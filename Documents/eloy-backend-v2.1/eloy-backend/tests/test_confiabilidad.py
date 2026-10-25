"""v2.1: qué pasa cuando un aviso falla, cuando nadie atiende y cuando la config es insegura."""
import hashlib
import hmac
import json

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import text

from app.config import SECRETO_DE_FABRICA, Settings, settings
from app.db import SessionLocal
from app.servicios.alertas import enviar_avisos_vencidos, repetir_avisos
from app.servicios.mantenimiento import limpiar_datos_viejos
from app.servicios.push import EmisorCombinado, PushExpo, PushLog, emisor
from tests.conftest import auth, nuevo_eloy, registrar

# En `familia`: Bautista (admin, nivel 1, sale ya), Vero (nivel 2, a los 2 min), Juan (nivel 3, sin cuenta).


def crear_alerta(cliente, f, id_local=1, **extra) -> int:
    r = cliente.post("/dispositivo/alertas", headers=auth(f["pi"]),
                     json={"id_local": id_local, "motivo": "Me caí en la cocina", **extra})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def avisos():
    with SessionLocal() as db:
        return [tuple(r) for r in db.execute(text(
            "SELECT nivel, enviada_en IS NOT NULL AS enviada, error FROM notificaciones_alerta ORDER BY nivel"))]


def ejecutar(funcion, *args):
    with SessionLocal() as db:
        return funcion(db, *args)


# ------------------------------------------------------------ reintentos

def test_si_el_push_falla_un_momento_el_aviso_se_reintenta(cliente, familia, reloj, monkeypatch):
    llamadas = []

    def sin_internet(*a, **k):
        llamadas.append(1)
        raise ConnectionError("sin internet")

    original = emisor().enviar
    monkeypatch.setattr(emisor(), "enviar", sin_internet)
    crear_alerta(cliente, familia)
    assert len(llamadas) == 1
    assert avisos()[0] == (1, False, None)          # sigue pendiente, SIN error definitivo

    assert ejecutar(enviar_avisos_vencidos) == 0     # recién falló: espera antes de reintentar
    assert len(llamadas) == 1

    monkeypatch.setattr(emisor(), "enviar", original)  # vuelve internet
    reloj.avanzar(seconds=20)
    assert ejecutar(enviar_avisos_vencidos) == 1
    assert avisos()[0] == (1, True, None)


def test_si_el_familiar_registra_el_celular_despues_igual_recibe_el_aviso(cliente, familia, reloj):
    with SessionLocal() as db:
        db.execute(text("DELETE FROM tokens_push"))
        db.commit()
    crear_alerta(cliente, familia)
    assert avisos()[0] == (1, False, None)           # no hay celular: queda esperando, no se pierde

    cliente.post("/push/token", json={"token": "fcm-token-tardio-1234", "plataforma": "android"},
                 headers=auth(familia["bauti"]))
    reloj.avanzar(seconds=20)
    assert ejecutar(enviar_avisos_vencidos) == 1
    assert avisos()[0] == (1, True, None)
    assert emisor().enviados[-1]["tokens"] == ["fcm-token-tardio-1234"]


def test_una_alerta_que_eloy_reporta_tarde_igual_avisa(cliente, familia):
    """Eloy estuvo sin internet: la alerta 'ocurrió' hace 3 horas pero el servidor la recibe ahora."""
    crear_alerta(cliente, familia, ocurrida_en="2026-10-18T11:00:00Z")
    assert avisos()[0] == (1, True, None)


def test_pasada_la_vigencia_los_avisos_que_siguen_fallando_se_descartan(cliente, familia, reloj, monkeypatch):
    monkeypatch.setattr(emisor(), "enviar", lambda *a, **k: (_ for _ in ()).throw(ConnectionError("caído")))
    crear_alerta(cliente, familia)
    reloj.avanzar(minutes=settings.aviso_vigencia_minutos + 1)
    ejecutar(enviar_avisos_vencidos)
    assert avisos()[0][2].startswith("descartado")


# ------------------------------------------------------------ nadie atiende

