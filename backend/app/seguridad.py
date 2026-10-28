"""Contraseñas, tokens y límite de intentos."""
from __future__ import annotations

import hashlib
import secrets
import threading
import time as _time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.config import settings

_ph = PasswordHasher()  # argon2id
_HASH_FALSO = _ph.hash("hash-para-igualar-tiempos")


def hash_clave(clave: str) -> str:
    return _ph.hash(clave)


def verificar_clave(hash_guardado: str | None, clave: str) -> bool:
    try:
        return _ph.verify(hash_guardado or _HASH_FALSO, clave) and hash_guardado is not None
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def sha256(texto: str) -> str:
    return hashlib.sha256(texto.encode()).hexdigest()


def token_aleatorio(n_bytes: int = 32) -> str:
    return secrets.token_urlsafe(n_bytes)


# Códigos de vinculación y de invitación: sin 0/O ni 1/I/L para que se puedan escribir a mano.
_ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


def codigo_vinculacion(largo: int = 6) -> str:
    return "".join(secrets.choice(_ALFABETO_CODIGO) for _ in range(largo))


def codigo_invitacion(largo: int = 8) -> str:
    """Viaja en el link y también se puede dictar: 31^8 (~850 mil millones) combinaciones.
    Dura 7 días y /invitaciones/aceptar tiene límite de intentos (limitador_invitacion)."""
    return "".join(secrets.choice(_ALFABETO_CODIGO) for _ in range(largo))


def crear_jwt(sub: int, tipo: str, minutos: int, **extra) -> str:
    ahora = datetime.now(timezone.utc)
    payload = {"sub": str(sub), "typ": tipo, "iat": ahora, "exp": ahora + timedelta(minutes=minutos), **extra}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def leer_jwt(token: str, tipo: str) -> dict:
    """Lanza jwt.PyJWTError si el token es inválido, venció o es de otro tipo."""
    payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    if payload.get("typ") != tipo:
        raise jwt.InvalidTokenError("tipo de token incorrecto")
    return payload


class Limitador:
    """Ventana deslizante en memoria. Alcanza para una instancia; con varias
    instancias conviene moverlo a Redis (misma interfaz)."""

    def __init__(self, maximo: int, ventana_seg: int):
        self.maximo, self.ventana = maximo, ventana_seg
        self._intentos: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def _purgar(self, clave: str) -> deque:
        q = self._intentos[clave]
        limite = _time.monotonic() - self.ventana
        while q and q[0] < limite:
            q.popleft()
        return q

    def bloqueado(self, clave: str) -> bool:
        with self._lock:
            return len(self._purgar(clave)) >= self.maximo

    def fallo(self, clave: str) -> None:
        with self._lock:
            self._purgar(clave).append(_time.monotonic())

    def limpiar(self, clave: str) -> None:
        with self._lock:
            self._intentos.pop(clave, None)


limitador_login = Limitador(maximo=5, ventana_seg=15 * 60)
limitador_vincular = Limitador(maximo=5, ventana_seg=15 * 60)
limitador_invitacion = Limitador(maximo=5, ventana_seg=15 * 60)  # códigos de invitación equivocados, por usuario
limitador_dispositivo = Limitador(maximo=10, ventana_seg=15 * 60)  # claves de Eloy y de fábrica equivocadas
