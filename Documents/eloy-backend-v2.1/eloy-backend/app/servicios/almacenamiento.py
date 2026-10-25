"""Audios fuera de la base (sección 18). En la base se guarda solo la clave del
archivo; la API entrega links firmados que vencen en minutos."""
from __future__ import annotations

import hashlib
import hmac
import re
import time
import uuid
from functools import lru_cache
from pathlib import Path

from app.config import settings

EXTENSIONES = {"wav", "ogg", "mp3", "m4a", "opus"}
CLAVE_VALIDA = re.compile(r"^[0-9a-f]{32}\.(wav|ogg|mp3|m4a|opus)$")


def _clave_de_firma() -> bytes:
    """Subclave solo para links de audio, derivada del JWT_SECRET: así una filtración de un link
    firmado nunca expone la clave con la que se firman los tokens de sesión."""
    return hmac.new(settings.jwt_secret.encode(), b"eloy:links-de-audio:v1", hashlib.sha256).digest()


def _firma(clave: str, exp: int) -> str:
    return hmac.new(_clave_de_firma(), f"{clave}:{exp}".encode(), hashlib.sha256).hexdigest()


def firma_valida(clave: str, exp: int, firma: str) -> bool:
    return exp >= int(time.time()) and hmac.compare_digest(_firma(clave, exp), firma)


class AlmacenamientoLocal:
    def __init__(self, carpeta: str) -> None:
        self.carpeta = Path(carpeta)
        self.carpeta.mkdir(parents=True, exist_ok=True)

    def guardar(self, datos: bytes, extension: str) -> str:
        clave = f"{uuid.uuid4().hex}.{extension}"
        (self.carpeta / clave).write_bytes(datos)
        return clave

    def ruta(self, clave: str) -> Path:
        return self.carpeta / clave

    def url(self, clave: str) -> str:
        exp = int(time.time()) + settings.audio_link_minutos * 60
        return f"{settings.url_publica}/media/{clave}?exp={exp}&firma={_firma(clave, exp)}"


class AlmacenamientoS3:
    """S3 o compatibles (Cloudflare R2, MinIO, GCS en modo interoperable)."""

    def __init__(self) -> None:
        import boto3
        self.bucket = settings.s3_bucket
        self.s3 = boto3.client("s3", endpoint_url=settings.s3_endpoint_url, region_name=settings.s3_region)

    def guardar(self, datos: bytes, extension: str) -> str:
        clave = f"{uuid.uuid4().hex}.{extension}"
        self.s3.put_object(Bucket=self.bucket, Key=f"audios/{clave}", Body=datos,
                           ContentType=f"audio/{'mpeg' if extension == 'mp3' else extension}")
        return clave

    def url(self, clave: str) -> str:
        return self.s3.generate_presigned_url(
            "get_object", Params={"Bucket": self.bucket, "Key": f"audios/{clave}"},
            ExpiresIn=settings.audio_link_minutos * 60)


@lru_cache
def almacenamiento():
    return AlmacenamientoS3() if settings.almacenamiento == "s3" else AlmacenamientoLocal(settings.media_dir)


def url_audio(clave: str | None) -> str | None:
    return almacenamiento().url(clave) if clave else None
