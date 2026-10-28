"""Pantalla Mensajes."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, update
from sqlalchemy.orm import Session, aliased

from app import tiempo
from app.db import get_db
from app.deps import familiar_de, persona_o_404, usuario_actual
from app.models import Familiar, Mensaje, UsuarioApp
from app.schemas import MensajeIn, MensajeOut
from app.servicios.almacenamiento import url_audio

router = APIRouter(tags=["Mensajes"])


def _salida(m: Mensaje, de: str | None, para: str | None, yo: Familiar) -> MensajeOut:
    return MensajeOut(
        id=m.id, direccion=m.direccion, de=de, para=para,
        es_mio=m.direccion == "de_familia" and m.id_familiar_emisor == yo.id,
        texto=m.texto, audio_url=url_audio(m.audio_url), audio_duracion_seg=m.audio_duracion_seg,
        estado=m.estado, entregado_en=m.entregado_en, leido_en=m.leido_en, creado_en=m.creado_en)


@router.get("/personas/{id_persona}/mensajes", response_model=list[MensajeOut])
def listar(id_persona: int, limite: int = Query(50, ge=1, le=200),
           antes_de: int | None = Query(None, description="id del mensaje más viejo que ya tenés (paginado)"),
           u: UsuarioApp = Depends(usuario_actual), db: Session = Depends(get_db)):
    """Más nuevos primero. Abrir el hilo marca como leídos los mensajes de la persona."""
    yo = familiar_de(db, u, id_persona)
    fe, fd = aliased(Familiar), aliased(Familiar)
    q = (select(Mensaje, fe.nombre, fd.nombre)
         .outerjoin(fe, fe.id == Mensaje.id_familiar_emisor)
         .outerjoin(fd, fd.id == Mensaje.id_familiar_destino)
         .where(Mensaje.id_persona_mayor == id_persona)
         .order_by(Mensaje.creado_en.desc(), Mensaje.id.desc()).limit(limite))
    if antes_de is not None:
        q = q.where(Mensaje.id < antes_de)
    filas = db.execute(q).all()

    db.execute(update(Mensaje).where(
        Mensaje.id_persona_mayor == id_persona, Mensaje.direccion == "a_familia", Mensaje.estado == "entregado",
    ).values(estado="leido", leido_en=tiempo.ahora_utc()))
    db.commit()
    # para = null: el mensaje es para toda la familia (la app decide cómo mostrarlo).
    return [_salida(m, nom_e or m.nombre_emisor, nom_d or m.nombre_destino, yo) for m, nom_e, nom_d in filas]


@router.post("/personas/{id_persona}/mensajes", response_model=MensajeOut, status_code=201)
def enviar(id_persona: int, body: MensajeIn, u: UsuarioApp = Depends(usuario_actual), db: Session = Depends(get_db)):
    """El emisor sale de la sesión, no de una lista. Eloy lo recibe en la próxima sincronización."""
    yo = familiar_de(db, u, id_persona)
    p = persona_o_404(db, id_persona)
    m = Mensaje(id_persona_mayor=p.id, direccion="de_familia", id_familiar_emisor=yo.id,
                nombre_emisor=yo.nombre, nombre_destino=p.nombre, texto=body.texto.strip(), estado="pendiente")
    db.add(m)
    db.commit()
    return _salida(m, yo.nombre, p.nombre, yo)
