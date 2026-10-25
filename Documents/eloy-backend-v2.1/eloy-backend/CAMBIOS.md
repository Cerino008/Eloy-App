# Cambios v2.1 — confiabilidad de las alertas

Partí del zip `eloy-backend` tal cual estaba (v2.0) y lo revisé leyendo todo el código y
corriendo los 15 tests (pasaban). Después armé experimentos para confirmar los problemas antes
de tocar nada. Esto es lo que cambié, **por qué**, y cómo lo comprobé.

> Estado: **35 tests pasan** (15 que ya estaban + 20 nuevos) contra MariaDB 10.11, y `ruff` no
> marca nada. `tests/test_pantallas.py` (los 15 tests viejos) no lo toqué y sigue pasando; solo ajusté `tests/conftest.py` (secretos de prueba y limpieza del estado nuevo entre tests).

---

## 1. Un aviso que falla ya no se pierde (lo más importante)

**Qué pasaba (comprobado):** si el push fallaba una vez (se cortó internet un segundo), el aviso
quedaba con `error` para siempre y el worker nunca más lo tomaba. Lo mismo si el familiar
registraba su celular *después* de la alerta.

**Qué hace ahora:** distingue tres resultados en `servicios/alertas.py::_enviar_una`:

| Resultado | Cuándo | Qué pasa |
|---|---|---|
| `enviado` | salió bien | listo |
| `reintentar` | falla pasajera, o todavía no hay celular registrado | queda pendiente, **sin error**, y se reintenta cada 15 s |
| `descartar` | no hay nada que reintentar (canal sin implementar, ej. WhatsApp) | error definitivo, como antes |

Los reintentos se cortan cuando la alerta se atiende/cierra, o pasan 60 minutos desde que **el
servidor la recibió**.

**Decisión que conviene que sepas:** el plazo de 60 min cuenta desde `creado_en` (cuando llegó al
servidor) y no desde `ocurrida_en`. Si Eloy estuvo sin internet y reporta una caída de hace 3
horas, igual tiene que avisar. Hay un test para eso.

**Limitación que sigue:** el aviso se "reclama" (`enviada_en = ahora`) antes de mandarse para no
duplicar entre instancias. Si el proceso se muere justo entre reclamar y mandar, ese aviso
queda como enviado sin haberlo sido. La ventana es de milisegundos; cerrarla del todo requiere
`SELECT ... FOR UPDATE SKIP LOCKED` (MariaDB ≥ 10.6) o una columna de "lease". Lo dejé así.

## 2. Si nadie atiende, se vuelve a avisar

**Qué pasaba (comprobado):** a los 30 minutos sin atender, el sistema ya había mandado todo lo
que sabía mandar y no hacía nada más.

