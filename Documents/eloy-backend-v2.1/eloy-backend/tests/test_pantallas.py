"""Un test por pantalla de Bautista, más sincronización y permisos."""
from sqlalchemy import select, text

from app.db import SessionLocal
from app.models import Dispositivo, Evento, Familiar
from app.servicios.alertas import enviar_avisos_vencidos
from app.servicios.push import emisor
from tests.conftest import auth, nuevo_eloy, registrar


def sync(cliente, f, **cuerpo):
    r = cliente.post("/dispositivo/sync", json=cuerpo, headers=auth(f["pi"]))
    assert r.status_code == 200, r.text
    return r.json()


# ------------------------------------------------------------------ cuenta

def test_cuenta_login_refresh_logout(cliente):
    t = registrar(cliente, "Bautista", "bauti@ejemplo.com")
    assert cliente.post("/auth/registro", json={"nombre": "X", "email": "BAUTI@ejemplo.com",
                                                "password": "otra-clave-larga"}).status_code == 409
    assert cliente.post("/auth/login", json={"email": "bauti@ejemplo.com", "password": "mal"}).status_code == 401
    login = cliente.post("/auth/login", json={"email": "bauti@ejemplo.com", "password": "una-clave-larga"}).json()
    assert cliente.get("/auth/yo", headers=auth(login["access_token"])).json()["nombre"] == "Bautista"

    nuevo = cliente.post("/auth/refresh", json={"refresh_token": login["refresh_token"]}).json()
    # Rotación: el refresh viejo ya no sirve, y la sesión vieja tampoco.
    assert cliente.post("/auth/refresh", json={"refresh_token": login["refresh_token"]}).status_code == 401
    assert cliente.get("/auth/yo", headers=auth(login["access_token"])).status_code == 401
    assert cliente.get("/auth/yo", headers=auth(nuevo["access_token"])).status_code == 200

    # Cerrar sesión en todos lados corta también la del registro.
    assert cliente.post("/auth/logout?todas=true", headers=auth(nuevo["access_token"])).status_code == 204
    assert cliente.get("/auth/yo", headers=auth(t["access_token"])).status_code == 401


def test_login_limita_intentos(cliente):
    registrar(cliente, "Bautista", "bauti@ejemplo.com")
    for _ in range(5):
        cliente.post("/auth/login", json={"email": "bauti@ejemplo.com", "password": "mal-mal-mal"})
    r = cliente.post("/auth/login", json={"email": "bauti@ejemplo.com", "password": "una-clave-larga"})
    assert r.status_code == 429


# ------------------------------------------------------------------ vincular

def test_vincular_codigo_de_un_solo_uso(cliente):
    bauti = registrar(cliente, "Bautista", "bauti@ejemplo.com")
    pi = nuevo_eloy(cliente)
    codigo = cliente.post("/dispositivo/codigo", headers=auth(pi)).json()["codigo"]
    assert len(codigo) == 6
    r = cliente.post("/dispositivos/vincular", json={"codigo": codigo.lower(), "nombre_persona": "Marta"},
                     headers=auth(bauti["access_token"]))
    assert r.status_code == 201
    otro = registrar(cliente, "Intruso", "x@ejemplo.com")
    assert cliente.post("/dispositivos/vincular", json={"codigo": codigo},
                        headers=auth(otro["access_token"])).status_code == 404
    personas = cliente.get("/personas", headers=auth(bauti["access_token"])).json()
    assert personas[0]["nombre"] == "Marta" and personas[0]["mi_rol"] == "administrador"
    # Ya vinculado: no da más códigos.
    assert cliente.post("/dispositivo/codigo", headers=auth(pi)).status_code == 409


def test_codigo_vencido(cliente, reloj):
    bauti = registrar(cliente, "Bautista", "bauti@ejemplo.com")
    pi = nuevo_eloy(cliente)
    codigo = cliente.post("/dispositivo/codigo", headers=auth(pi)).json()["codigo"]
    reloj.avanzar(minutes=11)
    assert cliente.post("/dispositivos/vincular", json={"codigo": codigo},
                        headers=auth(bauti["access_token"])).status_code == 404


# ------------------------------------------------------------------ inicio

