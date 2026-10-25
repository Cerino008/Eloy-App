"""Qué recordatorios tocan hoy, cuáles sonaron y cuáles vienen (sección 15.2)."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Recordatorio, RecordatorioEjecucion
from app.tiempo import DIAS, Hoy


def _dias(r: Recordatorio) -> set[str]:
    return set(r.dias_semana or ())


def toca_hoy(r: Recordatorio, hoy: Hoy, sono_hoy: bool) -> bool:
    if r.repeticion == "diaria":
        return True
    if r.repeticion == "semanal":
        return hoy.dia in _dias(r)
    if r.fecha_unica is not None:
        return r.fecha_unica == hoy.fecha
    # una vez sin fecha: suena la próxima vez que sea esa hora
    return (not r.completado) or sono_hoy


def proxima_fecha(r: Recordatorio, hoy: Hoy) -> date | None:
    """Para la lista "Próximos días" (no incluye hoy)."""
    if r.repeticion == "una_vez":
        return r.fecha_unica if r.fecha_unica and r.fecha_unica > hoy.fecha else None
    if r.repeticion == "semanal":
        dias = _dias(r)
        if hoy.dia in dias:
            return None  # ya aparece en "Hoy"
        for i in range(1, 8):
            f = hoy.fecha + timedelta(days=i)
            if DIAS[f.weekday()] in dias:
                return f
    return None


def recordatorios_del_dia(db: Session, id_persona: int, hoy: Hoy) -> tuple[list[dict], list[dict]]:
    """Devuelve (hoy, proximos). Cada ítem: {"r": Recordatorio, "estado"|"fecha"}."""
    recs = db.scalars(
        select(Recordatorio).where(Recordatorio.id_persona_mayor == id_persona,
                                   Recordatorio.eliminado_en.is_(None))
        .order_by(Recordatorio.hora, Recordatorio.id)
    ).all()
    sonaron = set(db.scalars(
        select(RecordatorioEjecucion.id_recordatorio).where(
            RecordatorioEjecucion.id_recordatorio.in_([r.id for r in recs] or [0]),
            RecordatorioEjecucion.fecha == hoy.fecha)
    ))
    de_hoy, proximos = [], []
    for r in recs:
        sono = r.id in sonaron
        if toca_hoy(r, hoy, sono):
            de_hoy.append({"r": r, "estado": "sono" if sono else "pendiente"})
        f = proxima_fecha(r, hoy)
        if f is not None:
            proximos.append({"r": r, "fecha": f})
    proximos.sort(key=lambda x: (x["fecha"], x["r"].hora))
    return de_hoy, proximos


def hay_atrasado(de_hoy: list[dict], hoy: Hoy, minutos: int) -> bool:
    """Estado "atencion": un recordatorio de hoy no sonó N minutos después de su hora.
    Los de una vez sin fecha no cuentan (pueden ser para mañana)."""
    ahora = datetime.combine(hoy.fecha, hoy.hora_local)
    for x in de_hoy:
        r = x["r"]
        if x["estado"] != "pendiente":
            continue
        if r.repeticion == "una_vez" and r.fecha_unica is None:
            continue
        if datetime.combine(hoy.fecha, r.hora) + timedelta(minutes=minutos) < ahora:
            return True
    return False
