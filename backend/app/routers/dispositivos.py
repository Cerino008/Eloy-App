"""Lo que hace la app con un Eloy: vincular, volumen y restaurar de fábrica."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import tiempo
from app.db import get_db
from app.deps import auditar, exigir_admin, familiar_de, usuario_actual
from app.models import (
    CodigoVinculacion, ComandoDispositivo, Dispositivo, Familiar, MemoriaAgente, PersonaMayor, UsuarioApp,
)
from app.schemas import DispositivoPatchIn, RestaurarIn, VincularIn, VincularOut
from app.seguridad import limitador_vincular
from app.servicios.sync import restaurar_pendiente

router = APIRouter(prefix="/dispositivos", tags=["Eloy (desde la app)"])


@router.post("/vincular", response_model=VincularOut, status_code=201)
def vincular(body: VincularIn, request: Request, u: UsuarioApp = Depends(usuario_actual),
             db: Session = Depends(get_db)):
    """Sección 15.4. Quien vincula queda como administrador."""
    clave_limite = f"u{u.id}"
    if limitador_vincular.bloqueado(clave_limite):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Demasiados intentos. Probá en 15 minutos.")
    ahora = tiempo.ahora_utc()
    cod = db.scalar(select(CodigoVinculacion).where(
        CodigoVinculacion.codigo == body.codigo.strip().upper(), CodigoVinculacion.usado_en.is_(None),
        CodigoVinculacion.expira_en > ahora, CodigoVinculacion.intentos_fallidos < 5).with_for_update())
    if cod is None:
        limitador_vincular.fallo(clave_limite)
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Código inválido o vencido. Pedile uno nuevo a Eloy.")

    if body.id_persona is not None:  # reemplazo de un Eloy de una persona que ya existe
        exigir_admin(familiar_de(db, u, body.id_persona))
        persona = db.get(PersonaMayor, body.id_persona)
        yo = familiar_de(db, u, body.id_persona)
    else:
        persona = PersonaMayor(nombre=(body.nombre_persona or "Sin nombre").strip()[:80])
        db.add(persona)
        db.flush()
        yo = Familiar(id_persona_mayor=persona.id, id_usuario_app=u.id, nombre=u.nombre,
                      telefono=u.telefono, email=u.email, rol="administrador", prioridad_alerta=1,
                      pendiente_sync=True)
        db.add(yo)

    filas = db.execute(update(Dispositivo).where(Dispositivo.id == cod.id_dispositivo,
                                                 Dispositivo.id_persona_mayor.is_(None))
                       .values(id_persona_mayor=persona.id, vinculado_en=ahora)).rowcount
    if filas == 0:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese Eloy ya está vinculado")
    cod.usado_en, cod.id_usuario_app = ahora, u.id
    db.flush()
    auditar(db, "vincular_dispositivo", request, id_usuario=u.id, id_persona=persona.id,
            id_dispositivo=cod.id_dispositivo)
    db.commit()
    limitador_vincular.limpiar(clave_limite)
    return VincularOut(id_persona=persona.id, id_dispositivo=cod.id_dispositivo)


def _dispositivo_admin(db: Session, u: UsuarioApp, id_dispositivo: int) -> Dispositivo:
    d = db.get(Dispositivo, id_dispositivo)
    if d is None or d.id_persona_mayor is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Eloy no encontrado")
    exigir_admin(familiar_de(db, u, d.id_persona_mayor, ocultar_como="Eloy no encontrado"))
    return d


@router.patch("/{id_dispositivo}", status_code=202)
def ajustar(id_dispositivo: int, body: DispositivoPatchIn, u: UsuarioApp = Depends(usuario_actual),
            db: Session = Depends(get_db)):
    """El volumen cambia cuando Eloy ejecuta el comando (y lo informa en su próximo sync)."""
    d = _dispositivo_admin(db, u, id_dispositivo)
    db.add(ComandoDispositivo(id_dispositivo=d.id, tipo="ajustar_volumen",
                              parametros={"volumen": body.volumen}, solicitado_por=u.id))
    db.commit()
    return {"detalle": "Eloy lo aplica en la próxima sincronización"}


@router.post("/{id_dispositivo}/restaurar", status_code=202)
def restaurar(id_dispositivo: int, body: RestaurarIn, request: Request, u: UsuarioApp = Depends(usuario_actual),
              db: Session = Depends(get_db)):
    """Sección 15.5. Solo administradores, con doble confirmación. Se borra la memoria ya;
    la desvinculación y los id_local se resuelven cuando Eloy confirma que restauró."""
    d = _dispositivo_admin(db, u, id_dispositivo)
    if restaurar_pendiente(db, d):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya hay una restauración en curso")
    db.add(ComandoDispositivo(id_dispositivo=d.id, tipo="restaurar_fabrica", solicitado_por=u.id))
    db.execute(MemoriaAgente.__table__.delete().where(MemoriaAgente.id_persona_mayor == d.id_persona_mayor))
    auditar(db, "restaurar_fabrica", request, id_usuario=u.id, id_persona=d.id_persona_mayor, id_dispositivo=d.id)
    db.commit()
    return {"detalle": "Eloy se restaura en la próxima sincronización"}
