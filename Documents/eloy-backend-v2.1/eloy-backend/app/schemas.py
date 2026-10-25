"""Lo que entra y sale de la API de la app. Todas las fechas salen en UTC con zona
("2026-10-18T13:42:00Z"); la app las muestra en la hora del celular."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Annotated, Literal, Optional

from pydantic import AfterValidator, BaseModel, EmailStr, Field, field_validator

from app.tiempo import DIAS


def _utc(v):
    return v.replace(tzinfo=timezone.utc) if isinstance(v, datetime) and v.tzinfo is None else v


FechaUTC = Annotated[datetime, AfterValidator(_utc)]
HoraHHMM = Annotated[str, Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$", examples=["09:00"])]


# ---------------------------------------------------------------- cuenta

class RegistroIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)
    apellido: str | None = Field(None, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    telefono: str | None = Field(None, max_length=30)
    nombre_equipo: str | None = Field(None, max_length=100, examples=["Moto G de Bautista"])


class LoginIn(BaseModel):
    email: EmailStr
    password: str
    nombre_equipo: str | None = Field(None, max_length=100)


class RefreshIn(BaseModel):
    refresh_token: str


class TokensOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expira_en_seg: int


class UsuarioOut(BaseModel):
    id: int
    nombre: str
    apellido: str | None
    email: str
    telefono: str | None


class PushTokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=255)
    plataforma: Literal["android", "ios", "web"]


# ---------------------------------------------------------------- personas / inicio

class PersonaResumenOut(BaseModel):
    id: int
    nombre: str
    mi_rol: str
    id_mi_familiar: int


class PersonaPatchIn(BaseModel):
    """Solo lo que Eloy no conoce. Nombre y edad los manda el dispositivo."""
    apellido: str | None = Field(None, max_length=80)
    telefono: str | None = Field(None, max_length=30)
    fecha_nacimiento: date | None = None
    zona_horaria: str | None = Field(None, max_length=50)


class ResumenOut(BaseModel):
    fecha: date
    texto: str
    es_de_hoy: bool


class RecordatorioCortoOut(BaseModel):
    id: int
    hora: str
    titulo: str


class InicioOut(BaseModel):
    persona: dict
    estado: Literal["bien", "atencion", "sin_conexion", "alerta"]
    id_alerta_abierta: int | None
    ultima_charla: Optional[FechaUTC]
    resumen: ResumenOut | None
    charlas: int
    minutos: int
    recordatorios_cumplidos: int
    recordatorios_total: int
    proximo_recordatorio: RecordatorioCortoOut | None


# ---------------------------------------------------------------- mensajes

class MensajeIn(BaseModel):
    texto: str = Field(min_length=1, max_length=2000)


class MensajeOut(BaseModel):
    id: int
    direccion: Literal["de_familia", "a_familia"]
    de: str | None
    para: str | None
    es_mio: bool
    texto: str | None
    audio_url: str | None = Field(description="link firmado, vence en minutos")
    audio_duracion_seg: int | None
    estado: Literal["pendiente", "entregado", "leido"]
    entregado_en: Optional[FechaUTC]
    leido_en: Optional[FechaUTC]
    creado_en: FechaUTC


# ---------------------------------------------------------------- recordatorios

Repeticion = Literal["una_vez", "diaria", "semanal"]


def _validar_dias(v):
    if v is None:
        return v
    malos = [d for d in v if d not in DIAS]
    if malos:
        raise ValueError(f"días inválidos: {malos}. Usá: {', '.join(DIAS)}")
    return v


class RecordatorioIn(BaseModel):
    titulo: str = Field(min_length=1, max_length=120)
    descripcion: str | None = Field(None, max_length=255)
    hora: HoraHHMM
    repeticion: Repeticion
    dias_semana: list[str] | None = None
    fecha_unica: date | None = None

    _dias = field_validator("dias_semana")(_validar_dias)


class RecordatorioPatchIn(BaseModel):
    titulo: str | None = Field(None, min_length=1, max_length=120)
    descripcion: str | None = Field(None, max_length=255)
    hora: HoraHHMM | None = None
    repeticion: Repeticion | None = None
    dias_semana: list[str] | None = None
    fecha_unica: date | None = None

    _dias = field_validator("dias_semana")(_validar_dias)


class RecordatorioOut(BaseModel):
    id: int
    titulo: str
    descripcion: str | None
    hora: str
    repeticion: Repeticion
    dias_semana: list[str]
    fecha_unica: date | None
    creado_desde: str
    sincronizado: bool = Field(description="False = Eloy todavía no recibió el último cambio")
    estado: Literal["sono", "pendiente"] | None = Field(None, description="solo en la lista de hoy")
    proxima_fecha: date | None = Field(None, description="solo en próximos días")


class RecordatoriosOut(BaseModel):
    fecha: date
    hoy: list[RecordatorioOut]
    proximos: list[RecordatorioOut]


# ---------------------------------------------------------------- alertas

class AvisadoOut(BaseModel):
    nombre: str
    parentesco: str | None


class AlertaOut(BaseModel):
    id: int
    id_persona: int
    persona: str
    telefono_persona: str | None
    estado: Literal["abierta", "atendida", "cerrada"]
    origen: str
    motivo: str | None
    audio_url: str | None
    audio_duracion_seg: int | None
    ocurrida_en: FechaUTC
    atendida_por: str | None
    atendida_por_mi: bool
    atendida_en: Optional[FechaUTC]
    cerrada_en: Optional[FechaUTC]
    nota_cierre: str | None
    tambien_avisamos_a: list[AvisadoOut]


class CerrarAlertaIn(BaseModel):
    nota: str | None = Field(None, max_length=255, examples=["Fui, se resbaló, está bien"])


# ---------------------------------------------------------------- familia

class FamiliarOut(BaseModel):
    id: int
    nombre: str
    parentesco: str | None
    rol: Literal["administrador", "familiar"]
    recibe_alertas: bool
    prioridad_alerta: int | None
    telefono: str | None
    tiene_cuenta: bool
    soy_yo: bool


class DispositivoOut(BaseModel):
    id: int
    conectado: bool
    ultima_conexion: Optional[FechaUTC]
    wifi_ssid: str | None
    volumen: int
    version_software: str | None
    restaurando: bool


class FamiliaOut(BaseModel):
    mi_rol: str
    familiares: list[FamiliarOut]
    dispositivos: list[DispositivoOut]


class FamiliarPatchIn(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=80)
    parentesco: str | None = Field(None, max_length=40)
    rol: Literal["administrador", "familiar"] | None = None
    recibe_alertas: bool | None = None
    prioridad_alerta: int | None = Field(None, ge=1, le=255)
    telefono: str | None = Field(None, max_length=30)


class InvitacionIn(BaseModel):
    email: EmailStr | None = None
    rol: Literal["administrador", "familiar"] = "familiar"
    id_familiar: int | None = Field(None, description="si ya está en la lista (ej. Juan) y solo le falta la cuenta")


class InvitacionOut(BaseModel):
    link: str
    codigo: str
    expira_en: FechaUTC


class AceptarInvitacionIn(BaseModel):
    codigo: str = Field(min_length=10)


class MemoriaOut(BaseModel):
    clave: str
    valor: str
    actualizado_en: FechaUTC


# ---------------------------------------------------------------- dispositivos (desde la app)

class VincularIn(BaseModel):
    codigo: str = Field(min_length=4, max_length=12)
    id_persona: int | None = Field(None, description="para reemplazar el Eloy de una persona que ya existe")
    nombre_persona: str | None = Field(None, max_length=80, description="si es nueva; después Eloy lo actualiza")


class VincularOut(BaseModel):
    id_persona: int
    id_dispositivo: int


class DispositivoPatchIn(BaseModel):
    volumen: int = Field(ge=0, le=100)


class RestaurarIn(BaseModel):
    confirmacion: Literal["RESTAURAR"] = Field(description="segunda confirmación: la app la manda tras el segundo diálogo")
