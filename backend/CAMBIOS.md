# Cambios v2.2 — camelCase, invitación corta y simulador de Eloy

Pedido de Héctor, hecho por Bautista (con Claude) en la rama `backend-correcciones`, sin mergear: la revisa Héctor.

> Estado: **44 tests pasan** (los 35 de antes + 9 nuevos en `tests/test_correcciones.py`) contra MariaDB 10.11
> de `docker compose`, y `ruff` no marca nada. Los 35 de antes no se borraron: se cambiaron solo las claves
> que leen de las respuestas (`["access_token"]` → `["accessToken"]`, etc.).

## 1. Respuestas en camelCase

- `app/schemas.py` tiene un modelo base, `ModeloApp`, con `ConfigDict(alias_generator=to_camel, populate_by_name=True)`.
  Lo heredan **todos** los modelos de ese archivo. Sale todo en camelCase (`idAlertaAbierta`, `esMio`,
  `tambienAvisamosA`...) y al entrar se acepta camelCase **y** snake_case.
- En el código no cambia nada: los modelos se siguen armando con snake_case (`TokensOut(access_token=...)`) y
  los `model_dump(exclude_unset=True)` de los PATCH devuelven los nombres de los campos (hay un test con
  `{"prioridadAlerta": 9}` para eso).
- **Siguen en snake_case:**
  - El contrato con la Raspberry (`schemas_dispositivo.py` y la respuesta del sync, que es un dict).
  - Los **parámetros de la URL** (`?antes_de=`, `?limite=`, `?id_persona=`, `?todas=`): no son modelos.
    La app manda la URL en snake_case aunque el cuerpo vaya en camelCase.
  - Los `data` de los push (`tipo`, `id_alerta`, `id_persona`, `id_mensaje`): no estaban en el pedido. Si la app
    los quiere en camelCase, es cambiar 4 diccionarios en `servicios/alertas.py`, `routers/alertas.py` y
    `routers/dispositivo_pi.py`.

## 2. Código de invitación de 8 caracteres

- Antes: `token_aleatorio(24)` (32 caracteres, imposible de dictar). Ahora `seguridad.codigo_invitacion()`:
  8 caracteres del mismo alfabeto que el código de vinculación (sin 0/O ni 1/I/L), unos 850 mil millones de
  combinaciones. El link es el mismo (`LINK_INVITACION + codigo`) y en la base se sigue guardando solo el hash.
- `codigo_hash` es UNIQUE: si un código justo se repite, se prueba con otro (hasta 5 veces, con `begin_nested`).
- `AceptarInvitacionIn.codigo`: exactamente 8 caracteres. Se le sacan los espacios y se pasa a mayúsculas antes
  de validar, así sirve escrito a mano. Se busca **solo en mayúsculas**: todavía no hay invitaciones reales con el
  código largo, así que no hizo falta convivir con las viejas.
- **Límite de intentos nuevo** en `POST /invitaciones/aceptar`: 5 códigos equivocados cada 15 minutos **por
  usuario** → 429 (`limitador_invitacion`). Con 32 caracteres no hacía falta; con 8 se podía probar a ciegas.
  Aceptar una invitación limpia el contador.

## 3. Mensajes para toda la familia: `para = null`

`GET /personas/{id}/mensajes` devolvía `para: "toda la familia"` cuando Marta le hablaba a todos. Ahora es `null`,
y la app decide cómo mostrarlo. Si el mensaje es para alguien, sigue viniendo su nombre.

## 4. `expira_en` del código de vinculación con zona

`POST /dispositivo/codigo` devolvía `expira_en` sin zona (`2026-10-18T17:10:00`), y la Pi no sabía si era UTC o
local. `CodigoOut.expira_en` ahora es `FechaUTC` (sale `...Z`). Revisé el resto de lo que se le responde a la Pi:
era la única fecha sin zona (los `creado_en` del sync ya llevaban la `Z`).

## 5. Simulador de Eloy: `herramientas/simular_eloy.py`

