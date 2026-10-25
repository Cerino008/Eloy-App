-- =====================================================================
-- ELOY · Base de datos del servidor (la que usa la app de la familia)
-- Versión 2.0 · MySQL 8.0.16+ / MariaDB 10.5+
--
-- * Todas las fechas y horas DATETIME se guardan en UTC.
--   Configurá el servidor con default-time-zone = '+00:00'.
-- * La base del dispositivo (SQLite en la Raspberry) NO cambia.
--   Por eso las tablas que se sincronizan con ella tienen:
--     id_dispositivo + id_local -> el id que la fila tiene en la Raspberry
--                                  (UNIQUE: reenviar la misma fila no la duplica)
--     pendiente_sync -> la app la cambió y Eloy todavía no se enteró
--     eliminado_en   -> borrado lógico, para que el borrado viaje a Eloy
-- =====================================================================
CREATE DATABASE IF NOT EXISTS eloy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE eloy;

-- ===================== CUENTAS Y FAMILIA =====================

-- Cuentas de la app: quienes inician sesión (Bautista, Vero...).
CREATE TABLE usuarios_app (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre           VARCHAR(80)  NOT NULL,
  apellido         VARCHAR(80)  NULL,
  email            VARCHAR(255) NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,          -- argon2id o bcrypt, nunca texto plano
  telefono         VARCHAR(30)  NULL,
  email_verificado BOOLEAN      NOT NULL DEFAULT 0,
  activo           BOOLEAN      NOT NULL DEFAULT 1,
  ultimo_acceso    DATETIME     NULL,
  creado_en        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_app_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sesiones abiertas (token de refresco). Permite "cerrar sesión en todos lados"
-- o cortar el acceso de un celular perdido.
CREATE TABLE sesiones (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario_app INT UNSIGNED NOT NULL,
  refresh_hash   CHAR(64)     NOT NULL,            -- SHA-256 del token de refresco
  nombre_equipo  VARCHAR(100) NULL,                -- "Moto G de Bautista"
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_uso     DATETIME     NULL,
  expira_en      DATETIME     NOT NULL,
  revocada_en    DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sesiones_refresh (refresh_hash),
  KEY ix_sesiones_usuario (id_usuario_app),
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (id_usuario_app)
    REFERENCES usuarios_app (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Celulares donde mandar notificaciones push (FCM). Imprescindible para las alertas.
CREATE TABLE tokens_push (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario_app INT UNSIGNED NOT NULL,
  token          VARCHAR(255) NOT NULL,
  plataforma     ENUM('android','ios','web') NOT NULL,
  activo         BOOLEAN      NOT NULL DEFAULT 1,  -- 0 si FCM avisa que el token ya no sirve
  ultimo_uso     DATETIME     NULL,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tokens_push_token (token),
  KEY ix_tokens_push_usuario (id_usuario_app, activo),
  CONSTRAINT fk_tokens_push_usuario FOREIGN KEY (id_usuario_app)
    REFERENCES usuarios_app (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- La persona que acompaña Eloy (Marta). Casi todo cuelga de acá.
-- En el dispositivo es la tabla `usuario` (siempre id = 1).
CREATE TABLE personas_mayores (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  nombre           VARCHAR(80)      NOT NULL,
  apellido         VARCHAR(80)      NULL,
  edad             TINYINT UNSIGNED NULL,          -- la que se carga en la primera conexión de Eloy
  fecha_nacimiento DATE             NULL,          -- opcional, desde la app; si está, manda sobre `edad`
  telefono         VARCHAR(30)      NULL,          -- botón "Llamar a Marta"
  tiene_pulsera    BOOLEAN          NOT NULL DEFAULT 0,
  zona_horaria     VARCHAR(50)      NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  activo           BOOLEAN          NOT NULL DEFAULT 1,
  creado_en        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT ck_personas_edad CHECK (edad IS NULL OR edad BETWEEN 1 AND 120)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Familiares de una persona. Un familiar puede tener cuenta en la app o no
-- (Juan solo recibe el aviso por teléfono). Une Familiar + FamiliaresUsuario.
CREATE TABLE familiares (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  id_persona_mayor INT UNSIGNED     NOT NULL,
  id_usuario_app   INT UNSIGNED     NULL,          -- NULL = no tiene cuenta (o todavía no aceptó)
  nombre           VARCHAR(80)      NOT NULL,      -- como lo dice Eloy: "Vero"
  parentesco       VARCHAR(40)      NULL,          -- en el dispositivo: `relacion`
  rol              ENUM('administrador','familiar') NOT NULL DEFAULT 'familiar',
  recibe_alertas   BOOLEAN          NOT NULL DEFAULT 1,
  prioridad_alerta TINYINT UNSIGNED NULL,          -- 1 = primero; en el dispositivo: numero_prioridad
  telefono         VARCHAR(30)      NULL,          -- en el dispositivo: numero_whatsapp
  email            VARCHAR(255)     NULL,
  -- sincronización con la tabla `familiar` del dispositivo
  id_dispositivo   INT UNSIGNED     NULL,
  id_local         INT UNSIGNED     NULL,
  pendiente_sync   BOOLEAN          NOT NULL DEFAULT 0,
  eliminado_en     DATETIME         NULL,
  creado_en        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_familiares_persona_usuario (id_persona_mayor, id_usuario_app),
  UNIQUE KEY uq_familiares_local (id_dispositivo, id_local),
  KEY ix_familiares_usuario (id_usuario_app),
  KEY ix_familiares_alertas (id_persona_mayor, recibe_alertas, prioridad_alerta),
  KEY ix_familiares_sync (id_persona_mayor, pendiente_sync),
  CONSTRAINT fk_familiares_persona FOREIGN KEY (id_persona_mayor)
    REFERENCES personas_mayores (id) ON DELETE CASCADE,
  CONSTRAINT fk_familiares_usuario FOREIGN KEY (id_usuario_app)
    REFERENCES usuarios_app (id) ON DELETE SET NULL
  -- la FK a dispositivos se agrega después de crear esa tabla (ALTER más abajo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- "Invitar a un familiar": link con código para que cree su cuenta.
-- Si se invita a alguien que ya está en la lista (Juan), se completa id_familiar
-- y al aceptar se le asigna la cuenta; si no, se crea el familiar al aceptar.
CREATE TABLE invitaciones (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_persona_mayor  INT UNSIGNED NOT NULL,
  id_familiar       INT UNSIGNED NULL,             -- familiar existente al que se le da cuenta
  invitado_por      INT UNSIGNED NULL,             -- familiar (administrador) que invitó
  email             VARCHAR(255) NULL,
  rol               ENUM('administrador','familiar') NOT NULL DEFAULT 'familiar',
  codigo_hash       CHAR(64)     NOT NULL,         -- SHA-256; el código real solo viaja en el link
  expira_en         DATETIME     NOT NULL,
  aceptada_en       DATETIME     NULL,
  id_usuario_acepto INT UNSIGNED NULL,
  creado_en         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invitaciones_codigo (codigo_hash),
  CONSTRAINT fk_invitaciones_persona FOREIGN KEY (id_persona_mayor)
    REFERENCES personas_mayores (id) ON DELETE CASCADE,
  CONSTRAINT fk_invitaciones_familiar FOREIGN KEY (id_familiar)
    REFERENCES familiares (id) ON DELETE CASCADE,
  CONSTRAINT fk_invitaciones_invito FOREIGN KEY (invitado_por)
    REFERENCES familiares (id) ON DELETE SET NULL,
  CONSTRAINT fk_invitaciones_acepto FOREIGN KEY (id_usuario_acepto)
    REFERENCES usuarios_app (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== DISPOSITIVO ELOY =====================

-- Cada Eloy físico y su estado (tarjeta "Eloy" de la pantalla Familia).
CREATE TABLE dispositivos (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  uid_serie        VARCHAR(64)      NOT NULL,      -- ID de fábrica (la MAC sirve)
  secret_hash      VARCHAR(255)     NOT NULL,      -- hash de la clave con la que Eloy se autentica
  id_persona_mayor INT UNSIGNED     NULL,          -- NULL = sin vincular (de fábrica o restaurado)
  vinculado_en     DATETIME         NULL,
  wifi_ssid        VARCHAR(64)      NULL,          -- solo el nombre; la clave del WiFi nunca sube
  volumen          TINYINT UNSIGNED NOT NULL DEFAULT 70,
  version_software VARCHAR(20)      NULL,
  ultima_conexion  DATETIME         NULL,          -- "Conectado hace 1 minuto"
  creado_en        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dispositivos_uid (uid_serie),
  KEY ix_dispositivos_persona (id_persona_mayor),
  CONSTRAINT ck_dispositivos_volumen CHECK (volumen BETWEEN 0 AND 100),
  CONSTRAINT fk_dispositivos_persona FOREIGN KEY (id_persona_mayor)
    REFERENCES personas_mayores (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE familiares
  ADD CONSTRAINT fk_familiares_dispositivo FOREIGN KEY (id_dispositivo)
    REFERENCES dispositivos (id) ON DELETE SET NULL;

-- Código de la pantalla "Vinculá a Eloy" (QR o escrito a mano). Un solo uso, vence.
CREATE TABLE codigos_vinculacion (
  id                INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  id_dispositivo    INT UNSIGNED     NOT NULL,
  codigo            VARCHAR(12)      NOT NULL,
  expira_en         DATETIME         NOT NULL,     -- sugerido: 10 minutos
  usado_en          DATETIME         NULL,
  id_usuario_app    INT UNSIGNED     NULL,         -- quién lo usó
  intentos_fallidos TINYINT UNSIGNED NOT NULL DEFAULT 0,
  creado_en         DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_codigos_codigo (codigo),
  CONSTRAINT fk_codigos_dispositivo FOREIGN KEY (id_dispositivo)
    REFERENCES dispositivos (id) ON DELETE CASCADE,
  CONSTRAINT fk_codigos_usuario FOREIGN KEY (id_usuario_app)
    REFERENCES usuarios_app (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Acciones que la app le pide a Eloy. Eloy las recibe en la próxima sincronización.
CREATE TABLE comandos_dispositivo (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_dispositivo INT UNSIGNED NOT NULL,
  tipo           ENUM('restaurar_fabrica','ajustar_volumen','borrar_memoria','reiniciar') NOT NULL,
  parametros     JSON         NULL,                -- {"volumen": 50} / {"clave": "nieta"}
  estado         ENUM('pendiente','enviado','ejecutado','fallido') NOT NULL DEFAULT 'pendiente',
  solicitado_por INT UNSIGNED NULL,
  enviado_en     DATETIME     NULL,
  ejecutado_en   DATETIME     NULL,
  error          VARCHAR(255) NULL,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_comandos_pendientes (id_dispositivo, estado),
  CONSTRAINT fk_comandos_dispositivo FOREIGN KEY (id_dispositivo)
    REFERENCES dispositivos (id) ON DELETE CASCADE,
  CONSTRAINT fk_comandos_usuario FOREIGN KEY (solicitado_por)
    REFERENCES usuarios_app (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== ACTIVIDAD =====================

-- Copia de la tabla `eventos` del dispositivo: charlas, medicación, emergencias...
-- De acá salen "Última charla", "3 charlas", "18 minutos" y la línea de tiempo.
CREATE TABLE eventos (
  id               INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  id_persona_mayor INT UNSIGNED      NOT NULL,
  id_dispositivo   INT UNSIGNED      NULL,
  id_local         INT UNSIGNED      NULL,
  tipo             VARCHAR(30)       NOT NULL,     -- texto libre: lo escribe el modelo de Eloy
  descripcion      VARCHAR(500)      NULL,
  duracion_min     SMALLINT UNSIGNED NULL,         -- solo tipo 'conversacion' ("charló 4 minuto(s)")
  ocurrido_en      DATETIME          NOT NULL,     -- UTC (en el dispositivo: ocurrio_en)
  creado_en        DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_eventos_local (id_dispositivo, id_local),
  KEY ix_eventos_persona_fecha (id_persona_mayor, ocurrido_en),
  KEY ix_eventos_persona_tipo (id_persona_mayor, tipo, ocurrido_en),
  CONSTRAINT fk_eventos_persona FOREIGN KEY (id_persona_mayor)
    REFERENCES personas_mayores (id) ON DELETE CASCADE,
  CONSTRAINT fk_eventos_dispositivo FOREIGN KEY (id_dispositivo)
    REFERENCES dispositivos (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- La regla del recordatorio ("Pastilla de la presión, todos los días 09:00").
-- Se crea desde la app o desde la voz (Eloy).
CREATE TABLE recordatorios (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_persona_mayor INT UNSIGNED NOT NULL,
  titulo           VARCHAR(120) NOT NULL,
  descripcion      VARCHAR(255) NULL,
  hora             TIME         NOT NULL,          -- hora local de la persona
  repeticion       ENUM('una_vez','diaria','semanal') NOT NULL,
  -- mismos nombres que usa el dispositivo (sin tildes): 'lunes,jueves' entra tal cual
  dias_semana      SET('lunes','martes','miercoles','jueves','viernes','sabado','domingo') NULL,
  fecha_unica      DATE         NULL,              -- una_vez con fecha; NULL = la próxima vez que sea esa hora
  completado       BOOLEAN      NOT NULL DEFAULT 0, -- una_vez que ya sonó
  creado_desde     ENUM('app','eloy') NOT NULL DEFAULT 'app',
  creado_por       INT UNSIGNED NULL,              -- familiar, si se creó desde la app
  -- sincronización con la tabla `recordatorios` del dispositivo
  id_dispositivo   INT UNSIGNED NULL,
  id_local         INT UNSIGNED NULL,
  pendiente_sync   BOOLEAN      NOT NULL DEFAULT 0,
  eliminado_en     DATETIME     NULL,
  creado_en        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_recordatorios_local (id_dispositivo, id_local),
  KEY ix_recordatorios_persona (id_persona_mayor, eliminado_en),
  KEY ix_recordatorios_sync (id_persona_mayor, pendiente_sync),
  CONSTRAINT ck_recordatorios_semanal CHECK (repeticion <> 'semanal' OR dias_semana IS NOT NULL),
  CONSTRAINT ck_recordatorios_fecha   CHECK (repeticion = 'una_vez' OR fecha_unica IS NULL),
  CONSTRAINT fk_recordatorios_persona FOREIGN KEY (id_persona_mayor)
    REFERENCES personas_mayores (id) ON DELETE CASCADE,
  CONSTRAINT fk_recordatorios_creado_por FOREIGN KEY (creado_por)
    REFERENCES familiares (id) ON DELETE SET NULL,
  CONSTRAINT fk_recordatorios_dispositivo FOREIGN KEY (id_dispositivo)
    REFERENCES dispositivos (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada vez que un recordatorio sonó. Solo hechos: lo "Pendiente" se calcula.
-- Sale de `ultima_ejecucion` del dispositivo (fecha local del último día que sonó).
CREATE TABLE recordatorio_ejecuciones (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_recordatorio INT UNSIGNED NOT NULL,
  fecha           DATE         NOT NULL,           -- día local de la persona
  sono_en         DATETIME     NULL,               -- UTC, si se conoce la hora exacta
  confirmado_en   DATETIME     NULL,               -- para el futuro "¿la tomaste?"
  reportado_en    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ejecucion_dia (id_recordatorio, fecha),
  CONSTRAINT fk_ejecuciones_recordatorio FOREIGN KEY (id_recordatorio)
    REFERENCES recordatorios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- "Resumen de hoy". Lo genera Eloy a las 21 (hoy: configuracion resumen_AAAA-MM-DD).
CREATE TABLE resumenes_diarios (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_persona_mayor INT UNSIGNED NOT NULL,
  fecha            DATE         NOT NULL,          -- día local
  texto            TEXT         NOT NULL,
  generado_por     ENUM('eloy','servidor') NOT NULL DEFAULT 'eloy',
  creado_en        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_resumenes_persona_fecha (id_persona_mayor, fecha),
  CONSTRAINT fk_resumenes_persona FOREIGN KEY (id_persona_mayor)
    REFERENCES personas_mayores (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pantalla Mensajes. Misma idea que la tabla `mensajes` del dispositivo:
--   de_familia: un familiar le escribe a Marta -> Eloy lo lee en voz alta
--   a_familia : Marta le dicta a Eloy "decile a Vero que..."
-- estado = entrega al destinatario:
--   de_familia: pendiente (solo en el servidor) -> entregado (ya está en Eloy) -> leido (Eloy lo dijo)
--   a_familia : entregado (visible en la app) -> leido (algún familiar lo abrió)
CREATE TABLE mensajes (
  id                  INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  id_persona_mayor    INT UNSIGNED      NOT NULL,
  direccion           ENUM('de_familia','a_familia') NOT NULL,
  id_familiar_emisor  INT UNSIGNED      NULL,      -- de_familia: quién escribió
  id_familiar_destino INT UNSIGNED      NULL,      -- a_familia: a quién (NULL = toda la familia)
  nombre_emisor       VARCHAR(80)       NULL,      -- copia del nombre tal como se mostró
  nombre_destino      VARCHAR(80)       NULL,
  texto               TEXT              NULL,
  audio_url           VARCHAR(500)      NULL,      -- ruta en el almacenamiento (S3 o similar)
  audio_duracion_seg  SMALLINT UNSIGNED NULL,
  estado              ENUM('pendiente','entregado','leido') NOT NULL DEFAULT 'pendiente',
  entregado_en        DATETIME          NULL,
  leido_en            DATETIME          NULL,      -- "Eloy ya se lo leyó · 11:20"
  id_dispositivo      INT UNSIGNED      NULL,
  id_local            INT UNSIGNED      NULL,
  creado_en           DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mensajes_local (id_dispositivo, id_local),
  KEY ix_mensajes_hilo (id_persona_mayor, creado_en),
  KEY ix_mensajes_pendientes (id_persona_mayor, direccion, estado),
  CONSTRAINT ck_mensajes_contenido CHECK (texto IS NOT NULL OR audio_url IS NOT NULL),
  CONSTRAINT fk_mensajes_persona FOREIGN KEY (id_persona_mayor)
    REFERENCES personas_mayores (id) ON DELETE CASCADE,
  CONSTRAINT fk_mensajes_emisor FOREIGN KEY (id_familiar_emisor)
    REFERENCES familiares (id) ON DELETE SET NULL,
  CONSTRAINT fk_mensajes_destino FOREIGN KEY (id_familiar_destino)
    REFERENCES familiares (id) ON DELETE SET NULL,
  CONSTRAINT fk_mensajes_dispositivo FOREIGN KEY (id_dispositivo)
    REFERENCES dispositivos (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== ALERTAS SOS =====================

-- Cada pedido de ayuda. En el dispositivo hoy es un mensaje con tipo = 'emergencia'.
CREATE TABLE alertas_sos (
  id                  INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  id_persona_mayor    INT UNSIGNED      NOT NULL,
  id_dispositivo      INT UNSIGNED      NULL,
  id_local            INT UNSIGNED      NULL,      -- id del mensaje 'emergencia' en el dispositivo
  origen              ENUM('voz','pulsera','pantalla') NOT NULL DEFAULT 'voz',
  motivo              VARCHAR(500)      NULL,      -- "Me caí en la cocina..."
  audio_url           VARCHAR(500)      NULL,
  audio_duracion_seg  SMALLINT UNSIGNED NULL,
  ocurrida_en         DATETIME          NOT NULL,
  estado              ENUM('abierta','atendida','cerrada') NOT NULL DEFAULT 'abierta',
  id_familiar_atiende INT UNSIGNED      NULL,      -- quién tocó "Ya me ocupo yo"
  atendida_en         DATETIME          NULL,
  cerrada_en          DATETIME          NULL,
  nota_cierre         VARCHAR(255)      NULL,      -- "Fui, se resbaló, está bien"
  -- Repetición del aviso mientras nadie la atiende (agregado en v2.1)
  proximo_reaviso_en  DATETIME          NULL,      -- cuándo toca volver a avisar si sigue abierta
  avisos_repetidos    TINYINT UNSIGNED  NOT NULL DEFAULT 0,   -- cuántas veces se repitió
  creado_en           DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_alertas_local (id_dispositivo, id_local),
  KEY ix_alertas_reaviso (estado, proximo_reaviso_en),
  KEY ix_alertas_persona_estado (id_persona_mayor, estado),
  KEY ix_alertas_persona_fecha (id_persona_mayor, ocurrida_en),
  CONSTRAINT fk_alertas_persona FOREIGN KEY (id_persona_mayor)
    REFERENCES personas_mayores (id) ON DELETE CASCADE,
  CONSTRAINT fk_alertas_dispositivo FOREIGN KEY (id_dispositivo)
    REFERENCES dispositivos (id) ON DELETE SET NULL,
  CONSTRAINT fk_alertas_atiende FOREIGN KEY (id_familiar_atiende)
    REFERENCES familiares (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A quién se avisó de cada alerta, por qué canal y cuándo ("También avisamos a...").
CREATE TABLE notificaciones_alerta (
  id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  id_alerta     INT UNSIGNED     NOT NULL,
  id_familiar   INT UNSIGNED     NOT NULL,
  nivel         TINYINT UNSIGNED NOT NULL,         -- copia de prioridad_alerta al momento de la alerta
  canal         ENUM('push','sms','whatsapp','llamada') NOT NULL DEFAULT 'push',
  programada_en DATETIME         NOT NULL,         -- nivel 1 = ya; los demás si sigue abierta
  enviada_en    DATETIME         NULL,
  abierta_en    DATETIME         NULL,             -- el familiar abrió la notificación
  error         VARCHAR(255)     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notif_alerta_familiar_canal (id_alerta, id_familiar, canal),
  KEY ix_notif_programadas (enviada_en, programada_en),
  CONSTRAINT fk_notif_alerta FOREIGN KEY (id_alerta)
    REFERENCES alertas_sos (id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_familiar FOREIGN KEY (id_familiar)
    REFERENCES familiares (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===================== SISTEMA =====================

-- "Lo que Eloy sabe" (clave -> valor). Copia de memoria_agente del dispositivo.
CREATE TABLE memoria_agente (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_persona_mayor INT UNSIGNED NOT NULL,
  clave            VARCHAR(100) NOT NULL,          -- "nieta", "comida_favorita"
  valor            TEXT         NOT NULL,
  creado_en        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_memoria_persona_clave (id_persona_mayor, clave),
  CONSTRAINT fk_memoria_persona FOREIGN KEY (id_persona_mayor)
    REFERENCES personas_mayores (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quién hizo qué en acciones delicadas (vincular, invitar, restaurar, cambiar roles).
CREATE TABLE registro_auditoria (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario_app   INT UNSIGNED    NULL,
  id_persona_mayor INT UNSIGNED    NULL,
  accion           VARCHAR(60)     NOT NULL,       -- vincular_dispositivo, restaurar_fabrica...
  detalle          JSON            NULL,
  ip               VARCHAR(45)     NULL,
  creado_en        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_auditoria_persona (id_persona_mayor, creado_en),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (id_usuario_app)
    REFERENCES usuarios_app (id) ON DELETE SET NULL,
  CONSTRAINT fk_auditoria_persona FOREIGN KEY (id_persona_mayor)
    REFERENCES personas_mayores (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
