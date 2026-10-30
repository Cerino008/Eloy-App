# Eloy · Backend

FastAPI + SQLAlchemy 2 + MySQL 8 / MariaDB 10.5+. Implementa la base de datos v2.0
(`sql/eloy_servidor.sql`, igual al Anexo A del documento) y los endpoints de las 6 pantallas.

## Correrlo en tu compu

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # completar DATABASE_URL y las claves
python -m scripts.init_db       # crea las 18 tablas (una sola vez)
uvicorn app.main:app --reload
```

O con Docker (levanta la base y la API juntas, sin instalar nada más; probado en v2.2):

```bash
docker compose up --build       # http://localhost:8000/docs
```

La documentación interactiva queda en `http://localhost:8000/docs`: ahí Bautista ve
cada endpoint con sus campos y puede probarlos.

**Tests:** corren contra MySQL/MariaDB real (el esquema usa `SET`, `ENUM` y `CHECK`).
Crean y borran la base `eloy_test`, así que el usuario necesita permiso para eso:

```bash
TEST_DATABASE_URL="mysql+pymysql://root:clave@localhost:3306/eloy_test?charset=utf8mb4" pytest
```

## Estructura

```
app/
  main.py               arranque, routers y la tarea de fondo de avisos
  config.py             variables de entorno
  db.py                 conexión (cada conexión en UTC)
  models.py             las 18 tablas
  schemas.py            entrada/salida de la app
  schemas_dispositivo.py  contrato con la Raspberry
  deps.py               autenticación y permisos (sección 15.6)
  tiempo.py             "hoy" según la zona horaria de la persona
  routers/              un archivo por pantalla + dispositivo_pi.py
  servicios/            sync, alertas, recordatorios, push (FCM + Expo), almacenamiento, mantenimiento
herramientas/simular_eloy.py  simulador de la Raspberry (alta, codigo, sync, alerta), sin dependencias
sql/eloy_servidor.sql   esquema (fuente de verdad)
sql/cambios/            ALTER para bases ya creadas con una versión anterior
tests/                  un test por pantalla, con los datos de las capturas
```

## Endpoints

Todos los de la app usan `Authorization: Bearer <access_token>`. Los del dispositivo
usan el token que devuelve `/dispositivo/token`.

| Pantalla | Rutas |
|---|---|
| Cuenta | `POST /auth/registro`, `/auth/login`, `/auth/refresh`, `/auth/logout?todas=`, `GET /auth/yo`, `POST/DELETE /push/token` |
| Selector | `GET /personas` (a quién sigo y con qué rol), `PATCH /personas/{id}` (teléfono, fecha de nacimiento) |
| Inicio | `GET /personas/{id}/inicio` |
| Mensajes | `GET /personas/{id}/mensajes?antes_de=&limite=`, `POST /personas/{id}/mensajes` |
| Recordatorios | `GET/POST /personas/{id}/recordatorios`, `PATCH/DELETE /recordatorios/{id}` |
| Alerta | `GET /alertas/{id}`, `POST /alertas/{id}/atender`, `POST /alertas/{id}/cerrar`, `GET /alertas?id_persona=` |
| Familia | `GET /personas/{id}/familia`, `PATCH/DELETE /familiares/{id}`, `POST /personas/{id}/invitaciones`, `POST /invitaciones/aceptar` |
| Vincular | `POST /dispositivos/vincular` |
| Eloy | `PATCH /dispositivos/{id}` (volumen), `POST /dispositivos/{id}/restaurar`, `GET /personas/{id}/memoria`, `DELETE /personas/{id}/memoria/{clave}` |
| Raspberry | `POST /dispositivo/registro`, `/token`, `/codigo`, `/audio`, `/alertas`, `/sync` |

Notas para la app:

- Los cuerpos JSON van en **camelCase** (`idPersona`, `esMio`...); al entrar también se acepta snake_case.
  Los parámetros de la URL siguen en snake_case (`?antes_de=`, `?id_persona=`, `?todas=`).
- Las fechas salen en UTC (`...Z`); la app las muestra en la hora del celular.
- `audioUrl` es un link firmado que vence en 10 minutos: pedir el hilo de nuevo si venció.
- `GET /inicio` devuelve `idAlertaAbierta`: si `estado == "alerta"`, abrir esa pantalla.
- En los mensajes, `para: null` significa "para toda la familia".
- La invitación trae un código de 8 caracteres dentro del link; `POST /invitaciones/aceptar` lo acepta en
  minúscula y responde 429 después de 5 códigos equivocados en 15 minutos.
