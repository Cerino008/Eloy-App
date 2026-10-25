"""Limpieza periódica de datos que ya no sirven. La dispara el worker cada hora."""
import logging
from datetime import timedelta

from sqlalchemy import delete, or_
from sqlalchemy.orm import Session

from app import tiempo
from app.models import CodigoVinculacion, Sesion

log = logging.getLogger("eloy.mantenimiento")

DIAS_DE_GRACIA_SESIONES = 7   # una sesión vencida o cerrada se conserva una semana (auditoría/soporte)


def limpiar_datos_viejos(db: Session) -> dict[str, int]:
    """Borra sesiones vencidas o cerradas hace más de una semana y códigos de vinculación
    vencidos hace más de un día. Devuelve cuántos borró de cada cosa."""
    ahora = tiempo.ahora_utc()
    limite = ahora - timedelta(days=DIAS_DE_GRACIA_SESIONES)
    sesiones = db.execute(delete(Sesion).where(
        or_(Sesion.expira_en < limite, Sesion.revocada_en < limite))).rowcount
    codigos = db.execute(delete(CodigoVinculacion).where(
        CodigoVinculacion.expira_en < ahora - timedelta(days=1))).rowcount
    db.commit()
    if sesiones or codigos:
        log.info("Limpieza: %d sesiones y %d códigos vencidos borrados", sesiones, codigos)
    return {"sesiones": sesiones, "codigos": codigos}
