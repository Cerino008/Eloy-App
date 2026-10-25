from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, pool_recycle=280)


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