Hace de Raspberry según el "Contrato con la Raspberry" del README. Solo usa la biblioteca estándar (anda en el
Python de la Pi) y sirve de base para el módulo de sync real.

```bash
docker compose up --build                       # API en :8000
python herramientas/simular_eloy.py alta         # registra un Eloy con la PROVISIONING_KEY de docker-compose
python herramientas/simular_eloy.py codigo       # código para "Vincular a Eloy" en la app
python herramientas/simular_eloy.py sync         # correrlo 2 o 3 veces seguidas
python herramientas/simular_eloy.py alerta "Me caí en la cocina"
```

- `herramientas/.eloy_simulado.json` hace de SQLite: uid y clave (permisos 600, en `.gitignore`; el Dockerfile no
  copia `herramientas/`), listas, ids locales, cursores de lo incremental y lo que falta confirmar.
  Con `--estado otro.json` se simula más de un Eloy.
- `alta` carga los datos de ejemplo: Marta, 3 recordatorios (presión 9:00, almorzar 13:00, gimnasia lunes y
  jueves), una charla de 4 minutos y un mensaje de Marta para toda la familia.
- `sync` manda las listas completas y lo nuevo, imprime la respuesta, aplica lo recibido y guarda para la vuelta
  siguiente las confirmaciones (`id_local` + `version`), los `mensajes_leidos` y el resultado de los comandos
  (volumen, borrar memoria, restaurar). Antes de mandar, marca como que sonaron los recordatorios de hoy cuya
  hora ya pasó (`ultima_ejecucion`).
- Un mensaje de la app tarda 3 vueltas en quedar "leído": llega → se confirma (entregado) → Eloy informa que lo leyó.
- `alerta` guarda la emergencia en la tabla de mensajes y avisa ya por `/dispositivo/alertas`; el sync siguiente
  la reenvía y el `id_local` evita que se duplique (así está el contrato).

## Cómo se comprobó

- **Tests:** 44 pasan. Los 9 nuevos cubren lo de arriba: ninguna clave con guion bajo en 7 respuestas de la app,
  entrada en las dos formas (incluido un PATCH), contrato con la Pi en snake_case, código de 8 del alfabeto con
  link y `expiraEn` con zona, aceptar en minúscula, largo inválido (422), límite (429, y es por usuario), código
  repetido, `para` en `null` y `expira_en` con `Z`.
- **Pruebas de mutación:** volví a romper cada arreglo por separado (`para` con "toda la familia", `CodigoOut` sin
  zona, sin límite, sin pasar a mayúsculas, sin reintento) y en cada caso falló su test.
- **`docker compose up --build`: probado por primera vez** (en v2.1 no había Docker). Levanta la base y la API.
  Con el simulador y una "app" de prueba que manda camelCase: alta → código → vincular → sync (Inicio muestra la
  charla y 2/2 recordatorios) → mensaje de la app leído en la tercera vuelta → recordatorio nuevo recibido y
  confirmado → volumen 50 aplicado → alerta (Inicio en `alerta`, sin duplicarse con el sync) → invitación de 8
  aceptada en minúscula → restaurar (queda desvinculado y vuelve a dar código).
- Los tests corrieron con Python 3.14 (es lo que hay en la compu de Bautista); la imagen de Docker usa 3.12.

## Para la app (cuando se mergee)

- `src/codigos.ts`: `LARGO_MINIMO_INVITACION` pasa de 10 a 8.
- Al conectar `cliente.ts`: cuerpos en camelCase, URL en snake_case, `para: null` = toda la familia.

## Qué falta

- Decidir si los `data` de los push también van en camelCase (punto 1).
- Aviso de los tests: `StarletteDeprecationWarning` por usar `httpx` con el `TestClient`; pide `httpx2`. No rompe nada.
- Lo pendiente de v2.1 sigue igual (abajo), salvo que el sync de la Pi ya tiene una base: `herramientas/simular_eloy.py`.

---

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
