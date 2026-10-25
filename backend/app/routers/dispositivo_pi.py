"""Endpoints que llama la Raspberry. Autenticación: uid_serie + clave -> token de dispositivo."""
import secrets
from datetime import timedelta

from fastapi import (
    APIRouter, BackgroundTasks, Depends, File, Header, HTTPException, Request, UploadFile, status,
)
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import tiempo
from app.config import settings
from app.db import SessionLocal, get_db
from app.deps import dispositivo_actual
from app.models import CodigoVinculacion, Dispositivo, Familiar, Mensaje, PersonaMayor
from app.schemas_dispositivo import (
    AlertaPiIn, CodigoOut, RegistroDispositivoIn, SyncIn, TokenDispositivoIn, TokenDispositivoOut,
)
from app.seguridad import codigo_vinculacion, crear_jwt, hash_clave, limitador_dispositivo, verificar_clave
from app.servicios.alertas import despachar_alerta, registrar_alerta
from app.servicios.almacenamiento import EXTENSIONES, almacenamiento
from app.servicios.push import push_a_familiares
from app.servicios.sync import sincronizar

router = APIRouter(prefix="/dispositivo", tags=["Dispositivo (lo llama la Raspberry)"])


@router.post("/registro", status_code=201)
def registro(body: RegistroDispositivoIn, request: Request, x_provisioning_key: str = Header(...),
             db: Session = Depends(get_db)):
    """Alta de fábrica: una sola vez por aparato. La Pi genera su clave, la guarda en un
    archivo con permisos restringidos (fuera de lo que borra "restaurar") y la manda acá."""
    clave_limite = f"registro|{request.client.host if request.client else '-'}"
    if limitador_dispositivo.bloqueado(clave_limite):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Demasiados intentos. Probá en 15 minutos.")
    if not secrets.compare_digest(x_provisioning_key, settings.provisioning_key):
        limitador_dispositivo.fallo(clave_limite)
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Clave de provisión inválida")
    db.add(Dispositivo(uid_serie=body.uid_serie, secret_hash=hash_clave(body.secret)))
    try:
        db.commit()
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese uid_serie ya está registrado") from None
    return {"detalle": "registrado"}


@router.post("/token", response_model=TokenDispositivoOut)
def token(body: TokenDispositivoIn, request: Request, db: Session = Depends(get_db)):
    clave_limite = f"token|{body.uid_serie}|{request.client.host if request.client else '-'}"
    if limitador_dispositivo.bloqueado(clave_limite):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Demasiados intentos. Probá en 15 minutos.")
    d = db.scalar(select(Dispositivo).where(Dispositivo.uid_serie == body.uid_serie))
    if not verificar_clave(d.secret_hash if d else None, body.secret):
        limitador_dispositivo.fallo(clave_limite)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "uid_serie o clave incorrectos")
    limitador_dispositivo.limpiar(clave_limite)
    minutos = settings.dispositivo_token_horas * 60
    return TokenDispositivoOut(access_token=crear_jwt(d.id, "dispositivo", minutos), expira_en_seg=minutos * 60,
                               vinculado=d.id_persona_mayor is not None)


@router.post("/codigo", response_model=CodigoOut, status_code=201)
def nuevo_codigo(d: Dispositivo = Depends(dispositivo_actual), db: Session = Depends(get_db)):
    """El código del QR de "Vinculá a Eloy". Vence a los 10 minutos."""
    if d.id_persona_mayor is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Este Eloy ya está vinculado")
    ahora = tiempo.ahora_utc()
    # La columna `codigo` es UNIQUE para siempre: se limpian los viejos para no agotar combinaciones.
    db.execute(delete(CodigoVinculacion).where(CodigoVinculacion.expira_en < ahora - timedelta(days=1)))
    db.execute(delete(CodigoVinculacion).where(CodigoVinculacion.id_dispositivo == d.id,
                                               CodigoVinculacion.usado_en.is_(None)))
    for _ in range(5):
        cod = CodigoVinculacion(id_dispositivo=d.id, codigo=codigo_vinculacion(),
                                expira_en=ahora + timedelta(minutes=settings.codigo_vinculacion_minutos))
        db.add(cod)
        try:
            db.commit()
            return CodigoOut(codigo=cod.codigo, expira_en=cod.expira_en)
        except IntegrityError:
            db.rollback()
    raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "No se pudo generar el código, reintentá")


@router.post("/audio", status_code=201)
async def subir_audio(archivo: UploadFile = File(...), d: Dispositivo = Depends(dispositivo_actual)):
    """Primero se sube el wav y después se manda su audio_key en /alertas o /sync."""
    extension = (archivo.filename or "").rsplit(".", 1)[-1].lower()
    if extension not in EXTENSIONES:
        raise HTTPException(422, f"Formato no soportado. Usá: {', '.join(sorted(EXTENSIONES))}")
    datos = await archivo.read(settings.audio_max_mb * 1024 * 1024 + 1)
    if len(datos) > settings.audio_max_mb * 1024 * 1024:
        raise HTTPException(413, f"Máximo {settings.audio_max_mb} MB")
    return {"audio_key": almacenamiento().guardar(datos, extension)}


@router.post("/alertas", status_code=201)
def alerta(body: AlertaPiIn, tareas: BackgroundTasks, d: Dispositivo = Depends(dispositivo_actual),
           db: Session = Depends(get_db)):
    """Apenas Marta pide ayuda, sin esperar la vuelta de 30 s. Si falla, el sync la
    reenvía como mensaje 'emergencia' y el id_local evita que llegue dos veces."""
    if d.id_persona_mayor is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Eloy no está vinculado")
    d.ultima_conexion = tiempo.ahora_utc()
    a, nueva = registrar_alerta(
        db, id_persona=d.id_persona_mayor, id_dispositivo=d.id, id_local=body.id_local, origen=body.origen,
        motivo=body.motivo, audio_key=body.audio_key, audio_duracion_seg=body.audio_duracion_seg,
        ocurrida_en=tiempo.entrada_a_utc(body.ocurrida_en) or tiempo.ahora_utc())
    db.commit()
    if nueva:
        tareas.add_task(despachar_alerta, a.id)
    return {"id": a.id, "nueva": nueva}


def _avisar_mensaje(id_mensaje: int) -> None:
    with SessionLocal() as db:
        m = db.get(Mensaje, id_mensaje)
        p = db.get(PersonaMayor, m.id_persona_mayor)
        if m.id_familiar_destino:
            ids = [m.id_familiar_destino]
        else:
            ids = list(db.scalars(select(Familiar.id).where(
                Familiar.id_persona_mayor == p.id, Familiar.eliminado_en.is_(None),
                Familiar.id_usuario_app.is_not(None))))
        push_a_familiares(db, ids, f"Mensaje de {p.nombre}", m.texto or "Te mandó un audio",
                          {"tipo": "mensaje", "id_persona": p.id, "id_mensaje": m.id})


@router.post("/sync")
def sync(body: SyncIn, tareas: BackgroundTasks, d: Dispositivo = Depends(dispositivo_actual),
         db: Session = Depends(get_db)):
    """Sección 14. Ver el README para el formato completo y el orden de los pasos."""
    salida, res = sincronizar(db, d, body)
    for id_alerta in res.alertas_nuevas:
        tareas.add_task(despachar_alerta, id_alerta)
    for id_mensaje in res.mensajes_nuevos:
        tareas.add_task(_avisar_mensaje, id_mensaje)
    return salida