def test_inicio_como_en_la_pantalla(cliente, familia):
    f = familia
    rec = lambda i, t, h, **kw: {"id": i, "titulo": t, "horario": h, **kw}  # noqa: E731
    sync(cliente, f,
         recordatorios=[
             rec(1, "Pastilla de la presión", "09:00", descripcion="la blanca, con agua",
                 se_repite_diario=True, ultima_ejecucion="2026-10-18"),
             rec(2, "Almorzar", "13:00", dias_semana="todos", ultima_ejecucion="2026-10-18"),
             rec(3, "Pastilla de la tarde", "18:00", se_repite_diario=True, ultima_ejecucion="2026-10-17"),
         ],
         eventos=[  # 10:42, 12:10 y 13:30 en Argentina (UTC-3)
             {"id": 101, "tipo": "conversacion", "descripcion": "charló 9 minuto(s)", "ocurrio_en": "2026-10-18T13:42:00"},
             {"id": 102, "tipo": "conversacion", "descripcion": "charló 5 minuto(s)", "ocurrio_en": "2026-10-18T15:10:00"},
             {"id": 103, "tipo": "conversacion", "descripcion": "charló 4 minuto(s)", "ocurrio_en": "2026-10-18T16:30:00"},
             {"id": 104, "tipo": "conversacion", "descripcion": "charló 30 minuto(s)", "ocurrio_en": "2026-10-17T20:00:00"},
         ],
         resumenes=[{"fecha": "2026-10-17", "texto": "Charló un rato y contó que teje una bufanda para su nieta."}])

    i = cliente.get(f"/personas/{f['persona']}/inicio", headers=auth(f["bauti"])).json()
    assert i["estado"] == "bien"
    assert (i["charlas"], i["minutos"]) == (3, 18)
    assert (i["recordatorios_cumplidos"], i["recordatorios_total"]) == (2, 3)
    assert i["proximo_recordatorio"]["hora"] == "18:00"
    assert i["ultima_charla"].startswith("2026-10-18T16:30:00")
    assert i["resumen"]["es_de_hoy"] is False and "bufanda" in i["resumen"]["texto"]

    # Reenviar los mismos eventos no los duplica.
    sync(cliente, f, eventos=[{"id": 101, "tipo": "conversacion", "descripcion": "charló 9 minuto(s)",
                               "ocurrio_en": "2026-10-18T13:42:00"}])
    with SessionLocal() as db:
        assert db.scalar(text("SELECT COUNT(*) FROM eventos")) == 4


def test_inicio_atencion_y_sin_conexion(cliente, familia, reloj):
    f = familia
    sync(cliente, f, recordatorios=[{"id": 1, "titulo": "Pastilla", "horario": "13:00", "se_repite_diario": True}])
    i = cliente.get(f"/personas/{f['persona']}/inicio", headers=auth(f["vero"])).json()
    assert i["estado"] == "atencion"  # 14:00 y la de las 13:00 no sonó
    reloj.avanzar(minutes=6)
    i = cliente.get(f"/personas/{f['persona']}/inicio", headers=auth(f["vero"])).json()
    assert i["estado"] == "sin_conexion"


# ------------------------------------------------------------------ mensajes

