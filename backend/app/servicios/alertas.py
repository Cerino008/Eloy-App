"""Alertas SOS: alta, aviso escalonado y tarea de fondo (secciones 15.3 y 16)."""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import tiempo
from app.config import settings
from app.db import SessionLocal
from app.models import AlertaSOS, Familiar, NotificacionAlerta, PersonaMayor
from app.servicios.mantenimiento import limpiar_datos_viejos
from app.servicios.push import enviar_push

log = logging.getLogger("eloy.alertas")


def registrar_alerta(db: Session, *, id_persona: int, id_dispositivo: int | None, id_local: int | None,
                     origen: str, motivo: str | None, audio_key: str | None,
                     audio_duracion_seg: int | None, ocurrida_en: datetime) -> tuple[AlertaSOS, bool]:
    """Crea la alerta y programa un aviso por familiar. Si ya existía (reenvío de
    Eloy con el mismo id_local) no la duplica: solo completa el audio si faltaba.
    Devuelve (alerta, es_nueva). No hace commit."""
    if id_local is not None and id_dispositivo is not None:
        existente = db.scalar(select(AlertaSOS).where(
            AlertaSOS.id_dispositivo == id_dispositivo, AlertaSOS.id_local == id_local))
        if existente is not None:
            if audio_key and not existente.audio_url:
                existente.audio_url, existente.audio_duracion_seg = audio_key, audio_duracion_seg
            return existente, False

    ahora = tiempo.ahora_utc()
    alerta = AlertaSOS(
        id_persona_mayor=id_persona, id_dispositivo=id_dispositivo, id_local=id_local, origen=origen,
        motivo=motivo, audio_url=audio_key, audio_duracion_seg=audio_duracion_seg,
        ocurrida_en=ocurrida_en, creado_en=ahora,
        proximo_reaviso_en=ahora + timedelta(minutes=settings.reaviso_minutos), avisos_repetidos=0,
    )
    db.add(alerta)
    db.flush()

    familiares = db.scalars(
        select(Familiar).where(
            Familiar.id_persona_mayor == id_persona, Familiar.recibe_alertas.is_(True),
            Familiar.eliminado_en.is_(None), Familiar.prioridad_alerta.is_not(None),
        ).order_by(Familiar.prioridad_alerta, Familiar.id)
    ).all()
    # Escalado: el escalón depende del orden (1º, 2º, 3º...), no del número
    # de prioridad, así prioridades 1, 2, 5 no generan un hueco de 8 minutos.
    escalones = {p: i for i, p in enumerate(sorted({f.prioridad_alerta for f in familiares}))}
    for f in familiares:
        db.add(NotificacionAlerta(
            id_alerta=alerta.id, id_familiar=f.id, nivel=f.prioridad_alerta,
            # Sin cuenta en la app no hay push: queda para WhatsApp/SMS (decisión abierta 3).
            canal="push" if f.id_usuario_app else "whatsapp",
            programada_en=ahora + timedelta(minutes=settings.escalado_minutos * escalones[f.prioridad_alerta]),
        ))
    return alerta, True


# Último intento de cada aviso, en memoria de este proceso: evita golpear al servicio de
# push cada 5 segundos mientras está caído (se reintenta cada `reintento_segundos`).
_ultimo_intento: dict[int, datetime] = {}


def _enviar_una(db: Session, n: NotificacionAlerta, alerta: AlertaSOS, persona: PersonaMayor) -> tuple[str, str]:
    """Intenta mandar un aviso. Devuelve (resultado, detalle):
      "enviado"    salió bien.
      "reintentar" falla pasajera (sin internet, servicio caído, el familiar todavía no registró su
                   celular...): el aviso queda pendiente y se vuelve a intentar.
      "descartar"  no hay nada que reintentar (canal sin implementar): queda con error definitivo."""
    if n.canal != "push":
        return "descartar", f"canal {n.canal} todavía no configurado"
    try:
        r = enviar_push(
            db, [n.id_familiar], f"{persona.nombre} pidió ayuda", alerta.motivo or "Tocá para ver la alerta",
            {"tipo": "alerta", "id_alerta": alerta.id, "id_persona": persona.id}, urgente=True)
    except Exception as e:  # noqa: BLE001 - cualquier falla del servicio de push se reintenta
        log.exception("Falla enviando el aviso %s; se reintenta", n.id)
        return "reintentar", f"falló el servicio de push: {e}"[:255]
    if r.celulares == 0:
        return "reintentar", "sin celulares registrados"
    if r.enviados == 0:
        return "reintentar", "ningún celular recibió el aviso"
    return "enviado", ""


