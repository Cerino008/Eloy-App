"""Inicio, Familia, invitaciones y "Lo que Eloy sabe"."""
from datetime import timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import tiempo
from app.config import settings
from app.db import get_db
from app.deps import auditar, exigir_admin, familiar_de, persona_o_404, usuario_actual
from app.models import (
    AlertaSOS, ComandoDispositivo, Dispositivo, Evento, Familiar, Invitacion, MemoriaAgente,
    PersonaMayor, ResumenDiario, UsuarioApp,
)
from app.schemas import (
    AceptarInvitacionIn, DispositivoOut, FamiliaOut, FamiliarOut, FamiliarPatchIn, InicioOut,
    InvitacionIn, InvitacionOut, MemoriaOut, PersonaPatchIn, PersonaResumenOut, RecordatorioCortoOut,
    ResumenOut,
)
from app.seguridad import codigo_invitacion, limitador_invitacion, sha256
from app.servicios.recordatorios import hay_atrasado, recordatorios_del_dia

router = APIRouter(tags=["Personas y familia"])

CAMPOS_QUE_VAN_A_ELOY = {"nombre", "parentesco", "telefono", "prioridad_alerta"}


# ---------------------------------------------------------------- personas

@router.get("/personas", response_model=list[PersonaResumenOut])
def mis_personas(u: UsuarioApp = Depends(usuario_actual), db: Session = Depends(get_db)):
    """A quiénes sigue este usuario. La app lo llama al abrir para saber qué id usar."""
    filas = db.execute(
        select(PersonaMayor, Familiar).join(Familiar, Familiar.id_persona_mayor == PersonaMayor.id)
        .where(Familiar.id_usuario_app == u.id, Familiar.eliminado_en.is_(None), PersonaMayor.activo.is_(True))
        .order_by(PersonaMayor.nombre)
    ).all()
    return [PersonaResumenOut(id=p.id, nombre=p.nombre, mi_rol=f.rol, id_mi_familiar=f.id) for p, f in filas]


@router.patch("/personas/{id_persona}", status_code=204)
def editar_persona(id_persona: int, body: PersonaPatchIn, u: UsuarioApp = Depends(usuario_actual),
                   db: Session = Depends(get_db)):
    exigir_admin(familiar_de(db, u, id_persona))
    p = persona_o_404(db, id_persona)
    datos = body.model_dump(exclude_unset=True)
    if "zona_horaria" in datos:
        try:
            ZoneInfo(datos["zona_horaria"])
        except (ZoneInfoNotFoundError, ValueError):
            raise HTTPException(422, "Zona horaria inválida (ej.: America/Argentina/Buenos_Aires)") from None
    for campo, valor in datos.items():
        setattr(p, campo, valor)
    db.commit()


