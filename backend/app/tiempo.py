"""Fechas: todo se guarda en UTC sin tzinfo; "hoy" se calcula con la zona de la persona."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

# Mismos nombres que usa el dispositivo (sin tildes). weekday(): lunes = 0.
DIAS = ("lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo")


def _reloj() -> datetime:
    """Única fuente de "ahora". Los tests la reemplazan para fijar la hora."""
    return datetime.now(timezone.utc)


def ahora_utc() -> datetime:
    return _reloj().astimezone(timezone.utc).replace(tzinfo=None, microsecond=0)


def a_utc(dt: datetime) -> datetime:
    """datetime con zona -> UTC sin tzinfo (como se guarda en la base)."""
    return dt.astimezone(timezone.utc).replace(tzinfo=None, microsecond=0)


def local_a_utc(local: datetime, zona_horaria: str) -> datetime:
    """Hora local sin tzinfo (ej. mensajes.creado de la Pi) -> UTC."""
    return a_utc(local.replace(tzinfo=ZoneInfo(zona_horaria)))


def entrada_a_utc(dt: datetime | None) -> datetime | None:
    """Fechas que llegan por la API: con zona se convierten; sin zona se asumen UTC."""
    if dt is None:
        return None
    return a_utc(dt) if dt.tzinfo else dt.replace(microsecond=0)


@dataclass(frozen=True)
class Hoy:
    fecha: date
    dia: str            # "domingo"
    hora_local: time
    desde_utc: datetime  # inicio del día local, en UTC
    hasta_utc: datetime
    ahora_utc: datetime


def hoy_de(zona_horaria: str) -> Hoy:
    zona = ZoneInfo(zona_horaria)
    ahora = ahora_utc()
    local = ahora.replace(tzinfo=timezone.utc).astimezone(zona)
    fecha = local.date()
    inicio = datetime.combine(fecha, time.min, tzinfo=zona)
    fin = datetime.combine(fecha + timedelta(days=1), time.min, tzinfo=zona)
    return Hoy(
        fecha=fecha,
        dia=DIAS[fecha.weekday()],
        hora_local=local.time().replace(microsecond=0, tzinfo=None),
        desde_utc=a_utc(inicio),
        hasta_utc=a_utc(fin),
        ahora_utc=ahora,
    )
