"""Modelos SQLAlchemy 2.0, uno por tabla de sql/eloy_servidor.sql.

El esquema lo crea el script SQL (es la fuente de verdad y está probado en
MySQL 8 y MariaDB 10.11). Estos modelos solo lo mapean: si cambiás una tabla,
cambiá primero el .sql y después acá.
"""
from __future__ import annotations

from datetime import date, datetime, time
from typing import Any, Optional

from sqlalchemy import (
    JSON, BigInteger, Boolean, Date, DateTime, Enum, ForeignKey, Integer,
    SmallInteger, String, Text, Time,
)
from sqlalchemy.dialects.mysql import SET
from sqlalchemy.orm import Mapped, mapped_column

from app import tiempo
from app.db import Base
from app.tiempo import DIAS


def _ahora() -> datetime:
    return tiempo.ahora_utc()


def _enum(*valores: str) -> Enum:
    return Enum(*valores, native_enum=True, validate_strings=True)


class _Creado:
    creado_en: Mapped[datetime] = mapped_column(DateTime, default=_ahora)


class _Actualizado(_Creado):
    actualizado_en: Mapped[datetime] = mapped_column(DateTime, default=_ahora, onupdate=_ahora)


# ===================== CUENTAS Y FAMILIA =====================

class UsuarioApp(_Creado, Base):
    __tablename__ = "usuarios_app"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80))
    apellido: Mapped[Optional[str]] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    telefono: Mapped[Optional[str]] = mapped_column(String(30))
    email_verificado: Mapped[bool] = mapped_column(Boolean, default=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    ultimo_acceso: Mapped[Optional[datetime]] = mapped_column(DateTime)


class Sesion(_Creado, Base):
    __tablename__ = "sesiones"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_usuario_app: Mapped[int] = mapped_column(ForeignKey("usuarios_app.id", ondelete="CASCADE"))
    refresh_hash: Mapped[str] = mapped_column(String(64))
    nombre_equipo: Mapped[Optional[str]] = mapped_column(String(100))
    ultimo_uso: Mapped[Optional[datetime]] = mapped_column(DateTime)
    expira_en: Mapped[datetime] = mapped_column(DateTime)
    revocada_en: Mapped[Optional[datetime]] = mapped_column(DateTime)


class TokenPush(_Creado, Base):
    __tablename__ = "tokens_push"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_usuario_app: Mapped[int] = mapped_column(ForeignKey("usuarios_app.id", ondelete="CASCADE"))
    token: Mapped[str] = mapped_column(String(255))
    plataforma: Mapped[str] = mapped_column(_enum("android", "ios", "web"))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    ultimo_uso: Mapped[Optional[datetime]] = mapped_column(DateTime)


class PersonaMayor(_Actualizado, Base):
    __tablename__ = "personas_mayores"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80))
    apellido: Mapped[Optional[str]] = mapped_column(String(80))
    edad: Mapped[Optional[int]] = mapped_column(SmallInteger)
    fecha_nacimiento: Mapped[Optional[date]] = mapped_column(Date)
    telefono: Mapped[Optional[str]] = mapped_column(String(30))
    tiene_pulsera: Mapped[bool] = mapped_column(Boolean, default=False)
    zona_horaria: Mapped[str] = mapped_column(String(50), default="America/Argentina/Buenos_Aires")
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class Familiar(_Actualizado, Base):
    __tablename__ = "familiares"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_persona_mayor: Mapped[int] = mapped_column(ForeignKey("personas_mayores.id", ondelete="CASCADE"))
    id_usuario_app: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios_app.id", ondelete="SET NULL"))
    nombre: Mapped[str] = mapped_column(String(80))
    parentesco: Mapped[Optional[str]] = mapped_column(String(40))
    rol: Mapped[str] = mapped_column(_enum("administrador", "familiar"), default="familiar")
    recibe_alertas: Mapped[bool] = mapped_column(Boolean, default=True)
    prioridad_alerta: Mapped[Optional[int]] = mapped_column(SmallInteger)
    telefono: Mapped[Optional[str]] = mapped_column(String(30))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    id_dispositivo: Mapped[Optional[int]] = mapped_column(ForeignKey("dispositivos.id", ondelete="SET NULL"))
    id_local: Mapped[Optional[int]] = mapped_column(Integer)
    pendiente_sync: Mapped[bool] = mapped_column(Boolean, default=False)
    eliminado_en: Mapped[Optional[datetime]] = mapped_column(DateTime)