@router.get("/personas/{id_persona}/inicio", response_model=InicioOut)
def inicio(id_persona: int, u: UsuarioApp = Depends(usuario_actual), db: Session = Depends(get_db)):
    familiar_de(db, u, id_persona)
    p = persona_o_404(db, id_persona)
    hoy = tiempo.hoy_de(p.zona_horaria)

    de_hoy, _ = recordatorios_del_dia(db, p.id, hoy)

    # Estado (15.1): gana el primero que se cumpla.
    id_alerta = db.scalar(select(AlertaSOS.id).where(
        AlertaSOS.id_persona_mayor == p.id, AlertaSOS.estado == "abierta")
        .order_by(AlertaSOS.ocurrida_en.desc()).limit(1))
    conectado = db.scalar(select(func.count()).select_from(Dispositivo).where(
        Dispositivo.id_persona_mayor == p.id,
        Dispositivo.ultima_conexion >= hoy.ahora_utc - timedelta(minutes=settings.sin_conexion_minutos)))
    if id_alerta:
        estado = "alerta"
    elif not conectado:
        estado = "sin_conexion"
    elif hay_atrasado(de_hoy, hoy, settings.atencion_minutos):
        estado = "atencion"
    else:
        estado = "bien"

    ultima = db.scalar(select(func.max(Evento.ocurrido_en)).where(
        Evento.id_persona_mayor == p.id, Evento.tipo == "conversacion"))
    charlas, minutos = db.execute(select(func.count(), func.coalesce(func.sum(Evento.duracion_min), 0)).where(
        Evento.id_persona_mayor == p.id, Evento.tipo == "conversacion",
        Evento.ocurrido_en >= hoy.desde_utc, Evento.ocurrido_en < hoy.hasta_utc)).one()

    # Eloy escribe el resumen a las 21: durante el día se muestra el de ayer.
    r = db.scalar(select(ResumenDiario).where(
        ResumenDiario.id_persona_mayor == p.id, ResumenDiario.fecha >= hoy.fecha - timedelta(days=1))
        .order_by(ResumenDiario.fecha.desc()).limit(1))

    proximo = next((x["r"] for x in de_hoy if x["estado"] == "pendiente" and x["r"].hora >= hoy.hora_local), None)
    return InicioOut(
        persona={"id": p.id, "nombre": p.nombre},
        estado=estado,
        id_alerta_abierta=id_alerta,
        ultima_charla=ultima,
        resumen=ResumenOut(fecha=r.fecha, texto=r.texto, es_de_hoy=r.fecha == hoy.fecha) if r else None,
        charlas=charlas,
        minutos=int(minutos),
        recordatorios_cumplidos=sum(1 for x in de_hoy if x["estado"] == "sono"),
        recordatorios_total=len(de_hoy),
        proximo_recordatorio=RecordatorioCortoOut(id=proximo.id, hora=proximo.hora.strftime("%H:%M"),
                                                  titulo=proximo.titulo) if proximo else None,
    )


# ---------------------------------------------------------------- familia

@router.get("/personas/{id_persona}/familia", response_model=FamiliaOut)
def familia(id_persona: int, u: UsuarioApp = Depends(usuario_actual), db: Session = Depends(get_db)):
    yo = familiar_de(db, u, id_persona)
    ahora = tiempo.ahora_utc()
    fams = db.scalars(select(Familiar).where(
        Familiar.id_persona_mayor == id_persona, Familiar.eliminado_en.is_(None))
        .order_by((Familiar.rol == "administrador").desc(), Familiar.prioridad_alerta.is_(None),
                  Familiar.prioridad_alerta, Familiar.id)).all()
    disps = db.scalars(select(Dispositivo).where(Dispositivo.id_persona_mayor == id_persona)).all()
    restaurando = set(db.scalars(select(ComandoDispositivo.id_dispositivo).where(
        ComandoDispositivo.id_dispositivo.in_([d.id for d in disps] or [0]),
        ComandoDispositivo.tipo == "restaurar_fabrica",
        ComandoDispositivo.estado.in_(("pendiente", "enviado")))))
    limite = ahora - timedelta(minutes=settings.sin_conexion_minutos)
    return FamiliaOut(
        mi_rol=yo.rol,
        familiares=[FamiliarOut(
            id=f.id, nombre=f.nombre, parentesco=f.parentesco, rol=f.rol, recibe_alertas=f.recibe_alertas,
            prioridad_alerta=f.prioridad_alerta, telefono=f.telefono,
            tiene_cuenta=f.id_usuario_app is not None, soy_yo=f.id == yo.id) for f in fams],
        dispositivos=[DispositivoOut(
            id=d.id, conectado=bool(d.ultima_conexion and d.ultima_conexion >= limite),
            ultima_conexion=d.ultima_conexion, wifi_ssid=d.wifi_ssid, volumen=d.volumen,
            version_software=d.version_software, restaurando=d.id in restaurando) for d in disps],
    )


def _familiar_editable(db: Session, u: UsuarioApp, id_familiar: int) -> Familiar:
    f = db.get(Familiar, id_familiar)
    if f is None or f.eliminado_en is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Familiar no encontrado")
    exigir_admin(familiar_de(db, u, f.id_persona_mayor, ocultar_como="Familiar no encontrado"))
    return f


def _quedan_admins(db: Session, id_persona: int, sin: int) -> bool:
    return db.scalar(select(func.count()).select_from(Familiar).where(
        Familiar.id_persona_mayor == id_persona, Familiar.rol == "administrador",
        Familiar.eliminado_en.is_(None), Familiar.id_usuario_app.is_not(None), Familiar.id != sin)) > 0


