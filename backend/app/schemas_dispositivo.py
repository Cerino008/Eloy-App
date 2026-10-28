"""Contrato con la Raspberry. Los nombres siguen a la SQLite del dispositivo
(horario, relacion, numero_whatsapp...) para que el módulo de la Pi casi no traduzca.
Si en la SQLite real alguna columna se llama distinto, se cambia acá y listo."""
from __future__ import annotations

from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas import FechaUTC


class RegistroDispositivoIn(BaseModel):
    uid_serie: str = Field(min_length=4, max_length=64)
    secret: str = Field(min_length=32, max_length=200, description="Clave generada en la Pi; se guarda solo el hash")


class TokenDispositivoIn(BaseModel):
    uid_serie: str
    secret: str


class TokenDispositivoOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expira_en_seg: int
    vinculado: bool


class CodigoOut(BaseModel):
    codigo: str
    expira_en: FechaUTC  # con zona ("...Z"): la Pi puede estar en otra hora


class AlertaPiIn(BaseModel):
    id_local: int | None = Field(None, description="id del mensaje 'emergencia' en la SQLite")
    origen: Literal["voz", "pulsera", "pantalla"] = "voz"
    motivo: str | None = Field(None, max_length=500)
    audio_key: str | None = None
    audio_duracion_seg: int | None = Field(None, ge=0, le=65535)
    ocurrida_en: datetime | None = Field(None, description="UTC; si falta, la hora en que llega")


# ---------- /dispositivo/sync

class EstadoPi(BaseModel):
    volumen: int | None = Field(None, ge=0, le=100)
    wifi_ssid: str | None = Field(None, max_length=64)
    version_software: str | None = Field(None, max_length=20)


class UsuarioPi(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)
    edad: int | None = None
    tiene_pulsera: bool = False

    @field_validator("edad")
    @classmethod
    def _edad(cls, v):
        return v if v is None or 1 <= v <= 120 else None


class FamiliarPi(BaseModel):
    id: int
    nombre: str = Field(min_length=1)
    relacion: str | None = Field(None, max_length=40)
    numero_whatsapp: str | None = Field(None, max_length=30)
    numero_prioridad: int | None = Field(None, ge=1, le=255)


class RecordatorioPi(BaseModel):
    id: int
    titulo: str = Field(min_length=1)
    descripcion: str | None = Field(None, max_length=255)
    horario: time
    se_repite_diario: bool = False
    dias_semana: str | None = Field(None, description="'todos' o 'lunes,jueves'")
    fecha: date | None = None
    completado: bool = False
    ultima_ejecucion: date | None = Field(None, description="fecha local del último día que sonó")


class MemoriaPi(BaseModel):
    clave: str = Field(min_length=1, max_length=100)
    valor: str


class EventoPi(BaseModel):
    id: int
    tipo: str = Field(min_length=1)
    descripcion: str | None = None
    duracion_min: int | None = Field(None, ge=0)
    ocurrio_en: datetime = Field(description="UTC, tal cual el CURRENT_TIMESTAMP de SQLite")


class MensajePi(BaseModel):
    id: int
    tipo: Literal["mensaje", "emergencia"] = "mensaje"
    direccion: Literal["de_familia", "a_familia"] = "a_familia"
    de: str | None = None
    para: str | None = None
    texto: str | None = None
    audio_key: str | None = Field(None, description="lo que devolvió POST /dispositivo/audio")
    audio_duracion_seg: int | None = Field(None, ge=0, le=65535)
    creado: datetime | None = Field(None, description="hora LOCAL, como la guarda la Pi")
    entregado: bool = False


class ResumenPi(BaseModel):
    fecha: date
    texto: str = Field(min_length=1)


class ConfirmacionPi(BaseModel):
    tabla: Literal["mensajes", "recordatorios", "familiares"]
    id: int = Field(description="id del servidor que vino en la respuesta anterior")
    id_local: int | None = Field(None, description="id que le dio la SQLite (None si era un borrado)")
    version: str | None = Field(None, description="el 'version' que vino en la respuesta")


class ResultadoComandoPi(BaseModel):
    id: int
    estado: Literal["ejecutado", "fallido"]
    error: str | None = None


class SyncIn(BaseModel):
    estado: EstadoPi | None = None
    usuario: UsuarioPi | None = None
    # Listas completas: None = "esta vez no la mando"; [] = "no tengo ninguno".
    familiares: list[FamiliarPi] | None = None
    recordatorios: list[RecordatorioPi] | None = None
    memoria: list[MemoriaPi] | None = None
    # Incrementales: solo lo nuevo (id mayor al último enviado).
    eventos: list[EventoPi] = []
    mensajes: list[MensajePi] = []
    resumenes: list[ResumenPi] = []
    # Respuestas a la vuelta anterior.
    confirmaciones: list[ConfirmacionPi] = []
    mensajes_leidos: list[int] = Field([], description="id_local de los mensajes_esperando_lectura que ya tienen entregado = 1")
    comandos: list[ResultadoComandoPi] = []