def enviar_avisos_vencidos(db: Session, id_alerta: int | None = None) -> int:
    """Manda los avisos cuya hora llegó. Seguro con varias instancias: cada aviso
    se "reclama" con un UPDATE condicional antes de mandarlo.

    Si el envío falla por algo pasajero, el aviso NO se marca con error: queda pendiente y se
    reintenta (cada `reintento_segundos`) mientras la alerta siga abierta y reciente."""
    ahora = tiempo.ahora_utc()
    q = (select(NotificacionAlerta, AlertaSOS, PersonaMayor)
         .join(AlertaSOS, AlertaSOS.id == NotificacionAlerta.id_alerta)
         .join(PersonaMayor, PersonaMayor.id == AlertaSOS.id_persona_mayor)
         .where(NotificacionAlerta.enviada_en.is_(None), NotificacionAlerta.error.is_(None),
                NotificacionAlerta.programada_en <= ahora)
         .order_by(NotificacionAlerta.programada_en))
    if id_alerta is not None:
        q = q.where(NotificacionAlerta.id_alerta == id_alerta)
    enviados = 0
    for n, alerta, persona in db.execute(q).all():
        if alerta.estado != "abierta":
            # Ya alguien se ocupa: los escalones que faltaban no se mandan.
            _marcar_error(db, n.id, "no enviada: la alerta ya estaba atendida")
            continue
        if ahora - alerta.creado_en > timedelta(minutes=settings.aviso_vigencia_minutos):
            # Es por la hora en que el SERVIDOR recibió la alerta, no por cuándo ocurrió: una alerta que
            # Eloy reporta tarde (estuvo sin internet) igual tiene que avisar.
            _marcar_error(db, n.id, f"descartado: la alerta tiene más de {settings.aviso_vigencia_minutos} minutos")
            continue
        ultimo = _ultimo_intento.get(n.id)
        if ultimo is not None and ahora - ultimo < timedelta(seconds=settings.reintento_segundos):
            continue  # falló hace poco: esperar antes de reintentar
        reclamada = db.execute(
            update(NotificacionAlerta)
            .where(NotificacionAlerta.id == n.id, NotificacionAlerta.enviada_en.is_(None),
                   NotificacionAlerta.error.is_(None))
            .values(enviada_en=ahora)
        ).rowcount
        db.commit()
        if not reclamada:
            continue  # la mandó otra instancia
        _ultimo_intento[n.id] = ahora
        resultado, detalle = _enviar_una(db, n, alerta, persona)
        if resultado == "enviado":
            enviados += 1
            _ultimo_intento.pop(n.id, None)
        elif resultado == "descartar":
            _marcar_error(db, n.id, detalle, reclamada=True)
            continue
        else:
            log.warning("Aviso %s pendiente (se reintenta): %s", n.id, detalle)
            db.execute(update(NotificacionAlerta).where(NotificacionAlerta.id == n.id).values(enviada_en=None))
        db.commit()
    return enviados


def _marcar_error(db: Session, id_aviso: int, texto: str, reclamada: bool = False) -> None:
    """Deja el aviso con un error definitivo (el worker no lo toma más).
    `reclamada=True` cuando este proceso ya lo había reclamado (tenía `enviada_en` puesto)."""
    q = update(NotificacionAlerta).where(NotificacionAlerta.id == id_aviso)
    if not reclamada:
        q = q.where(NotificacionAlerta.enviada_en.is_(None))  # no pisar uno que otra instancia ya mandó
    db.execute(q.values(enviada_en=None, error=texto[:255]))
    db.commit()
    _ultimo_intento.pop(id_aviso, None)