@router.patch("/familiares/{id_familiar}", response_model=FamiliarOut)
def editar_familiar(id_familiar: int, body: FamiliarPatchIn, request: Request,
                    u: UsuarioApp = Depends(usuario_actual), db: Session = Depends(get_db)):
    """Solo administradores: rol, prioridad de aviso, teléfono... (sección 15.6)."""
    f = _familiar_editable(db, u, id_familiar)
    datos = body.model_dump(exclude_unset=True)
    if datos.get("rol") == "familiar" and f.rol == "administrador" and not _quedan_admins(db, f.id_persona_mayor, f.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Tiene que quedar al menos un administrador")
    if datos.get("rol") == "administrador" and f.id_usuario_app is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Para ser administrador primero tiene que aceptar una invitación")
    if "rol" in datos and datos["rol"] != f.rol:
        auditar(db, "cambiar_rol", request, id_usuario=u.id, id_persona=f.id_persona_mayor,
                id_familiar=f.id, de=f.rol, a=datos["rol"])
    for campo, valor in datos.items():
        setattr(f, campo, valor)
    if CAMPOS_QUE_VAN_A_ELOY & datos.keys():
        f.pendiente_sync = True
    db.commit()
    return FamiliarOut(id=f.id, nombre=f.nombre, parentesco=f.parentesco, rol=f.rol,
                       recibe_alertas=f.recibe_alertas, prioridad_alerta=f.prioridad_alerta,
                       telefono=f.telefono, tiene_cuenta=f.id_usuario_app is not None,
                       soy_yo=f.id_usuario_app == u.id)


@router.delete("/familiares/{id_familiar}", status_code=204)
def borrar_familiar(id_familiar: int, request: Request, u: UsuarioApp = Depends(usuario_actual),
                    db: Session = Depends(get_db)):
    f = _familiar_editable(db, u, id_familiar)
    if f.rol == "administrador" and not _quedan_admins(db, f.id_persona_mayor, f.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Tiene que quedar al menos un administrador")
    f.eliminado_en = tiempo.ahora_utc()
    f.pendiente_sync = f.id_local is not None  # si Eloy nunca lo tuvo, no hay nada que avisarle
    auditar(db, "borrar_familiar", request, id_usuario=u.id, id_persona=f.id_persona_mayor, id_familiar=f.id)
    db.commit()


# ---------------------------------------------------------------- invitaciones

@router.post("/personas/{id_persona}/invitaciones", response_model=InvitacionOut, status_code=201)
def invitar(id_persona: int, body: InvitacionIn, request: Request, u: UsuarioApp = Depends(usuario_actual),
            db: Session = Depends(get_db)):
    """Devuelve el link para compartir (WhatsApp, etc.) con un código de 8 caracteres adentro,
    que también se puede dictar o escribir a mano. En la base se guarda solo su hash."""
    yo = familiar_de(db, u, id_persona)
    exigir_admin(yo)
    if body.id_familiar is not None:
        f = db.get(Familiar, body.id_familiar)
        if f is None or f.id_persona_mayor != id_persona or f.eliminado_en is not None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Familiar no encontrado")
        if f.id_usuario_app is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Ese familiar ya tiene cuenta")
    for _ in range(5):
        codigo = codigo_invitacion()
        inv = Invitacion(id_persona_mayor=id_persona, id_familiar=body.id_familiar, invitado_por=yo.id,
                         email=body.email, rol=body.rol, codigo_hash=sha256(codigo),
                         expira_en=tiempo.ahora_utc() + timedelta(days=settings.invitacion_dias))
        try:
            with db.begin_nested():  # codigo_hash es UNIQUE: si justo se repite, se prueba con otro
                db.add(inv)
            break
        except IntegrityError:
            continue
    else:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "No se pudo generar la invitación, reintentá")
    auditar(db, "invitar_familiar", request, id_usuario=u.id, id_persona=id_persona,
            rol=body.rol, id_familiar=body.id_familiar)
    db.commit()
    return InvitacionOut(link=settings.link_invitacion + codigo, codigo=codigo, expira_en=inv.expira_en)


@router.post("/invitaciones/aceptar", response_model=PersonaResumenOut)
def aceptar_invitacion(body: AceptarInvitacionIn, request: Request, u: UsuarioApp = Depends(usuario_actual),
                       db: Session = Depends(get_db)):
    # Con 8 caracteres se podría probar a ciegas: 5 códigos equivocados cada 15 minutos por usuario.
    clave_limite = f"u{u.id}"
    if limitador_invitacion.bloqueado(clave_limite):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Demasiados intentos. Probá en 15 minutos.")
    ahora = tiempo.ahora_utc()
    inv = db.scalar(select(Invitacion).where(Invitacion.codigo_hash == sha256(body.codigo)).with_for_update())
    if inv is None or inv.aceptada_en is not None or inv.expira_en <= ahora:
        limitador_invitacion.fallo(clave_limite)
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La invitación no existe, ya se usó o venció")
    persona = persona_o_404(db, inv.id_persona_mayor)

    # ¿Este usuario ya estuvo en esta familia? (la clave única incluye a los borrados)
    previo = db.scalar(select(Familiar).where(
        Familiar.id_persona_mayor == persona.id, Familiar.id_usuario_app == u.id))
    if previo is not None and previo.eliminado_en is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya sos parte de esta familia")

    if inv.id_familiar is not None:
        f = db.get(Familiar, inv.id_familiar)
        if f is None or f.eliminado_en is not None or f.id_usuario_app is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "La invitación ya no es válida")
        if previo is not None:  # liberar la clave única antes de asignar la cuenta
            previo.id_usuario_app = None
            db.flush()
        f.id_usuario_app, f.rol = u.id, inv.rol
        f.email = f.email or u.email
    elif previo is not None:
        f = previo
        f.eliminado_en, f.rol, f.pendiente_sync = None, inv.rol, True
    else:
        siguiente = (db.scalar(select(func.max(Familiar.prioridad_alerta)).where(
            Familiar.id_persona_mayor == persona.id, Familiar.eliminado_en.is_(None))) or 0) + 1
        f = Familiar(id_persona_mayor=persona.id, id_usuario_app=u.id, nombre=u.nombre, rol=inv.rol,
                     telefono=u.telefono, email=u.email, prioridad_alerta=min(siguiente, 255),
                     pendiente_sync=True)
        db.add(f)
    db.flush()
    inv.aceptada_en, inv.id_usuario_acepto = ahora, u.id
    auditar(db, "aceptar_invitacion", request, id_usuario=u.id, id_persona=persona.id, id_familiar=f.id)
    db.commit()
    limitador_invitacion.limpiar(clave_limite)
    return PersonaResumenOut(id=persona.id, nombre=persona.nombre, mi_rol=f.rol, id_mi_familiar=f.id)


