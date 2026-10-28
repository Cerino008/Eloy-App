"""Los tests corren contra MySQL/MariaDB de verdad (el esquema usa SET, ENUM, CHECK...).
Variable TEST_DATABASE_URL; por defecto una base eloy_test local."""
import os
import tempfile
from datetime import datetime, timezone

os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "mysql+pymysql://eloy:eloy@localhost:3306/eloy_test?charset=utf8mb4")
os.environ["WORKER_ACTIVO"] = "false"
os.environ["FCM_CREDENCIALES"] = ""
os.environ["ALMACENAMIENTO"] = "local"
os.environ["MEDIA_DIR"] = tempfile.mkdtemp()
os.environ["URL_PUBLICA"] = "http://testserver"
os.environ["PROVISIONING_KEY"] = "clave-de-fabrica-para-los-tests-0123456789"
os.environ["JWT_SECRET"] = "secreto-jwt-para-los-tests-que-tiene-mas-de-32-caracteres"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402

from app import tiempo  # noqa: E402
from app.config import settings  # noqa: E402
from app.db import engine  # noqa: E402
from app.seguridad import (  # noqa: E402
    limitador_dispositivo, limitador_invitacion, limitador_login, limitador_vincular,
)
from app.servicios.alertas import _ultimo_intento  # noqa: E402
from app.servicios.push import emisor  # noqa: E402
from scripts.init_db import crear  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def base_de_datos():
    url = make_url(settings.database_url)
    servidor = create_engine(url.set(database=""))
    with servidor.begin() as con:
        con.execute(text(f"DROP DATABASE IF EXISTS `{url.database}`"))
        con.execute(text(f"CREATE DATABASE `{url.database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
    servidor.dispose()
    crear(settings.database_url)
    yield


@pytest.fixture(autouse=True)
def limpiar():
    with engine.begin() as con:
        con.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        tablas = con.execute(text("SHOW TABLES")).scalars().all()
        for t in tablas:
            con.execute(text(f"TRUNCATE TABLE `{t}`"))
        con.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    limitador_login._intentos.clear()
    limitador_vincular._intentos.clear()
    limitador_invitacion._intentos.clear()
    limitador_dispositivo._intentos.clear()
    _ultimo_intento.clear()
    emisor().enviados.clear()
    yield


class Reloj:
    """Domingo 18/10/2026, 14:00 en Argentina (17:00 UTC), como en la sección 17."""

    def __init__(self):
        self.ahora = datetime(2026, 10, 18, 17, 0, tzinfo=timezone.utc)

    def __call__(self):
        return self.ahora

    def avanzar(self, **kw):
        from datetime import timedelta
        self.ahora += timedelta(**kw)


@pytest.fixture(autouse=True)
def reloj(monkeypatch):
    r = Reloj()
    monkeypatch.setattr(tiempo, "_reloj", r)
    return r


@pytest.fixture
def cliente():
    from app.main import app
    with TestClient(app) as c:
        yield c


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def registrar(cliente, nombre, email, telefono=None):
    r = cliente.post("/auth/registro", json={"nombre": nombre, "email": email, "password": "una-clave-larga",
                                             "telefono": telefono})
    assert r.status_code == 201, r.text
    return r.json()


def nuevo_eloy(cliente, uid="eloy-b8:27:eb:00:00:01"):
    secret = "s" * 40
    r = cliente.post("/dispositivo/registro", json={"uid_serie": uid, "secret": secret},
                     headers={"X-Provisioning-Key": "clave-de-fabrica-para-los-tests-0123456789"})
    assert r.status_code == 201, r.text
    r = cliente.post("/dispositivo/token", json={"uid_serie": uid, "secret": secret})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]  # la Raspberry sigue en snake_case


@pytest.fixture
def familia(cliente):
    """Escenario de las pantallas: Bautista vincula el Eloy de Marta; la Pi ya tenía
    cargados a Bautista, Vero y Juan; Vero acepta una invitación; Juan no tiene cuenta."""
    bauti = registrar(cliente, "Bautista", "bauti@ejemplo.com", "1155550001")
    vero = registrar(cliente, "Vero", "vero@ejemplo.com", "1155550002")
    pi = nuevo_eloy(cliente)

    codigo = cliente.post("/dispositivo/codigo", headers=auth(pi)).json()["codigo"]
    r = cliente.post("/dispositivos/vincular", json={"codigo": codigo, "nombre_persona": "Marta"},
                     headers=auth(bauti["accessToken"]))
    assert r.status_code == 201, r.text
    id_persona, id_disp = r.json()["idPersona"], r.json()["idDispositivo"]

    primer_sync = {
        "estado": {"volumen": 70, "wifi_ssid": "Casa de Marta", "version_software": "1.4"},
        "usuario": {"nombre": "Marta", "edad": 78, "tiene_pulsera": False},
        "familiares": [
            {"id": 1, "nombre": "Bautista", "relacion": "hijo", "numero_whatsapp": "1155550001", "numero_prioridad": 1},
            {"id": 2, "nombre": "Vero", "relacion": "hija", "numero_whatsapp": "1155550002", "numero_prioridad": 2},
            {"id": 3, "nombre": "Juan", "relacion": "nieto", "numero_whatsapp": "1155550003", "numero_prioridad": 3},
        ],
        "recordatorios": [], "memoria": [],
    }
    r = cliente.post("/dispositivo/sync", json=primer_sync, headers=auth(pi))
    assert r.status_code == 200, r.text
    resp = r.json()
    # Bautista se adoptó por nombre: la Pi recibe la versión combinada y confirma.
    confs = [{"tabla": "familiares", "id": f["id"], "id_local": f["id_local"], "version": f["version"]}
             for f in resp["familiares"]]
    cliente.post("/dispositivo/sync", json={"confirmaciones": confs}, headers=auth(pi))

    fam = cliente.get(f"/personas/{id_persona}/familia", headers=auth(bauti["accessToken"])).json()
    ids = {f["nombre"]: f["id"] for f in fam["familiares"]}
    inv = cliente.post(f"/personas/{id_persona}/invitaciones", json={"id_familiar": ids["Vero"]},
                       headers=auth(bauti["accessToken"])).json()
    r = cliente.post("/invitaciones/aceptar", json={"codigo": inv["codigo"]}, headers=auth(vero["accessToken"]))
    assert r.status_code == 200, r.text

    for quien, token in (("bauti", bauti), ("vero", vero)):
        cliente.post("/push/token", json={"token": f"fcm-token-de-{quien}-123", "plataforma": "android"},
                     headers=auth(token["accessToken"]))
    return {"persona": id_persona, "dispositivo": id_disp, "pi": pi, "ids": ids,
            "bauti": bauti["accessToken"], "vero": vero["accessToken"]}
