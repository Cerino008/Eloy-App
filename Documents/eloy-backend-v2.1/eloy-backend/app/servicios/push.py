"""Notificaciones push.

Hay tres emisores y un "repartidor" que elige cuál usar según el token:

* PushFCM:  Firebase directo (tokens nativos de Android).
* PushExpo: el servicio de push de Expo (tokens "ExponentPushToken[...]"). Es lo que
            hace falta para iPhone si la app usa Expo, porque el token nativo de iOS es de
            APNs y Firebase lo rechaza.
* PushLog:  no manda nada, solo lo anota (desarrollo y tests).

`emisor()` devuelve el repartidor. Los dos caminos pueden convivir: cada token va por el suyo.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

import httpx
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Familiar, TokenPush

log = logging.getLogger("eloy.push")

PREFIJOS_EXPO = ("ExponentPushToken[", "ExpoPushToken[")


class EmisorPush(Protocol):
    def enviar(self, tokens: list[str], titulo: str, cuerpo: str, datos: dict,
               urgente: bool = False) -> tuple[int, list[str]]:
        """Devuelve (cuántos salieron bien, tokens que ya no sirven).
        Si el servicio no responde (red caída, error 5xx) lanza una excepción: quien llama reintenta."""


class PushLog:
    def __init__(self) -> None:
        self.enviados: list[dict] = []

    def enviar(self, tokens, titulo, cuerpo, datos, urgente=False):
        log.info("PUSH%s a %d celular(es): %s | %s | %s", " URGENTE" if urgente else "", len(tokens), titulo, cuerpo, datos)
        self.enviados.append({"tokens": list(tokens), "titulo": titulo, "cuerpo": cuerpo, "datos": datos, "urgente": urgente})
        return len(tokens), []


class PushFCM:
    def __init__(self, ruta_credenciales: str) -> None:
        import firebase_admin
        from firebase_admin import credentials
        self._app = firebase_admin.initialize_app(credentials.Certificate(ruta_credenciales), name="eloy")

    def enviar(self, tokens, titulo, cuerpo, datos, urgente=False):
        from firebase_admin import messaging
        mensaje = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(title=titulo, body=cuerpo),
            data={k: str(v) for k, v in datos.items()},
            android=messaging.AndroidConfig(
                priority="high" if urgente else "normal",
                # La app tiene que crear estos canales (el de alertas con importancia alta).
                notification=messaging.AndroidNotification(channel_id="alertas" if urgente else "general"),
            ),
            apns=messaging.APNSConfig(headers={"apns-priority": "10" if urgente else "5"}),
        )
        r = messaging.send_each_for_multicast(mensaje, app=self._app)
        invalidos = [
            tokens[i] for i, resp in enumerate(r.responses)
            if not resp.success and isinstance(resp.exception, (messaging.UnregisteredError,))
        ]
        return r.success_count, invalidos


class PushExpo:
    """Servicio de push de Expo: https://docs.expo.dev/push-notifications/sending-notifications/

    Ojo: que Expo acepte el mensaje ("ticket ok") no garantiza que llegó al celular; para eso
    existen los "receipts", que todavía no se consultan (ver CAMBIOS.md)."""

    URL = "https://exp.host/--/api/v2/push/send"
    LOTE = 100  # máximo de mensajes por pedido

    def __init__(self, access_token: str | None = None, transporte: httpx.BaseTransport | None = None) -> None:
        cabeceras = {"Accept": "application/json", "Content-Type": "application/json"}
        if access_token:
            cabeceras["Authorization"] = f"Bearer {access_token}"
        self._http = httpx.Client(timeout=10, headers=cabeceras, transport=transporte)

    def enviar(self, tokens, titulo, cuerpo, datos, urgente=False):
        ok, invalidos = 0, []
        for i in range(0, len(tokens), self.LOTE):
            lote = tokens[i:i + self.LOTE]
            mensajes = [{
                "to": t, "title": titulo, "body": cuerpo, "data": datos, "sound": "default",
                "priority": "high" if urgente else "default",
                # La app tiene que crear estos canales de Android (el de alertas con importancia alta).
                "channelId": "alertas" if urgente else "general",
            } for t in lote]
            respuesta = self._http.post(self.URL, json=mensajes)  # httpx.HTTPError si no hay red
            if respuesta.status_code != 200:
                raise RuntimeError(f"Expo respondió {respuesta.status_code}")
            for token, ticket in zip(lote, respuesta.json().get("data", []), strict=False):
                if ticket.get("status") == "ok":
                    ok += 1
                elif (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                    invalidos.append(token)  # se desinstaló la app o el token venció
                else:
                    log.warning("Expo rechazó un aviso: %s", ticket)
        return ok, invalidos


class EmisorCombinado:
    """Reparte los tokens: los de Expo al servicio de Expo y el resto a FCM (o solo al log)."""

    def __init__(self, fcm: EmisorPush | None, expo: EmisorPush | None) -> None:
        self._fcm, self._expo = fcm, expo
        self._log = PushLog()

    @property
    def enviados(self) -> list[dict]:
        """Lo que solo se logueó (modo desarrollo y tests)."""
        return self._log.enviados

    def enviar(self, tokens, titulo, cuerpo, datos, urgente=False):
        de_expo = [t for t in tokens if self._expo is not None and t.startswith(PREFIJOS_EXPO)]
        otros = [t for t in tokens if t not in set(de_expo)]
        ok, invalidos, primer_error = 0, [], None
        for destino, lote in ((self._expo, de_expo), (self._fcm or self._log, otros)):
            if not lote:
                continue
            try:
                ok_parcial, inv_parcial = destino.enviar(lote, titulo, cuerpo, datos, urgente)
            except Exception as e:  # noqa: BLE001 - si falla uno, el otro camino igual se intenta
                log.exception("Falló un camino de push (%s)", type(destino).__name__)
                primer_error = primer_error or e
                continue
            ok += ok_parcial
            invalidos += inv_parcial
        if primer_error is not None and ok == 0:
            raise primer_error  # nada salió: que quien llama reintente
        return ok, invalidos


@lru_cache
def emisor() -> EmisorCombinado:
    """Se crea una vez. `main.py` lo llama al arrancar: un FCM mal configurado tiene que
    romper el arranque, no descubrirse cuando suena la primera alerta real."""
    fcm = PushFCM(settings.fcm_credenciales) if settings.fcm_credenciales else None
    expo = PushExpo(settings.expo_access_token) if settings.push_expo else None
    if fcm is None and expo is None:
        log.warning("Sin FCM ni Expo: las notificaciones solo se loguean")
    return EmisorCombinado(fcm, expo)


@dataclass
class ResultadoPush:
    celulares: int  # a cuántos celulares activos había que mandarle
    enviados: int   # a cuántos salió bien


def tokens_activos(db: Session, ids_familiares: list[int]) -> list[str]:
    if not ids_familiares:
        return []
    return list(db.scalars(
        select(TokenPush.token)
        .join(Familiar, Familiar.id_usuario_app == TokenPush.id_usuario_app)
        .where(Familiar.id.in_(ids_familiares), TokenPush.activo.is_(True))
    ).unique())


def enviar_push(db: Session, ids_familiares: list[int], titulo: str, cuerpo: str,
                datos: dict, urgente: bool = False) -> ResultadoPush:
    """Manda a todos los celulares activos de esos familiares. Si el servicio de push no
    responde, la excepción sube (para que las alertas reintenten)."""
    tokens = tokens_activos(db, ids_familiares)
    if not tokens:
        return ResultadoPush(0, 0)
    ok, invalidos = emisor().enviar(tokens, titulo, cuerpo, datos, urgente)
    if invalidos:
        db.execute(update(TokenPush).where(TokenPush.token.in_(invalidos)).values(activo=False))
        db.commit()
    return ResultadoPush(len(tokens), ok)


def push_a_familiares(db: Session, ids_familiares: list[int], titulo: str, cuerpo: str,
                      datos: dict, urgente: bool = False) -> int:
    """Versión simple para avisos que no son críticos (mensajes, "alguien se ocupa").
    Devuelve cuántos salieron y no propaga errores del servicio de push."""
    try:
        return enviar_push(db, ids_familiares, titulo, cuerpo, datos, urgente).enviados
    except Exception:  # noqa: BLE001
        log.exception("No se pudo mandar el push '%s'", titulo)
        return 0