class Invitacion(_Creado, Base):
    __tablename__ = "invitaciones"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_persona_mayor: Mapped[int] = mapped_column(ForeignKey("personas_mayores.id", ondelete="CASCADE"))
    id_familiar: Mapped[Optional[int]] = mapped_column(ForeignKey("familiares.id", ondelete="CASCADE"))
    invitado_por: Mapped[Optional[int]] = mapped_column(ForeignKey("familiares.id", ondelete="SET NULL"))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    rol: Mapped[str] = mapped_column(_enum("administrador", "familiar"), default="familiar")
    codigo_hash: Mapped[str] = mapped_column(String(64))
    expira_en: Mapped[datetime] = mapped_column(DateTime)
    aceptada_en: Mapped[Optional[datetime]] = mapped_column(DateTime)
    id_usuario_acepto: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios_app.id", ondelete="SET NULL"))


# ===================== DISPOSITIVO ELOY =====================

class Dispositivo(_Creado, Base):
    __tablename__ = "dispositivos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    uid_serie: Mapped[str] = mapped_column(String(64))
    secret_hash: Mapped[str] = mapped_column(String(255))
    id_persona_mayor: Mapped[Optional[int]] = mapped_column(ForeignKey("personas_mayores.id", ondelete="SET NULL"))
    vinculado_en: Mapped[Optional[datetime]] = mapped_column(DateTime)
    wifi_ssid: Mapped[Optional[str]] = mapped_column(String(64))
    volumen: Mapped[int] = mapped_column(SmallInteger, default=70)
    version_software: Mapped[Optional[str]] = mapped_column(String(20))
    ultima_conexion: Mapped[Optional[datetime]] = mapped_column(DateTime)


class CodigoVinculacion(_Creado, Base):
    __tablename__ = "codigos_vinculacion"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_dispositivo: Mapped[int] = mapped_column(ForeignKey("dispositivos.id", ondelete="CASCADE"))
    codigo: Mapped[str] = mapped_column(String(12))
    expira_en: Mapped[datetime] = mapped_column(DateTime)
    usado_en: Mapped[Optional[datetime]] = mapped_column(DateTime)
    id_usuario_app: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios_app.id", ondelete="SET NULL"))
    intentos_fallidos: Mapped[int] = mapped_column(SmallInteger, default=0)


class ComandoDispositivo(_Creado, Base):
    __tablename__ = "comandos_dispositivo"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_dispositivo: Mapped[int] = mapped_column(ForeignKey("dispositivos.id", ondelete="CASCADE"))
    tipo: Mapped[str] = mapped_column(
        _enum("restaurar_fabrica", "ajustar_volumen", "borrar_memoria", "reiniciar"))
    parametros: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)
    estado: Mapped[str] = mapped_column(
        _enum("pendiente", "enviado", "ejecutado", "fallido"), default="pendiente")
    solicitado_por: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios_app.id", ondelete="SET NULL"))
    enviado_en: Mapped[Optional[datetime]] = mapped_column(DateTime)
    ejecutado_en: Mapped[Optional[datetime]] = mapped_column(DateTime)
    error: Mapped[Optional[str]] = mapped_column(String(255))


# ===================== ACTIVIDAD =====================