- Push: la app registra su token con `POST /push/token` y crea en Android el canal
  `alertas` (importancia alta) y `general`. Los `data` traen `tipo` (`alerta`,
  `alerta_atendida`, `mensaje`) e ids para abrir la pantalla correcta.
- `POST /alertas/{id}/atender` devuelve **409** si otro ya la tomó; el `detail` dice quién.

## Contrato con la Raspberry

1. **Alta de fábrica** (una vez): la Pi genera una clave aleatoria de 32+ caracteres, la guarda
   en un archivo con permisos `600` **fuera** de lo que borra "restaurar", y llama a
   `POST /dispositivo/registro` con el header `X-Provisioning-Key`.
2. **Token:** `POST /dispositivo/token {uid_serie, secret}` → token de 24 h. Renovarlo al recibir 401.
3. **Vincular:** `POST /dispositivo/codigo` → código de 6 caracteres para el QR (vence en 10 min; `expira_en` en UTC con `Z`).
4. **Audios:** `POST /dispositivo/audio` (multipart, campo `archivo`) → `audio_key`.
5. **Alerta:** apenas Marta pide ayuda, `POST /dispositivo/alertas` sin esperar el audio;
   el audio puede ir después en el sync (el mismo `id_local` completa la alerta sin duplicarla).
6. **Sync** cada 30 s y al terminar cada charla: `POST /dispositivo/sync`.

### Lo que manda la Pi

```json
{
  "estado": {"volumen": 70, "wifi_ssid": "Casa de Marta", "version_software": "1.4"},
  "usuario": {"nombre": "Marta", "edad": 78, "tiene_pulsera": false},
  "familiares": [{"id": 2, "nombre": "Vero", "relacion": "hija", "numero_whatsapp": "11...", "numero_prioridad": 2}],
  "recordatorios": [{"id": 1, "titulo": "Pastilla de la presión", "descripcion": "la blanca", "horario": "09:00",
                     "se_repite_diario": true, "dias_semana": "todos", "fecha": null,
                     "completado": false, "ultima_ejecucion": "2026-10-18"}],
  "memoria": [{"clave": "nieta", "valor": "Sofi"}],
  "eventos": [{"id": 101, "tipo": "conversacion", "descripcion": "charló 4 minuto(s)", "ocurrio_en": "2026-10-18 13:42:00"}],
  "mensajes": [{"id": 56, "tipo": "mensaje", "direccion": "a_familia", "de": "Marta", "para": "Vero",
                "texto": "...", "audio_key": "…wav", "audio_duracion_seg": 4,
                "creado": "2026-10-18 10:45:00", "entregado": false}],
  "resumenes": [{"fecha": "2026-10-18", "texto": "..."}],
  "confirmaciones": [{"tabla": "recordatorios", "id": 12, "id_local": 7, "version": "2026-10-18T17:00:00"}],
  "mensajes_leidos": [55],
  "comandos": [{"id": 3, "estado": "ejecutado"}]
}
```

- `familiares`, `recordatorios` y `memoria` son **listas completas**: si un elemento falta, se
  considera borrado en Eloy. `null` (o no mandarla) significa "esta vez no la mando".
- `eventos` y `mensajes` son **incrementales** (id mayor al último enviado, guardado en
  `configuracion` como `sync_eventos` / `sync_mensajes`). Las emergencias van en `mensajes`
  con `tipo: "emergencia"`.
- `ocurrio_en` de eventos va en UTC; `creado` de mensajes va en hora local (como hoy en la Pi).
- Si en la SQLite real alguna columna se llama distinto, se cambia en `app/schemas_dispositivo.py`.

### Lo que responde

```json
{
  "vinculado": true, "id_persona": 1, "zona_horaria": "America/Argentina/Buenos_Aires",
  "mensajes": [{"id": 40, "de": "Bautista", "texto": "¿Te acordaste de la pastilla?", "creado_en": "...Z"}],
  "mensajes_esperando_lectura": [55],
  "recordatorios": [{"id": 12, "id_local": null, "eliminado": false, "version": "...", "titulo": "...",
                     "horario": "18:30", "se_repite_diario": false, "dias_semana": "lunes,jueves",
                     "fecha": null, "completado": false}],
  "familiares": [{"id": 3, "id_local": 3, "eliminado": false, "version": "...", "nombre": "Juan",
                  "relacion": "nieto", "numero_whatsapp": "11...", "numero_prioridad": 3}],
  "comandos": [{"id": 3, "tipo": "ajustar_volumen", "parametros": {"volumen": 50}}]
}
```

