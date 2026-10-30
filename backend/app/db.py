import ssl

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


def argumentos_de_conexion() -> dict:
    """Con DB_TLS, PyMySQL conecta por TLS y verifica el certificado y el nombre del servidor
    (con las CA del sistema o con DB_TLS_CA). Sin DB_TLS, PyMySQL 2 igual cifra si el servidor
    lo ofrece, pero sin verificar con quién habla (lo mismo que pasar ssl={})."""
    if not settings.db_tls:
        return {}
    return {"ssl": ssl.create_default_context(cafile=settings.db_tls_ca)}


engine = create_engine(settings.database_url, connect_args=argumentos_de_conexion(),
                       pool_pre_ping=True, pool_recycle=280)


@event.listens_for(engine, "connect")
def _sesion_en_utc(dbapi_conn, _):
    # Aunque el servidor administrado no tenga default-time-zone = '+00:00',
    # cada conexión trabaja en UTC (CURRENT_TIMESTAMP incluido).
    cur = dbapi_conn.cursor()
    cur.execute("SET time_zone = '+00:00'")
    cur.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
