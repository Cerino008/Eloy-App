"""Crea las tablas en la base de DATABASE_URL usando sql/eloy_servidor.sql.
Uso: python -m scripts.init_db   (una sola vez; falla si las tablas ya existen)"""
import re
from pathlib import Path

from sqlalchemy import create_engine, text

from app.config import settings
from app.db import argumentos_de_conexion

SCRIPT = Path(__file__).resolve().parent.parent / "sql" / "eloy_servidor.sql"


def sentencias(sql: str) -> list[str]:
    sql = re.sub(r"--[^\n]*", "", sql)  # sacar comentarios (algunos tienen ';')
    partes = [s.strip() for s in sql.split(";")]
    # La base ya la eligió DATABASE_URL (en la nube suele venir creada con otro nombre).
    return [s for s in partes if s and not re.match(r"^(CREATE DATABASE|USE)\b", s, re.IGNORECASE)]


def crear(url: str = settings.database_url) -> None:
    engine = create_engine(url, connect_args=argumentos_de_conexion())
    with engine.begin() as con:
        for s in sentencias(SCRIPT.read_text(encoding="utf-8")):
            con.execute(text(s))
    engine.dispose()


if __name__ == "__main__":
    crear()
    print("Listo: 18 tablas creadas.")