class Evento(_Creado, Base):
    __tablename__ = "eventos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_persona_mayor: Mapped[int] = mapped_column(ForeignKey("personas_mayores.id", ondelete="CASCADE"))
    id_dispositivo: Mapped[Optional[int]] = mapped_column(ForeignKey("dispositivos.id", ondelete="SET NULL"))
    id_local: Mapped[Optional[int]] = mapped_column(Integer)
    tipo: Mapped[str] = mapped_column(String(30))
    descripcion: Mapped[Optional[str]] = mapped_column(String(500))
    duracion_min: Mapped[Optional[int]] = mapped_column(SmallInteger)
    ocurrido_en: Mapped[datetime] = mapped_column(DateTime)


class Recordatorio(_Actualizado, Base):
    __tablename__ = "recordatorios"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_persona_mayor: Mapped[int] = mapped_column(ForeignKey("personas_mayores.id", ondelete="CASCADE"))
    titulo: Mapped[str] = mapped_column(String(120))
    descripcion: Mapped[Optional[str]] = mapped_column(String(255))
    hora: Mapped[time] = mapped_column(Time)
    repeticion: Mapped[str] = mapped_column(_enum("una_vez", "diaria", "semanal"))
    dias_semana: Mapped[Optional[set[str]]] = mapped_column(SET(*DIAS))
    fecha_unica: Mapped[Optional[date]] = mapped_column(Date)
    completado: Mapped[bool] = mapped_column(Boolean, default=False)
    creado_desde: Mapped[str] = mapped_column(_enum("app", "eloy"), default="app")
    creado_por: Mapped[Optional[int]] = mapped_column(ForeignKey("familiares.id", ondelete="SET NULL"))
    id_dispositivo: Mapped[Optional[int]] = mapped_column(ForeignKey("dispositivos.id", ondelete="SET NULL"))
    id_local: Mapped[Optional[int]] = mapped_column(Integer)
    pendiente_sync: Mapped[bool] = mapped_column(Boolean, default=False)
    eliminado_en: Mapped[Optional[datetime]] = mapped_column(DateTime)


class RecordatorioEjecucion(Base):
    __tablename__ = "recordatorio_ejecuciones"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_recordatorio: Mapped[int] = mapped_column(ForeignKey("recordatorios.id", ondelete="CASCADE"))
    fecha: Mapped[date] = mapped_column(Date)
    sono_en: Mapped[Optional[datetime]] = mapped_column(DateTime)
    confirmado_en: Mapped[Optional[datetime]] = mapped_column(DateTime)
    reportado_en: Mapped[datetime] = mapped_column(DateTime, default=_ahora)


class ResumenDiario(_Actualizado, Base):
    __tablename__ = "resumenes_diarios"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_persona_mayor: Mapped[int] = mapped_column(ForeignKey("personas_mayores.id", ondelete="CASCADE"))
    fecha: Mapped[date] = mapped_column(Date)
    texto: Mapped[str] = mapped_column(Text)
    generado_por: Mapped[str] = mapped_column(_enum("eloy", "servidor"), default="eloy")


class Mensaje(_Creado, Base):
    __tablename__ = "mensajes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_persona_mayor: Mapped[int] = mapped_column(ForeignKey("personas_mayores.id", ondelete="CASCADE"))
    direccion: Mapped[str] = mapped_column(_enum("de_familia", "a_familia"))
    id_familiar_emisor: Mapped[Optional[int]] = mapped_column(ForeignKey("familiares.id", ondelete="SET NULL"))
    id_familiar_destino: Mapped[Optional[int]] = mapped_column(ForeignKey("familiares.id", ondelete="SET NULL"))
    nombre_emisor: Mapped[Optional[str]] = mapped_column(String(80))
    nombre_destino: Mapped[Optional[str]] = mapped_column(String(80))
    texto: Mapped[Optional[str]] = mapped_column(Text)
    audio_url: Mapped[Optional[str]] = mapped_column(String(500))  # clave en el almacenamiento, no URL pública
    audio_duracion_seg: Mapped[Optional[int]] = mapped_column(SmallInteger)
    estado: Mapped[str] = mapped_column(_enum("pendiente", "entregado", "leido"), default="pendiente")
    entregado_en: Mapped[Optional[datetime]] = mapped_column(DateTime)
    leido_en: Mapped[Optional[datetime]] = mapped_column(DateTime)
    id_dispositivo: Mapped[Optional[int]] = mapped_column(ForeignKey("dispositivos.id", ondelete="SET NULL"))
    id_local: Mapped[Optional[int]] = mapped_column(Integer)


