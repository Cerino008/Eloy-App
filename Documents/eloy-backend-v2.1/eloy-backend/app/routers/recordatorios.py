"""Pantalla Recordatorios."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import tiempo
from app.db import get_db
from app.deps import familiar_de, persona_o_404, usuario_actual
from app.models import Recordatorio, UsuarioApp
from app.schemas import RecordatorioIn, RecordatorioOut, RecordatorioPatchIn, RecordatoriosOut
from app.servicios.recordatorios import recordatorios_del_dia
from app.tiempo import DIAS

router = APIRouter(tags=["Recordatorios"])


def _salida(r: Recordatorio, **extra) -> RecordatorioOut:
    return RecordatorioOut(
        id=r.id, titulo=r.titulo, descripcion=r.descripcion, hora=r.hora.strftime("%H:%M"),
        repeticion=r.repeticion, dias_semana=[d for d in DIAS if d in (r.dias_semana or ())],
        fecha_unica=r.fecha_unica, creado_desde=r.creado_desde, sincronizado=not r.pendiente_sync, **extra)


def _validar_regla(repeticion: str, dias: set[str] | None, fecha) -> None:
    """Las mismas reglas que los CHECK de la tabla, con un mensaje entendible."""
    if repeticion == "semanal" and not dias:
        raise HTTPException(422, "Un recordatorio semanal necesita al menos un día")
    if repeticion != "semanal" and dias:
        raise HTTPException(422, "Los días solo van en recordatorios semanales")
    if repeticion != "una_vez" and fecha is not None:
        raise HTTPException(422, "La fecha solo va en recordatorios de una vez")


def _recordatorio_mio(db: Session, u: UsuarioApp, id_recordatorio: int) -> Recordatorio:
    r = db.get(Recordatorio, id_recordatorio)
    if r is None or r.eliminado_en is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Recordatorio no encontrado")
    familiar_de(db, u, r.id_persona_mayor, ocultar_como="Recordatorio no encontrado")
    return r


@router.get("/personas/{id_persona}/recordatorios", response_model=RecordatoriosOut)
def listar(id_persona: int, u: UsuarioApp = Depends(usuario_actual), db: Session = Depends(get_db)):
    familiar_de(db, u, id_persona)
    p = persona_o_404(db, id_persona)
    hoy = tiempo.hoy_de(p.zona_horaria)
    de_hoy, proximos = recordatorios_del_dia(db, p.id, hoy)
    return RecordatoriosOut(
        fecha=hoy.fecha,
        hoy=[_salida(x["r"], estado=x["estado"]) for x in de_hoy],
        proximos=[_salida(x["r"], proxima_fecha=x["fecha"]) for x in proximos])


@router.post("/personas/{id_persona}/recordatorios", response_model=RecordatorioOut, status_code=201)
def crear(id_persona: int, body: RecordatorioIn, u: UsuarioApp = Depends(usuario_actual),
          db: Session = Depends(get_db)):
    yo = familiar_de(db, u, id_persona)
    dias = set(body.dias_semana or []) or None
    _validar_regla(body.repeticion, dias, body.fecha_unica)
    r = Recordatorio(
        id_persona_mayor=id_persona, titulo=body.titulo.strip(), descripcion=body.descripcion,
        hora=datetime.strptime(body.hora, "%H:%M").time(), repeticion=body.repeticion, dias_semana=dias,
        fecha_unica=body.fecha_unica, creado_desde="app", creado_por=yo.id,
        pendiente_sync=True)  # queda pendiente hasta que Eloy lo reciba
    db.add(r)
    db.commit()
    return _salida(r)


@router.patch("/recordatorios/{id_recordatorio}", response_model=RecordatorioOut)
def editar(id_recordatorio: int, body: RecordatorioPatchIn, u: UsuarioApp = Depends(usuario_actual),
           db: Session = Depends(get_db)):
    r = _recordatorio_mio(db, u, id_recordatorio)
    datos = body.model_dump(exclude_unset=True)
    repeticion = datos.get("repeticion", r.repeticion)
    # Si cambia el tipo, lo que no corresponde se limpia solo.
    dias = set(datos["dias_semana"] or []) or None if "dias_semana" in datos else \
        (r.dias_semana if repeticion == "semanal" else None)
    fecha = datos["fecha_unica"] if "fecha_unica" in datos else \
        (r.fecha_unica if repeticion == "una_vez" else None)
    _validar_regla(repeticion, dias, fecha)
    if "titulo" in datos:
        r.titulo = datos["titulo"].strip()
    if "descripcion" in datos:
        r.descripcion = datos["descripcion"]
    if "hora" in datos:
        r.hora = datetime.strptime(datos["hora"], "%H:%M").time()
        r.completado = False
    r.repeticion, r.dias_semana, r.fecha_unica = repeticion, dias, fecha
    r.pendiente_sync = True
    db.commit()
    return _salida(r)


@router.delete("/recordatorios/{id_recordatorio}", status_code=204)
def borrar(id_recordatorio: int, u: UsuarioApp = Depends(usuario_actual), db: Session = Depends(get_db)):
    r = _recordatorio_mio(db, u, id_recordatorio)
    r.eliminado_en = tiempo.ahora_utc()
    r.pendiente_sync = r.id_local is not None  # si Eloy nunca lo tuvo, no hay que avisarle
    db.commit()
