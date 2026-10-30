# Eloy · Backend

API de Eloy (robot compañero para personas mayores): la usan la app de la familia (de Bautista, en `../`) y la
Raspberry de cada Eloy. FastAPI + SQLAlchemy 2 + MariaDB 10.11 / MySQL 8. Lo mantiene Héctor.
Detalle: `README.md` (endpoints, contrato con la Pi, deploy) y `CAMBIOS.md` (el porqué); abajo, dónde buscar cada cosa.

## Correrlo

```bash
docker compose up --build                     # base + API en http://localhost:8000/docs
TEST_DATABASE_URL="mysql+pymysql://root:clave@127.0.0.1:3306/eloy_test?charset=utf8mb4" pytest
ruff check .                                  # tiene que dar "All checks passed!"
python herramientas/simular_eloy.py alta      # simula una Raspberry: alta, codigo, sync, alerta "motivo"
```

Sin Docker: venv + `pip install -r requirements-dev.txt` + `.env` (ver `.env.example`) + `python -m scripts.init_db`
+ `uvicorn app.main:app --reload`. Los tests borran y crean la base `eloy_test`.

## Estructura

```
app/main.py                arranque, routers, /salud y el worker de avisos (WORKER_ACTIVO)
app/config.py              variables de entorno; con ENTORNO=produccion no arranca con secretos de fábrica.
                           La base: DATABASE_URL o en partes (DB_HOST...); TLS en db.argumentos_de_conexion()
app/models.py              las 18 tablas (espejo de sql/eloy_servidor.sql)
app/schemas.py             entrada/salida de la APP (camelCase, base ModeloApp)
app/schemas_dispositivo.py contrato con la RASPBERRY (snake_case)
app/deps.py                autenticación y permisos: usuario_actual, familiar_de, exigir_admin
app/seguridad.py           contraseñas, JWT, códigos (vinculación e invitación) y límites de intentos
app/tiempo.py              ahora_utc(), "hoy" en la zona de la persona; los tests cambian el reloj
app/routers/               cuenta, personas (inicio, familia, invitaciones, memoria), mensajes,
                           recordatorios, alertas, dispositivos (desde la app), dispositivo_pi (la Pi)
app/servicios/             sync (POST /dispositivo/sync), alertas (escalado, reintentos, reavisos),
                           recordatorios (hoy/próximos), push (FCM + Expo), almacenamiento, mantenimiento
sql/eloy_servidor.sql      esquema, fuente de verdad;  sql/cambios/  ALTER para bases ya creadas
tests/                     test_pantallas (una por pantalla), test_confiabilidad (v2.1), test_correcciones (v2.2),
                           test_despliegue (v2.3)
herramientas/              simular_eloy.py: hace de Pi, sin dependencias (estado en .eloy_simulado.json)
```

## Reglas

- **App en camelCase, Pi en snake_case.** Todo modelo nuevo de `schemas.py` hereda de `ModeloApp`; en el código
  se usa snake_case igual. Los parámetros de la URL (`?antes_de=`, `?id_persona=`, `?todas=`) van en snake_case.
  No renombrar campos de `schemas_dispositivo.py` sin coordinar con el módulo de la Pi.
- **Fechas:** en la base, UTC sin zona. Hacia afuera, `FechaUTC` (sale con `Z`). Usar `tiempo.ahora_utc()`,
  nunca `datetime.now()`: los tests fijan el reloj (domingo 18/10/2026, 14:00 en Argentina).
- **Permisos:** rutas por persona → `familiar_de()` (403). Recursos pedidos por id → `familiar_de(..., ocultar_como=...)`
  (404, para no revelar qué ids existen). Acciones de administrador → `exigir_admin()`.
- **Cambio de esquema:** tocar `sql/eloy_servidor.sql`, `app/models.py` y agregar un ALTER en `sql/cambios/NNN_*.sql`.
- **Límites de intentos** (`Limitador` de `seguridad.py`, en memoria): si agregás uno, limpialo en `tests/conftest.py`.
- Los `detail` de los errores los puede ver la familia: en español rioplatense y entendibles.
- Cada cambio con su test (contra MariaDB real, no SQLite: el esquema usa SET, ENUM y CHECK) y anotado en
  `CAMBIOS.md`, en una sección por versión. Si cambia algo que ve la app, también en las "Notas para la app" del README.

## Dónde está cada cosa

- Formato del sync y qué hace la Pi con la respuesta → README, "Contrato con la Raspberry"; código en `servicios/sync.py`.
- Por qué restaurar anula los `id_local` recién al confirmar, y el ida y vuelta de "ya se lo leyó" → README, "Cambios respecto al documento v2.0".
- Reintentos y reavisos de alertas, push por Expo, controles de producción → `CAMBIOS.md`, v2.1.
- camelCase, código de invitación de 8, simulador → `CAMBIOS.md`, v2.2.
- Base en partes, TLS verificado, UID/GID 10001 de la imagen y `FORWARDED_ALLOW_IPS` → `CAMBIOS.md`, v2.3.
- El deploy en Northflank (recursos, variables, logs, comandos) → `DEPLOY.md`.
- Lo que falta → README, "Pendiente".
