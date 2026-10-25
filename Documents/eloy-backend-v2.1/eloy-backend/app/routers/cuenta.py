"""Cuenta: registro, login, refresh con rotación, logout y tokens push."""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import tiempo
from app.config import settings
from app.db import get_db
from app.deps import sesion_actual, usuario_actual
from app.models import Sesion, TokenPush, UsuarioApp
from app.schemas import LoginIn, PushTokenIn, RefreshIn, RegistroIn, TokensOut, UsuarioOut
from app.seguridad import (
    crear_jwt, hash_clave, limitador_login, sha256, token_aleatorio, verificar_clave,
)

router = APIRouter(prefix="/auth", tags=["Cuenta"])
router_push = APIRouter(prefix="/push", tags=["Cuenta"])


def _abrir_sesion(db: Session, usuario: UsuarioApp, nombre_equipo: str | None) -> TokensOut:
    refresh = token_aleatorio()
    s = Sesion(id_usuario_app=usuario.id, refresh_hash=sha256(refresh), nombre_equipo=nombre_equipo,
               expira_en=tiempo.ahora_utc() + timedelta(days=settings.refresh_dias))
    db.add(s)
    db.flush()
    access = crear_jwt(usuario.id, "app", settings.access_minutos, sid=s.id)
    return TokensOut(access_token=access, refresh_token=refresh, expira_en_seg=settings.access_minutos * 60)


@router.post("/registro", response_model=TokensOut, status_code=201)
def registro(body: RegistroIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(UsuarioApp.id).where(UsuarioApp.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya hay una cuenta con ese email")
    u = UsuarioApp(nombre=body.nombre.strip(), apellido=body.apellido, email=email,
                   password_hash=hash_clave(body.password), telefono=body.telefono,
                   ultimo_acceso=tiempo.ahora_utc())
    db.add(u)
    db.flush()
    tokens = _abrir_sesion(db, u, body.nombre_equipo)
    db.commit()
    return tokens


@router.post("/login", response_model=TokensOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    email = body.email.lower()
    clave_limite = f"{email}|{request.client.host if request.client else '-'}"
    if limitador_login.bloqueado(clave_limite):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Demasiados intentos. Probá en 15 minutos.")
    u = db.scalar(select(UsuarioApp).where(UsuarioApp.email == email))
    if not verificar_clave(u.password_hash if u else None, body.password):
        limitador_login.fallo(clave_limite)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email o contraseña incorrectos")
    if not u.activo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cuenta desactivada")
    limitador_login.limpiar(clave_limite)
    u.ultimo_acceso = tiempo.ahora_utc()
    tokens = _abrir_sesion(db, u, body.nombre_equipo)
    db.commit()
    return tokens


@router.post("/refresh", response_model=TokensOut)
def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    """Rotación: el refresh viejo deja de servir y se entrega uno nuevo."""
    ahora = tiempo.ahora_utc()
    s = db.scalar(select(Sesion).where(Sesion.refresh_hash == sha256(body.refresh_token)).with_for_update())
    if s is None or s.revocada_en is not None or s.expira_en <= ahora:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sesión vencida. Iniciá sesión de nuevo.")
    u = db.get(UsuarioApp, s.id_usuario_app)
    if u is None or not u.activo:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Cuenta desactivada")
    s.revocada_en = ahora
    s.ultimo_uso = ahora
    tokens = _abrir_sesion(db, u, s.nombre_equipo)
    db.commit()
    return tokens


@router.post("/logout", status_code=204)
def logout(todas: bool = False, sesion: Sesion = Depends(sesion_actual), db: Session = Depends(get_db)):
    """Cierra esta sesión, o todas (?todas=true) para cortar un celular perdido."""
    ahora = tiempo.ahora_utc()
    q = update(Sesion).where(Sesion.revocada_en.is_(None))
    q = q.where(Sesion.id_usuario_app == sesion.id_usuario_app) if todas else q.where(Sesion.id == sesion.id)
    db.execute(q.values(revocada_en=ahora))
    db.commit()


@router.get("/yo", response_model=UsuarioOut)
def yo(u: UsuarioApp = Depends(usuario_actual)):
    return UsuarioOut(id=u.id, nombre=u.nombre, apellido=u.apellido, email=u.email, telefono=u.telefono)


@router_push.post("/token", status_code=204)
def registrar_token(body: PushTokenIn, u: UsuarioApp = Depends(usuario_actual), db: Session = Depends(get_db)):
    """La app lo llama al iniciar sesión y cada vez que FCM le da un token nuevo."""
    t = db.scalar(select(TokenPush).where(TokenPush.token == body.token))
    if t is None:
        db.add(TokenPush(id_usuario_app=u.id, token=body.token, plataforma=body.plataforma,
                         ultimo_uso=tiempo.ahora_utc()))
    else:  # el mismo celular con otra cuenta: pasa a la cuenta nueva
        t.id_usuario_app, t.plataforma, t.activo, t.ultimo_uso = u.id, body.plataforma, True, tiempo.ahora_utc()
    db.commit()


@router_push.delete("/token", status_code=204)
def borrar_token(body: PushTokenIn, u: UsuarioApp = Depends(usuario_actual), db: Session = Depends(get_db)):
    db.execute(update(TokenPush).where(TokenPush.token == body.token, TokenPush.id_usuario_app == u.id)
               .values(activo=False))
    db.commit()