**Qué hace ahora:** `repetir_avisos` vuelve a mandar un push urgente ("Marta sigue necesitando
ayuda") a quienes **ya recibieron** el primero, cada 3 min, hasta 10 veces (30 min). Se frena
solo apenas alguien toca "Ya me ocupo yo". Si llega al tope, deja un `ERROR` en el log.

**Por qué hizo falta tocar el esquema:** el `UNIQUE (id_alerta, id_familiar, canal)` de
`notificaciones_alerta` no deja guardar un segundo aviso al mismo familiar, y no había dónde
anotar "cuántas veces repetí / cuándo toca de nuevo". Agregué **2 columnas en `alertas_sos`**
(`proximo_reaviso_en`, `avisos_repetidos`) y un índice.

- Bases nuevas: ya vienen en `sql/eloy_servidor.sql`.
- Bases ya creadas con v2.0: `sql/cambios/001_reaviso_alertas.sql` (un `ALTER`).
- Comprobé que correr ese `ALTER` sobre una base v2.0 deja las **mismas columnas e índices** que
  el esquema nuevo.

## 3. iPhone: push por el servicio de Expo (`PushExpo`)

**El problema:** con Expo, `getDevicePushTokenAsync()` devuelve el token de FCM en Android pero
el de **APNs** en iOS, y `firebase-admin` rechaza ese token. Es decir, con solo FCM, los iPhone
no reciben nada.

**Qué agregué:** `PushExpo` y un repartidor (`EmisorCombinado`) que manda cada token por su camino:
`ExponentPushToken[...]` → Expo; el resto → FCM. Conviven, así que no hay que decidir ya entre
las dos opciones de la app: el backend soporta las dos. Maneja lotes de 100, detecta
`DeviceNotRegistered` y desactiva ese token.

**Lo que NO pude probar:** contra el servicio real de Expo ni en un iPhone. Está probado con
respuestas simuladas (formato de mensaje, lotes, tokens muertos, caída del servicio). Bautista
tiene que mandar el token con `getExpoPushTokenAsync` y crear los canales Android `alertas`
(importancia alta) y `general`.

**Limitación:** "ticket ok" de Expo = Expo aceptó el mensaje, no que llegó. Falta consultar los
*receipts*.

## 4. El servidor no arranca con una configuración peligrosa

**Qué pasaba (comprobado):** sin variables de entorno, `JWT_SECRET` y `PROVISIONING_KEY` valían
`cambiar-en-produccion` (público): cualquiera podía fabricar tokens. Y un `FCM_CREDENCIALES`
con ruta mala recién fallaba cuando sonaba la primera alerta real.

**Ahora:**
- Nueva variable `ENTORNO` (`desarrollo` por defecto). Con `ENTORNO=produccion` el arranque falla si:
  los secretos son los de fábrica o tienen menos de 32 caracteres, son iguales entre sí, o no
  hay forma de mandar push. En desarrollo solo avisa en el log (para que `uvicorn` siga andando
  de una).
- El emisor de push se crea **al arrancar**: un FCM mal configurado rompe el arranque.

## 5. Seguridad de segundo orden

| Cambio | Por qué |
|---|---|
| Cerrar una alerta: solo quien la atendió o un administrador | Antes Vero (familiar común) podía cerrar una alerta que nadie había atendido (comprobado). Un administrador sí puede cerrar una falsa alarma. Ahora el cierre también es atómico. |
| Alertas, recordatorios, familiares y dispositivos pedidos por id responden **404** a quien no es de la familia | Antes: 403 si existía y 404 si no, o sea se podía averiguar qué ids existen (comprobado). Las rutas por persona siguen en 403. |
| Límite de intentos en `/dispositivo/token` y `/dispositivo/registro` (10 cada 15 min) | No tenían ninguno. |
| `Dockerfile` ya no usa `--forwarded-allow-ips='*'` | Con `*`, cualquiera podía falsear `X-Forwarded-For` y saltarse el límite de intentos. Ahora Uvicorn confía solo en `FORWARDED_ALLOW_IPS` (por defecto `127.0.0.1`). **Detrás de un balanceador tenés que configurarla** (ver README). |
| Links de audio firmados con una subclave derivada del `JWT_SECRET` | Antes se firmaban con el secreto crudo. Los links ya emitidos (10 min) dejan de valer al desplegar. |

No toqué `/auth/registro` (sin límite): conviene limitarlo cuando exista verificación de email,
porque limitar por IP hoy castigaría a todos los que están detrás del mismo balanceador.

## 6. Operación

- **Limpieza automática** (`servicios/mantenimiento.py`, una vez por hora desde el worker):
  borra sesiones vencidas o cerradas hace más de 7 días y códigos de vinculación vencidos hace más de 1 día.
- `GET /salud` responde **503** (antes 500) si la base no contesta, y el `Dockerfile` trae `HEALTHCHECK`.
- `pyproject.toml` con la configuración de `ruff` (con la configuración por defecto marcaba 185 avisos; ahora no marca ninguno).
- `docker-compose.yml` para desarrollo (base + API con un comando).
- `httpx` pasó de `requirements-dev.txt` a `requirements.txt` (lo usa `PushExpo`).

---

## Cómo se comprobó

- **Los 15 tests que ya había:** pasan. Uno de ellos (`test_alerta_escalado_y_ya_me_ocupo`) me
  atrapó un bug en mi primera versión (un aviso descartado quedaba marcado como enviado), así que
  ya cumplió su función.
- **20 tests nuevos** en `tests/test_confiabilidad.py`: reintento, celular registrado tarde, alerta
  reportada tarde, vigencia, reavisos (se repite, se frena, tope, no se duplica), Expo
  (lotes, tokens muertos, caída, repartidor, punta a punta), permisos, 404, límites, firma de
  audio, config de producción, arranque con FCM roto y limpieza.
- **Pruebas de mutación:** rompí a propósito tres arreglos para ver si los tests lo notaban.
  Los tests fallaron en los tres casos (en el del reaviso hay dos protecciones redundantes y falla
  recién al quitar las dos, que es lo esperable).
- **Migración:** `001_reaviso_alertas.sql` aplicado sobre una base v2.0 vs. esquema nuevo: columnas e índices idénticos.

## Lo que NO se probó

- `docker compose up` (no hay Docker en el entorno donde trabajé). El YAML es simple, pero probalo.
- Push real: ni FCM ni Expo contra los servicios reales, ni en un celular.
- MySQL 8 (solo MariaDB 10.11).

---

## Qué falta (en este orden)

1. **Módulo de sync en la Raspberry.** Es lo más grande. Necesito `sqlite3 aloy.db .schema` real
   (y 2 filas de ejemplo de `mensajes` y `recordatorios`) porque los nombres de columnas de
   `schemas_dispositivo.py` son supuestos.
2. **Prueba real de una alerta** en un Android (FCM) y un iPhone (Expo), con la app de Bautista.
3. **Avisar por push cuando Eloy se queda sin conexión.** Hoy solo se ve al abrir la app. Necesita
   guardar "ya avisé" para no repetir, o sea otro cambio de esquema; por eso lo dejé para
   decidirlo con vos.
4. **WhatsApp/SMS para familiares sin cuenta** (Juan): necesita elegir proveedor (Twilio u otro) y tiene costo.
5. **Receipts de Expo**, versiones fijas de dependencias, retención de audios, consentimiento
   (Ley 25.326), verificación de email y recuperar contraseña, Alembic.
6. Correr los tests una vez en **MySQL 8**.