def test_mensajes_ida_y_vuelta(cliente, familia, reloj):
    f = familia
    m = cliente.post(f"/personas/{f['persona']}/mensajes", json={"texto": "¿Te acordaste de la pastilla?"},
                     headers=auth(f["bauti"])).json()
    assert m["estado"] == "pendiente" and m["de"] == "Bautista" and m["es_mio"]

    resp = sync(cliente, f)
    assert [x["id"] for x in resp["mensajes"]] == [m["id"]]
    # La Pi lo guarda con id 55 y lo confirma.
    resp = sync(cliente, f, confirmaciones=[{"tabla": "mensajes", "id": m["id"], "id_local": 55}],
                mensajes=[{"id": 55, "direccion": "de_familia", "de": "Bautista", "texto": "¿Te acordaste de la pastilla?",
                           "creado": "2026-10-18 14:00:00", "entregado": False}])
    assert resp["mensajes"] == [] and resp["mensajes_esperando_lectura"] == [55]
    with SessionLocal() as db:
        assert db.scalar(text("SELECT COUNT(*) FROM mensajes")) == 1  # el incremental no lo duplicó

    reloj.avanzar(minutes=1)
    sync(cliente, f, mensajes_leidos=[55])
    hilo = cliente.get(f"/personas/{f['persona']}/mensajes", headers=auth(f["vero"])).json()
    assert hilo[0]["estado"] == "leido" and hilo[0]["leido_en"].startswith("2026-10-18T17:01")
    assert hilo[0]["es_mio"] is False  # lo ve Vero

    # Marta le dicta a Eloy, con audio.
    with open("/tmp/prueba.wav", "wb") as a:
        a.write(b"RIFF....WAVEfmt fake")
    with open("/tmp/prueba.wav", "rb") as a:
        key = cliente.post("/dispositivo/audio", files={"archivo": ("m.wav", a, "audio/wav")},
                           headers=auth(f["pi"])).json()["audio_key"]
    sync(cliente, f, mensajes=[{"id": 56, "direccion": "a_familia", "de": "Marta", "para": "Vero",
                                "texto": "Decile a Vero que el domingo la espero a comer",
                                "audio_key": key, "audio_duracion_seg": 4, "creado": "2026-10-18 14:01:00"}])
    hilo = cliente.get(f"/personas/{f['persona']}/mensajes", headers=auth(f["bauti"])).json()
    nuevo = hilo[0]
    assert nuevo["direccion"] == "a_familia" and nuevo["para"] == "Vero" and nuevo["creado_en"].startswith("2026-10-18T17:01")
    assert cliente.get(nuevo["audio_url"].replace("http://testserver", "")).content.startswith(b"RIFF")
    assert any(p["datos"]["tipo"] == "mensaje" for p in emisor().enviados)


# ------------------------------------------------------------------ recordatorios

def test_recordatorios_hoy_proximos_y_sync(cliente, familia):
    f = familia
    P = f"/personas/{f['persona']}/recordatorios"
    turno = cliente.post(P, json={"titulo": "Turno con la doctora", "hora": "10:00", "repeticion": "una_vez",
                                  "fecha_unica": "2026-10-23"}, headers=auth(f["vero"])).json()
    gym = cliente.post(P, json={"titulo": "Gimnasia", "hora": "17:00", "repeticion": "semanal",
                                "dias_semana": ["lunes", "jueves"]}, headers=auth(f["vero"])).json()
    assert cliente.post(P, json={"titulo": "X", "hora": "17:00", "repeticion": "semanal"},
                        headers=auth(f["vero"])).status_code == 422
    assert cliente.post(P, json={"titulo": "X", "hora": "25:00", "repeticion": "diaria"},
                        headers=auth(f["vero"])).status_code == 422

    lista = cliente.get(P, headers=auth(f["bauti"])).json()
    assert [(x["titulo"], x["proxima_fecha"]) for x in lista["proximos"]] == [
        ("Gimnasia", "2026-10-19"), ("Turno con la doctora", "2026-10-23")]

    # Viaja a Eloy, que lo guarda con ids 7 y 8.
    resp = sync(cliente, f)
    por_id = {x["id"]: x for x in resp["recordatorios"]}
    assert por_id[gym["id"]]["dias_semana"] == "lunes,jueves" and por_id[turno["id"]]["fecha"] == "2026-10-23"
    lista_pi = [
        {"id": 7, "titulo": "Turno con la doctora", "horario": "10:00", "fecha": "2026-10-23"},
        {"id": 8, "titulo": "Gimnasia", "horario": "17:00", "dias_semana": "lunes,jueves"},
    ]
    resp = sync(cliente, f, recordatorios=lista_pi, confirmaciones=[
        {"tabla": "recordatorios", "id": turno["id"], "id_local": 7, "version": por_id[turno["id"]]["version"]},
        {"tabla": "recordatorios", "id": gym["id"], "id_local": 8, "version": por_id[gym["id"]]["version"]}])
    assert resp["recordatorios"] == []
    with SessionLocal() as db:
        assert db.scalar(text("SELECT COUNT(*) FROM recordatorios")) == 2

    # La app cambia la hora; Eloy todavía manda la vieja: gana la app.
    cliente.patch(f"/recordatorios/{gym['id']}", json={"hora": "18:30"}, headers=auth(f["bauti"]))
    resp = sync(cliente, f, recordatorios=lista_pi)
    assert [x["horario"] for x in resp["recordatorios"]] == ["18:30"]
    assert cliente.get(P, headers=auth(f["bauti"])).json()["proximos"][0]["hora"] == "18:30"

    # Eloy borra el turno por voz -> desaparece en la app.
    sync(cliente, f, recordatorios=[{"id": 8, "titulo": "Gimnasia", "horario": "18:30", "dias_semana": "lunes,jueves"}],
         confirmaciones=[{"tabla": "recordatorios", "id": gym["id"], "id_local": 8,
                          "version": resp["recordatorios"][0]["version"]}])
    lista = cliente.get(P, headers=auth(f["bauti"])).json()
    assert [x["titulo"] for x in lista["proximos"]] == ["Gimnasia"] and lista["proximos"][0]["sincronizado"]

    # La app borra la gimnasia -> viaja como borrado.
    cliente.delete(f"/recordatorios/{gym['id']}", headers=auth(f["bauti"]))
    resp = sync(cliente, f)
    assert resp["recordatorios"][0]["eliminado"] is True and resp["recordatorios"][0]["id_local"] == 8


