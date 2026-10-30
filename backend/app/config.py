"""Configuración por variables de entorno (o archivo .env)."""
import logging

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL
from typing import Literal

log = logging.getLogger("eloy.config")

SECRETO_DE_FABRICA = "cambiar-en-produccion"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "produccion" activa controles de arranque: el servidor NO levanta si falta algo crítico
    # (secretos de fábrica, sin forma de mandar push). En "desarrollo" solo avisa en el log.
    entorno: Literal["desarrollo", "produccion"] = "desarrollo"

    # Base de datos (MySQL 8 / MariaDB 10.5+). El driver es PyMySQL.
    # Entera en DATABASE_URL (desarrollo, docker compose, tests) o en partes, como la pasa una base
    # administrada (en Northflank, alias de HOST, PORT, DATABASE, USERNAME, PASSWORD y TLS_ENABLED).
    # Si están las dos, manda DATABASE_URL. Después de validar, database_url siempre tiene la URL final.
    database_url: str | None = None
    db_host: str | None = None
    db_port: int = 3306
    db_name: str = "eloy"
    db_user: str | None = None
    db_password: str | None = None
    db_tls: bool = False               # TLS verificando el certificado y el nombre del servidor
    db_tls_ca: str | None = None       # certificado de la CA, si no es una de las del sistema

    # Tokens de la app
    jwt_secret: str = SECRETO_DE_FABRICA
    access_minutos: int = 15
    refresh_dias: int = 30

    # Dispositivos
    provisioning_key: str = SECRETO_DE_FABRICA   # la usa la "fábrica" para dar de alta un Eloy
    dispositivo_token_horas: int = 24
    codigo_vinculacion_minutos: int = 10

    # Archivos de audio: "local" (desarrollo) o "s3" (S3, R2, GCS con API S3...)
    almacenamiento: str = "local"
    media_dir: str = "./media"
    url_publica: str = "http://localhost:8000"         # para armar los links firmados en modo local
    s3_bucket: str | None = None
    s3_endpoint_url: str | None = None
    s3_region: str | None = None
    audio_link_minutos: int = 10
    audio_max_mb: int = 5

    # Push. Hay dos caminos y pueden convivir; cada token va por el suyo según cómo empieza:
    #  - FCM directo: ruta al JSON de la cuenta de servicio de Firebase (tokens nativos de Android).
    #  - Servicio de Expo: tokens "ExponentPushToken[...]" (los únicos que sirven en iPhone con Expo).
    # Sin ninguno de los dos, los push solo se loguean (vale en desarrollo, no en producción).
    fcm_credenciales: str | None = None
    push_expo: bool = True
    expo_access_token: str | None = None

    # Invitaciones
    link_invitacion: str = "https://eloy.app/invitacion?codigo="
    invitacion_dias: int = 7

    # Reglas de negocio (sección 15 del documento)
    escalado_minutos: int = 2
    sin_conexion_minutos: int = 5
    atencion_minutos: int = 30

    # Alertas (v2.1): qué pasa cuando un aviso falla o nadie atiende
    aviso_vigencia_minutos: int = 60   # pasado este tiempo desde la alerta, los avisos pendientes se descartan
    reintento_segundos: int = 15       # espera entre reintentos de un aviso que falló
    reaviso_minutos: int = 3           # si nadie la atiende, se vuelve a avisar cada tanto...
    reavisos_maximos: int = 10         # ...hasta esta cantidad de veces (3 min x 10 = 30 min)

    # Tarea en segundo plano que manda los avisos escalonados
    worker_activo: bool = True
    worker_intervalo_seg: int = 5
    mantenimiento_cada_minutos: int = 60   # limpieza de sesiones y códigos vencidos

    cors_origenes: list[str] = []

    @model_validator(mode="after")
    def _controles_de_arranque(self) -> "Settings":
        problemas: list[str] = []
        if not self.database_url:
            if self.db_host:
                # URL.create escapa la clave (puede traer @, :, / o %).
                self.database_url = URL.create(
                    "mysql+pymysql", username=self.db_user, password=self.db_password, host=self.db_host,
                    port=self.db_port, database=self.db_name, query={"charset": "utf8mb4"},
                ).render_as_string(hide_password=False)
            elif self.entorno == "produccion":
                problemas.append("falta la base de datos (DATABASE_URL, o DB_HOST con DB_USER y DB_PASSWORD)")
            else:
                self.database_url = "mysql+pymysql://eloy:eloy@localhost:3306/eloy?charset=utf8mb4"
        for nombre, valor in (("JWT_SECRET", self.jwt_secret), ("PROVISIONING_KEY", self.provisioning_key)):
            if valor == SECRETO_DE_FABRICA or len(valor) < 32:
                problemas.append(f"{nombre} tiene el valor de fábrica o tiene menos de 32 caracteres")
        if self.jwt_secret == self.provisioning_key:
            problemas.append("JWT_SECRET y PROVISIONING_KEY tienen que ser distintas")
        if not self.fcm_credenciales and not self.push_expo:
            problemas.append("no hay forma de mandar push (configurá FCM_CREDENCIALES o dejá PUSH_EXPO=true)")

        if self.entorno == "produccion":
            if problemas:
                raise ValueError("Configuración insegura para producción: " + "; ".join(problemas))
            if self.almacenamiento == "local":
                log.warning("ALMACENAMIENTO=local en producción: los audios se pierden si el contenedor "
                            "no tiene un volumen. Lo normal es usar s3.")
        else:
            for p in problemas:
                log.warning("Config de desarrollo: %s (en producción el servidor no arranca así)", p)
        return self


settings = Settings()
