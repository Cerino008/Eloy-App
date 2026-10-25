"""Pantalla de Alerta: detalle, "Ya me ocupo yo" y cierre."""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import tiempo
from app.db import SessionLocal, get_db
from app.deps import familiar_de, usuario_actual
from app.models import AlertaSOS, Familiar, NotificacionAlerta, PersonaMayor, UsuarioApp
from app.schemas import AlertaOut, AvisadoOut, CerrarAlertaIn
from app.servicios.almacenamiento import url_audio
from app.servicios.push import push_a_familiares

router = APIRouter(prefix="/alertas", tags=["Alertas"])


def _alerta_y_yo(db: Session, u: UsuarioApp, id_alerta: int) -> tuple[AlertaSOS, Familiar]:
    a = db.get(AlertaSOS, id_alerta)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alerta no encontrada")
    return a, familiar_de(db, u, a.id_persona_mayor, ocultar_como="Alerta no encontrada")


def _detalle(db: Session, a: AlertaSOS, yo: Familiar) -> AlertaOut:
    p = db.get(PersonaMayor, a.id_persona_mayor)
    atiende = db.get(Familiar, a.id_familiar_atiende) if a.id_familiar_atiende else None
    avisados = db.execute(
        select(Familiar.nombre, Familiar.parentesco).join(NotificacionAlerta, NotificacionAlerta.id_familiar == Familiar.id)
        .where(NotificacionAlerta.id_alerta == a.id, NotificacionAlerta.id_familiar != yo.id,
               NotificacionAlerta.enviada_en.is_not(None), NotificacionAlerta.error.is_(None))
        .order_by(NotificacionAlerta.nivel)).all()
    return AlertaOut(
        id=a.id, id_persona=p.id, persona=p.nombre, telefono_persona=p.telefono, estado=a.estado,
        origen=a.origen, motivo=a.motivo, audio_url=url_audio(a.audio_url), audio_duracion_seg=a.audio_duracion_seg,
        ocurrida_en=a.ocurrida_en, atendida_por=atiende.nombre if atiende else None,
        atendida_por_mi=a.id_familiar_atiende == yo.id, atendida_en=a.atendida_en, cerrada_en=a.cerrada_en,
        nota_cierre=a.nota_cierre,
        tambien_avisamos_a=[AvisadoOut(nombre=n, parentesco=par) for n, par in avisados])


def _avisar_que_se_ocupa(id_alerta: int, id_familiar: int) -> None:
    """"Al tocar 'Ya me ocupo yo', el resto de la familia lo ve"."""
    with SessionLocal() as db:
        a = db.get(AlertaSOS, id_alerta)
        quien = db.get(Familiar, id_familiar)
        p = db.get(PersonaMayor, a.id_persona_mayor)
        otros = list(db.scalars(select(NotificacionAlerta.id_familiar).where(
            NotificacionAlerta.id_alerta == id_alerta, NotificacionAlerta.id_familiar != id_familiar,
            NotificacionAlerta.enviada_en.is_not(None))))
        push_a_familiares(db, otros, f"{quien.nombre} se ocupa", f"{quien.nombre} está atendiendo a {p.nombre}",
                          {"tipo": "alerta_atendida", "id_alerta": id_alerta})


@router.get("/{id_alerta}", response_model=AlertaOut)
def ver(id_alerta: int, u: UsuarioApp = Depends(usuario_actual), db: Session = Depends(get_db)):
    a, yo = _alerta_y_yo(db, u, id_alerta)
    # Abrir la alerta cuenta como "abrió la notificación" (FCM no confirma la entrega).
    db.execute(update(NotificacionAlerta).where(
        NotificacionAlerta.id_alerta == a.id, NotificacionAlerta.id_familiar == yo.id,
        NotificacionAlerta.abierta_en.is_(None)).values(abierta_en=tiempo.ahora_utc()))
    db.commit()
    return _detalle(db, a, yo)


@router.post("/{id_alerta}/atender", response_model=AlertaOut,
             responses={409: {"description": "Otro familiar ya la tomó (el detalle dice quién)"}})
def atender(id_alerta: int, tareas: BackgroundTasks, u: UsuarioApp = Depends(usuario_actual),
            db: Session = Depends(get_db)):
    a, yo = _alerta_y_yo(db, u, id_alerta)
    filas = db.execute(update(AlertaSOS).where(AlertaSOS.id == a.id, AlertaSOS.estado == "abierta")
                       .values(estado="atendida", id_familiar_atiende=yo.id, atendida_en=tiempo.ahora_utc())).rowcount
    db.commit()
    db.refresh(a)
    if filas == 0:
        quien = db.get(Familiar, a.id_familiar_atiende) if a.id_familiar_atiende else None
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"{quien.nombre} ya se está ocupando" if quien else "La alerta ya no está abierta")
    tareas.add_task(_avisar_que_se_ocupa, a.id, yo.id)
    return _detalle(db, a, yo)


@router.post("/{id_alerta}/cerrar", response_model=AlertaOut,
             responses={403: {"description": "No sos quien la atendió ni administrador"},
                        409: {"description": "La alerta ya estaba cerrada"}})
def cerrar(id_alerta: int, body: CerrarAlertaIn, u: UsuarioApp = Depends(usuario_actual),
           db: Session = Depends(get_db)):
    """Termina la emergencia. La cierra quien la atendió o un administrador (v2.1: antes podía
    cerrarla cualquier familiar, incluso una que nadie había atendido)."""
    a, yo = _alerta_y_yo(db, u, id_alerta)
    es_admin = yo.rol == "administrador"
    if a.estado == "cerrada":
        raise HTTPException(status.HTTP_409_CONFLICT, "La alerta ya está cerrada")
    if a.estado == "abierta" and not es_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Primero tomala con \"Ya me ocupo yo\" (o que la cierre un administrador)")
    if a.estado == "atendida" and a.id_familiar_atiende != yo.id and not es_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo quien la atendió o un administrador puede cerrarla")
    ahora = tiempo.ahora_utc()
    valores = dict(estado="cerrada", cerrada_en=ahora, nota_cierre=body.nota)
    if a.id_familiar_atiende is None:  # un administrador la cierra sin que nadie la haya atendido
        valores.update(id_familiar_atiende=yo.id, atendida_en=ahora)
    # Condicional, igual que "atender": si dos la cierran a la vez, solo una gana.
    filas = db.execute(update(AlertaSOS).where(AlertaSOS.id == a.id, AlertaSOS.estado != "cerrada")
                       .values(**valores)).rowcount
    db.commit()
    if filas == 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "La alerta ya está cerrada")
    db.refresh(a)
    return _detalle(db, a, yo)


@router.get("", response_model=list[AlertaOut], include_in_schema=True)
def historial(id_persona: int, limite: int = 20, u: UsuarioApp = Depends(usuario_actual),
              db: Session = Depends(get_db)):
    """GET /alertas?id_persona=1 — historial de pedidos de ayuda."""
    yo = familiar_de(db, u, id_persona)
    alertas = db.scalars(select(AlertaSOS).where(AlertaSOS.id_persona_mayor == id_persona)
                         .order_by(AlertaSOS.ocurrida_en.desc()).limit(min(limite, 100))).all()
    return [_detalle(db, a, yo) for a in alertas]
