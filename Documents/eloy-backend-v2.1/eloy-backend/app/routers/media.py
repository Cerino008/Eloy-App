"""Descarga de audios con link firmado (solo en modo de almacenamiento local)."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.servicios.almacenamiento import CLAVE_VALIDA, AlmacenamientoLocal, almacenamiento, firma_valida

router = APIRouter(include_in_schema=False)


@router.get("/media/{clave}")
def audio(clave: str, exp: int, firma: str):
    alm = almacenamiento()
    if not isinstance(alm, AlmacenamientoLocal) or not CLAVE_VALIDA.match(clave) or not firma_valida(clave, exp, firma):
        raise HTTPException(404)
    ruta = alm.ruta(clave)
    if not ruta.exists():
        raise HTTPException(404)
    return FileResponse(ruta)
