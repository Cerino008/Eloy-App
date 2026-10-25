"""POST /dispositivo/sync: lo que hace el servidor con lo que manda Eloy (secciones 13 y 14).

Orden de proceso (importa):
  1. estado del aparato y resultado de comandos (un restaurar_fabrica ejecutado desvincula)
  2. confirmaciones de lo que Eloy recibió en la vuelta anterior -> se completa id_local
     ANTES de mirar las listas, así una fila nacida en la app no se duplica
  3. listas completas (usuario, familiares, recordatorios, memoria)
  4. lo nuevo de las tablas que crecen (eventos, mensajes, resúmenes)
  5. respuesta: lo pendiente para Eloy
"""
from __future__ import annotations

import logging
import re
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import tiempo
from app.models import (
    AlertaSOS, ComandoDispositivo, Dispositivo, Evento, Familiar, MemoriaAgente, Mensaje,
    PersonaMayor, Recordatorio, RecordatorioEjecucion, ResumenDiario,
)
from app.schemas_dispositivo import (
    FamiliarPi, RecordatorioPi, SyncIn,
)
from app.servicios.alertas import registrar_alerta
from app.tiempo import DIAS

log = logging.getLogger("eloy.sync")

_RE_MINUTOS = re.compile(r"(\d+)\s*minuto", re.IGNORECASE)


class ResultadoSync:
    def __init__(self) -> None:
        self.alertas_nuevas: list[int] = []
        self.mensajes_nuevos: list[int] = []


# ---------------------------------------------------------------- utilidades

def _version(fila) -> str:
    return fila.actualizado_en.isoformat()


def restaurar_pendiente(db: Session, d: Dispositivo) -> bool:
    return db.scalar(select(func.count()).select_from(ComandoDispositivo).where(
        ComandoDispositivo.id_dispositivo == d.id, ComandoDispositivo.tipo == "restaurar_fabrica",
        ComandoDispositivo.estado.in_(("pendiente", "enviado")))) > 0


def _duracion(tipo: str, descripcion: str | None, duracion: int | None) -> int | None:
    if duracion is not None:
        return duracion
    if tipo != "conversacion" or not descripcion:
        return None
    m = _RE_MINUTOS.search(descripcion)  # "charló 4 minuto(s)"
    return int(m.group(1)) if m else None


def recordatorio_desde_pi(item: RecordatorioPi) -> dict:
    """Tabla 13: se_repite_diario -> diaria; días distintos de 'todos' -> semanal;
    con fecha -> una_vez + fecha; el resto -> una_vez sin fecha."""
    dias_txt = (item.dias_semana or "").strip().lower()
    dias = {d.strip() for d in dias_txt.split(",") if d.strip() in DIAS}
    if item.se_repite_diario or dias_txt == "todos":
        rep, dias_set, fecha = "diaria", None, None
    elif dias:
        rep, dias_set, fecha = "semanal", dias, None
    elif item.fecha:
        rep, dias_set, fecha = "una_vez", None, item.fecha
    else:
        rep, dias_set, fecha = "una_vez", None, None
    return {
        "titulo": item.titulo[:120], "descripcion": item.descripcion, "hora": item.horario,
        "repeticion": rep, "dias_semana": dias_set, "fecha_unica": fecha, "completado": item.completado,
    }


def recordatorio_hacia_pi(r: Recordatorio) -> dict:
    dias = None
    if r.repeticion == "diaria":
        dias = "todos"
    elif r.repeticion == "semanal":
        dias = ",".join(d for d in DIAS if d in (r.dias_semana or ()))
    return {
        "id": r.id, "id_local": r.id_local, "eliminado": r.eliminado_en is not None, "version": _version(r),
        "titulo": r.titulo, "descripcion": r.descripcion, "horario": r.hora.strftime("%H:%M"),
        "se_repite_diario": r.repeticion == "diaria", "dias_semana": dias,
        "fecha": r.fecha_unica.isoformat() if r.fecha_unica else None, "completado": r.completado,
    }


def familiar_hacia_pi(f: Familiar) -> dict:
    return {
        "id": f.id, "id_local": f.id_local, "eliminado": f.eliminado_en is not None, "version": _version(f),
        "nombre": f.nombre, "relacion": f.parentesco, "numero_whatsapp": f.telefono,
        "numero_prioridad": f.prioridad_alerta,
    }


