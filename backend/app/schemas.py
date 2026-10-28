"""Lo que entra y sale de la API de la app. Todas las fechas salen en UTC con zona
("2026-10-18T13:42:00Z"); la app las muestra en la hora del celular.

Los cuerpos JSON van en camelCase (idPersona, esMio...): todos los modelos heredan de
ModeloApp. Al entrar se acepta también snake_case. Los parámetros de la URL (?antes_de=,
?id_persona=, ?todas=) no son modelos y siguen en snake_case. El contrato con la Raspberry
(schemas_dispositivo.py) queda en snake_case."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Annotated, Literal, Optional

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel

from app.tiempo import DIAS


def _utc(v):
    return v.replace(tzinfo=timezone.utc) if isinstance(v, datetime) and v.tzinfo is None else v


FechaUTC = Annotated[datetime, AfterValidator(_utc)]
HoraHHMM = Annotated[str, Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$", examples=["09:00"])]


class ModeloApp(BaseModel):
    """Base de todo lo que habla con la app: sale en camelCase y entra en camelCase o snake_case
    (populate_by_name). En el código se sigue usando snake_case: TokensOut(access_token=...)."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ---------------------------------------------------------------- cuenta

class RegistroIn(ModeloApp):
    nombre: str = Field(min_length=1, max_length=80)
    apellido: str | None = Field(None, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    telefono: str | None = Field(None, max_length=30)
    nombre_equipo: str | None = Field(None, max_length=100, examples=["Moto G de Bautista"])


class LoginIn(ModeloApp):
    email: EmailStr
    password: str
    nombre_equipo: str | None = Field(None, max_length=100)


class RefreshIn(ModeloApp):
    refresh_token: str


class TokensOut(ModeloApp):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expira_en_seg: int


class UsuarioOut(ModeloApp):
    id: int
    nombre: str
    apellido: str | None
    email: str
    telefono: str | None


class PushTokenIn(ModeloApp):
    token: str = Field(min_length=10, max_length=255)
    plataforma: Literal["android", "ios", "web"]


# ---------------------------------------------------------------- personas / inicio

class PersonaResumenOut(ModeloApp):
    id: int
    nombre: str
    mi_rol: str
    id_mi_familiar: int


class PersonaPatchIn(ModeloApp):
    """Solo lo que Eloy no conoce. Nombre y edad los manda el dispositivo."""
    apellido: str | None = Field(None, max_length=80)
    telefono: str | None = Field(None, max_length=30)
    fecha_nacimiento: date | None = None
    zona_horaria: str | None = Field(None, max_length=50)


class ResumenOut(ModeloApp):
    fecha: date
    texto: str
    es_de_hoy: bool


class RecordatorioCortoOut(ModeloApp):
    id: int
    hora: str
    titulo: str


class InicioOut(ModeloApp):
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

class MensajeIn(ModeloApp):
    texto: str = Field(min_length=1, max_length=2000)


class MensajeOut(ModeloApp):
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


class RecordatorioIn(ModeloApp):
    titulo: str = Field(min_length=1, max_length=120)
    descripcion: str | None = Field(None, max_length=255)
    hora: HoraHHMM
    repeticion: Repeticion
    dias_semana: list[str] | None = None
    fecha_unica: date | None = None

    _dias = field_validator("dias_semana")(_validar_dias)


class RecordatorioPatchIn(ModeloApp):
    titulo: str | None = Field(None, min_length=1, max_length=120)
    descripcion: str | None = Field(None, max_length=255)
    hora: HoraHHMM | None = None
    repeticion: Repeticion | None = None
    dias_semana: list[str] | None = None
    fecha_unica: date | None = None

    _dias = field_validator("dias_semana")(_validar_dias)


class RecordatorioOut(ModeloApp):
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


class RecordatoriosOut(ModeloApp):
    fecha: date
    hoy: list[RecordatorioOut]
    proximos: list[RecordatorioOut]


# ---------------------------------------------------------------- alertas

class AvisadoOut(ModeloApp):
    nombre: str
    parentesco: str | None


class AlertaOut(ModeloApp):
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


class CerrarAlertaIn(ModeloApp):
    nota: str | None = Field(None, max_length=255, examples=["Fui, se resbaló, está bien"])


# ---------------------------------------------------------------- familia

class FamiliarOut(ModeloApp):
    id: int
    nombre: str
    parentesco: str | None
    rol: Literal["administrador", "familiar"]
    recibe_alertas: bool
    prioridad_alerta: int | None
    telefono: str | None
    tiene_cuenta: bool
    soy_yo: bool


class DispositivoOut(ModeloApp):
    id: int
    conectado: bool
    ultima_conexion: Optional[FechaUTC]
    wifi_ssid: str | None
    volumen: int
    version_software: str | None
    restaurando: bool


class FamiliaOut(ModeloApp):
    mi_rol: str
    familiares: list[FamiliarOut]
    dispositivos: list[DispositivoOut]


class FamiliarPatchIn(ModeloApp):
    nombre: str | None = Field(None, min_length=1, max_length=80)
    parentesco: str | None = Field(None, max_length=40)
    rol: Literal["administrador", "familiar"] | None = None
    recibe_alertas: bool | None = None
    prioridad_alerta: int | None = Field(None, ge=1, le=255)
    telefono: str | None = Field(None, max_length=30)


class InvitacionIn(ModeloApp):
    email: EmailStr | None = None
    rol: Literal["administrador", "familiar"] = "familiar"
    id_familiar: int | None = Field(None, description="si ya está en la lista (ej. Juan) y solo le falta la cuenta")


class InvitacionOut(ModeloApp):
    link: str
    codigo: str
    expira_en: FechaUTC


class AceptarInvitacionIn(ModeloApp):
    codigo: str = Field(min_length=8, max_length=8, description="los 8 caracteres del link; se aceptan en minúscula")

    @field_validator("codigo", mode="before")
    @classmethod
    def _normalizar(cls, v):
        # El código se genera en mayúsculas: así sirve aunque lo escriban a mano en minúscula.
        return v.strip().upper() if isinstance(v, str) else v


class MemoriaOut(ModeloApp):
    clave: str
    valor: str
    actualizado_en: FechaUTC


# ---------------------------------------------------------------- dispositivos (desde la app)

class VincularIn(ModeloApp):
    codigo: str = Field(min_length=4, max_length=12)
    id_persona: int | None = Field(None, description="para reemplazar el Eloy de una persona que ya existe")
    nombre_persona: str | None = Field(None, max_length=80, description="si es nueva; después Eloy lo actualiza")


class VincularOut(ModeloApp):
    id_persona: int
    id_dispositivo: int


class DispositivoPatchIn(ModeloApp):
    volumen: int = Field(ge=0, le=100)


class RestaurarIn(ModeloApp):
    confirmacion: Literal["RESTAURAR"] = Field(description="segunda confirmación: la app la manda tras el segundo diálogo")