def repetir_avisos(db: Session) -> int:
    """Si una alerta sigue abierta, vuelve a avisar a quienes ya recibieron el primer aviso:
    cada `reaviso_minutos`, hasta `reavisos_maximos` veces. Se frena sola apenas alguien toca
    "Ya me ocupo yo". Devuelve cuántas alertas se repitieron."""
    ahora = tiempo.ahora_utc()
    vencidas = db.execute(select(AlertaSOS.id, AlertaSOS.avisos_repetidos).where(
        AlertaSOS.estado == "abierta", AlertaSOS.proximo_reaviso_en.is_not(None),
        AlertaSOS.proximo_reaviso_en <= ahora, AlertaSOS.avisos_repetidos < settings.reavisos_maximos)).all()
    repetidas = 0
    for id_alerta, ya_repetidos in vencidas:
        # Reclamo atómico: si hay varias instancias, solo una repite esta vez.
        reclamada = db.execute(
            update(AlertaSOS)
            .where(AlertaSOS.id == id_alerta, AlertaSOS.estado == "abierta",
                   AlertaSOS.avisos_repetidos == ya_repetidos)
            .values(avisos_repetidos=ya_repetidos + 1,
                    proximo_reaviso_en=ahora + timedelta(minutes=settings.reaviso_minutos))
        ).rowcount
        db.commit()
        if not reclamada:
            continue
        alerta = db.get(AlertaSOS, id_alerta)
        persona = db.get(PersonaMayor, alerta.id_persona_mayor)
        ya_avisados = list(db.scalars(select(NotificacionAlerta.id_familiar).where(
            NotificacionAlerta.id_alerta == id_alerta, NotificacionAlerta.canal == "push",
            NotificacionAlerta.enviada_en.is_not(None))))
        if not ya_avisados:
            continue  # todavía no salió ningún aviso: ya se está reintentando por el camino normal
        try:
            enviar_push(db, ya_avisados, f"{persona.nombre} sigue necesitando ayuda",
                        alerta.motivo or "Nadie atendió la alerta. Tocá para verla",
                        {"tipo": "alerta", "id_alerta": id_alerta, "id_persona": persona.id,
                         "repeticion": ya_repetidos + 1}, urgente=True)
            repetidas += 1
        except Exception:  # noqa: BLE001
            log.exception("Falló el reaviso %s de la alerta %s", ya_repetidos + 1, id_alerta)
        if ya_repetidos + 1 >= settings.reavisos_maximos:
            log.error("ALERTA %s sigue abierta después de %s reavisos: nadie la atendió", id_alerta, ya_repetidos + 1)
    return repetidas


def despachar_alerta(id_alerta: int) -> None:
    """Para BackgroundTasks: manda ya el primer escalón, sin esperar al worker."""
    with SessionLocal() as db:
        enviar_avisos_vencidos(db, id_alerta)


async def worker_avisos() -> None:
    """Corre en el proceso de la API. Si desplegás con escala a cero (Cloud Run),
    dejá al menos 1 instancia siempre prendida o los escalones no salen."""
    ultima_limpieza = 0.0  # time.monotonic() de la última limpieza (0 = todavía no hubo)

    def _tick(hacer_limpieza: bool):
        with SessionLocal() as db:
            enviar_avisos_vencidos(db)
            repetir_avisos(db)
            if hacer_limpieza:
                limpiar_datos_viejos(db)

    while True:
        try:
            ahora = time.monotonic()
            toca = ahora - ultima_limpieza >= settings.mantenimiento_cada_minutos * 60
            await asyncio.to_thread(_tick, toca)
            if toca:
                ultima_limpieza = ahora
        except Exception:  # noqa: BLE001
            log.exception("Error en el worker de avisos")
        await asyncio.sleep(settings.worker_intervalo_seg)