# ------------------------------------------------------------------ alerta

def test_alerta_escalado_y_ya_me_ocupo(cliente, familia, reloj):
    f = familia
    r = cliente.post("/dispositivo/alertas", headers=auth(f["pi"]), json={
        "id_local": 900, "motivo": "Me caí en la cocina y no me puedo levantar"})
    assert r.status_code == 201 and r.json()["nueva"]
    id_alerta = r.json()["id"]

    # El primer escalón (Bautista) salió ya, por BackgroundTasks, como push urgente.
    urgentes = [p for p in emisor().enviados if p["urgente"]]
    assert len(urgentes) == 1 and urgentes[0]["tokens"] == ["fcm-token-de-bauti-123"]
    assert urgentes[0]["titulo"] == "Marta pidió ayuda"

    i = cliente.get(f"/personas/{f['persona']}/inicio", headers=auth(f["vero"])).json()
    assert i["estado"] == "alerta" and i["id_alerta_abierta"] == id_alerta

    # Reenvío (por /alertas o por el sync como 'emergencia'): no se duplica.
    assert cliente.post("/dispositivo/alertas", headers=auth(f["pi"]), json={"id_local": 900}).json()["nueva"] is False
    sync(cliente, f, mensajes=[{"id": 900, "tipo": "emergencia", "texto": "Me caí", "creado": "2026-10-18 14:00:00"}])
    with SessionLocal() as db:
        assert db.scalar(text("SELECT COUNT(*) FROM alertas_sos")) == 1

    # A los 2 minutos, sigue abierta: sale Vero. Juan no tiene cuenta (WhatsApp sin configurar).
    reloj.avanzar(minutes=2)
    with SessionLocal() as db:
        assert enviar_avisos_vencidos(db) == 1
    reloj.avanzar(minutes=2)
    with SessionLocal() as db:
        enviar_avisos_vencidos(db)
        juan = db.execute(text("SELECT canal, error FROM notificaciones_alerta WHERE nivel = 3")).one()
        assert juan.canal == "whatsapp" and "no configurado" in juan.error

    a = cliente.get(f"/alertas/{id_alerta}", headers=auth(f["vero"])).json()
    assert a["telefono_persona"] is None and [x["nombre"] for x in a["tambien_avisamos_a"]] == ["Bautista"]

    # "Ya me ocupo yo": el primero gana, el segundo ve quién.
    assert cliente.post(f"/alertas/{id_alerta}/atender", headers=auth(f["bauti"])).status_code == 200
    r = cliente.post(f"/alertas/{id_alerta}/atender", headers=auth(f["vero"]))
    assert r.status_code == 409 and "Bautista" in r.json()["detail"]
    assert any(p["titulo"] == "Bautista se ocupa" for p in emisor().enviados)

    a = cliente.post(f"/alertas/{id_alerta}/cerrar", json={"nota": "Fui, se resbaló, está bien"},
                     headers=auth(f["bauti"])).json()
    assert a["estado"] == "cerrada" and a["atendida_por_mi"]
    assert cliente.get(f"/personas/{f['persona']}/inicio", headers=auth(f["vero"])).json()["estado"] == "bien"


def test_alerta_atendida_no_escala(cliente, familia, reloj):
    f = familia
    id_alerta = cliente.post("/dispositivo/alertas", headers=auth(f["pi"]), json={"id_local": 1}).json()["id"]
    cliente.post(f"/alertas/{id_alerta}/atender", headers=auth(f["bauti"]))
    reloj.avanzar(minutes=10)
    with SessionLocal() as db:
        assert enviar_avisos_vencidos(db) == 0