# ---------------------------------------------------------------- pasos

def _aplicar_estado(d: Dispositivo, body: SyncIn) -> None:
    d.ultima_conexion = tiempo.ahora_utc()
    if body.estado:
        if body.estado.volumen is not None:
            d.volumen = body.estado.volumen
        if body.estado.wifi_ssid is not None:
            d.wifi_ssid = body.estado.wifi_ssid
        if body.estado.version_software is not None:
            d.version_software = body.estado.version_software


def _aplicar_resultados_comandos(db: Session, d: Dispositivo, body: SyncIn) -> None:
    ahora = tiempo.ahora_utc()
    for res in body.comandos:
        c = db.get(ComandoDispositivo, res.id)
        if c is None or c.id_dispositivo != d.id or c.estado in ("ejecutado", "fallido"):
            continue
        c.estado = res.estado
        c.ejecutado_en = ahora if res.estado == "ejecutado" else None
        c.error = (res.error or "")[:255] or None
        if c.tipo == "restaurar_fabrica" and res.estado == "ejecutado":
            desvincular_tras_restaurar(db, d)


def desvincular_tras_restaurar(db: Session, d: Dispositivo) -> None:
    """Sección 15.5, con un cambio: los id_local se anulan recién cuando Eloy CONFIRMA
    que restauró. Si se anulan al pedirlo (como el documento), una sincronización
    que llegue antes de que Eloy ejecute el comando vuelve a insertar todo duplicado."""
    persona = d.id_persona_mayor
    for modelo in (Familiar, Recordatorio, Evento, Mensaje, AlertaSOS):
        db.execute(update(modelo).where(modelo.id_dispositivo == d.id).values(id_local=None))
    if persona is not None:
        # Familiares y recordatorios quedan en la cuenta de la familia: si se vuelve
        # a vincular un Eloy a la misma persona, se le mandan de nuevo.
        for modelo in (Familiar, Recordatorio):
            db.execute(update(modelo).where(modelo.id_persona_mayor == persona,
                                            modelo.eliminado_en.is_(None))
                       .values(pendiente_sync=True, id_dispositivo=None))
        db.execute(MemoriaAgente.__table__.delete().where(MemoriaAgente.id_persona_mayor == persona))
    d.id_persona_mayor = None
    d.vinculado_en = None
    d.wifi_ssid = None


def _aplicar_confirmaciones(db: Session, d: Dispositivo, persona: int, body: SyncIn) -> None:
    ahora = tiempo.ahora_utc()
    for conf in body.confirmaciones:
        try:
            with db.begin_nested():  # si una falla (id_local repetido) no tira abajo el resto
                _confirmar(db, d, persona, conf, ahora)
        except IntegrityError:
            log.warning("Confirmación ignorada (id_local repetido): %s", conf)


def _confirmar(db: Session, d: Dispositivo, persona: int, conf, ahora: datetime) -> None:
    if conf.tabla == "mensajes":
        m = db.get(Mensaje, conf.id)
        if m is None or m.id_persona_mayor != persona:
            return
        m.id_dispositivo, m.id_local = d.id, conf.id_local
        if m.estado == "pendiente":
            m.estado, m.entregado_en = "entregado", ahora
    else:
        modelo = Recordatorio if conf.tabla == "recordatorios" else Familiar
        fila = db.get(modelo, conf.id)
        if fila is None or fila.id_persona_mayor != persona:
            return
        # Si la app lo volvió a cambiar después de mandarlo, sigue pendiente.
        vigente = conf.version is None or conf.version == _version(fila)
        if fila.eliminado_en is not None:
            fila.id_local = None
        elif conf.id_local is not None:
            fila.id_dispositivo, fila.id_local = d.id, conf.id_local
        if vigente:
            fila.pendiente_sync = False
    db.flush()


def _aplicar_usuario(db: Session, persona: PersonaMayor, body: SyncIn) -> None:
    if body.usuario is None:
        return
    persona.nombre = body.usuario.nombre
    persona.edad = body.usuario.edad
    persona.tiene_pulsera = body.usuario.tiene_pulsera