def test_si_nadie_atiende_se_vuelve_a_avisar(cliente, familia, reloj):
    crear_alerta(cliente, familia)
    reloj.avanzar(minutes=3)
    ejecutar(enviar_avisos_vencidos)                 # a los 2 min sale Vero
    antes = len(emisor().enviados)
    assert ejecutar(repetir_avisos) == 1
    repeticion = emisor().enviados[antes]
    assert repeticion["titulo"] == "Marta sigue necesitando ayuda" and repeticion["urgente"]
    assert repeticion["datos"]["repeticion"] == 1
    assert sorted(repeticion["tokens"]) == ["fcm-token-de-bauti-123", "fcm-token-de-vero-123"]
    assert ejecutar(repetir_avisos) == 0              # no se repite dos veces a la vez


def test_el_reaviso_se_frena_cuando_alguien_atiende(cliente, familia, reloj):
    id_alerta = crear_alerta(cliente, familia)
    cliente.post(f"/alertas/{id_alerta}/atender", headers=auth(familia["bauti"]))
    reloj.avanzar(minutes=10)
    assert ejecutar(repetir_avisos) == 0


def test_los_reavisos_tienen_un_tope(cliente, familia, reloj, monkeypatch):
    monkeypatch.setattr(settings, "reavisos_maximos", 2)
    crear_alerta(cliente, familia)
    repetidos = 0
    for _ in range(6):
        reloj.avanzar(minutes=settings.reaviso_minutos)
        repetidos += ejecutar(repetir_avisos)
    assert repetidos == 2
    with SessionLocal() as db:
        assert db.scalar(text("SELECT avisos_repetidos FROM alertas_sos")) == 2


# ------------------------------------------------------------ push por Expo (iPhone)

def _expo_simulado(pedidos, respuesta=None, estado=200):
    def manejar(pedido: httpx.Request) -> httpx.Response:
        mensajes = json.loads(pedido.content)
        pedidos.append(mensajes)
        cuerpo = respuesta(mensajes) if respuesta else {"data": [{"status": "ok", "id": "t"} for _ in mensajes]}
        return httpx.Response(estado, json=cuerpo)
    return PushExpo(transporte=httpx.MockTransport(manejar))


def test_expo_manda_en_lotes_y_reconoce_tokens_muertos():
    pedidos = []
    expo = _expo_simulado(pedidos, lambda ms: {"data": [
        {"status": "ok"} if i else {"status": "error", "details": {"error": "DeviceNotRegistered"}}
        for i, _ in enumerate(ms)]})
    tokens = [f"ExponentPushToken[t{i:04d}]" for i in range(150)]
    ok, invalidos = expo.enviar(tokens, "t", "c", {"id_alerta": 1}, urgente=True)
    assert [len(p) for p in pedidos] == [100, 50]    # Expo acepta hasta 100 por pedido
    assert ok == 148 and invalidos == [tokens[0], tokens[100]]
    assert pedidos[0][0]["priority"] == "high" and pedidos[0][0]["channelId"] == "alertas"


def test_expo_caido_lanza_error_para_que_se_reintente():
    with pytest.raises(RuntimeError):
        _expo_simulado([], estado=503).enviar(["ExponentPushToken[abc]"], "t", "c", {})


def test_el_repartidor_manda_cada_token_por_su_camino():
    pedidos = []
    combinado = EmisorCombinado(fcm=None, expo=_expo_simulado(pedidos))
    ok, _ = combinado.enviar(["ExponentPushToken[iphone]", "token-nativo-android"], "t", "c", {})
    assert ok == 2
    assert [m["to"] for p in pedidos for m in p] == ["ExponentPushToken[iphone]"]   # el de Expo, por Expo
    assert combinado.enviados[0]["tokens"] == ["token-nativo-android"]            # el otro, al log (sin FCM)


def test_si_un_camino_falla_el_otro_igual_sale_y_si_fallan_todos_se_avisa():
    class Roto:
        def enviar(self, *a, **k):
            raise ConnectionError("caído")

    parcial = EmisorCombinado(fcm=PushLog(), expo=Roto())
    assert parcial.enviar(["ExponentPushToken[a]", "fcm-1"], "t", "c", {})[0] == 1
    with pytest.raises(ConnectionError):
        EmisorCombinado(fcm=None, expo=Roto()).enviar(["ExponentPushToken[a]"], "t", "c", {})


