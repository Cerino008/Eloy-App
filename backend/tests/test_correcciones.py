"""v2.2: respuestas en camelCase, código de invitación corto, mensajes para toda la familia
y vencimiento del código de vinculación con zona."""
import app.routers.personas as rutas_personas
from app.seguridad import _ALFABETO_CODIGO
from tests.conftest import auth, nuevo_eloy, registrar


def sync(cliente, f, **cuerpo):
    r = cliente.post("/dispositivo/sync", json=cuerpo, headers=auth(f["pi"]))
    assert r.status_code == 200, r.text
    return r.json()


def claves_snake(dato) -> set[str]:
    """Las claves con guion bajo, en cualquier nivel del JSON."""
    if isinstance(dato, dict):
        return {k for k in dato if "_" in k} | set().union(*(claves_snake(v) for v in dato.values()))
    if isinstance(dato, list):
        return set().union(*(claves_snake(v) for v in dato))
    return set()


# ------------------------------------------------------------------ camelCase

def test_respuestas_de_la_app_en_camel_case(cliente, familia):
    f = familia
    h = auth(f["bauti"])
    cliente.post(f"/personas/{f['persona']}/mensajes", json={"texto": "Hola, ma"}, headers=h)
    cliente.post(f"/personas/{f['persona']}/recordatorios", json={"titulo": "Gimnasia", "hora": "17:00",
                                                                  "repeticion": "semanal", "dias_semana": ["lunes"]}, headers=h)
    id_alerta = cliente.post("/dispositivo/alertas", headers=auth(f["pi"]), json={"id_local": 1}).json()["id"]

    respuestas = {ruta: cliente.get(ruta, headers=h).json() for ruta in (
        "/auth/yo", "/personas", f"/personas/{f['persona']}/inicio", f"/personas/{f['persona']}/mensajes",
        f"/personas/{f['persona']}/recordatorios", f"/personas/{f['persona']}/familia", f"/alertas/{id_alerta}")}
    for ruta, cuerpo in respuestas.items():
        assert claves_snake(cuerpo) == set(), ruta

    inicio = respuestas[f"/personas/{f['persona']}/inicio"]
    assert inicio["idAlertaAbierta"] == id_alerta and "recordatoriosCumplidos" in inicio
    assert respuestas[f"/personas/{f['persona']}/mensajes"][0]["esMio"] is True
    familia_ = respuestas[f"/personas/{f['persona']}/familia"]
    assert familia_["miRol"] == "administrador" and familia_["familiares"][0]["soyYo"]
    assert familia_["dispositivos"][0]["wifiSsid"] == "Casa de Marta"
    assert registrar(cliente, "Otra", "otra@ejemplo.com").keys() == {"accessToken", "refreshToken", "tokenType", "expiraEnSeg"}


def test_la_entrada_acepta_camel_case_y_snake_case(cliente, familia):
    f = familia
    h = auth(f["bauti"])
    P = f"/personas/{f['persona']}/recordatorios"
    for dias in ({"diasSemana": ["lunes"]}, {"dias_semana": ["jueves"]}):
        r = cliente.post(P, json={"titulo": "Gimnasia", "hora": "17:00", "repeticion": "semanal", **dias}, headers=h)
        assert r.status_code == 201, r.text
    assert sorted(r["diasSemana"][0] for r in cliente.get(P, headers=h).json()["proximos"]) == ["jueves", "lunes"]

    # Los PATCH arman el cambio con model_dump: tiene que andar igual con el nombre en camelCase.
    r = cliente.patch(f"/familiares/{f['ids']['Juan']}", json={"prioridadAlerta": 9}, headers=h)
    assert r.status_code == 200 and r.json()["prioridadAlerta"] == 9

    login = cliente.post("/auth/login", json={"email": "bauti@ejemplo.com", "password": "una-clave-larga",
                                              "nombreEquipo": "iPhone de Bautista"}).json()
    r = cliente.post("/auth/refresh", json={"refreshToken": login["refreshToken"]})
    assert r.status_code == 200 and r.json()["accessToken"]