def _aplicar_familiares(db: Session, d: Dispositivo, persona: int, lista: list[FamiliarPi]) -> None:
    ahora = tiempo.ahora_utc()
    existentes = {f.id_local: f for f in db.scalars(select(Familiar).where(
        Familiar.id_dispositivo == d.id, Familiar.id_local.is_not(None)))}
    vistos = set()
    for item in lista:
        vistos.add(item.id)
        f = existentes.get(item.id)
        datos = {"nombre": item.nombre[:80], "parentesco": item.relacion,
                 "telefono": item.numero_whatsapp, "prioridad_alerta": item.numero_prioridad}
        if f is None:
            # ¿Ya existe en el servidor sin id_local? (ej.: el administrador que se creó
            # al vincular y que en la Pi se cargó en la primera conexión). Se adopta por nombre.
            f = db.scalar(select(Familiar).where(
                Familiar.id_persona_mayor == persona, Familiar.id_local.is_(None),
                Familiar.eliminado_en.is_(None), func.lower(Familiar.nombre) == item.nombre.lower(),
            ).limit(1))
            if f is not None:
                for campo, valor in datos.items():
                    if getattr(f, campo) is None:
                        setattr(f, campo, valor)
                f.id_dispositivo, f.id_local = d.id, item.id
                f.pendiente_sync = True  # Eloy recibe la versión combinada
                continue
            db.add(Familiar(id_persona_mayor=persona, id_dispositivo=d.id, id_local=item.id, **datos))
            continue
        if f.pendiente_sync:
            continue  # gana la app
        for campo, valor in datos.items():
            setattr(f, campo, valor)
        f.eliminado_en = None
    for id_local, f in existentes.items():
        if id_local in vistos or f.pendiente_sync or f.eliminado_en is not None:
            continue
        if f.id_usuario_app is not None:
            # Tiene cuenta en la app: borrarlo desde la voz no le quita el acceso,
            # solo deja de estar en la lista de Eloy.
            f.id_dispositivo, f.id_local = None, None
        else:
            f.eliminado_en = ahora


def _aplicar_recordatorios(db: Session, d: Dispositivo, persona: int, lista: list[RecordatorioPi]) -> None:
    ahora = tiempo.ahora_utc()
    existentes = {r.id_local: r for r in db.scalars(select(Recordatorio).where(
        Recordatorio.id_dispositivo == d.id, Recordatorio.id_local.is_not(None)))}
    vistos = set()
    for item in lista:
        vistos.add(item.id)
        r = existentes.get(item.id)
        datos = recordatorio_desde_pi(item)
        if r is None:
            r = Recordatorio(id_persona_mayor=persona, creado_desde="eloy", id_dispositivo=d.id,
                             id_local=item.id, **datos)
            db.add(r)
            db.flush()
        elif not r.pendiente_sync:
            for campo, valor in datos.items():
                setattr(r, campo, valor)
            r.eliminado_en = None
        if item.ultima_ejecucion:
            db.execute(mysql_insert(RecordatorioEjecucion)
                       .values(id_recordatorio=r.id, fecha=item.ultima_ejecucion, reportado_en=ahora)
                       .on_duplicate_key_update(reportado_en=RecordatorioEjecucion.reportado_en))
    for id_local, r in existentes.items():
        if id_local not in vistos and not r.pendiente_sync and r.eliminado_en is None:
            r.eliminado_en = ahora


def _aplicar_memoria(db: Session, d: Dispositivo, persona: int, lista) -> None:
    # Claves que la familia pidió borrar y Eloy todavía no borró: no se reviven.
    por_borrar = {
        (c.parametros or {}).get("clave") for c in db.scalars(select(ComandoDispositivo).where(
            ComandoDispositivo.id_dispositivo == d.id, ComandoDispositivo.tipo == "borrar_memoria",
            ComandoDispositivo.estado.in_(("pendiente", "enviado"))))
    }
    existentes = {m.clave: m for m in db.scalars(select(MemoriaAgente).where(
        MemoriaAgente.id_persona_mayor == persona))}
    vistas = set()
    for item in lista:
        if item.clave in por_borrar:
            continue
        vistas.add(item.clave)
        m = existentes.get(item.clave)
        if m is None:
            db.add(MemoriaAgente(id_persona_mayor=persona, clave=item.clave[:100], valor=item.valor))
        else:
            m.valor = item.valor
    for clave, m in existentes.items():
        if clave not in vistas:
            db.delete(m)