def test_alerta_de_punta_a_punta_con_un_iphone_por_expo(cliente, familia, monkeypatch):
    pedidos = []
    monkeypatch.setattr(emisor(), "_expo", _expo_simulado(pedidos))
    cliente.post("/push/token", json={"token": "ExponentPushToken[iphone-de-bauti]", "plataforma": "ios"},
                 headers=auth(familia["bauti"]))
    crear_alerta(cliente, familia)
    mensaje = pedidos[0][0]
    assert mensaje["to"] == "ExponentPushToken[iphone-de-bauti]"
    assert mensaje["title"] == "Marta pidió ayuda" and mensaje["priority"] == "high"
    assert avisos()[0] == (1, True, None)


def test_token_de_expo_muerto_se_desactiva(cliente, familia, monkeypatch):
    respuesta = lambda ms: {"data": [{"status": "error", "details": {"error": "DeviceNotRegistered"}} for _ in ms]}  # noqa: E731
    monkeypatch.setattr(emisor(), "_expo", _expo_simulado([], respuesta))
    cliente.post("/push/token", json={"token": "ExponentPushToken[muerto-1234]", "plataforma": "ios"},
                 headers=auth(familia["bauti"]))
    crear_alerta(cliente, familia)
    with SessionLocal() as db:
        assert db.scalar(text("SELECT activo FROM tokens_push WHERE token = 'ExponentPushToken[muerto-1234]'")) == 0


# ------------------------------------------------------------ permisos

def test_cerrar_una_alerta_exige_ser_quien_la_atendio_o_administrador(cliente, familia):
    f = familia
    sin_atender = crear_alerta(cliente, f, id_local=1)
    # Vero es familiar común: no puede cerrar una alerta que nadie atendió...
    assert cliente.post(f"/alertas/{sin_atender}/cerrar", json={}, headers=auth(f["vero"])).status_code == 403
    # ...ni una que atendió otro.
    cliente.post(f"/alertas/{sin_atender}/atender", headers=auth(f["bauti"]))
    assert cliente.post(f"/alertas/{sin_atender}/cerrar", json={}, headers=auth(f["vero"])).status_code == 403
    # Quien la atendió sí, y una sola vez.
    assert cliente.post(f"/alertas/{sin_atender}/cerrar", json={}, headers=auth(f["bauti"])).status_code == 200
    assert cliente.post(f"/alertas/{sin_atender}/cerrar", json={}, headers=auth(f["bauti"])).status_code == 409

    # Un administrador puede cerrar una falsa alarma sin haberla atendido; queda como quien la cerró.
    falsa = crear_alerta(cliente, f, id_local=2)
    r = cliente.post(f"/alertas/{falsa}/cerrar", json={"nota": "Falsa alarma"}, headers=auth(f["bauti"]))
    assert r.status_code == 200 and r.json()["atendida_por_mi"]


def test_quien_no_es_de_la_familia_recibe_404_igual_que_si_no_existiera(cliente, familia):
    f = familia
    id_alerta = crear_alerta(cliente, f)
    ajeno = auth(registrar(cliente, "Ajeno", "ajeno@ejemplo.com")["access_token"])
    existente = [cliente.get(f"/alertas/{id_alerta}", headers=ajeno),
                 cliente.post(f"/alertas/{id_alerta}/atender", headers=ajeno),
                 cliente.post(f"/alertas/{id_alerta}/cerrar", json={}, headers=ajeno)]
    inexistente = [cliente.get("/alertas/99999", headers=ajeno),
                   cliente.post("/alertas/99999/atender", headers=ajeno),
                   cliente.post("/alertas/99999/cerrar", json={}, headers=ajeno)]
    assert [r.status_code for r in existente] == [404, 404, 404]
    assert [r.json() for r in existente] == [r.json() for r in inexistente]
    # Lo mismo con recordatorios, familiares y dispositivos pedidos por id.
    assert cliente.patch("/recordatorios/1", json={"titulo": "x"}, headers=ajeno).status_code == 404
    assert cliente.patch("/familiares/1", json={"nombre": "x"}, headers=ajeno).status_code == 404
    assert cliente.patch(f"/dispositivos/{f['dispositivo']}", json={"volumen": 10}, headers=ajeno).status_code == 404