# ------------------------------------------------------------------ familia

def test_familia_roles_e_invitacion(cliente, familia):
    f = familia
    fam = cliente.get(f"/personas/{f['persona']}/familia", headers=auth(f["vero"])).json()
    assert [(x["nombre"], x["rol"], x["tiene_cuenta"]) for x in fam["familiares"]] == [
        ("Bautista", "administrador", True), ("Vero", "familiar", True), ("Juan", "familiar", False)]
    d = fam["dispositivos"][0]
    assert d["conectado"] and d["wifi_ssid"] == "Casa de Marta" and d["volumen"] == 70

    # Vero no es administradora.
    assert cliente.post(f"/personas/{f['persona']}/invitaciones", json={},
                        headers=auth(f["vero"])).status_code == 403
    assert cliente.patch(f"/familiares/{f['ids']['Juan']}", json={"prioridad_alerta": 1},
                         headers=auth(f["vero"])).status_code == 403
    # Bautista no puede dejar de ser el único administrador.
    assert cliente.patch(f"/familiares/{f['ids']['Bautista']}", json={"rol": "familiar"},
                         headers=auth(f["bauti"])).status_code == 409
    # Cambiar el teléfono de Juan viaja a Eloy.
    cliente.patch(f"/familiares/{f['ids']['Juan']}", json={"telefono": "1199999999"}, headers=auth(f["bauti"]))
    resp = sync(cliente, f)
    assert [(x["nombre"], x["numero_whatsapp"], x["id_local"]) for x in resp["familiares"]] == [("Juan", "1199999999", 3)]

    # Invitación nueva (alguien que no estaba): se crea el familiar al aceptar.
    inv = cliente.post(f"/personas/{f['persona']}/invitaciones", json={"rol": "familiar"},
                       headers=auth(f["bauti"])).json()
    assert inv["link"].endswith(inv["codigo"])
    tia = registrar(cliente, "Tía Ana", "ana@ejemplo.com")
    r = cliente.post("/invitaciones/aceptar", json={"codigo": inv["codigo"]}, headers=auth(tia["access_token"]))
    assert r.status_code == 200 and r.json()["nombre"] == "Marta"
    assert cliente.post("/invitaciones/aceptar", json={"codigo": inv["codigo"]},
                        headers=auth(tia["access_token"])).status_code == 404


def test_permisos_entre_familias(cliente, familia):
    f = familia
    ajeno = registrar(cliente, "Ajeno", "ajeno@ejemplo.com")
    h = auth(ajeno["access_token"])
    assert cliente.get(f"/personas/{f['persona']}/inicio", headers=h).status_code == 403
    assert cliente.get(f"/personas/{f['persona']}/mensajes", headers=h).status_code == 403
    assert cliente.get("/personas", headers=h).json() == []
    # Un token de app no sirve como token de dispositivo y viceversa.
    assert cliente.post("/dispositivo/sync", json={}, headers=auth(f["bauti"])).status_code == 401
    assert cliente.get("/personas", headers=auth(f["pi"])).status_code == 401


def test_borrar_familiar_desde_la_voz_no_quita_la_cuenta(cliente, familia):
    f = familia
    # La Pi ya no tiene a Vero (la borraron por voz): conserva el acceso a la app.
    sync(cliente, f, familiares=[
        {"id": 1, "nombre": "Bautista", "relacion": "hijo", "numero_whatsapp": "1155550001", "numero_prioridad": 1},
        {"id": 3, "nombre": "Juan", "relacion": "nieto", "numero_whatsapp": "1155550003", "numero_prioridad": 3}])
    assert cliente.get(f"/personas/{f['persona']}/inicio", headers=auth(f["vero"])).status_code == 200
    # A Juan (sin cuenta) sí se lo borra si desaparece.
    sync(cliente, f, familiares=[
        {"id": 1, "nombre": "Bautista", "relacion": "hijo", "numero_whatsapp": "1155550001", "numero_prioridad": 1}])
    nombres = [x["nombre"] for x in cliente.get(f"/personas/{f['persona']}/familia",
                                                headers=auth(f["bauti"])).json()["familiares"]]
    assert nombres == ["Bautista", "Vero"]


