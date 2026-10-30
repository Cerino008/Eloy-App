# Deploy en Northflank

Cómo quedó armado el backend en Northflank (30/10/2026) y cómo operarlo. El porqué de los cambios de código
(base en partes, TLS, usuario 10001) está en `CAMBIOS.md`, v2.3.

**API:** https://http--eloy-api--8xm892fjxzwf.code.run (`GET /salud` → `{"ok": true}`; documentación en `/docs`)

## Dónde está

- Equipo `cerino08s-team`, plan gratis (Developer Sandbox: hasta USD 20/mes de recursos, con tarjeta cargada y
  alerta de gasto).
- Proyecto **`default`** (se ve como "Default"), región **`us-central`** (Iowa). El plan gratis permite un solo
  proyecto y la API no deja cambiarle el nombre; la descripción dice "eloy: backend de Eloy…".
  São Paulo (`southamerica-east`) y `us-east1` no aceptan proyectos gratis.

| Recurso | Qué es | Detalle |
|---|---|---|
| `eloy-db` | Addon MySQL **8.4.11** | `nf-compute-20` (0,2 vCPU, 512 MB, hasta 32 conexiones), 4 GB, **TLS** (no se puede apagar), base `eloy`, sin acceso público |
| `eloy-api` | Servicio (build + deploy) | GitHub `Cerino008/Eloy-App`, rama `main`, Dockerfile `/backend/Dockerfile`, contexto `/backend`, puerto 8000 HTTP público, `nf-compute-20`, 1 instancia siempre prendida |
| `eloy-audios` | Volumen | 6 GB (el mínimo), un solo pod a la vez, montado en `/app/media` |
| `eloy-secretos` | Secret group (solo `eloy-api`) | `JWT_SECRET`, `PROVISIONING_KEY` y los datos del addon con alias: `HOST→DB_HOST`, `PORT→DB_PORT`, `DATABASE→DB_NAME`, `USERNAME→DB_USER`, `PASSWORD→DB_PASSWORD`, `TLS_ENABLED→DB_TLS` |
| `eloy-config` | Secret group (solo `eloy-api`) | `ENTORNO=produccion`, `PUSH_EXPO=true`, `URL_PUBLICA` (la dirección de arriba), `FORWARDED_ALLOW_IPS=10.0.0.0/8` |

Costo estimado: unos USD 12/mes (API 5,40 + MySQL 5,40 + discos ~1,20), dentro de los USD 20 gratis.

`JWT_SECRET` y `PROVISIONING_KEY` se generaron al azar (64 caracteres, distintas) dentro de un comando que no las
imprimió. No están en el repo ni en ningún archivo: se ven en el panel (secret group `eloy-secretos`).

## Cómo funciona

- **Deploy continuo:** cada push a `main` reconstruye la imagen y la despliega. No se pudo limitar a los cambios de
  `backend/` (Northflank ignora `pathIgnoreRules` en este plan), así que también un commit solo de la app redespliega.
- **Cada redeploy o reinicio corta entre 30 s y 1 minuto** (medido: 35–55 s): con el volumen, Northflank apaga el contenedor viejo antes de
  prender el nuevo. Mientras tanto la API responde 503; la Pi reintenta en el próximo sync y la app muestra el error.
- **Health checks:** readiness HTTP `GET /salud` en el 8000 (si la base no responde, Northflank deja de mandarle
  tráfico) y liveness TCP en el 8000 (así una caída de la base no reinicia la API en bucle).
- **Base:** la URL se arma con `DB_*` y conecta por **TLS 1.3 verificando certificado y nombre** (la CA es pública,
  alcanzan las del sistema). Comprobado adentro del contenedor: `CERT_REQUIRED`, `check_hostname=True`.
- **IP real del cliente:** el proxy de Northflank entra desde varias IP internas que cambian (se vieron
  10.56.138.249, 10.56.141.194, 10.56.142.7 y 10.56.142.134 en tres minutos) y agrega la IP del cliente al final
  de `X-Forwarded-For`. Por eso `FORWARDED_ALLOW_IPS=10.0.0.0/8`: un rango más chico se rompería si el proxy cambia
  de subred, y las políticas de red de Northflank no dejan que otros proyectos lleguen al contenedor. Comprobado:
  con `X-Forwarded-For: 1.2.3.4` el log muestra la IP pública real. **Nunca `*`.**
- **Volumen:** Northflank lo monta con el grupo 10001 de la imagen (`drwxrwsr-x root eloy`); la API escribe.
- **Backups:** dump semanal, domingos 06:00 UTC (03:00 en Argentina), se guardan 7 días. El plan gratis **no
  permite backups diarios**. Antes de algo riesgoso, hacer uno a mano: addon `eloy-db` → Backups → Backup now.
- **La base se creó** con `python -m scripts.init_db` adentro del contenedor (30/10/2026, 18 tablas). No hay que
  repetirlo: falla si las tablas ya existen.

## Ver logs

En la web: proyecto Default → `eloy-api` → **Logs** (o Builds para los de construcción); `eloy-db` → Logs.

Con el CLI (`npm install -g @northflank/cli`, `northflank login`):

```bash
northflank get service logs --projectId default --serviceId eloy-api --tail          # en vivo
northflank get service logs --projectId default --serviceId eloy-api --duration 3600 --textIncludes ERROR
northflank get addon logs --projectId default --addonId eloy-db --lineLimit 100
```

## Comandos adentro del contenedor

```bash
northflank exec service --projectId default --serviceId eloy-api --cmd "python -m scripts.init_db"
```

Sin terminal interactiva (scripts, CI) el CLI se traga la salida: en macOS, anteponer `script -q /dev/null`.

Para un cambio de esquema (`sql/cambios/NNN_*.sql`): `northflank forward addon --projectId default --addonId eloy-db`
abre la base en tu compu y se aplica con el cliente de MySQL, con los datos de conexión del panel.

## Cambiar configuración

- **`eloy-config`:** se puede editar en el panel; después, reiniciar `eloy-api`.
- **`eloy-secretos`:** editar un secret group **reescribe todas sus variables** (por API o CLI hay que mandar
  `JWT_SECRET` y `PROVISIONING_KEY` juntas). Cambiar `JWT_SECRET` cierra todas las sesiones de la app; cambiar
  `PROVISIONING_KEY` obliga a actualizarla donde se dan de alta los Eloy.
- **Para el simulador** (`herramientas/simular_eloy.py`), la clave se pasa por variable de entorno sin guardarla:

  ```bash
  export ELOY_API=https://http--eloy-api--8xm892fjxzwf.code.run
  export PROVISIONING_KEY="$(northflank get secret --projectId default --secretId eloy-secretos --show this -o json \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("data", d)["secrets"]["variables"]["PROVISIONING_KEY"])')"
  ```

## Pendiente

- El estado del deploy en Northflank a veces se queda en "en curso" aunque la API responde: para saber si anda,
  `curl https://http--eloy-api--8xm892fjxzwf.code.run/salud`.
- Audios en S3/R2 en vez del volumen (así se podrían tener 2 instancias y redeploys sin corte).
- Dominio propio (hoy es la dirección `code.run` de Northflank; si cambia, actualizar `URL_PUBLICA` y la app).