def test_el_dispositivo_tiene_limite_de_intentos(cliente, familia):
    for _ in range(10):
        r = cliente.post("/dispositivo/token", json={"uid_serie": "eloy-b8:27:eb:00:00:01", "secret": "x" * 40})
        assert r.status_code == 401
    assert cliente.post("/dispositivo/token", json={"uid_serie": "eloy-b8:27:eb:00:00:01", "secret": "x" * 40}
                        ).status_code == 429
    for _ in range(10):
        assert cliente.post("/dispositivo/registro", json={"uid_serie": "eloy-nuevo", "secret": "s" * 40},
                            headers={"X-Provisioning-Key": "clave-equivocada"}).status_code == 403
    assert cliente.post("/dispositivo/registro", json={"uid_serie": "eloy-nuevo", "secret": "s" * 40},
                        headers={"X-Provisioning-Key": "clave-equivocada"}).status_code == 429


def test_los_links_de_audio_no_se_firman_con_el_jwt_secret_crudo():
    from app.servicios.almacenamiento import _firma
    cruda = hmac.new(settings.jwt_secret.encode(), b"a.wav:123", hashlib.sha256).hexdigest()
    assert _firma("a.wav", 123) != cruda


# ------------------------------------------------------------ arranque seguro

def test_en_produccion_el_servidor_no_arranca_con_secretos_de_fabrica():
    largo = "x" * 40
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(_env_file=None, entorno="produccion", jwt_secret=SECRETO_DE_FABRICA, provisioning_key=largo)
    with pytest.raises(ValidationError, match="menos de 32"):
        Settings(_env_file=None, entorno="produccion", jwt_secret="corto", provisioning_key=largo)
    with pytest.raises(ValidationError, match="distintas"):
        Settings(_env_file=None, entorno="produccion", jwt_secret=largo, provisioning_key=largo)
    with pytest.raises(ValidationError, match="push"):
        Settings(_env_file=None, entorno="produccion", jwt_secret=largo, provisioning_key="y" * 40,
                 push_expo=False, fcm_credenciales=None)
    ok = Settings(_env_file=None, entorno="produccion", jwt_secret=largo, provisioning_key="y" * 40)
    assert ok.entorno == "produccion"
    Settings(_env_file=None)   # en desarrollo arranca con los valores de fábrica (solo avisa en el log)


def test_un_fcm_mal_configurado_rompe_el_arranque_y_no_la_primera_alerta(monkeypatch):
    from app.main import app
    emisor.cache_clear()
    monkeypatch.setattr(settings, "fcm_credenciales", "/ruta/que/no/existe.json")
    try:
        with pytest.raises(Exception):  # noqa: B017 - firebase tira FileNotFoundError / ValueError
            with TestClient(app):
                pass
    finally:
        monkeypatch.undo()
        emisor.cache_clear()


# ------------------------------------------------------------ limpieza

def test_la_limpieza_borra_sesiones_y_codigos_viejos_y_deja_los_vigentes(cliente, reloj):
    registrar(cliente, "Viejo", "viejo@ejemplo.com")          # abre una sesión (vence a los 30 días)
    nuevo_eloy(cliente)
    cliente.post("/dispositivo/codigo", headers=auth(nuevo_eloy(cliente, "eloy-otro-0002")))
    assert ejecutar(limpiar_datos_viejos) == {"sesiones": 0, "codigos": 0}

    reloj.avanzar(days=40)                                    # sesión vencida hace >7 días, código hace >1 día
    registrar(cliente, "Reciente", "reciente@ejemplo.com")    # esta sesión sí está vigente
    assert ejecutar(limpiar_datos_viejos) == {"sesiones": 1, "codigos": 1}
    with SessionLocal() as db:
        assert db.scalar(text("SELECT COUNT(*) FROM sesiones")) == 1