def test_el_contrato_con_la_raspberry_sigue_en_snake_case(cliente, familia):
    f = familia
    resp = sync(cliente, f)
    assert {"mensajes_esperando_lectura", "id_persona", "zona_horaria"} <= resp.keys()
    pi = nuevo_eloy(cliente, uid="eloy-b8:27:eb:00:00:02")  # usa /dispositivo/token -> access_token
    assert cliente.post("/dispositivo/codigo", headers=auth(pi)).json().keys() == {"codigo", "expira_en"}


# ------------------------------------------------------------------ invitación con código corto

def invitar(cliente, f, **cuerpo):
    r = cliente.post(f"/personas/{f['persona']}/invitaciones", json=cuerpo, headers=auth(f["bauti"]))
    assert r.status_code == 201, r.text
    return r.json()


def test_codigo_de_invitacion_de_8_caracteres(cliente, familia):
    inv = invitar(cliente, familia)
    assert len(inv["codigo"]) == 8 and set(inv["codigo"]) <= set(_ALFABETO_CODIGO)
    assert inv["link"].endswith("?codigo=" + inv["codigo"])
    assert inv["expiraEn"] == "2026-10-25T17:00:00Z"  # 7 días, con zona

    # Escrito a mano, en minúscula y con espacios, también sirve.
    tia = registrar(cliente, "Tía Ana", "ana@ejemplo.com")
    r = cliente.post("/invitaciones/aceptar", json={"codigo": f"  {inv['codigo'].lower()} "},
                     headers=auth(tia["accessToken"]))
    assert r.status_code == 200 and r.json()["nombre"] == "Marta"


def test_aceptar_invitacion_valida_el_largo(cliente, familia):
    tia = auth(registrar(cliente, "Tía Ana", "ana@ejemplo.com")["accessToken"])
    for codigo in ("ABCDEFG", "ABCDEFGHJ", "x" * 32):
        assert cliente.post("/invitaciones/aceptar", json={"codigo": codigo}, headers=tia).status_code == 422


def test_aceptar_invitacion_limita_intentos(cliente, familia):
    inv = invitar(cliente, familia)
    tia = auth(registrar(cliente, "Tía Ana", "ana@ejemplo.com")["accessToken"])
    for _ in range(5):
        assert cliente.post("/invitaciones/aceptar", json={"codigo": "ZZZZZZZZ"}, headers=tia).status_code == 404
    # Bloqueada, aunque ahora pruebe con el código bueno.
    r = cliente.post("/invitaciones/aceptar", json={"codigo": inv["codigo"]}, headers=tia)
    assert r.status_code == 429
    # El límite es por usuario: otro sigue pudiendo.
    primo = auth(registrar(cliente, "Primo", "primo@ejemplo.com")["accessToken"])
    assert cliente.post("/invitaciones/aceptar", json={"codigo": inv["codigo"]}, headers=primo).status_code == 200


def test_invitacion_si_el_codigo_se_repite_prueba_otro(cliente, familia, monkeypatch):
    codigos = iter(["ABCDEFGH", "ABCDEFGH", "HJKMNPQR"])
    monkeypatch.setattr(rutas_personas, "codigo_invitacion", lambda: next(codigos))
    assert invitar(cliente, familia)["codigo"] == "ABCDEFGH"
    assert invitar(cliente, familia)["codigo"] == "HJKMNPQR"


# ------------------------------------------------------------------ mensajes para toda la familia

def test_mensaje_para_toda_la_familia_tiene_para_null(cliente, familia):
    f = familia
    sync(cliente, f, mensajes=[
        {"id": 60, "direccion": "a_familia", "de": "Marta", "texto": "Hoy fui a la plaza", "creado": "2026-10-18 13:00:00"},
        {"id": 61, "direccion": "a_familia", "de": "Marta", "para": "Vero", "texto": "El domingo te espero",
         "creado": "2026-10-18 13:30:00"}])
    hilo = cliente.get(f"/personas/{f['persona']}/mensajes", headers=auth(f["bauti"])).json()
    assert [(m["texto"], m["para"]) for m in hilo] == [("El domingo te espero", "Vero"), ("Hoy fui a la plaza", None)]


# ------------------------------------------------------------------ código de vinculación con zona

def test_codigo_de_vinculacion_vence_en_utc_con_zona(cliente):
    pi = nuevo_eloy(cliente)
    r = cliente.post("/dispositivo/codigo", headers=auth(pi))
    assert r.status_code == 201 and r.json()["expira_en"] == "2026-10-18T17:10:00Z"