# ===================== ALERTAS SOS =====================

class AlertaSOS(_Creado, Base):
    __tablename__ = "alertas_sos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_persona_mayor: Mapped[int] = mapped_column(ForeignKey("personas_mayores.id", ondelete="CASCADE"))
    id_dispositivo: Mapped[Optional[int]] = mapped_column(ForeignKey("dispositivos.id", ondelete="SET NULL"))
    id_local: Mapped[Optional[int]] = mapped_column(Integer)
    origen: Mapped[str] = mapped_column(_enum("voz", "pulsera", "pantalla"), default="voz")
    motivo: Mapped[Optional[str]] = mapped_column(String(500))
    audio_url: Mapped[Optional[str]] = mapped_column(String(500))
    audio_duracion_seg: Mapped[Optional[int]] = mapped_column(SmallInteger)
    ocurrida_en: Mapped[datetime] = mapped_column(DateTime)
    estado: Mapped[str] = mapped_column(_enum("abierta", "atendida", "cerrada"), default="abierta")
    id_familiar_atiende: Mapped[Optional[int]] = mapped_column(ForeignKey("familiares.id", ondelete="SET NULL"))
    atendida_en: Mapped[Optional[datetime]] = mapped_column(DateTime)
    cerrada_en: Mapped[Optional[datetime]] = mapped_column(DateTime)
    nota_cierre: Mapped[Optional[str]] = mapped_column(String(255))
    # Repetición del aviso mientras nadie la atiende (v2.1)
    proximo_reaviso_en: Mapped[Optional[datetime]] = mapped_column(DateTime)
    avisos_repetidos: Mapped[int] = mapped_column(SmallInteger, default=0)


class NotificacionAlerta(Base):
    __tablename__ = "notificaciones_alerta"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_alerta: Mapped[int] = mapped_column(ForeignKey("alertas_sos.id", ondelete="CASCADE"))
    id_familiar: Mapped[int] = mapped_column(ForeignKey("familiares.id", ondelete="CASCADE"))
    nivel: Mapped[int] = mapped_column(SmallInteger)
    canal: Mapped[str] = mapped_column(_enum("push", "sms", "whatsapp", "llamada"), default="push")
    programada_en: Mapped[datetime] = mapped_column(DateTime)
    enviada_en: Mapped[Optional[datetime]] = mapped_column(DateTime)
    abierta_en: Mapped[Optional[datetime]] = mapped_column(DateTime)
    error: Mapped[Optional[str]] = mapped_column(String(255))


# ===================== SISTEMA =====================

class MemoriaAgente(_Actualizado, Base):
    __tablename__ = "memoria_agente"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_persona_mayor: Mapped[int] = mapped_column(ForeignKey("personas_mayores.id", ondelete="CASCADE"))
    clave: Mapped[str] = mapped_column(String(100))
    valor: Mapped[str] = mapped_column(Text)


class RegistroAuditoria(_Creado, Base):
    __tablename__ = "registro_auditoria"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_usuario_app: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios_app.id", ondelete="SET NULL"))
    id_persona_mayor: Mapped[Optional[int]] = mapped_column(ForeignKey("personas_mayores.id", ondelete="SET NULL"))
    accion: Mapped[str] = mapped_column(String(60))
    detalle: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)
    ip: Mapped[Optional[str]] = mapped_column(String(45))