Qué hace la Pi con eso:

- `mensajes`: insertarlos en su tabla `mensajes` (de_familia) y devolver en la vuelta siguiente
  `{"tabla": "mensajes", "id": <id servidor>, "id_local": <su id>}`.
- `mensajes_esperando_lectura`: devolver en `mensajes_leidos` los que ya tengan `entregado = 1`.
- `recordatorios` / `familiares`: `id_local` null → insertar; con `id_local` → actualizar;
  `eliminado: true` → borrar. Confirmar siempre con el `version` que vino.
- `comandos`: ejecutar e informar `{"id", "estado": "ejecutado"|"fallido", "error"}`.
  Un comando puede llegar dos veces si la confirmación se perdió: guardar los ids ya ejecutados.
- Para no duplicar un mensaje si se pierde la confirmación, guardar en `configuracion` el par
  `id servidor → id local` hasta confirmarlo.

## Cambios respecto al documento v2.0

El esquema no cambió. Cambió el comportamiento en cuatro puntos donde el flujo del documento
fallaba:

1. **Restaurar de fábrica:** el documento anula los `id_local` al pedirlo. Si Eloy sincroniza
   antes de ejecutar el comando, todo lo que manda entra duplicado. Acá se anulan cuando Eloy
   **confirma**, y mientras hay un restaurar pendiente el sync no guarda nada. Además los
   familiares y recordatorios quedan marcados para reenviarse si se vincula otro Eloy a la misma persona.
2. **"Eloy ya se lo leyó":** con sync incremental por id, el cambio de `entregado = 0 → 1` en la
   Pi nunca viajaba (la fila ya se había mandado). Se agregó el ida y vuelta
   `mensajes_esperando_lectura` / `mensajes_leidos`.
3. **`intentos_fallidos` en códigos de vinculación:** con un código equivocado no se sabe a qué
   código sumarle el intento. La protección real contra fuerza bruta es por usuario
   (5 intentos cada 15 minutos) y un código de 6 caracteres sin ambigüedades (~900 millones de combinaciones).
4. **Confirmaciones con versión:** si la app vuelve a editar un recordatorio mientras Eloy
   recibía la versión anterior, la confirmación vieja no lo marca como sincronizado.

Otras decisiones: el administrador creado al vincular se "adopta" por nombre si la Pi ya lo
tenía cargado; borrar por voz a un familiar con cuenta no le quita el acceso a la app; Inicio
muestra el resumen de ayer hasta que Eloy escriba el de hoy a las 21; el escalado de alertas usa
el orden de prioridad (1º, 2º, 3º) y no el número, para que prioridades 1, 2, 5 no dejen un hueco de 8 minutos.

## Cambios v2.1 (revisión de confiabilidad de alertas)

Detalle, motivos y cómo se probó cada cosa: **`CAMBIOS.md`**. Resumen:

- **El esquema cambió (2 columnas en `alertas_sos`)**: `proximo_reaviso_en` y `avisos_repetidos`.
  Bases nuevas: ya vienen en `sql/eloy_servidor.sql`. Bases creadas con la v2.0:
  `mysql ... < sql/cambios/001_reaviso_alertas.sql`.
- Un aviso que falla por algo pasajero se **reintenta** (antes quedaba con error para siempre).
- Si **nadie atiende**, se vuelve a avisar cada 3 minutos, hasta 10 veces.
- Push para **iPhone con Expo** (`PushExpo`), conviviendo con FCM.
- Con `ENTORNO=produccion` el servidor **no arranca** con secretos de fábrica o sin push.
- Cerrar una alerta: solo quien la atendió o un administrador. Los recursos pedidos por id
  responden 404 a quien no es de la familia. Límite de intentos para `/dispositivo/token` y `/registro`.
- Limpieza automática de sesiones y códigos vencidos. `Dockerfile` ya no confía en `X-Forwarded-For` de cualquiera.

## Cambios v2.2 (camelCase, invitación corta, simulador)

Detalle en **`CAMBIOS.md`**. Resumen: las respuestas a la app salen en camelCase (la Pi sigue en snake_case);
el código de invitación tiene 8 caracteres y límite de intentos; `para: null` en los mensajes para toda la
familia; `expira_en` del código de vinculación con zona; y `herramientas/simular_eloy.py` hace de Raspberry:

