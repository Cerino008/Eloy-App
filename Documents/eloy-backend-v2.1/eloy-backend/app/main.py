import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import settings
from app.db import SessionLocal
from app.routers import alertas, cuenta, dispositivo_pi, dispositivos, media, mensajes, personas, recordatorios
from app.servicios.alertas import worker_avisos
from app.servicios.push import emisor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Crear el emisor de push ahora: si FCM está mal configurado, el servidor no arranca
    # (mejor eso que enterarse cuando suena la primera alerta real).
    emisor()
    logging.getLogger("eloy").info("Eloy API arrancó en modo %s", settings.entorno)
    tarea = asyncio.create_task(worker_avisos()) if settings.worker_activo else None
    yield
    if tarea:
        tarea.cancel()


app = FastAPI(title="Eloy · API", version="1.0.0", lifespan=lifespan,
              description="Backend de la app de la familia y sincronización con Eloy.")

if settings.cors_origenes:
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origenes, allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])

for r in (cuenta.router, cuenta.router_push, personas.router, mensajes.router, recordatorios.router,
          alertas.router, dispositivos.router, dispositivo_pi.router, media.router):
    app.include_router(r)


@app.get("/salud", tags=["Sistema"])
def salud():
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        return JSONResponse(status_code=503, content={"ok": False, "base_de_datos": "sin conexión"})
    return {"ok": True}