def _aplicar_eventos(db: Session, d: Dispositivo, persona: int, body: SyncIn) -> None:
    for e in body.eventos:
        db.execute(mysql_insert(Evento).values(
            id_persona_mayor=persona, id_dispositivo=d.id, id_local=e.id, tipo=e.tipo[:30],
            descripcion=(e.descripcion or None) and e.descripcion[:500],
            duracion_min=_duracion(e.tipo, e.descripcion, e.duracion_min),
            ocurrido_en=tiempo.entrada_a_utc(e.ocurrio_en), creado_en=tiempo.ahora_utc(),
        ).on_duplicate_key_update(id=Evento.id))


def _buscar_familiar(db: Session, persona: int, nombre: str | None) -> Familiar | None:
    if not nombre:
        return None
    return db.scalar(select(Familiar).where(
        Familiar.id_persona_mayor == persona, Familiar.eliminado_en.is_(None),
        func.lower(Familiar.nombre) == nombre.strip().lower()).limit(1))


def _aplicar_mensajes(db: Session, d: Dispositivo, p: PersonaMayor, body: SyncIn, res: ResultadoSync) -> None:
    ahora = tiempo.ahora_utc()
    for m in body.mensajes:
        creado = tiempo.local_a_utc(m.creado, p.zona_horaria) if m.creado else ahora

        if m.tipo == "emergencia":
            alerta, nueva = registrar_alerta(
                db, id_persona=p.id, id_dispositivo=d.id, id_local=m.id, origen="voz",
                motivo=m.texto, audio_key=m.audio_key, audio_duracion_seg=m.audio_duracion_seg,
                ocurrida_en=creado)
            if nueva:
                db.flush()
                res.alertas_nuevas.append(alerta.id)
            continue

        fila = db.scalar(select(Mensaje).where(Mensaje.id_dispositivo == d.id, Mensaje.id_local == m.id))
        if fila is not None:
            if m.direccion == "de_familia" and m.entregado and fila.estado != "leido":
                fila.estado, fila.leido_en = "leido", ahora
            continue
        if not (m.texto or m.audio_key):
            continue
        if m.direccion == "a_familia":
            destino = _buscar_familiar(db, p.id, m.para)
            fila = Mensaje(
                id_persona_mayor=p.id, direccion="a_familia", id_familiar_destino=destino.id if destino else None,
                nombre_emisor=m.de or p.nombre, nombre_destino=m.para, texto=m.texto,
                audio_url=m.audio_key, audio_duracion_seg=m.audio_duracion_seg,
                estado="entregado", entregado_en=ahora, id_dispositivo=d.id, id_local=m.id, creado_en=creado)
            db.add(fila)
            db.flush()
            res.mensajes_nuevos.append(fila.id)
        else:
            # de_familia que no nació en el servidor (ej.: escrito desde la página vieja de la Pi).
            emisor = _buscar_familiar(db, p.id, m.de)
            db.add(Mensaje(
                id_persona_mayor=p.id, direccion="de_familia", id_familiar_emisor=emisor.id if emisor else None,
                nombre_emisor=m.de, nombre_destino=p.nombre, texto=m.texto, audio_url=m.audio_key,
                estado="leido" if m.entregado else "entregado", entregado_en=creado,
                leido_en=ahora if m.entregado else None, id_dispositivo=d.id, id_local=m.id, creado_en=creado))

    # Mensajes que Eloy ya leyó en voz alta (la Pi no tiene "fecha de cambio", así
    # que el servidor le pregunta por los que esperan lectura y ella responde).
    if body.mensajes_leidos:
        db.execute(update(Mensaje).where(
            Mensaje.id_dispositivo == d.id, Mensaje.id_local.in_(body.mensajes_leidos),
            Mensaje.direccion == "de_familia", Mensaje.estado != "leido",
        ).values(estado="leido", leido_en=ahora))