# ---------------------------------------------------------------- lo que Eloy sabe

@router.get("/personas/{id_persona}/memoria", response_model=list[MemoriaOut])
def memoria(id_persona: int, u: UsuarioApp = Depends(usuario_actual), db: Session = Depends(get_db)):
    familiar_de(db, u, id_persona)
    return [MemoriaOut(clave=m.clave, valor=m.valor, actualizado_en=m.actualizado_en)
            for m in db.scalars(select(MemoriaAgente).where(MemoriaAgente.id_persona_mayor == id_persona)
                                .order_by(MemoriaAgente.clave))]


@router.delete("/personas/{id_persona}/memoria/{clave}", status_code=204)
def borrar_memoria(id_persona: int, clave: str, request: Request, u: UsuarioApp = Depends(usuario_actual),
                   db: Session = Depends(get_db)):
    """Se borra ya en el servidor y se le pide a Eloy que lo olvide (comando borrar_memoria)."""
    exigir_admin(familiar_de(db, u, id_persona))
    m = db.scalar(select(MemoriaAgente).where(MemoriaAgente.id_persona_mayor == id_persona,
                                              MemoriaAgente.clave == clave))
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Eloy no tiene guardado eso")
    db.delete(m)
    for d in db.scalars(select(Dispositivo).where(Dispositivo.id_persona_mayor == id_persona)):
        db.add(ComandoDispositivo(id_dispositivo=d.id, tipo="borrar_memoria", parametros={"clave": clave},
                                  solicitado_por=u.id))
    auditar(db, "borrar_memoria", request, id_usuario=u.id, id_persona=id_persona, clave=clave)
    db.commit()
