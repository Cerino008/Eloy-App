"""v2.3: base de datos en partes (como la pasa un addon de Northflank) y conexión por TLS."""
import ssl

import pytest
from sqlalchemy.engine import make_url

from app.config import Settings, settings
from app.db import argumentos_de_conexion

CLAVE_RARA = "cl@ve:con/raros#%?&"


def config(**valores) -> Settings:
    # _env_file=None: que un .env local no se meta en el test.
    return Settings(_env_file=None, **valores)


def test_url_armada_con_las_partes_del_addon():
    s = config(database_url=None, db_host="primary.eloy-db.addon.code.run", db_port=3306, db_name="eloy",
               db_user="usuario", db_password=CLAVE_RARA)
    url = make_url(s.database_url)
    assert url.drivername == "mysql+pymysql"
    assert (url.username, url.password) == ("usuario", CLAVE_RARA)
    assert (url.host, url.port, url.database) == ("primary.eloy-db.addon.code.run", 3306, "eloy")
    assert url.query["charset"] == "utf8mb4"


def test_database_url_tiene_prioridad_sobre_las_partes():
    entera = "mysql+pymysql://eloy:eloy@otra-base:3306/eloy?charset=utf8mb4"
    s = config(database_url=entera, db_host="primary.eloy-db.addon.code.run", db_user="u", db_password="p")
    assert s.database_url == entera


def test_sin_base_en_desarrollo_usa_la_local():
    s = config(database_url=None, db_host=None)
    assert make_url(s.database_url).host == "localhost"


def test_sin_base_en_produccion_no_arranca():
    with pytest.raises(ValueError, match="falta la base de datos"):
        config(entorno="produccion", database_url=None, db_host=None)


def test_tls_verifica_certificado_y_nombre_del_servidor(monkeypatch):
    monkeypatch.setattr(settings, "db_tls", False)
    assert argumentos_de_conexion() == {}

    monkeypatch.setattr(settings, "db_tls", True)
    monkeypatch.setattr(settings, "db_tls_ca", None)
    contexto = argumentos_de_conexion()["ssl"]
    assert contexto.verify_mode == ssl.CERT_REQUIRED
    assert contexto.check_hostname is True


def test_tls_enabled_del_addon_se_entiende_como_booleano(monkeypatch):
    # Northflank pasa TLS_ENABLED como texto.
    monkeypatch.setenv("DB_TLS", "true")
    assert config().db_tls is True
    monkeypatch.setenv("DB_TLS", "false")
    assert config().db_tls is False