def _aplicar_resumenes(db: Session, persona: int, body: SyncIn) -> None:
    for r in body.resumenes:
        db.execute(mysql_insert(ResumenDiario).values(
            id_persona_mayor=persona, fecha=r.fecha, texto=r.texto, generado_por="eloy",
            creado_en=tiempo.ahora_utc(), actualizado_en=tiempo.ahora_utc(),
        ).on_duplicate_key_update(texto=r.texto, actualizado_en=tiempo.ahora_utc()))


def _respuesta(db: Session, d: Dispositivo, persona: PersonaMayor | None) -> dict:
    ahora = tiempo.ahora_utc()
    comandos = db.scalars(select(ComandoDispositivo).where(
        ComandoDispositivo.id_dispositivo == d.id,
        ComandoDispositivo.estado.in_(("pendiente", "enviado"))).order_by(ComandoDispositivo.id)).all()
    for c in comandos:
        if c.estado == "pendiente":
            c.estado, c.enviado_en = "enviado", ahora
    salida = {
        "vinculado": persona is not None,
        "comandos": [{"id": c.id, "tipo": c.tipo, "parametros": c.parametros} for c in comandos],
        "mensajes": [], "mensajes_esperando_lectura": [], "recordatorios": [], "familiares": [],
    }
    if persona is None or restaurar_pendiente(db, d):
        return salida
    salida["id_persona"] = persona.id
    salida["zona_horaria"] = persona.zona_horaria
    salida["mensajes"] = [
        {"id": m.id, "de": m.nombre_emisor, "texto": m.texto, "creado_en": m.creado_en.isoformat() + "Z"}
        for m in db.scalars(select(Mensaje).where(
            Mensaje.id_persona_mayor == persona.id, Mensaje.direccion == "de_familia",
            Mensaje.estado == "pendiente").order_by(Mensaje.id))
    ]
    salida["mensajes_esperando_lectura"] = list(db.scalars(select(Mensaje.id_local).where(
        Mensaje.id_dispositivo == d.id, Mensaje.direccion == "de_familia",
        Mensaje.estado == "entregado", Mensaje.id_local.is_not(None))))
    salida["recordatorios"] = [recordatorio_hacia_pi(r) for r in db.scalars(select(Recordatorio).where(
        Recordatorio.id_persona_mayor == persona.id, Recordatorio.pendiente_sync.is_(True)))]
    salida["familiares"] = [familiar_hacia_pi(f) for f in db.scalars(select(Familiar).where(
        Familiar.id_persona_mayor == persona.id, Familiar.pendiente_sync.is_(True)))]
    # Borrados en la app de filas que Eloy nunca recibió: no hace falta mandarlos.
    for lista, modelo in (("recordatorios", Recordatorio), ("familiares", Familiar)):
        inutiles = [x["id"] for x in salida[lista] if x["eliminado"] and x["id_local"] is None]
        if inutiles:
            db.execute(update(modelo).where(modelo.id.in_(inutiles)).values(pendiente_sync=False))
            salida[lista] = [x for x in salida[lista] if x["id"] not in inutiles]
    return salida


# ---------------------------------------------------------------- entrada

def sincronizar(db: Session, d: Dispositivo, body: SyncIn) -> tuple[dict, ResultadoSync]:
    res = ResultadoSync()
    _aplicar_estado(d, body)
    _aplicar_resultados_comandos(db, d, body)
    db.flush()

    persona = db.get(PersonaMayor, d.id_persona_mayor) if d.id_persona_mayor else None
    # Sin vincular, o con un restaurar en curso: no se guarda nada de lo que manda.
    if persona is not None and not restaurar_pendiente(db, d):
        _aplicar_confirmaciones(db, d, persona.id, body)
        _aplicar_usuario(db, persona, body)
        if body.familiares is not None:
            _aplicar_familiares(db, d, persona.id, body.familiares)
        db.flush()
        if body.recordatorios is not None:
            _aplicar_recordatorios(db, d, persona.id, body.recordatorios)
        if body.memoria is not None:
            _aplicar_memoria(db, d, persona.id, body.memoria)
        _aplicar_eventos(db, d, persona.id, body)
        _aplicar_mensajes(db, d, persona, body, res)
        _aplicar_resumenes(db, persona.id, body)
        db.flush()

    salida = _respuesta(db, d, persona)
    db.commit()
    return salida, res