# ------------------------------------------------------------------ memoria y restaurar

def test_memoria_y_restaurar_de_fabrica(cliente, familia):
    f = familia
    sync(cliente, f, memoria=[{"clave": "nieta", "valor": "Sofi, 8 años"}, {"clave": "comida_favorita", "valor": "ñoquis"}],
         eventos=[{"id": 1, "tipo": "conversacion", "descripcion": "charló 4 minuto(s)", "ocurrio_en": "2026-10-18T13:00:00"}])
    assert len(cliente.get(f"/personas/{f['persona']}/memoria", headers=auth(f["vero"])).json()) == 2

    # Borrar un dato: se va ya y Eloy recibe el comando. Mientras, la lista vieja no lo revive.
    assert cliente.delete(f"/personas/{f['persona']}/memoria/nieta", headers=auth(f["bauti"])).status_code == 204
    resp = sync(cliente, f, memoria=[{"clave": "nieta", "valor": "Sofi, 8 años"}, {"clave": "comida_favorita", "valor": "ñoquis"}])
    assert [c["tipo"] for c in resp["comandos"]] == ["borrar_memoria"]
    assert [m["clave"] for m in cliente.get(f"/personas/{f['persona']}/memoria", headers=auth(f["vero"])).json()] == ["comida_favorita"]
    sync(cliente, f, comandos=[{"id": resp["comandos"][0]["id"], "estado": "ejecutado"}])

    # Restaurar: solo administrador y con confirmación.
    D = f"/dispositivos/{f['dispositivo']}/restaurar"
    assert cliente.post(D, json={"confirmacion": "RESTAURAR"}, headers=auth(f["vero"])).status_code == 403
    assert cliente.post(D, json={"confirmacion": "si"}, headers=auth(f["bauti"])).status_code == 422
    assert cliente.post(D, json={"confirmacion": "RESTAURAR"}, headers=auth(f["bauti"])).status_code == 202

    # Antes de ejecutar, Eloy sincroniza con ids viejos: no se guarda nada (ni se duplica).
    resp = sync(cliente, f, eventos=[{"id": 2, "tipo": "conversacion", "descripcion": "charló 1 minuto(s)",
                                      "ocurrio_en": "2026-10-18T16:00:00"}])
    cmd = next(c for c in resp["comandos"] if c["tipo"] == "restaurar_fabrica")
    with SessionLocal() as db:
        assert db.scalar(text("SELECT COUNT(*) FROM eventos")) == 1

    # Eloy confirma: queda desvinculado, el historial se conserva sin id_local.
    resp = sync(cliente, f, comandos=[{"id": cmd["id"], "estado": "ejecutado"}])
    assert resp["vinculado"] is False
    with SessionLocal() as db:
        d = db.get(Dispositivo, f["dispositivo"])
        assert d.id_persona_mayor is None and d.wifi_ssid is None
        assert db.scalar(select(Evento.id_local)) is None
        assert db.scalar(text("SELECT COUNT(*) FROM memoria_agente")) == 0
        assert all(x.pendiente_sync for x in db.scalars(select(Familiar)))
    # Puede volver a vincularse a la misma persona: se le reenvían los familiares.
    codigo = cliente.post("/dispositivo/codigo", headers=auth(f["pi"])).json()["codigo"]
    assert cliente.post("/dispositivos/vincular", json={"codigo": codigo, "id_persona": f["persona"]},
                        headers=auth(f["bauti"])).status_code == 201
    resp = sync(cliente, f)
    assert {x["nombre"] for x in resp["familiares"]} == {"Bautista", "Vero", "Juan"}
    assert all(x["id_local"] is None for x in resp["familiares"])


def test_volumen_por_comando(cliente, familia):
    f = familia
    assert cliente.patch(f"/dispositivos/{f['dispositivo']}", json={"volumen": 50},
                         headers=auth(f["bauti"])).status_code == 202
    resp = sync(cliente, f)
    assert resp["comandos"][0]["parametros"] == {"volumen": 50}
    resp = sync(cliente, f, estado={"volumen": 50}, comandos=[{"id": resp["comandos"][0]["id"], "estado": "ejecutado"}])
    assert resp["comandos"] == []
    fam = cliente.get(f"/personas/{f['persona']}/familia", headers=auth(f["bauti"])).json()
    assert fam["dispositivos"][0]["volumen"] == 50
