"""Dependencias: quién llama (app o dispositivo) y permisos (sección 15.6)."""
from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import tiempo
from app.db import get_db
from app.models import Dispositivo, Familiar, PersonaMayor, RegistroAuditoria, Sesion, UsuarioApp
from app.seguridad import leer_jwt

_bearer = HTTPBearer(auto_error=False)


def _no_autorizado(detalle: str = "Sesión inválida o vencida") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detalle, headers={"WWW-Authenticate": "Bearer"})


def sesion_actual(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Sesion:
    if cred is None:
        raise _no_autorizado("Falta el token")
    try:
        payload = leer_jwt(cred.credentials, "app")
    except jwt.PyJWTError:
        raise _no_autorizado() from None
    sesion = db.get(Sesion, int(payload.get("sid", 0)))
    # Revisar la sesión en cada pedido permite cortar un celular perdido al instante.
    if sesion is None or sesion.revocada_en is not None or sesion.id_usuario_app != int(payload["sub"]):
        raise _no_autorizado() from None
    return sesion


def usuario_actual(sesion: Sesion = Depends(sesion_actual), db: Session = Depends(get_db)) -> UsuarioApp:
    usuario = db.get(UsuarioApp, sesion.id_usuario_app)
    if usuario is None or not usuario.activo:
        raise _no_autorizado() from None
    return usuario


def dispositivo_actual(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Dispositivo:
    if cred is None:
        raise _no_autorizado("Falta el token del dispositivo")
    try:
        payload = leer_jwt(cred.credentials, "dispositivo")
    except jwt.PyJWTError:
        raise _no_autorizado() from None
    disp = db.get(Dispositivo, int(payload["sub"]))
    if disp is None:
        raise _no_autorizado() from None
    return disp


def familiar_de(db: Session, usuario: UsuarioApp, id_persona: int, ocultar_como: str | None = None) -> Familiar:
    """El usuario tiene que ser familiar (activo) de esa persona; si no, 403.

    Para recursos que se piden por id (una alerta, un recordatorio...) pasá `ocultar_como="X no
    encontrada"`: así quien no es de la familia recibe 404, igual que si el id no existiera, y no
    puede descubrir qué ids existen."""
    fam = db.scalar(
        select(Familiar).where(
            Familiar.id_usuario_app == usuario.id,
            Familiar.id_persona_mayor == id_persona,
            Familiar.eliminado_en.is_(None),
        )
    )
    if fam is None:
        if ocultar_como:
            raise HTTPException(status.HTTP_404_NOT_FOUND, ocultar_como)
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No tenés acceso a esta persona")
    return fam


def exigir_admin(fam: Familiar) -> None:
    if fam.rol != "administrador":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo un administrador puede hacer esto")


def persona_o_404(db: Session, id_persona: int) -> PersonaMayor:
    p = db.get(PersonaMayor, id_persona)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Persona no encontrada")
    return p


def auditar(db: Session, accion: str, request: Request | None = None, *, id_usuario: int | None = None,
            id_persona: int | None = None, **detalle) -> None:
    db.add(RegistroAuditoria(
        id_usuario_app=id_usuario, id_persona_mayor=id_persona, accion=accion,
        detalle=detalle or None, ip=(request.client.host if request and request.client else None),
        creado_en=tiempo.ahora_utc(),
    ))