```bash
docker compose up --build
python herramientas/simular_eloy.py alta      # después: codigo, sync (2 o 3 veces), alerta "motivo"
```

## Cambios v2.3 (listo para desplegar)

Detalle en **`CAMBIOS.md`**. Resumen: la base se puede pasar en partes (`DB_HOST`, `DB_USER`...), como la da un
addon de Northflank, con TLS verificado (`DB_TLS`); la imagen corre con UID/GID fijos (10001) para que el volumen
de audios tenga permisos; y los tests pasan también en MySQL 8.4. **Nada cambia para la app ni para la Pi.**

## Deploy

Hace falta: un contenedor con el `Dockerfile`, una base MySQL 8 o MariaDB administrada y,
para los audios, un bucket S3 compatible. Pasos comunes a cualquier proveedor:

1. Crear la base y correr `python -m scripts.init_db` una vez (desde tu compu apuntando a la
   base de la nube, o como tarea del proveedor).
2. Cargar las variables de `.env.example` en el panel del servicio. `JWT_SECRET` y
   `PROVISIONING_KEY` tienen que ser largas y distintas. La base va entera en `DATABASE_URL` o en partes
   (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`), como la pasa una base administrada. Si la base
   usa TLS, `DB_TLS=true`: se verifica el certificado y el nombre del servidor (sin eso, PyMySQL cifra si
   puede pero no verifica con quién habla).
3. Health check: `GET /salud` (el `Dockerfile` ya trae un `HEALTHCHECK`).
4. **`ENTORNO=produccion`**: así el servidor se niega a arrancar con una configuración insegura.
5. **Detrás de un balanceador** definí `FORWARDED_ALLOW_IPS` con la IP o rango del balanceador. Sin eso la API ve
   la IP del balanceador (el límite de intentos sigue funcionando, pero agrupa a todos); con `*` cualquiera falsea su IP.
   Acepta rangos (`10.0.0.0/8`): uvicorn toma la última IP de `X-Forwarded-For` que no sea de ese rango, que es la
   que agregó el balanceador.
6. **Audios sin S3** (`ALMACENAMIENTO=local`): un volumen montado justo en `/app/media`. La imagen corre como
   UID/GID 10001; si el proveedor no le da el volumen a ese grupo, la API no puede guardar audios.
7. **Push en iPhone con Expo:** la app tiene que mandar el token de Expo (`getExpoPushTokenAsync`, empieza con
   `ExponentPushToken[`). Con `getDevicePushTokenAsync` el token de iOS es de APNs y Firebase lo rechaza.
   Los tokens nativos de Android siguen yendo por FCM.

**Ojo con la tarea de fondo:** los avisos escalonados (2º y 3º familiar) los manda un loop
dentro del proceso de la API cada 5 segundos. Si el proveedor apaga el contenedor cuando no hay
tráfico (Cloud Run, Render free, Railway con sleep), configurá **mínimo 1 instancia siempre
prendida**; si no, el segundo aviso no sale. Varias instancias no mandan avisos duplicados.

## Pendiente

- **Módulo de sync en la Raspberry** (lo más grande que falta; necesita `sqlite3 aloy.db .schema` real). Base:
  `herramientas/simular_eloy.py`, que ya hace el ida y vuelta completo contra la API.
- **Avisar por push cuando Eloy se queda sin conexión** (hoy solo se ve al abrir la app). Requiere guardar
  "ya avisé" para no repetir: va con un cambio de esquema.
- **Receipts de Expo:** hoy "ticket ok" significa que Expo aceptó el mensaje, no que llegó al celular.
- WhatsApp/SMS para familiares sin cuenta (decisión abierta 3): hoy esos avisos quedan con
  error "canal no configurado". Va en `servicios/alertas.py::_enviar_una`.
- Probar una alerta real en un celular (Android con FCM y iPhone con Expo) con la app de Bautista.
- Editar la memoria desde la app: el ENUM de `comandos_dispositivo.tipo` no tiene
  `editar_memoria`; por ahora solo se puede ver y borrar.
- Verificación de email y recuperar contraseña (con eso se puede limitar el registro por IP).
- Retención de audios y consentimiento (Ley 25.326) antes de usar datos de personas reales.
- Versiones fijas de las dependencias (hoy `>=`): generar un archivo de versiones congeladas.
- Migraciones: cuando el esquema siga cambiando, pasar a Alembic (hoy hay un solo ALTER en `sql/cambios/`).
