-- ============================================================
--  Destello — Historial de schema (PostgreSQL / Supabase)
--
--  ⚠️ NO ES UN SCRIPT PARA CORRER DE UN TIROTAZO EN UNA BASE VIVA.
--  Es la concatenación, en orden y SIN EDITAR, de:
--    1) La base original de Supabase (esta sección, de jul 2026)
--    2) Cada migración de apps/api/src/db/migrations/ (001 a 016)
--  Sirve para leer "cómo llegamos a la estructura de hoy" de corrido,
--  y como punto de partida si algún día hay que levantar una base
--  nueva desde cero (correr cada sección EN ORDEN, revisando que
--  cada CREATE/ALTER siga aplicando).
--
--  Regla crítica del proyecto (ver CLAUDE.md): las tablas de esta
--  base YA EXISTEN, creadas y editadas a mano en el panel de Supabase
--  por Paola — este archivo documenta el historial versionado, pero
--  puede haber cambios hechos directo en Supabase que ningún script
--  capturó. Si algo aquí no coincide con la base real, la base real
--  manda, no este archivo.
--
--  ✅ Resuelto (18 sep 2026): se confirmó contra la base real
--  (information_schema.columns en el SQL Editor de Supabase) que
--  `talleres.id` SÍ es TEXT (slug), como dice la sección de abajo.
--  CLAUDE.md tenía el dato viejo (decía UUID) — ya se corrigió ahí.
--
--  ⚠️ Pero esa misma consulta encontró algo más: `talleres` tiene dos
--  columnas reales, `instructor TEXT` y `duracion_horas NUMERIC`, que
--  NO existen en NINGÚN archivo de este repo (ni aquí ni en ninguna
--  migración 001-014) — se agregaron a mano en Supabase sin dejar
--  rastro versionado. Es la prueba concreta de la advertencia de
--  arriba: la base real puede tener más que este archivo. Si vuelves
--  a agregar una columna a mano, considera anotarla aquí aunque sea en
--  un comentario, para que este archivo no se quede obsoleto otra vez.
--
--  Reglas de negocio que siguen vigentes (de la base original):
--   · cupo_maximo  = 20 por defecto (control de reventa)
--   · chispas.usuario_email → usuarios.email  (FK INTENCIONAL:
--     una chispa solo existe para un usuario con cuenta) — NUNCA quitar
--   · resplandores.email ≠ chispas.usuario_email (columnas distintas,
--     no confundirlas)
--   · La ventana de material (30 días desde el día siguiente a que
--     concluye el taller) NO se guarda: se calcula en la API a partir
--     de talleres.fecha_fin (o fecha_inicio si no hay fin).
-- ============================================================

-- ════════════════════════════════════════════════════════════
--  SECCIÓN 0 — Base original de Supabase (jul 2026)
--
--  ⚠️ Esta sección hace DROP TABLE ... CASCADE de las tablas
--  principales. Solo tiene sentido correrla en una base VACÍA o de
--  prueba — no en la base con datos que ya tengas.
-- ════════════════════════════════════════════════════════════

-- ── Limpieza (orden inverso por dependencias FK) ─────────────
DROP TABLE IF EXISTS canjes_supernova CASCADE;
DROP TABLE IF EXISTS supernovas       CASCADE;
DROP TABLE IF EXISTS referidos        CASCADE;
DROP TABLE IF EXISTS lista_espera     CASCADE;
DROP TABLE IF EXISTS chispas          CASCADE;
DROP TABLE IF EXISTS resplandores     CASCADE;
DROP TABLE IF EXISTS talleres         CASCADE;
DROP TABLE IF EXISTS usuarios         CASCADE;

-- ── Usuarios ─────────────────────────────────────────────────
CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,        -- destino de la FK de chispas
    nombre          TEXT,
    apellido        TEXT,
    whatsapp        TEXT,                         -- 10 dígitos, sin lada
    password        TEXT,                         -- bcrypt hash (null si solo Google)
    estado          TEXT DEFAULT 'espera',        -- espera | activo | inactivo | baneado
    -- ── Referidos ──
    codigo_referido TEXT UNIQUE,                  -- SU código para compartir (polvo estelar)
    referido_por    TEXT,                         -- email de quien lo invitó (se fija 1 vez)
    estrellas       INTEGER DEFAULT 0,            -- saldo cacheado (ganadas − canjeadas)
    -- ── Constancia ──
    racha            INTEGER DEFAULT 0,           -- días seguidos de actividad
    ultima_actividad DATE,                        -- último día que entró (CDMX)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Talleres ─────────────────────────────────────────────────
CREATE TABLE talleres (
    id            TEXT PRIMARY KEY,              -- slug: 'taller-nombre'
    nombre        TEXT NOT NULL,
    descripcion   TEXT,
    precio        NUMERIC(10,2),
    horario       TEXT,                          -- ej. '12:00 PM (CDMX)' — texto para mostrar
    hora_inicio   TIME,                          -- hora local CDMX (UTC−6) inicio de clase
    hora_fin      TIME,                          -- hora local CDMX fin de clase (para cerrar acceso)
    fecha_inicio  DATE,                          -- fecha en que se imparte
    fecha_fin     DATE,                          -- fin (null si es de un día)
    cupo_maximo   INTEGER DEFAULT 20,            -- tope de alumnos (anti-reventa)
    imagen_url    TEXT,
    categoria     TEXT,
    estado        TEXT DEFAULT 'activo',         -- activo | proximamente | lleno | pausado | borrador
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Resplandores (invitación de 1 uso para crear cuenta) ─────
CREATE TABLE resplandores (
    code         TEXT PRIMARY KEY,               -- RESP-XXXX-XXXX
    email        TEXT NOT NULL,                  -- ⚠ es 'email', NO 'usuario_email'
    nombre       TEXT,
    taller_id    TEXT REFERENCES talleres(id) ON UPDATE CASCADE ON DELETE SET NULL,
    expires_at   TIMESTAMPTZ,
    used         BOOLEAN DEFAULT FALSE,
    used_at      TIMESTAMPTZ,
    revoked      BOOLEAN DEFAULT FALSE,
    revoked_at   TIMESTAMPTZ,
    created_by   TEXT DEFAULT 'admin',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Chispas (llave de acceso a un taller para usuario con cuenta) ──
CREATE TABLE chispas (
    code           TEXT PRIMARY KEY,             -- DEST-XXXX-XXXX
    taller_id      TEXT REFERENCES talleres(id) ON UPDATE CASCADE ON DELETE SET NULL,
    taller_nombre  TEXT,
    -- FK INTENCIONAL: la chispa solo se crea para un usuario existente.
    usuario_email  TEXT REFERENCES usuarios(email) ON UPDATE CASCADE ON DELETE SET NULL,
    usuario_nombre TEXT,
    usuario_wa     TEXT,
    pago_id        TEXT,                          -- referencia de pago (futuro)
    expires_at     TIMESTAMPTZ,                   -- vigencia de la chispa
    used           BOOLEAN DEFAULT FALSE,         -- ¿ya se canjeó?
    used_at        TIMESTAMPTZ,                   -- cuándo se canjeó
    used_by        TEXT,                          -- quién la canjeó (email/id)
    revoked        BOOLEAN DEFAULT FALSE,
    revoked_at     TIMESTAMPTZ,
    is_demo        BOOLEAN DEFAULT FALSE,         -- chispa regalada
    created_by     TEXT DEFAULT 'admin',
    created_at     TIMESTAMPTZ DEFAULT NOW()      -- fecha de compra/emisión
);

-- ── Lista de espera ──────────────────────────────────────────
CREATE TABLE lista_espera (
    id          SERIAL PRIMARY KEY,
    email       TEXT NOT NULL,
    taller_id   TEXT REFERENCES talleres(id) ON UPDATE CASCADE ON DELETE CASCADE,
    nombre      TEXT,
    whatsapp    TEXT,
    estado      TEXT DEFAULT 'pendiente',         -- pendiente | cupo_confirmado | pagado | rechazado
    notas       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Referidos (libro mayor: 1 fila por referido exitoso) ─────
CREATE TABLE referidos (
    id              SERIAL PRIMARY KEY,
    referidor_email TEXT REFERENCES usuarios(email) ON UPDATE CASCADE ON DELETE CASCADE, -- quién invitó
    referido_email  TEXT REFERENCES usuarios(email) ON UPDATE CASCADE ON DELETE CASCADE, -- quién entró
    codigo_usado    TEXT,                         -- código con el que llegó
    estrellas       INTEGER DEFAULT 0,            -- Estrellas otorgadas por este referido
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (referido_email)                       -- un usuario solo puede ser referido una vez
);

-- ── Supernovas (catálogo de premios canjeables con Estrellas) ─
CREATE TABLE supernovas (
    id           SERIAL PRIMARY KEY,
    nombre       TEXT NOT NULL,
    descripcion  TEXT,
    costo_estrellas INTEGER NOT NULL,             -- cuántas Estrellas cuesta
    activo       BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Canjes de Supernova (redenciones de Estrellas) ───────────
CREATE TABLE canjes_supernova (
    id                SERIAL PRIMARY KEY,
    usuario_email     TEXT REFERENCES usuarios(email) ON UPDATE CASCADE ON DELETE CASCADE,
    supernova_id      INTEGER REFERENCES supernovas(id) ON UPDATE CASCADE ON DELETE SET NULL,
    estrellas_gastadas INTEGER NOT NULL,
    estado            TEXT DEFAULT 'solicitado',  -- solicitado | entregado | cancelado
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Catálogo inicial de Supernovas (ajusta costos a tu gusto) ─
INSERT INTO supernovas (nombre, descripcion, costo_estrellas) VALUES
    ('Mes de acceso gratis',  'Un mes de acceso completo a la plataforma', 500),
    ('Masterclass exclusiva', 'Acceso a una masterclass solo para alumnos', 300),
    ('Taller a elegir',       'Un taller del catálogo a elección',         800);

-- ── Insignias (logros que la profesora otorga al alumno) ─────
CREATE TABLE insignias (
    id            SERIAL PRIMARY KEY,
    usuario_email TEXT REFERENCES usuarios(email) ON UPDATE CASCADE ON DELETE CASCADE,
    nombre        TEXT NOT NULL,                  -- ej. 'Puntería perfecta'
    descripcion   TEXT,
    taller_id     TEXT REFERENCES talleres(id) ON UPDATE CASCADE ON DELETE SET NULL,
    otorgada_por  TEXT,                           -- profesora/admin que la otorgó
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX idx_chispas_email        ON chispas(usuario_email);
CREATE INDEX idx_insignias_usuario    ON insignias(usuario_email);
CREATE INDEX idx_chispas_taller       ON chispas(taller_id);
CREATE INDEX idx_resplandores_email   ON resplandores(email);
CREATE INDEX idx_lista_espera_estado  ON lista_espera(estado);
CREATE INDEX idx_lista_espera_taller  ON lista_espera(taller_id);
CREATE INDEX idx_usuarios_email       ON usuarios(email);
CREATE INDEX idx_usuarios_codigo_ref  ON usuarios(codigo_referido);
CREATE INDEX idx_referidos_referidor  ON referidos(referidor_email);
CREATE INDEX idx_canjes_usuario       ON canjes_supernova(usuario_email);


-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 001_whatsapp_unico
--  Archivo real: apps/api/src/db/migrations/001_whatsapp_unico.sql
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 001: un número de WhatsApp = una sola cuenta
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUÉ: el login por número (`POST /auth/phone/verify`) busca al usuario con
-- `WHERE whatsapp = $1`. Si dos cuentas comparten número, la persona entra a la
-- cuenta equivocada — acceso cruzado a los datos de alguien más.
--
-- Correr en el SQL Editor de Supabase, EN ORDEN. El paso 3 falla si todavía
-- quedan duplicados: eso es a propósito.
-- ════════════════════════════════════════════════════════════════════════════


-- ── PASO 0 · Normalizar antes de comparar ──────────────────────────────────
-- Si un número quedó guardado como '+52 55 1234 5678' y otro como '5512345678',
-- son el mismo número pero el índice no los vería como iguales. Se dejan todos
-- en el formato canónico: 10 dígitos, sin lada ni signos. Las cadenas vacías
-- pasan a NULL para que el índice parcial las ignore.

UPDATE usuarios
SET whatsapp = NULLIF(RIGHT(REGEXP_REPLACE(whatsapp, '\D', '', 'g'), 10), '')
WHERE whatsapp IS NOT NULL
  AND whatsapp <> NULLIF(RIGHT(REGEXP_REPLACE(whatsapp, '\D', '', 'g'), 10), '');

-- Los que no quedaron en 10 dígitos son basura (números incompletos): a NULL.
UPDATE usuarios
SET whatsapp = NULL
WHERE whatsapp IS NOT NULL AND LENGTH(whatsapp) <> 10;


-- ── PASO 1 · ¿Qué duplicados quedan? ───────────────────────────────────────
-- Revisar el resultado ANTES de seguir. Si sale vacío, saltar al paso 3.

SELECT whatsapp,
       COUNT(*)                                AS cuentas,
       ARRAY_AGG(id       ORDER BY id)         AS ids,
       ARRAY_AGG(email    ORDER BY id)         AS correos,
       ARRAY_AGG(estado   ORDER BY id)         AS estados,
       ARRAY_AGG(created_at::date ORDER BY id) AS creadas
FROM usuarios
WHERE whatsapp IS NOT NULL
GROUP BY whatsapp
HAVING COUNT(*) > 1
ORDER BY cuentas DESC;


-- ── PASO 2 · Resolver los duplicados ───────────────────────────────────────
-- El número se queda con UNA cuenta; a las demás se les pone NULL (la persona
-- podrá volver a ligarlo desde su perfil, y ahí sí se valida).
--
-- Criterio sugerido: gana la cuenta ACTIVA; si hay varias activas, la más
-- antigua (menor id). Nunca se borra ninguna cuenta — solo se suelta el número.
--
-- ⚠️ Revisa primero el resultado del paso 1. Si en algún caso quieres que gane
-- otra cuenta, hazlo a mano con:
--     UPDATE usuarios SET whatsapp = NULL WHERE id = <id_que_pierde>;

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY whatsapp
               ORDER BY (estado = 'activo') DESC, id ASC
           ) AS pos
    FROM usuarios
    WHERE whatsapp IS NOT NULL
)
UPDATE usuarios u
SET whatsapp = NULL
FROM ranked r
WHERE u.id = r.id AND r.pos > 1;


-- ── PASO 3 · El candado ────────────────────────────────────────────────────
-- Índice ÚNICO PARCIAL: solo aplica a las filas con número. Así muchas cuentas
-- pueden seguir teniendo whatsapp NULL (en un índice único normal, varios NULL
-- sí se permiten, pero el parcial además mantiene el índice pequeño y rápido).

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_whatsapp_unico
    ON usuarios (whatsapp)
    WHERE whatsapp IS NOT NULL;


-- ── PASO 4 · Verificar ─────────────────────────────────────────────────────
-- Debe devolver 0 filas.

SELECT whatsapp, COUNT(*)
FROM usuarios
WHERE whatsapp IS NOT NULL
GROUP BY whatsapp
HAVING COUNT(*) > 1;

-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 002_comprobantes
--  Archivo real: apps/api/src/db/migrations/002_comprobantes.sql
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 002: guardar los comprobantes de pago
-- ════════════════════════════════════════════════════════════════════════════
--
-- Hasta ahora la foto del comprobante solo llegaba al WhatsApp de Paola. Para
-- verla desde el panel hay que guardarla, y para eso hace falta saber dónde
-- quedó dentro de Supabase Storage.
--
-- Se guarda la RUTA, no una URL pública: un comprobante trae nombre, banco y
-- monto, así que el bucket es privado y la API firma una URL temporal (1 h)
-- cada vez que se abre la bandeja.
-- ════════════════════════════════════════════════════════════════════════════


-- ── PASO 1 · La columna ─────────────────────────────────────────────────────

ALTER TABLE reportes_acceso
    ADD COLUMN IF NOT EXISTS comprobante_path TEXT;

COMMENT ON COLUMN reportes_acceso.comprobante_path IS
    'Ruta dentro del bucket privado de Supabase Storage. NULL = sin imagen.';


-- ── PASO 2 · El bucket ──────────────────────────────────────────────────────
--
-- Esto NO se corre como SQL. Hazlo en el dashboard:
--   Storage → New bucket
--     · Name: comprobantes
--     · Public bucket: **DESACTIVADO** ← importante
--   Create bucket
--
-- No hacen falta políticas RLS: la API entra con la service key, que las omite.
-- Justamente por eso el bucket debe quedar privado — así el único camino para
-- ver un comprobante es una URL firmada por la API.


-- ── PASO 3 · Variables de entorno de la API ─────────────────────────────────
--
-- En el .env que usa el contenedor de la API (y en docker-compose si hace falta
-- pasarlas explícitas):
--
--   SUPABASE_URL=https://wqofkllxkrjjifpzsfwm.supabase.co
--   SUPABASE_SERVICE_KEY=<Project Settings → API → service_role secret>
--
-- ⚠️ La service_role key salta TODAS las reglas de seguridad de Supabase.
--    Va solo en el servidor, nunca en el frontend ni en el repo.
--
-- Sin estas variables no truena nada: el reporte se guarda igual, solo sin
-- imagen, y en los logs de la API aparece "Storage sin configurar".


-- ── PASO 4 · Verificar ──────────────────────────────────────────────────────

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'reportes_acceso' AND column_name = 'comprobante_path';

-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 003_metricas
--  Archivo real: apps/api/src/db/migrations/003_metricas.sql
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 003: métricas del embudo, pagos y bitácora de eventos
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUÉ:
-- Hoy no se puede responder ninguna de estas preguntas con la BD:
--   · ¿Cuánta gente entró al bot y cuánta terminó pagando?
--   · ¿Cuánto tarda alguien de "pendiente" a "pagado"?
--   · ¿Cuánto dinero entró este mes y por qué taller?
--   · ¿En qué paso del bot se cae la gente?
--   · ¿Cuántos usuarios activos entran de verdad a la plataforma?
--
-- La razón es que los cambios de estado se hacen con `UPDATE ... SET estado`
-- a secas: se sabe DÓNDE está cada quien, pero no CUÁNDO llegó ahí ni por
-- dónde pasó. Un estado sin fecha no es una métrica, es una foto.
--
-- CÓMO ESTÁ RESUELTO:
-- Las fechas NO se escriben desde la API — se estampan con TRIGGERS en la BD.
-- Es a propósito: hoy hay tres rutas distintas que activan a un usuario y dos
-- que lo marcan como pagado. Si cada una tuviera que acordarse de escribir la
-- fecha, tarde o temprano una se olvida y la métrica miente. Con el trigger,
-- da igual quién haga el UPDATE: la fecha siempre queda.
--
-- SEGURIDAD DE ESTA MIGRACIÓN:
--   · Es 100% ADITIVA. No borra ni renombra nada. No rompe el código actual.
--   · Es idempotente: se puede correr dos veces sin miedo.
--   · Hace backfill de lo que sí se puede reconstruir del pasado.
--
-- Correr completo en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 1 · Fechas de transición en lista_espera
-- ════════════════════════════════════════════════════════════════════════════
-- El embudo completo de una inscripción vive en esta tabla. Sin estas cuatro
-- fechas no hay forma de medir tiempos ni conversión.

ALTER TABLE lista_espera
    ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS confirmado_at   TIMESTAMPTZ,  -- pasó a cupo_confirmado
    ADD COLUMN IF NOT EXISTS pagado_at       TIMESTAMPTZ,  -- pasó a pagado
    ADD COLUMN IF NOT EXISTS rechazado_at    TIMESTAMPTZ,  -- pasó a rechazado / liberado
    ADD COLUMN IF NOT EXISTS origen          TEXT,         -- bot | web | admin
    ADD COLUMN IF NOT EXISTS confirmado_por  TEXT,         -- quién confirmó el cupo
    ADD COLUMN IF NOT EXISTS pagado_por      TEXT;         -- quién validó el pago

COMMENT ON COLUMN lista_espera.origen IS
    'Por dónde llegó esta inscripción: bot (WhatsApp) | web (Habitat) | admin (alta manual)';


-- ── Backfill: recuperar lo que sí se puede del pasado ───────────────────────
-- El panel ya derivaba la fecha de apartado desde chispas.created_at
-- (routes/admin.js). Se usa el mismo criterio para no inventar datos nuevos.

UPDATE lista_espera le
SET pagado_at = c.created_at
FROM (
    SELECT usuario_email, taller_id, MIN(created_at) AS created_at
    FROM chispas
    WHERE revoked = FALSE
    GROUP BY usuario_email, taller_id
) c
WHERE le.pagado_at IS NULL
  AND le.estado = 'pagado'
  AND LOWER(le.email) = LOWER(c.usuario_email)
  AND le.taller_id    = c.taller_id;

-- Lo que sigue sin fecha pero ya está en un estado avanzado: se marca con la
-- fecha de creación como piso, para que no cuente como "nunca pasó".
UPDATE lista_espera
SET confirmado_at = COALESCE(confirmado_at, created_at)
WHERE estado IN ('cupo_confirmado', 'confirmado', 'pagado');

UPDATE lista_espera
SET pagado_at = COALESCE(pagado_at, created_at)
WHERE estado = 'pagado';


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 2 · Fechas de ciclo de vida en usuarios
-- ════════════════════════════════════════════════════════════════════════════
-- Hoy no se sabe cuándo una cuenta pasó a 'activo' — ni siquiera se toca
-- updated_at en dos de las tres rutas que la activan.

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS activado_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS activado_por     TEXT,        -- admin | sistema | pago
    ADD COLUMN IF NOT EXISTS origen           TEXT,        -- bot | google | web | admin
    ADD COLUMN IF NOT EXISTS primer_login_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ultimo_login_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS total_logins     INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS metodo_login     TEXT;        -- google | whatsapp | password

COMMENT ON COLUMN usuarios.activado_at IS
    'Cuándo Paola le dio permiso de entrar (estado espera -> activo). Lo estampa un trigger.';
COMMENT ON COLUMN usuarios.primer_login_at IS
    'Primera vez que entró de verdad. activado_at sin primer_login_at = pagó y nunca entró.';

-- Backfill: los que ya están activos, con lo más cercano que hay.
UPDATE usuarios
SET activado_at  = COALESCE(activado_at, updated_at, created_at),
    activado_por = COALESCE(activado_por, 'backfill')
WHERE estado = 'activo' AND activado_at IS NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 3 · Tabla de pagos
-- ════════════════════════════════════════════════════════════════════════════
-- Hoy el dinero NO existe como dato: el monto, el banco y el folio viven
-- concatenados como texto libre dentro de reportes_acceso.detalle. Así no se
-- puede sumar, ni filtrar por taller, ni sacar un corte del mes.
--
-- Un pago es una entidad propia: tiene monto, método, quién lo verificó y
-- cuándo. Esto también es la base para cuando entre Stripe/Conekta.

CREATE TABLE IF NOT EXISTS pagos (
    id               SERIAL PRIMARY KEY,
    usuario_email    TEXT,                          -- sin FK: puede reportar antes de tener cuenta
    lista_espera_id  INTEGER REFERENCES lista_espera(id) ON DELETE SET NULL,
    taller_id        TEXT    REFERENCES talleres(id)     ON UPDATE CASCADE ON DELETE SET NULL,

    monto            NUMERIC(10,2),
    moneda           TEXT DEFAULT 'MXN',
    metodo           TEXT,                          -- transferencia | efectivo | tarjeta | cortesia
    banco            TEXT,
    titular          TEXT,
    folio            TEXT,
    fecha_pago       TIMESTAMPTZ,                   -- cuándo dice el usuario que pagó
    comprobante_path TEXT,                          -- ruta en el bucket privado

    estado           TEXT DEFAULT 'reportado',      -- reportado | verificado | rechazado
    verificado_por   TEXT,
    verificado_at    TIMESTAMPTZ,
    nota             TEXT,                          -- el PORQUÉ de la decisión

    origen           TEXT DEFAULT 'bot',            -- bot | admin | pasarela
    reporte_id       INTEGER,                       -- liga al reporte del bot que lo originó
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE  pagos IS 'Un renglón por pago reportado. Es la fuente de verdad del dinero.';
COMMENT ON COLUMN pagos.nota IS
    'Por qué se aceptó o rechazó. Cuando los agentes tomen esta decisión, aprenden de aquí.';

CREATE INDEX IF NOT EXISTS idx_pagos_email   ON pagos(usuario_email);
CREATE INDEX IF NOT EXISTS idx_pagos_taller  ON pagos(taller_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado  ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha   ON pagos(created_at);


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 4 · Bitácora de eventos
-- ════════════════════════════════════════════════════════════════════════════
-- Esta es la pieza que evita tener que migrar la BD cada vez que quieras medir
-- algo nuevo. Una sola tabla append-only: cada cosa que pasa deja un renglón.
--
-- Con esto puedes contestar preguntas que hoy ni te has hecho, sin tocar el
-- esquema otra vez. Y es la memoria que van a leer los agentes cuando empiecen
-- a tomar decisiones: qué pasó, cuándo, y con qué contexto.

CREATE TABLE IF NOT EXISTS eventos (
    id             BIGSERIAL PRIMARY KEY,
    tipo           TEXT NOT NULL,          -- ver catálogo abajo
    usuario_email  TEXT,
    taller_id      TEXT,
    origen         TEXT,                   -- bot | web | admin | sistema
    actor          TEXT,                   -- quién lo provocó (email, 'admin', 'sistema')
    metadata       JSONB DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE eventos IS
    'Bitácora append-only. Nunca se hace UPDATE ni DELETE aquí. Catálogo de tipos:
     bot_conversacion_inicio · bot_menu_opcion · bot_registro_completo
     lista_espera_alta · cupo_confirmado · pago_reportado · pago_verificado
     usuario_activado · login · taller_asignado · taller_abierto
     chispa_creada · chispa_revocada · reporte_abierto · reporte_resuelto';

CREATE INDEX IF NOT EXISTS idx_eventos_tipo    ON eventos(tipo);
CREATE INDEX IF NOT EXISTS idx_eventos_email   ON eventos(usuario_email);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha   ON eventos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_taller  ON eventos(taller_id);
-- Índice GIN para poder filtrar por dentro del JSON sin escanear toda la tabla
CREATE INDEX IF NOT EXISTS idx_eventos_meta    ON eventos USING GIN (metadata);


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 5 · Conversaciones del bot
-- ════════════════════════════════════════════════════════════════════════════
-- Hoy el estado de la conversación vive en un Map() en memoria (flujo.js).
-- Dos consecuencias:
--   1. Si el bot se reinicia, todos pierden su conversación a media captura.
--      Eso no es solo una métrica faltante, es una mala experiencia real.
--   2. No hay forma de saber en qué paso se cae la gente.

CREATE TABLE IF NOT EXISTS bot_conversaciones (
    jid            TEXT PRIMARY KEY,       -- identificador de WhatsApp
    whatsapp       TEXT,                   -- 10 dígitos, cuando se puede extraer
    email          TEXT,
    paso           TEXT,                   -- PASO.* actual
    datos          JSONB DEFAULT '{}'::jsonb,
    ultimo_menu    TEXT,
    mensajes       INTEGER DEFAULT 0,
    completada     BOOLEAN DEFAULT FALSE,  -- llegó hasta lista de espera
    abandonada_en  TEXT,                   -- último paso si se quedó a medias
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_conv_email  ON bot_conversaciones(email);
CREATE INDEX IF NOT EXISTS idx_bot_conv_fecha  ON bot_conversaciones(created_at);


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 6 · Triggers — las fechas se estampan solas
-- ════════════════════════════════════════════════════════════════════════════
-- Esta es la parte importante. La API NO tiene que acordarse de nada.

-- ── 6.1 · updated_at genérico ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION destello_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lista_espera_touch ON lista_espera;
CREATE TRIGGER trg_lista_espera_touch
    BEFORE UPDATE ON lista_espera
    FOR EACH ROW EXECUTE FUNCTION destello_touch_updated_at();

DROP TRIGGER IF EXISTS trg_pagos_touch ON pagos;
CREATE TRIGGER trg_pagos_touch
    BEFORE UPDATE ON pagos
    FOR EACH ROW EXECUTE FUNCTION destello_touch_updated_at();

DROP TRIGGER IF EXISTS trg_bot_conv_touch ON bot_conversaciones;
CREATE TRIGGER trg_bot_conv_touch
    BEFORE UPDATE ON bot_conversaciones
    FOR EACH ROW EXECUTE FUNCTION destello_touch_updated_at();


-- ── 6.2 · lista_espera: estampar la fecha de cada transición ───────────────
-- Da igual si el cambio viene del selector del panel, del botón "Confirmar
-- pago" o de un script: la fecha queda y el evento se registra.

CREATE OR REPLACE FUNCTION destello_lista_espera_transicion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN

        IF NEW.estado IN ('cupo_confirmado', 'confirmado') AND NEW.confirmado_at IS NULL THEN
            NEW.confirmado_at := NOW();
        END IF;

        IF NEW.estado = 'pagado' AND NEW.pagado_at IS NULL THEN
            NEW.pagado_at := NOW();
            -- si nunca se marcó el cupo, se asume que se confirmó junto con el pago
            IF NEW.confirmado_at IS NULL THEN
                NEW.confirmado_at := NOW();
            END IF;
        END IF;

        IF NEW.estado = 'rechazado' AND NEW.rechazado_at IS NULL THEN
            NEW.rechazado_at := NOW();
        END IF;

        INSERT INTO eventos (tipo, usuario_email, taller_id, origen, metadata)
        VALUES (
            'lista_espera_' || NEW.estado,
            LOWER(NEW.email),
            NEW.taller_id,
            'sistema',
            jsonb_build_object(
                'estado_anterior', OLD.estado,
                'estado_nuevo',    NEW.estado,
                'lista_espera_id', NEW.id
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lista_espera_transicion ON lista_espera;
CREATE TRIGGER trg_lista_espera_transicion
    BEFORE UPDATE ON lista_espera
    FOR EACH ROW EXECUTE FUNCTION destello_lista_espera_transicion();


-- ── 6.3 · lista_espera: registrar el alta ──────────────────────────────────
CREATE OR REPLACE FUNCTION destello_lista_espera_alta()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO eventos (tipo, usuario_email, taller_id, origen, metadata)
    VALUES ('lista_espera_alta', LOWER(NEW.email), NEW.taller_id,
            COALESCE(NEW.origen, 'desconocido'),
            jsonb_build_object('lista_espera_id', NEW.id));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lista_espera_alta ON lista_espera;
CREATE TRIGGER trg_lista_espera_alta
    AFTER INSERT ON lista_espera
    FOR EACH ROW EXECUTE FUNCTION destello_lista_espera_alta();


-- ── 6.4 · usuarios: estampar la activación ─────────────────────────────────
-- Cierra el hueco de las tres rutas que activan sin dejar rastro.

CREATE OR REPLACE FUNCTION destello_usuario_activacion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado = 'activo' AND OLD.estado IS DISTINCT FROM 'activo' THEN
        IF NEW.activado_at IS NULL THEN
            NEW.activado_at := NOW();
        END IF;
        NEW.updated_at := NOW();

        INSERT INTO eventos (tipo, usuario_email, origen, metadata)
        VALUES ('usuario_activado', LOWER(NEW.email), 'sistema',
                jsonb_build_object('estado_anterior', OLD.estado,
                                   'activado_por', COALESCE(NEW.activado_por, 'desconocido')));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuario_activacion ON usuarios;
CREATE TRIGGER trg_usuario_activacion
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION destello_usuario_activacion();


-- ── 6.5 · pagos: registrar verificación ────────────────────────────────────
CREATE OR REPLACE FUNCTION destello_pago_verificado()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado IS DISTINCT FROM OLD.estado
       AND NEW.estado IN ('verificado', 'rechazado') THEN
        IF NEW.verificado_at IS NULL THEN
            NEW.verificado_at := NOW();
        END IF;
        INSERT INTO eventos (tipo, usuario_email, taller_id, origen, actor, metadata)
        VALUES ('pago_' || NEW.estado, LOWER(NEW.usuario_email), NEW.taller_id,
                'admin', NEW.verificado_por,
                jsonb_build_object('monto', NEW.monto, 'metodo', NEW.metodo,
                                   'nota', NEW.nota, 'pago_id', NEW.id));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pago_verificado ON pagos;
CREATE TRIGGER trg_pago_verificado
    BEFORE UPDATE ON pagos
    FOR EACH ROW EXECUTE FUNCTION destello_pago_verificado();


-- ── 6.6 · chispas: guardar CUÁNDO se revocó ────────────────────────────────
-- La columna revoked_at existe desde el principio y nunca se ha escrito:
-- hay tres lugares que revocan y ninguno la llena.

CREATE OR REPLACE FUNCTION destello_chispa_revocada()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.revoked = TRUE AND OLD.revoked IS DISTINCT FROM TRUE THEN
        IF NEW.revoked_at IS NULL THEN
            NEW.revoked_at := NOW();
        END IF;
        INSERT INTO eventos (tipo, usuario_email, taller_id, origen, metadata)
        VALUES ('chispa_revocada', LOWER(NEW.usuario_email), NEW.taller_id, 'admin',
                jsonb_build_object('code', NEW.code));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chispa_revocada ON chispas;
CREATE TRIGGER trg_chispa_revocada
    BEFORE UPDATE ON chispas
    FOR EACH ROW EXECUTE FUNCTION destello_chispa_revocada();


-- ── 6.7 · chispas: registrar la creación (= taller asignado) ───────────────
CREATE OR REPLACE FUNCTION destello_chispa_creada()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO eventos (tipo, usuario_email, taller_id, origen, metadata)
    VALUES ('taller_asignado', LOWER(NEW.usuario_email), NEW.taller_id, 'admin',
            jsonb_build_object('code', NEW.code, 'is_demo', NEW.is_demo,
                               'expires_at', NEW.expires_at));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chispa_creada ON chispas;
CREATE TRIGGER trg_chispa_creada
    AFTER INSERT ON chispas
    FOR EACH ROW EXECUTE FUNCTION destello_chispa_creada();


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 7 · Vistas del dashboard
-- ════════════════════════════════════════════════════════════════════════════
-- El panel consulta estas vistas en vez de armar el SQL a mano. Si cambia el
-- cálculo, se cambia aquí y todo el panel se entera.

-- ── 7.1 · Embudo global ────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_embudo AS
SELECT
    (SELECT COUNT(*)                       FROM bot_conversaciones)                     AS conversaciones_bot,
    (SELECT COUNT(*)                       FROM bot_conversaciones WHERE completada)    AS bot_completadas,
    (SELECT COUNT(*)                       FROM usuarios)                               AS usuarios_registrados,
    (SELECT COUNT(*)                       FROM lista_espera)                           AS inscripciones,
    (SELECT COUNT(*)                       FROM lista_espera WHERE confirmado_at IS NOT NULL) AS cupos_confirmados,
    (SELECT COUNT(*)                       FROM lista_espera WHERE pagado_at    IS NOT NULL) AS pagados,
    (SELECT COUNT(*)                       FROM usuarios WHERE estado = 'activo')        AS cuentas_activas,
    (SELECT COUNT(*)                       FROM usuarios WHERE primer_login_at IS NOT NULL) AS entraron_alguna_vez,
    (SELECT COALESCE(SUM(monto), 0)        FROM pagos WHERE estado = 'verificado')       AS ingresos_verificados;

COMMENT ON VIEW v_embudo IS
    'Una sola fila con el embudo completo. La diferencia entre cuentas_activas y
     entraron_alguna_vez es la métrica más importante: gente que pagó y nunca entró.';


-- ── 7.2 · Tiempos del embudo (qué tan rápido se mueve la gente) ────────────
CREATE OR REPLACE VIEW v_tiempos_embudo AS
SELECT
    taller_id,
    COUNT(*) FILTER (WHERE confirmado_at IS NOT NULL) AS n_confirmados,
    COUNT(*) FILTER (WHERE pagado_at     IS NOT NULL) AS n_pagados,
    ROUND(AVG(EXTRACT(EPOCH FROM (confirmado_at - created_at))   / 3600)::numeric, 1) AS horas_alta_a_cupo,
    ROUND(AVG(EXTRACT(EPOCH FROM (pagado_at     - confirmado_at))/ 3600)::numeric, 1) AS horas_cupo_a_pago,
    ROUND(AVG(EXTRACT(EPOCH FROM (pagado_at     - created_at))   / 3600)::numeric, 1) AS horas_alta_a_pago
FROM lista_espera
GROUP BY taller_id;


-- ── 7.3 · Métricas por taller ──────────────────────────────────────────────
CREATE OR REPLACE VIEW v_metricas_taller AS
SELECT
    t.id,
    t.nombre,
    t.precio,
    t.cupo_maximo,
    COUNT(le.id)                                                      AS en_lista,
    COUNT(le.id) FILTER (WHERE le.estado = 'pendiente')               AS pendientes,
    COUNT(le.id) FILTER (WHERE le.confirmado_at IS NOT NULL)          AS confirmados,
    COUNT(le.id) FILTER (WHERE le.pagado_at     IS NOT NULL)          AS pagados,
    COUNT(le.id) FILTER (WHERE le.estado = 'rechazado')               AS rechazados,
    -- Cupo ocupado = pagados + cortesías vigentes. Las demos SÍ cuentan.
    (SELECT COUNT(*) FROM chispas c
      WHERE c.taller_id = t.id AND c.revoked = FALSE
        AND (c.expires_at IS NULL OR c.expires_at > NOW()))           AS cupo_ocupado,
    GREATEST(t.cupo_maximo - (SELECT COUNT(*) FROM chispas c
      WHERE c.taller_id = t.id AND c.revoked = FALSE
        AND (c.expires_at IS NULL OR c.expires_at > NOW())), 0)       AS lugares_libres,
    ROUND(100.0 * COUNT(le.id) FILTER (WHERE le.pagado_at IS NOT NULL)
          / NULLIF(COUNT(le.id), 0), 1)                               AS tasa_conversion,
    COALESCE((SELECT SUM(p.monto) FROM pagos p
               WHERE p.taller_id = t.id AND p.estado = 'verificado'), 0) AS ingresos
FROM talleres t
LEFT JOIN lista_espera le ON le.taller_id = t.id
GROUP BY t.id, t.nombre, t.precio, t.cupo_maximo;

COMMENT ON VIEW v_metricas_taller IS
    'cupo_ocupado incluye las chispas demo a propósito: una cortesía ocupa un
     lugar real en el salón igual que un pago.';


-- ── 7.4 · Altas por día (para las gráficas) ────────────────────────────────
CREATE OR REPLACE VIEW v_actividad_diaria AS
SELECT
    (created_at AT TIME ZONE 'America/Mexico_City')::date AS dia,
    tipo,
    COUNT(*) AS total
FROM eventos
GROUP BY 1, 2
ORDER BY 1 DESC, 2;


-- ── 7.5 · Alertas: lo que necesita atención de Paola ───────────────────────
-- Esta vista es la que debería mandar el panel a la parte de arriba.
CREATE OR REPLACE VIEW v_alertas AS
-- Pagó pero su cuenta sigue en espera (el desfase que el bot ya detecta)
SELECT 'pagado_sin_activar' AS tipo, le.email, le.taller_id,
       le.pagado_at AS desde,
       'Pagó pero su cuenta no está activa' AS detalle
FROM lista_espera le
JOIN usuarios u ON LOWER(u.email) = LOWER(le.email)
WHERE le.estado = 'pagado' AND u.estado <> 'activo'

UNION ALL
-- Pagó, está activo, pero no tiene chispa: su taller NO aparece
SELECT 'pagado_sin_taller', le.email, le.taller_id, le.pagado_at,
       'Pagado y activo pero sin chispa: no ve su taller'
FROM lista_espera le
WHERE le.estado = 'pagado'
  AND NOT EXISTS (
      SELECT 1 FROM chispas c
      WHERE LOWER(c.usuario_email) = LOWER(le.email)
        AND c.taller_id = le.taller_id AND c.revoked = FALSE)

UNION ALL
-- Activo desde hace más de 3 días y nunca ha entrado
SELECT 'activo_sin_entrar', u.email, NULL, u.activado_at,
       'Lleva más de 3 días activo y nunca ha entrado'
FROM usuarios u
WHERE u.estado = 'activo' AND u.primer_login_at IS NULL
  AND u.activado_at < NOW() - INTERVAL '3 days'

UNION ALL
-- Cupo confirmado hace más de 48h sin pagar (el reloj que hoy solo vive en el front)
SELECT 'cupo_vencido', le.email, le.taller_id, le.confirmado_at,
       'Se le apartó lugar hace más de 48h y no ha pagado'
FROM lista_espera le
WHERE le.estado IN ('cupo_confirmado', 'confirmado')
  AND le.confirmado_at < NOW() - INTERVAL '48 hours'

UNION ALL
-- Talleres sobrevendidos
SELECT 'taller_sobrevendido', NULL, t.id, NOW(),
       'Tiene más inscritos que cupo_maximo'
FROM talleres t
WHERE (SELECT COUNT(*) FROM chispas c
       WHERE c.taller_id = t.id AND c.revoked = FALSE
         AND (c.expires_at IS NULL OR c.expires_at > NOW())) > t.cupo_maximo;


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 8 · Verificación
-- ════════════════════════════════════════════════════════════════════════════

-- Debe devolver 5 tablas/vistas nuevas y las columnas agregadas.
SELECT 'tablas nuevas' AS chequeo, string_agg(table_name, ', ' ORDER BY table_name) AS resultado
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('pagos', 'eventos', 'bot_conversaciones')
UNION ALL
SELECT 'vistas nuevas', string_agg(table_name, ', ' ORDER BY table_name)
FROM information_schema.views
WHERE table_schema = 'public' AND table_name LIKE 'v_%'
UNION ALL
SELECT 'cols lista_espera', string_agg(column_name, ', ' ORDER BY column_name)
FROM information_schema.columns
WHERE table_name = 'lista_espera'
  AND column_name IN ('updated_at','confirmado_at','pagado_at','rechazado_at','origen')
UNION ALL
SELECT 'cols usuarios', string_agg(column_name, ', ' ORDER BY column_name)
FROM information_schema.columns
WHERE table_name = 'usuarios'
  AND column_name IN ('activado_at','origen','primer_login_at','ultimo_login_at','total_logins');

-- El embudo, ya con los datos de hoy:
SELECT * FROM v_embudo;

-- Lo que necesita tu atención ahorita:
SELECT tipo, COUNT(*) FROM v_alertas GROUP BY tipo;

-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 004_seguridad_vistas
--  Archivo real: apps/api/src/db/migrations/004_seguridad_vistas.sql
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 004: cerrar las vistas de métricas al público
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUÉ:
-- La migración 003 creó cinco vistas (v_embudo, v_alertas, etc.) y el Advisor
-- de Supabase las marcó como CRITICAL — "Security Definer View". Con razón.
--
-- Qué significa, en corto:
-- Supabase expone automáticamente TODO lo que vive en el esquema `public` a
-- través de su API REST, usando dos roles: `anon` (cualquiera con la llave
-- pública) y `authenticated`. Una vista creada por el dueño de la BD corre con
-- los permisos del dueño, no con los de quien pregunta — así que salta
-- cualquier regla de seguridad de las tablas de abajo.
--
-- Traducción a tu caso: `v_alertas` devuelve correos y WhatsApp de tus alumnos,
-- y `v_metricas_taller` devuelve tus ingresos. Quedaron alcanzables por la API
-- pública de Supabase.
--
-- LA BUENA NOTICIA: tu API no las necesita por ahí. Se conecta directo a
-- PostgreSQL con su propio usuario (Session pooler), no por la API REST de
-- Supabase. Así que se le puede quitar el acceso a `anon` sin romper nada.
--
-- QUÉ HACE ESTA MIGRACIÓN:
--   1. Pone las vistas en modo `security_invoker` — respetan los permisos de
--      quien pregunta, no los del dueño.
--   2. Le quita el acceso a `anon` y `authenticated` sobre las vistas y sobre
--      las tablas nuevas (pagos, eventos, bot_conversaciones).
--   3. Te muestra un reporte de qué tablas tienen RLS y cuáles no.
--
-- Correr completo en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 1 · Las vistas respetan al que pregunta, no al dueño
-- ════════════════════════════════════════════════════════════════════════════

ALTER VIEW v_embudo           SET (security_invoker = on);
ALTER VIEW v_tiempos_embudo   SET (security_invoker = on);
ALTER VIEW v_metricas_taller  SET (security_invoker = on);
ALTER VIEW v_actividad_diaria SET (security_invoker = on);
ALTER VIEW v_alertas          SET (security_invoker = on);


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 2 · Quitarle el acceso al público
-- ════════════════════════════════════════════════════════════════════════════
-- Estas vistas y tablas son solo para el panel de administración, que las lee
-- por medio de la API con conexión directa a Postgres. Nadie más las necesita.

REVOKE ALL ON v_embudo           FROM anon, authenticated;
REVOKE ALL ON v_tiempos_embudo   FROM anon, authenticated;
REVOKE ALL ON v_metricas_taller  FROM anon, authenticated;
REVOKE ALL ON v_actividad_diaria FROM anon, authenticated;
REVOKE ALL ON v_alertas          FROM anon, authenticated;

-- Las tablas nuevas traen datos sensibles: montos, comprobantes, teléfonos.
REVOKE ALL ON pagos              FROM anon, authenticated;
REVOKE ALL ON eventos            FROM anon, authenticated;
REVOKE ALL ON bot_conversaciones FROM anon, authenticated;

-- Y sus secuencias, para que nadie pueda insertar.
REVOKE ALL ON SEQUENCE pagos_id_seq   FROM anon, authenticated;
REVOKE ALL ON SEQUENCE eventos_id_seq FROM anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 3 · Candado por si acaso: activar RLS sin políticas
-- ════════════════════════════════════════════════════════════════════════════
-- RLS con CERO políticas = nadie pasa, salvo el dueño de la tabla y los roles
-- con BYPASSRLS (que es como entra tu API). Es el cinturón además del tirante:
-- aunque un día alguien vuelva a dar permisos por error, la puerta sigue
-- cerrada.
--
-- ⚠️ Esto NO afecta a tu API: se conecta como el usuario dueño de la BD.
--    Si algún día mueves el panel a leer por la API REST de Supabase, aquí es
--    donde habría que escribir políticas.

ALTER TABLE pagos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_conversaciones ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 4 · Reporte: ¿qué más está abierto?
-- ════════════════════════════════════════════════════════════════════════════
-- Esto NO cambia nada, solo te enseña la foto. Revisa la columna `riesgo`.
--
-- Las tablas viejas (usuarios, chispas, lista_espera...) traen correos,
-- teléfonos y códigos. Si aparecen como 'ABIERTA AL PÚBLICO', cualquiera con
-- la llave anon de tu proyecto podría leerlas por la API REST de Supabase.

SELECT
    c.relname                                   AS tabla,
    CASE WHEN c.relrowsecurity THEN 'sí' ELSE 'NO' END AS rls_activo,
    COALESCE(
        (SELECT COUNT(*)::text FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = c.relname), '0'
    )                                           AS politicas,
    CASE
        WHEN has_table_privilege('anon', c.oid, 'SELECT') AND NOT c.relrowsecurity
             THEN '🔴 ABIERTA AL PÚBLICO'
        WHEN has_table_privilege('anon', c.oid, 'SELECT')
             THEN '🟡 anon tiene permiso, pero RLS filtra'
        ELSE '🟢 cerrada a anon'
    END                                         AS riesgo
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY
    CASE
        WHEN has_table_privilege('anon', c.oid, 'SELECT') AND NOT c.relrowsecurity THEN 1
        WHEN has_table_privilege('anon', c.oid, 'SELECT') THEN 2
        ELSE 3
    END,
    c.relname;


-- ── Y las vistas, para confirmar que quedaron cerradas ──────────────────────
SELECT
    c.relname AS vista,
    CASE WHEN has_table_privilege('anon', c.oid, 'SELECT')
         THEN '🔴 anon todavía puede leerla' ELSE '🟢 cerrada' END AS estado_anon,
    CASE WHEN array_to_string(c.reloptions, ',') ILIKE '%security_invoker=on%'
         THEN 'sí' ELSE 'NO' END AS security_invoker
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v' AND c.relname LIKE 'v\_%'
ORDER BY c.relname;

-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 005_nombre_certificado
--  Archivo real: apps/api/src/db/migrations/005_nombre_certificado.sql
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 005: el nombre del certificado, como la persona lo quiere
-- ════════════════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA:
-- Hoy el nombre del alumno se guarda mal y no hay forma de que se guarde bien.
-- El bot pide nombre y apellido por separado (correcto), pero manda el nombre
-- COMPLETO CONCATENADO a `lista_espera.nombre`. Después, al confirmar el pago,
-- ese nombre completo se copia de vuelta a `usuarios.nombre` si estaba vacío.
-- Resultado:  nombre = "Ana Ruiz García",  apellido = NULL.
--
-- Y eso importa porque **ese nombre es el que va impreso en el certificado**.
--
-- POR QUÉ NO BASTA CON ARREGLAR EL BUG:
-- Aunque se arregle la concatenación, partir nombres en dos campos es una
-- pelea que no se gana: hay quien tiene dos apellidos, quien usa uno solo,
-- nombres compuestos, "de la", acentos que el bot pierde. Adivinar cómo
-- partirlo siempre va a fallar para alguien.
--
-- LA SOLUCIÓN:
-- Que lo diga la persona. `nombre` y `apellido` se quedan para uso del sistema
-- (saludarla, buscarla). Se agrega `nombre_certificado`: el texto EXACTO que se
-- imprime, tal como ella lo escribió.
--
-- En el onboarding se le pregunta una sola vez:
--     "¿Cómo quieres que aparezca tu nombre en el certificado?"
-- precargado con lo que ya se tenga, y ella lo corrige si hace falta. Es una
-- pregunta que la gente SÍ quiere contestar, porque le importa el resultado —
-- muy distinto a pedirle "apellido" a secas.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS nombre_certificado     TEXT,
    ADD COLUMN IF NOT EXISTS nombre_certificado_at  TIMESTAMPTZ;

COMMENT ON COLUMN usuarios.nombre_certificado IS
    'Texto EXACTO que va impreso en el certificado, escrito por la persona.
     NULL = todavía no se le ha preguntado. Nunca se calcula ni se parte:
     es la única fuente de verdad para el documento.';

COMMENT ON COLUMN usuarios.nombre_certificado_at IS
    'Cuándo lo confirmó. NULL con la cuenta activa = falta preguntárselo.';


-- ── Semilla: lo que ya se tiene, como propuesta inicial ─────────────────────
-- No es la respuesta final — es solo el valor que se le va a mostrar
-- precargado. Por eso `nombre_certificado_at` se deja en NULL: mientras esté
-- vacío, la plataforma sabe que la persona todavía no lo ha confirmado.

UPDATE usuarios
SET nombre_certificado = TRIM(
        COALESCE(nombre, '') ||
        CASE WHEN COALESCE(apellido, '') <> '' THEN ' ' || apellido ELSE '' END
    )
WHERE nombre_certificado IS NULL
  AND COALESCE(nombre, '') <> '';


-- ── A quién hay que preguntarle ─────────────────────────────────────────────
-- Esta vista alimenta el aviso del perfil. Se muestra solo a quien ya está
-- adentro: preguntarle el nombre del certificado a alguien que todavía no
-- entra no tiene ningún sentido.

CREATE OR REPLACE VIEW v_falta_nombre_certificado AS
SELECT id, email, nombre, apellido, nombre_certificado AS propuesta, activado_at
FROM usuarios
WHERE estado = 'activo'
  AND nombre_certificado_at IS NULL;

ALTER VIEW v_falta_nombre_certificado SET (security_invoker = on);
REVOKE ALL ON v_falta_nombre_certificado FROM anon, authenticated;


-- ── Verificar ───────────────────────────────────────────────────────────────
SELECT COUNT(*) FILTER (WHERE nombre_certificado IS NOT NULL)    AS con_propuesta,
       COUNT(*) FILTER (WHERE nombre_certificado_at IS NOT NULL) AS ya_confirmado,
       COUNT(*)                                                  AS total
FROM usuarios;

SELECT * FROM v_falta_nombre_certificado;

-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 006_backfill_chispas_lista
--  Archivo real: apps/api/src/db/migrations/006_backfill_chispas_lista.sql
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 006: reparar las chispas que se quedaron sin lugar en la lista
-- ════════════════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA (detectado el 23 ago 2026 probando el flujo real):
--
-- Antes del fix de las cortesías, `createChispa` se saltaba `lista_espera`
-- cuando `isDemo` era true. Esas chispas quedaron huérfanas: existen y dan
-- acceso, pero no tienen renglón en la lista.
--
-- Eso provocaba DOS síntomas que parecían no tener nada que ver:
--
--   1. El filtro "🎁 Demo" del panel salía vacío aunque las estadísticas
--      contaran 1 demo. El filtro lee `lista_espera`, y ahí no había nada.
--
--   2. **El bot dejaba inscribirse otra vez a un taller que la persona ya
--      tenía.** `registrarEnLista` busca duplicados en `lista_espera`; como no
--      había renglón, concluía que era gente nueva y la volvía a formar.
--
-- Un solo hueco, dos síntomas. Esta migración lo tapa hacia atrás; el código
-- ya lo evita hacia adelante.
--
-- Aditiva e idempotente: solo crea lo que falta, nunca pisa lo que existe.
-- Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- ── PASO 1 · Ver qué está huérfano ANTES de tocar nada ──────────────────────
SELECT c.code, c.usuario_email, c.taller_id, c.is_demo, c.created_at::date
FROM chispas c
WHERE c.revoked = FALSE
  AND c.usuario_email IS NOT NULL
  AND c.taller_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM lista_espera le
      WHERE LOWER(le.email) = LOWER(c.usuario_email)
        AND le.taller_id = c.taller_id
  )
ORDER BY c.created_at;


-- ── PASO 2 · Crearles su renglón ────────────────────────────────────────────
-- Entran como 'pagado' porque ya tienen acceso: la chispa existe. Que haya
-- sido cortesía o pago se distingue por el renglón de `pagos`, no por aquí.
--
-- `created_at` se copia de la chispa para no falsear las métricas de tiempo:
-- se apuntó cuando se le dio la chispa, no hoy.
--
-- `pagado_at` y `confirmado_at` se ponen a mano aquí porque los triggers de la
-- 003 se disparan en UPDATE, no en INSERT. Sin ellos, la fila diría 'pagado'
-- con la fecha vacía y el embudo no la contaría: el estado y su fecha SIEMPRE
-- deben ir juntos, o las métricas empiezan a mentir.
INSERT INTO lista_espera (email, taller_id, nombre, whatsapp, estado, origen,
                          created_at, confirmado_at, pagado_at)
SELECT DISTINCT ON (LOWER(c.usuario_email), c.taller_id)
       LOWER(c.usuario_email),
       c.taller_id,
       COALESCE(c.usuario_nombre, u.nombre),
       COALESCE(c.usuario_wa, u.whatsapp),
       'pagado',
       'admin',
       c.created_at,
       c.created_at,
       c.created_at
FROM chispas c
LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(c.usuario_email)
WHERE c.revoked = FALSE
  AND c.usuario_email IS NOT NULL
  AND c.taller_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM lista_espera le
      WHERE LOWER(le.email) = LOWER(c.usuario_email)
        AND le.taller_id = c.taller_id
  )
ORDER BY LOWER(c.usuario_email), c.taller_id, c.created_at ASC;


-- ── PASO 3 · Registrar las cortesías en `pagos` ─────────────────────────────
-- Para que el dinero cuadre: una demo es un pago de $0 con metodo='cortesia'.
-- Sin esto, una cortesía se vería igual que un pago que nunca se registró.

INSERT INTO pagos (usuario_email, lista_espera_id, taller_id, monto, metodo,
                   estado, verificado_por, nota, origen, created_at)
SELECT LOWER(c.usuario_email), le.id, c.taller_id, 0, 'cortesia',
       'verificado', 'backfill',
       'Cortesía anterior al cambio de regla — reconstruida desde la chispa',
       'admin', c.created_at
FROM chispas c
JOIN lista_espera le
  ON LOWER(le.email) = LOWER(c.usuario_email) AND le.taller_id = c.taller_id
WHERE c.is_demo = TRUE
  AND c.revoked = FALSE
  AND NOT EXISTS (
      SELECT 1 FROM pagos p WHERE p.lista_espera_id = le.id AND p.metodo = 'cortesia'
  );


-- ── PASO 4 · Verificar ──────────────────────────────────────────────────────

-- Debe devolver 0 filas: ya no quedan chispas sin lugar en la lista.
SELECT c.code, c.usuario_email, c.taller_id
FROM chispas c
WHERE c.revoked = FALSE
  AND c.usuario_email IS NOT NULL AND c.taller_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM lista_espera le
      WHERE LOWER(le.email) = LOWER(c.usuario_email) AND le.taller_id = c.taller_id
  );

-- Las demos ya deben aparecer en la lista (esto alimenta el filtro 🎁 Demo).
SELECT le.email, le.taller_id, le.estado, c.is_demo, c.expires_at::date AS vence
FROM lista_espera le
JOIN chispas c ON LOWER(c.usuario_email) = LOWER(le.email)
              AND c.taller_id = le.taller_id AND c.revoked = FALSE
WHERE c.is_demo = TRUE;

-- Y el cupo, con las cortesías contando como el lugar que son.
SELECT nombre, cupo_maximo, cupo_ocupado, lugares_libres, pagados, ingresos
FROM v_metricas_taller
WHERE cupo_ocupado > 0;

-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 007_gracia_recordatorio
--  Archivo real: apps/api/src/db/migrations/007_gracia_recordatorio.sql
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 007: las 24 h de gracia después del recordatorio
-- ════════════════════════════════════════════════════════════════════════════
--
-- LA REGLA (definida por Paola el 23 ago 2026):
--
--   1. Le confirmas el lugar        → se lo apartas
--   2. Tiene 48 h para pagar        → si no, el panel te avisa
--   3. Le mandas un recordatorio    → se le dan 24 h MÁS
--   4. Si no responde en esas 24 h  → puedes liberar el lugar
--
-- El paso 3 no existía como dato. El panel dejaba liberar el lugar en cuanto
-- se cumplían las 48 h, sin distinguir si ya se le había avisado o no. Y eso
-- importa: **liberar el lugar de alguien a quien nunca le avisaste es muy
-- distinto de liberarlo después de que no contestó.**
--
-- `recordatorio_at` es la fecha que faltaba. Con ella el panel puede mostrar
-- en qué etapa va cada quien y no ofrecer "liberar" antes de tiempo.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


ALTER TABLE lista_espera
    ADD COLUMN IF NOT EXISTS recordatorio_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS recordatorios      INTEGER DEFAULT 0;

COMMENT ON COLUMN lista_espera.recordatorio_at IS
    'Cuándo se le mandó el último recordatorio de pago. NULL = todavía no se le
     avisa, así que NO se le debe liberar el lugar aunque ya pasaran las 48 h.';

COMMENT ON COLUMN lista_espera.recordatorios IS
    'Cuántos recordatorios se le han mandado. Sirve para saber a quién hay que
     perseguir siempre y para no mandarle diez mensajes a la misma persona.';


-- ── Alertas actualizadas: distinguir las tres etapas ────────────────────────
-- Antes `cupo_vencido` mezclaba a quien nunca supo que tenía que pagar con
-- quien ya no contestó. Son dos acciones distintas: al primero se le manda un
-- recordatorio, al segundo se le libera el lugar.

CREATE OR REPLACE VIEW v_alertas AS
-- Pagó pero su cuenta sigue en espera
SELECT 'pagado_sin_activar' AS tipo, le.email, le.taller_id,
       le.pagado_at AS desde,
       'Pagó pero su cuenta no está activa' AS detalle
FROM lista_espera le
JOIN usuarios u ON LOWER(u.email) = LOWER(le.email)
WHERE le.estado = 'pagado' AND u.estado <> 'activo'

UNION ALL
-- Pagó, está activo, pero no tiene chispa: su taller NO aparece
SELECT 'pagado_sin_taller', le.email, le.taller_id, le.pagado_at,
       'Pagado y activo pero sin chispa: no ve su taller'
FROM lista_espera le
WHERE le.estado = 'pagado'
  AND NOT EXISTS (
      SELECT 1 FROM chispas c
      WHERE LOWER(c.usuario_email) = LOWER(le.email)
        AND c.taller_id = le.taller_id AND c.revoked = FALSE)

UNION ALL
-- Activo desde hace más de 3 días y nunca ha entrado
SELECT 'activo_sin_entrar', u.email, NULL, u.activado_at,
       'Lleva más de 3 días activo y nunca ha entrado'
FROM usuarios u
WHERE u.estado = 'activo' AND u.primer_login_at IS NULL
  AND u.activado_at < NOW() - INTERVAL '3 days'

UNION ALL
-- ETAPA 1 · Se le venció el plazo y NUNCA se le avisó → mandar recordatorio
SELECT 'falta_recordatorio', le.email, le.taller_id, le.confirmado_at,
       'Se le venció el plazo de 48 h y aún no se le manda recordatorio'
FROM lista_espera le
WHERE le.estado IN ('cupo_confirmado', 'confirmado')
  AND le.confirmado_at < NOW() - INTERVAL '48 hours'
  AND le.recordatorio_at IS NULL

UNION ALL
-- ETAPA 2 · Ya se le avisó y pasaron sus 24 h de gracia → se puede liberar
SELECT 'gracia_vencida', le.email, le.taller_id, le.recordatorio_at,
       'Ya se le recordó y pasaron sus 24 h de gracia: se puede liberar el lugar'
FROM lista_espera le
WHERE le.estado IN ('cupo_confirmado', 'confirmado')
  AND le.recordatorio_at IS NOT NULL
  AND le.recordatorio_at < NOW() - INTERVAL '24 hours'

UNION ALL
-- Talleres sobrevendidos
SELECT 'taller_sobrevendido', NULL, t.id, NOW(),
       'Tiene más inscritos que cupo_maximo'
FROM talleres t
WHERE (SELECT COUNT(*) FROM chispas c
       WHERE c.taller_id = t.id AND c.revoked = FALSE
         AND (c.expires_at IS NULL OR c.expires_at > NOW())) > t.cupo_maximo;

ALTER VIEW v_alertas SET (security_invoker = on);
REVOKE ALL ON v_alertas FROM anon, authenticated;


-- ── Verificar ───────────────────────────────────────────────────────────────
SELECT column_name FROM information_schema.columns
WHERE table_name = 'lista_espera'
  AND column_name IN ('recordatorio_at', 'recordatorios');

SELECT tipo, COUNT(*) FROM v_alertas GROUP BY tipo ORDER BY tipo;

-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 008_cupo
--  Archivo real: apps/api/src/db/migrations/008_cupo.sql
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 008: el cupo, contado como Paola lo definió
-- ════════════════════════════════════════════════════════════════════════════
--
-- LA REGLA:
-- **Confirmar el lugar YA lo aparta.** Si el taller tiene 20 lugares y confirmas
-- a 20 personas, se llena — aunque ninguna haya pagado todavía. El reloj de
-- 48 h + 24 h de gracia existe justo para poder recuperar esos lugares.
--
-- QUÉ ESTABA MAL:
-- `cupo_ocupado` contaba únicamente **chispas vivas**. Pero una chispa solo
-- existe cuando ya se le dio acceso, así que a todas las personas con el lugar
-- apartado esperando pagar **no se les contaba el lugar**. En un taller de 20
-- podías confirmar a 30 sin que nada avisara.
--
-- CÓMO SE CUENTA AHORA — ocupa lugar quien:
--   · está en `cupo_confirmado` o `pagado`  (los `pendiente` NO apartan nada), Y
--   · no tiene una chispa muerta como única llave.
--
-- Esa segunda condición es la que hace que **una cortesía sin usar se libere
-- sola**: si le diste una demo de 3 días y no entró, su chispa expira, deja de
-- ocupar lugar, y el asiento vuelve a estar disponible sin que hagas nada.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- ── Vista base del cupo — una fila por taller ───────────────────────────────
-- La consultan la API (antes de aceptar una inscripción), el bot y el Habitat.
-- Tener el cálculo en UN solo lugar evita que el panel diga una cosa y el bot
-- otra.

CREATE OR REPLACE VIEW v_cupo_taller AS
SELECT
    t.id,
    t.nombre,
    t.estado                                        AS estado_taller,
    COALESCE(t.cupo_maximo, 0)                      AS cupo_maximo,
    COALESCE(ocupados.n, 0)                         AS cupo_ocupado,
    GREATEST(COALESCE(t.cupo_maximo, 0) - COALESCE(ocupados.n, 0), 0) AS lugares_libres,
    (COALESCE(t.cupo_maximo, 0) > 0
     AND COALESCE(ocupados.n, 0) >= t.cupo_maximo)  AS agotado
FROM talleres t
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS n
    FROM lista_espera le
    WHERE le.taller_id = t.id
      -- 'pendiente' NO aparta lugar: está en la fila, todavía sin permiso.
      AND le.estado IN ('cupo_confirmado', 'confirmado', 'pagado')
      AND (
          -- Nunca se le emitió chispa: tiene el lugar apartado esperando pagar.
          NOT EXISTS (
              SELECT 1 FROM chispas c
              WHERE LOWER(c.usuario_email) = LOWER(le.email)
                AND c.taller_id = le.taller_id
          )
          -- O tiene una chispa VIVA. Si todas las suyas están revocadas o
          -- vencidas, ya no ocupa nada: el lugar se liberó solo.
          OR EXISTS (
              SELECT 1 FROM chispas c
              WHERE LOWER(c.usuario_email) = LOWER(le.email)
                AND c.taller_id = le.taller_id
                AND c.revoked = FALSE
                AND (c.expires_at IS NULL OR c.expires_at > NOW())
          )
      )
) ocupados ON TRUE;

COMMENT ON VIEW v_cupo_taller IS
    'Fuente única de verdad del cupo. `agotado = true` → no aceptar más
     inscripciones. Un cupo_maximo de 0 o NULL significa SIN LÍMITE.';

ALTER VIEW v_cupo_taller SET (security_invoker = on);
REVOKE ALL ON v_cupo_taller FROM anon, authenticated;


-- ── v_metricas_taller usa la misma cuenta ──────────────────────────────────
-- Antes tenía su propia fórmula (solo chispas vivas). Dos fórmulas distintas
-- para lo mismo es exactamente cómo empiezan los números que no cuadran.

-- Se DROPEA en vez de REPLACE porque cambia el orden y el número de columnas,
-- y `CREATE OR REPLACE VIEW` solo permite agregar columnas al final. No hay
-- riesgo: una vista no guarda datos, se recalcula sola.
DROP VIEW IF EXISTS v_metricas_taller;
CREATE VIEW v_metricas_taller AS
SELECT
    t.id,
    t.nombre,
    t.precio,
    cu.cupo_maximo,
    COUNT(le.id)                                                      AS en_lista,
    COUNT(le.id) FILTER (WHERE le.estado = 'pendiente')               AS pendientes,
    COUNT(le.id) FILTER (WHERE le.confirmado_at IS NOT NULL)          AS confirmados,
    COUNT(le.id) FILTER (WHERE le.pagado_at     IS NOT NULL)          AS pagados,
    COUNT(le.id) FILTER (WHERE le.estado = 'rechazado')               AS rechazados,
    cu.cupo_ocupado,
    cu.lugares_libres,
    cu.agotado,
    ROUND(100.0 * COUNT(le.id) FILTER (WHERE le.pagado_at IS NOT NULL)
          / NULLIF(COUNT(le.id), 0), 1)                               AS tasa_conversion,
    COALESCE((SELECT SUM(p.monto) FROM pagos p
               WHERE p.taller_id = t.id AND p.estado = 'verificado'), 0) AS ingresos
FROM talleres t
JOIN v_cupo_taller cu ON cu.id = t.id
LEFT JOIN lista_espera le ON le.taller_id = t.id
GROUP BY t.id, t.nombre, t.precio,
         cu.cupo_maximo, cu.cupo_ocupado, cu.lugares_libres, cu.agotado;

ALTER VIEW v_metricas_taller SET (security_invoker = on);
REVOKE ALL ON v_metricas_taller FROM anon, authenticated;


-- ── Marcar como 'lleno' los talleres que ya se agotaron ─────────────────────
-- El estado 'lleno' ya existía en el esquema pero se ponía a mano. Esto pone al
-- día los que hoy estén agotados; de aquí en adelante la API lo hace sola al
-- aceptar la última inscripción.

UPDATE talleres t
SET estado = 'lleno'
FROM v_cupo_taller cu
WHERE cu.id = t.id AND cu.agotado AND t.estado = 'activo';


-- ── Verificar ───────────────────────────────────────────────────────────────

SELECT nombre, estado_taller, cupo_maximo, cupo_ocupado, lugares_libres, agotado
FROM v_cupo_taller
ORDER BY agotado DESC, cupo_ocupado DESC;

-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 009_confirmar_asistencia
--  Archivo real: apps/api/src/db/migrations/009_confirmar_asistencia.sql
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 009: confirmación de asistencia
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUÉ (idea de Paola, 23 ago 2026):
--
-- Cuando le das una cortesía a alguien que YA tiene cuenta, esa persona ni se
-- entera: la chispa aparece en su dashboard y ya. No hay ningún momento en el
-- que diga "sí, voy a ir".
--
-- Y eso importa porque **una cortesía ocupa una silla real en un taller en
-- vivo**. Si la persona no piensa asistir, ese lugar se lo está quitando a
-- alguien que sí iría — y no hay forma de saberlo hasta el día del taller.
--
-- La solución: la primera vez que entra después de recibir el acceso, se le
-- muestra los datos del taller y se le pide que confirme su asistencia. Un
-- clic. Con eso Paola sabe con quién cuenta de verdad.
--
-- `asistencia_confirmada_at` es NULL mientras no confirme. Esa es la señal que
-- dispara el pop-up y la que alimenta la lista de "no ha confirmado".
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


ALTER TABLE lista_espera
    ADD COLUMN IF NOT EXISTS asistencia_confirmada_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS asistencia_respuesta     TEXT;

COMMENT ON COLUMN lista_espera.asistencia_confirmada_at IS
    'Cuándo dijo si va o no. NULL = todavía no le hemos preguntado o no ha
     contestado; es lo que dispara el pop-up al entrar.';

COMMENT ON COLUMN lista_espera.asistencia_respuesta IS
    'si | no. Un "no" libera la silla para alguien más — por eso se pregunta.';


-- ── A quién hay que preguntarle ─────────────────────────────────────────────
-- Solo a quien ya tiene acceso vivo y todavía no ha contestado. No tiene
-- sentido preguntarle a quien no puede entrar.

CREATE OR REPLACE VIEW v_falta_confirmar_asistencia AS
SELECT le.id            AS lista_espera_id,
       le.email,
       le.taller_id,
       t.nombre         AS taller_nombre,
       t.descripcion    AS taller_descripcion,
       t.fecha_inicio,
       t.horario,
       c.is_demo,
       c.expires_at
FROM lista_espera le
JOIN talleres t ON t.id = le.taller_id
JOIN LATERAL (
    SELECT ch.is_demo, ch.expires_at
    FROM chispas ch
    WHERE LOWER(ch.usuario_email) = LOWER(le.email)
      AND ch.taller_id = le.taller_id
      AND ch.revoked = FALSE
      AND (ch.expires_at IS NULL OR ch.expires_at > NOW())
    ORDER BY ch.created_at DESC
    LIMIT 1
) c ON TRUE
WHERE le.estado = 'pagado'
  AND le.asistencia_confirmada_at IS NULL;

ALTER VIEW v_falta_confirmar_asistencia SET (security_invoker = on);
REVOKE ALL ON v_falta_confirmar_asistencia FROM anon, authenticated;


-- ── Alerta para el panel ────────────────────────────────────────────────────
-- Una cortesía sin confirmar a menos de 3 días del taller es una silla que
-- probablemente se va a quedar vacía. Vale la pena que Paola lo vea a tiempo
-- para poder ofrecérsela a alguien más.

CREATE OR REPLACE VIEW v_cortesias_sin_confirmar AS
SELECT email, taller_id, taller_nombre, fecha_inicio,
       (fecha_inicio - CURRENT_DATE) AS dias_para_el_taller
FROM v_falta_confirmar_asistencia
WHERE is_demo = TRUE
  AND fecha_inicio IS NOT NULL
  AND fecha_inicio >= CURRENT_DATE
ORDER BY fecha_inicio;

ALTER VIEW v_cortesias_sin_confirmar SET (security_invoker = on);
REVOKE ALL ON v_cortesias_sin_confirmar FROM anon, authenticated;


-- ── Verificar ───────────────────────────────────────────────────────────────
SELECT column_name FROM information_schema.columns
WHERE table_name = 'lista_espera'
  AND column_name IN ('asistencia_confirmada_at', 'asistencia_respuesta');

SELECT * FROM v_falta_confirmar_asistencia;

-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 010_asistencia_certificados
--  Archivo real: apps/api/src/db/migrations/010_asistencia_certificados.sql
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 010: asistencia real y certificados
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUÉ (decisión de Paola, 23 ago 2026):
--
-- «Vamos a ver quién entró y quién accedió al taller; esas personas son a las
--  que se les debe liberar el certificado. ¿Por qué? Porque qué pasa con las
--  personas que por X no puedan acceder al taller — no tendrían por qué tener
--  un certificado.»
--
-- Hasta hoy la única señal de asistencia era la DECLARADA (migración 009: el
-- alumno responde "sí voy" en un pop-up). Decir que vas no es haber ido.
-- Certificar con esa señal sería certificar intenciones.
--
-- Esta migración agrega la señal REAL: quién abrió su aula, cuándo, y cuánto
-- tiempo la tuvo abierta. De ahí sale el certificado.
--
-- ── Por qué se guarda tiempo y no solo un "entró" ──────────────────────────
-- Un clic no es asistir: alguien puede abrir el aula, ver que no le late y
-- cerrarla en diez segundos. Guardando el primer y el último latido tenemos
-- cuánto tiempo estuvo presente, que es lo que permite decir con honestidad
-- "esta persona tomó el taller". El umbral NO se guarda aquí: es una decisión
-- de negocio y vive en la API, para poder cambiarlo sin migrar.
--
-- ── Por qué los certificados son una tabla y no un cálculo ──────────────────
-- Un certificado es un hecho, no una consulta. Si se calculara al vuelo,
-- cambiar el umbral mañana le quitaría el certificado a alguien que ya lo
-- descargó y lo compartió. Se emite una vez, queda escrito, y ya nadie se lo
-- quita. Por eso también lleva folio: para poder comprobar que es real.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Datos del taller que aparecen en el certificado ──────────────────────
-- Paola pidió que el certificado lleve el nombre del instructor y las horas.
-- Van en `talleres` y no en el certificado porque son del taller, no de la
-- persona: si se corrige un typo en el nombre del instructor, se corrige una
-- vez. Lo que sí se congela en el certificado es lo que ya se emitió (ver §3).

ALTER TABLE talleres
    ADD COLUMN IF NOT EXISTS instructor      TEXT,
    ADD COLUMN IF NOT EXISTS duracion_horas  NUMERIC(4,1);

COMMENT ON COLUMN talleres.instructor IS
    'Quién imparte. Aparece en el certificado.';

COMMENT ON COLUMN talleres.duracion_horas IS
    'Horas de formación que acredita el certificado. NULL = no se imprime.';


-- ── 2. Asistencia real ──────────────────────────────────────────────────────
-- Una fila por persona y taller. No una por entrada: si alguien se le cae el
-- internet y vuelve a entrar tres veces, sigue siendo una asistencia, no tres.
-- Por eso `entradas` es un contador y no filas sueltas.

CREATE TABLE IF NOT EXISTS asistencias (
    id              SERIAL PRIMARY KEY,
    usuario_email   TEXT NOT NULL,
    taller_id       TEXT NOT NULL REFERENCES talleres(id) ON DELETE CASCADE,
    primera_entrada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultimo_latido   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    entradas        INTEGER     NOT NULL DEFAULT 1,
    minutos         INTEGER     NOT NULL DEFAULT 0,
    origen          TEXT,       -- 'aula' | 'admin' (cuando Paola la agrega a mano)
    nota            TEXT,       -- por qué se agregó a mano; el porqué, no solo el qué
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- El correo se guarda en minúsculas desde la API, pero el índice es funcional
-- por si algún día entra por otro camino: una persona = una asistencia.
CREATE UNIQUE INDEX IF NOT EXISTS asistencias_persona_taller
    ON asistencias (LOWER(usuario_email), taller_id);

CREATE INDEX IF NOT EXISTS asistencias_taller ON asistencias (taller_id);

COMMENT ON TABLE asistencias IS
    'Quién estuvo de verdad en la clase. La alimenta el aula: una entrada al
     abrirla y un latido cada pocos minutos mientras siga abierta.';

COMMENT ON COLUMN asistencias.minutos IS
    'Minutos con el aula abierta. Se acumula desde los latidos, así que un
     cierre de pestaña no lo pierde: lo que ya se contó, ya se contó.';

COMMENT ON COLUMN asistencias.origen IS
    'aula = la persona entró sola. admin = Paola la agregó (se le fue el
     internet, entró desde el celular de alguien más, etc.).';


-- ── 3. Certificados ─────────────────────────────────────────────────────────
-- El nombre y los datos del taller se COPIAN al emitir, no se leen por JOIN.
-- Un certificado dice lo que decía el día que se emitió; si mañana la persona
-- cambia cómo se escribe su nombre, el papel que ya descargó no cambia solo.

CREATE TABLE IF NOT EXISTS certificados (
    id               SERIAL PRIMARY KEY,
    folio            TEXT UNIQUE NOT NULL,
    usuario_email    TEXT NOT NULL,
    taller_id        TEXT NOT NULL REFERENCES talleres(id) ON DELETE CASCADE,
    -- Congelados al emitir:
    nombre           TEXT NOT NULL,   -- como pidió aparecer
    taller_nombre    TEXT NOT NULL,
    instructor       TEXT,
    duracion_horas   NUMERIC(4,1),
    fecha_taller     DATE,
    -- Trazabilidad:
    emitido_por      TEXT,            -- 'automatico' o quién lo emitió a mano
    minutos_presente INTEGER,         -- lo que justificó la emisión
    anulado          BOOLEAN     NOT NULL DEFAULT FALSE,
    anulado_at       TIMESTAMPTZ,
    anulado_motivo   TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS certificados_persona_taller
    ON certificados (LOWER(usuario_email), taller_id);

CREATE INDEX IF NOT EXISTS certificados_taller ON certificados (taller_id);

COMMENT ON TABLE certificados IS
    'Hechos, no consultas. Se emite una vez y queda escrito con los datos de
     ese día. Un certificado emitido no se borra: se anula, y se guarda por qué.';

COMMENT ON COLUMN certificados.folio IS
    'Código verificable, único. Formato DST-<AÑO>-<6 alfanuméricos>.';

COMMENT ON COLUMN certificados.anulado IS
    'Se anula, no se borra. Borrarlo dejaría un folio circulando sin respaldo.';


-- ── 4. Quién merece certificado ─────────────────────────────────────────────
-- La vista NO decide el umbral: expone los minutos y deja que la API ponga la
-- línea. Así Paola puede cambiar de opinión sobre "cuánto es haber asistido"
-- sin tocar la base.
--
-- Solo aparece quien tenía derecho a estar ahí (pagó o traía cortesía viva).

CREATE OR REPLACE VIEW v_asistencia_taller AS
SELECT t.id                             AS taller_id,
       t.nombre                         AS taller_nombre,
       t.fecha_inicio,
       LOWER(le.email)                  AS usuario_email,
       u.nombre,
       u.apellido,
       u.nombre_certificado,
       le.estado,
       (SELECT ch.is_demo FROM chispas ch
         WHERE LOWER(ch.usuario_email) = LOWER(le.email)
           AND ch.taller_id = t.id AND ch.revoked = FALSE
         ORDER BY ch.created_at DESC LIMIT 1)          AS es_demo,
       le.asistencia_respuesta,
       a.primera_entrada,
       a.ultimo_latido,
       a.entradas,
       COALESCE(a.minutos, 0)           AS minutos,
       (a.id IS NOT NULL)               AS entro,
       a.origen                         AS asistencia_origen,
       c.folio                          AS certificado_folio,
       (c.id IS NOT NULL AND c.anulado = FALSE) AS tiene_certificado
FROM lista_espera le
JOIN talleres t ON t.id = le.taller_id
LEFT JOIN usuarios u    ON LOWER(u.email) = LOWER(le.email)
LEFT JOIN asistencias a ON LOWER(a.usuario_email) = LOWER(le.email)
                       AND a.taller_id = t.id
LEFT JOIN certificados c ON LOWER(c.usuario_email) = LOWER(le.email)
                        AND c.taller_id = t.id
WHERE le.estado = 'pagado';

ALTER VIEW v_asistencia_taller SET (security_invoker = on);
REVOKE ALL ON v_asistencia_taller FROM anon, authenticated;

COMMENT ON VIEW v_asistencia_taller IS
    'La lista que ve Paola después de cada taller: quién entró, cuánto tiempo,
     y si ya tiene certificado. El umbral lo pone la API, no esta vista.';


-- ── 5. A quién le falta decir su nombre ─────────────────────────────────────
-- Ya existe v_falta_nombre_certificado (005), pero lista a cualquiera. Esta
-- acota a quien ya tiene un certificado por delante: son a los que urge
-- preguntarles, porque el papel sale con el nombre que tengamos ese día.

CREATE OR REPLACE VIEW v_falta_nombre_con_taller AS
SELECT DISTINCT LOWER(le.email) AS email,
       u.nombre,
       u.apellido,
       COUNT(*) OVER (PARTITION BY LOWER(le.email)) AS talleres_pagados
FROM lista_espera le
JOIN usuarios u ON LOWER(u.email) = LOWER(le.email)
WHERE le.estado = 'pagado'
  AND (u.nombre_certificado IS NULL OR BTRIM(u.nombre_certificado) = '');

ALTER VIEW v_falta_nombre_con_taller SET (security_invoker = on);
REVOKE ALL ON v_falta_nombre_con_taller FROM anon, authenticated;


-- ── 6. Mantener updated_at al día ───────────────────────────────────────────
-- Igual que en 003: lo estampa un trigger, no el código. Ningún camino nuevo
-- puede olvidarlo.

CREATE OR REPLACE FUNCTION tocar_asistencia() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tocar_asistencia ON asistencias;
CREATE TRIGGER trg_tocar_asistencia
    BEFORE UPDATE ON asistencias
    FOR EACH ROW EXECUTE FUNCTION tocar_asistencia();


-- ── 7. Seguridad ────────────────────────────────────────────────────────────
-- RLS encendido y CERO políticas = nadie llega por PostgREST. La API entra con
-- service_role, que salta RLS. Mismo criterio que `pagos` en la migración 004.

ALTER TABLE asistencias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificados ENABLE ROW LEVEL SECURITY;


-- ── Verificar ───────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('asistencias', 'certificados');

SELECT column_name FROM information_schema.columns
WHERE table_name = 'talleres' AND column_name IN ('instructor', 'duracion_horas');

SELECT * FROM v_asistencia_taller LIMIT 5;

-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 011_asistencia_completa
--  Archivo real: apps/api/src/db/migrations/011_asistencia_completa.sql
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 011: la lista de asistencia deja de esconder gente
-- ════════════════════════════════════════════════════════════════════════════
--
-- EL BUG (mío, 24 ago 2026):
--
-- `v_asistencia_taller` arrancaba en `FROM lista_espera ... WHERE estado =
-- 'pagado'`. Eso significaba que una persona **solo aparecía si estaba inscrita
-- y pagada**. Consecuencias reales:
--
--   · Un certificado emitido a mano a alguien que no está en `lista_espera`
--     quedaba INVISIBLE en el panel. Existía, se podía descargar, tenía folio
--     circulando… y Paola no podía anularlo desde ningún lado.
--   · Lo mismo con quien entró al aula con una cortesía pero nunca pasó por
--     `lista_espera`: asistió de verdad y la lista decía que no había nadie.
--
-- Una pantalla que se llama "Quién estuvo en la clase" no puede decidir a quién
-- muestra por un criterio administrativo. Si hay rastro de la persona en ese
-- taller — inscripción, asistencia o certificado — tiene que salir.
--
-- LA CORRECCIÓN: la vista ahora arranca de la UNIÓN de las tres fuentes.
-- `estado` puede venir NULL (nunca estuvo en lista_espera) y eso es información
-- legítima, no un error: el panel lo muestra como "sin inscripción".
--
-- Aditiva e idempotente. No borra ni cambia un solo dato. Correr en:
-- Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- CREATE OR REPLACE no basta: cambia el orden y el tipo de las columnas.
DROP VIEW IF EXISTS v_asistencia_taller;

CREATE VIEW v_asistencia_taller AS
WITH gente AS (
    -- Inscritos y pagados: el caso normal.
    SELECT le.taller_id, LOWER(le.email) AS usuario_email
      FROM lista_espera le
     WHERE le.estado = 'pagado'
    UNION
    -- Quien entró al aula, esté o no en la lista.
    SELECT a.taller_id, LOWER(a.usuario_email)
      FROM asistencias a
    UNION
    -- Quien tiene certificado. Incluye los ANULADOS a propósito: si no, un
    -- certificado anulado desaparecería de la pantalla y no quedaría rastro
    -- visible de que existió.
    SELECT c.taller_id, LOWER(c.usuario_email)
      FROM certificados c
)
SELECT t.id                             AS taller_id,
       t.nombre                         AS taller_nombre,
       t.fecha_inicio,
       g.usuario_email,
       u.nombre,
       u.apellido,
       u.nombre_certificado,
       le.estado,                        -- NULL = no está en lista_espera
       (SELECT ch.is_demo FROM chispas ch
         WHERE LOWER(ch.usuario_email) = g.usuario_email
           AND ch.taller_id = t.id AND ch.revoked = FALSE
         ORDER BY ch.created_at DESC LIMIT 1)          AS es_demo,
       le.asistencia_respuesta,
       a.primera_entrada,
       a.ultimo_latido,
       a.entradas,
       COALESCE(a.minutos, 0)           AS minutos,
       (a.id IS NOT NULL)               AS entro,
       a.origen                         AS asistencia_origen,
       c.folio                          AS certificado_folio,
       COALESCE(c.anulado, FALSE)       AS certificado_anulado,
       (c.id IS NOT NULL AND c.anulado = FALSE) AS tiene_certificado
FROM gente g
JOIN talleres t ON t.id = g.taller_id
LEFT JOIN usuarios u ON LOWER(u.email) = g.usuario_email
-- DISTINCT ON por si alguien tuviera más de una fila en lista_espera del mismo
-- taller: gana la más reciente, igual que en el resto del proyecto.
LEFT JOIN LATERAL (
    SELECT le2.estado, le2.asistencia_respuesta
      FROM lista_espera le2
     WHERE LOWER(le2.email) = g.usuario_email AND le2.taller_id = t.id
     ORDER BY le2.created_at DESC LIMIT 1
) le ON TRUE
LEFT JOIN asistencias a ON LOWER(a.usuario_email) = g.usuario_email
                       AND a.taller_id = t.id
-- El vigente manda; si solo hay anulados, se muestra el más reciente para que
-- se vea que hubo uno.
LEFT JOIN LATERAL (
    SELECT c2.id, c2.folio, c2.anulado
      FROM certificados c2
     WHERE LOWER(c2.usuario_email) = g.usuario_email AND c2.taller_id = t.id
     ORDER BY c2.anulado ASC, c2.created_at DESC LIMIT 1
) c ON TRUE;

ALTER VIEW v_asistencia_taller SET (security_invoker = on);
REVOKE ALL ON v_asistencia_taller FROM anon, authenticated;

COMMENT ON VIEW v_asistencia_taller IS
    'Quién tuvo algo que ver con este taller: inscripción pagada, asistencia al
     aula o certificado. Si hay rastro, aparece — aunque no esté en la lista de
     espera. Antes se escondía a quien tenía certificado sin inscripción, y por
     eso ese certificado no se podía anular.';


-- ── Verificar ───────────────────────────────────────────────────────────────
-- Nadie con certificado debe quedar fuera de la vista. Esta consulta tiene que
-- devolver CERO filas.
SELECT c.folio, c.usuario_email, c.taller_id
  FROM certificados c
 WHERE NOT EXISTS (
     SELECT 1 FROM v_asistencia_taller v
      WHERE v.taller_id = c.taller_id
        AND v.usuario_email = LOWER(c.usuario_email));

-- Y aquí sí deben salir todos los certificados que existen hoy.
SELECT taller_nombre, usuario_email, entro, minutos,
       certificado_folio, certificado_anulado
  FROM v_asistencia_taller
 WHERE certificado_folio IS NOT NULL
 ORDER BY taller_nombre;

-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 012_reemitir_certificado
--  Archivo real: apps/api/src/db/migrations/012_reemitir_certificado.sql
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 012: poder reemitir un certificado anulado
-- ════════════════════════════════════════════════════════════════════════════
--
-- EL BUG (mío, 24 ago 2026):
--
-- La migración 010 creó `certificados_persona_taller` como índice único sobre
-- (correo, taller) **sin distinguir si el certificado está anulado**. Con eso,
-- una persona podía tener UN certificado de ese taller en toda la historia.
--
-- Resultado: Paola anulaba un certificado y al volver a emitirlo el panel
-- respondía "Ese registro ya existe" — la base rechazaba el INSERT contra el
-- certificado anulado, que sigue ahí porque **anular no borra**.
--
-- Las dos reglas eran correctas por separado y se contradecían juntas:
--   · "un certificado emitido no se borra, se anula"  (queda la fila)
--   · "una persona = un certificado por taller"        (no cabe otra fila)
--
-- LA CORRECCIÓN: el índice pasa a ser **parcial**. La unicidad aplica solo a
-- los certificados VIGENTES. Así:
--   · sigue siendo imposible tener dos certificados válidos del mismo taller;
--   · se pueden acumular todos los anulados que haga falta, cada uno con su
--     folio y su motivo, que es justo el historial que queremos conservar.
--
-- Aditiva e idempotente. No borra ni cambia un solo dato. Correr en:
-- Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- El índice viejo abarcaba todo; el nuevo solo lo vigente.
DROP INDEX IF EXISTS certificados_persona_taller;

CREATE UNIQUE INDEX IF NOT EXISTS certificados_persona_taller_vigente
    ON certificados (LOWER(usuario_email), taller_id)
    WHERE anulado = FALSE;

COMMENT ON INDEX certificados_persona_taller_vigente IS
    'Un solo certificado VIGENTE por persona y taller. Los anulados no cuentan:
     se conservan como historial y por eso el índice es parcial — si abarcara
     todo, un certificado anulado impediría reemitir uno nuevo.';


-- ── Verificar ───────────────────────────────────────────────────────────────
-- Debe aparecer el índice nuevo, con su cláusula WHERE, y NO el viejo.
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE tablename = 'certificados'
   AND indexname LIKE 'certificados_persona%';

-- Nadie debe tener dos certificados vigentes del mismo taller (0 filas).
SELECT LOWER(usuario_email) AS correo, taller_id, COUNT(*) AS vigentes
  FROM certificados
 WHERE anulado = FALSE
 GROUP BY 1, 2
HAVING COUNT(*) > 1;

-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 013_bloqueo_usuarios
--  Archivo real: apps/api/src/db/migrations/013_bloqueo_usuarios.sql
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 013: bloquear usuarios sin borrarlos
-- ════════════════════════════════════════════════════════════════════════════
--
-- QUÉ RESUELVE
--
-- Hasta hoy, cuando alguien intentaba defraudar (comprobantes falsos, códigos
-- revendidos, una cuenta compartida entre diez), la única herramienta era
-- revocar chispas una por una. No había forma de decir "esta persona, por
-- ahora, no". Y borrar la cuenta nunca fue opción: se lleva por delante su
-- historial, sus certificados y las métricas del negocio.
--
-- DOS INTERRUPTORES, NO UNO
--
-- Se separan a propósito porque son dos castigos distintos:
--
--   · `acceso_bloqueado`   → no puede entrar a la plataforma. Es el grave.
--   · `compras_bloqueadas` → puede entrar y tomar lo que ya pagó, pero no
--                            puede apartar lugar en nada nuevo. Es el que se
--                            usa mientras se aclara un pago sospechoso, sin
--                            castigar a quien quizá no hizo nada.
--
-- Bloquear compras NO toca lo que la persona ya tenía apartado: sus chispas y
-- sus lugares siguen vivos. Si además hay que quitárselos, se revocan a mano
-- desde Accesos. Un interruptor que hiciera las dos cosas a la vez sería
-- imposible de deshacer sin adivinar qué había antes.
--
-- NADA DE BORRADO DURO
--
-- Ninguna columna borra nada y ambas se pueden apagar. Cada encendido y cada
-- apagado deja renglón en `usuarios_bloqueos` con el motivo: dentro de tres
-- meses, cuando alguien reclame, la respuesta tiene que estar escrita en algún
-- lado y no en la memoria de nadie.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Los dos interruptores, en la propia cuenta ───────────────────────────
--
-- Van en `usuarios` y no en una tabla aparte porque se consultan en CADA
-- login y en cada intento de apartar lugar: un JOIN extra en el camino
-- caliente, en la Toshiba, se nota.
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS acceso_bloqueado   BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS compras_bloqueadas BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS bloqueo_motivo     TEXT,
    ADD COLUMN IF NOT EXISTS bloqueo_at         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS bloqueo_por        TEXT;

COMMENT ON COLUMN usuarios.acceso_bloqueado IS
    'TRUE = no puede iniciar sesión ni usar la API, y el bot también lo rechaza.
     Reversible: apagarlo devuelve la cuenta intacta.';
COMMENT ON COLUMN usuarios.compras_bloqueadas IS
    'TRUE = no puede apartar lugar en talleres nuevos (web, bot ni panel).
     Lo que ya tenía apartado NO se toca.';
COMMENT ON COLUMN usuarios.bloqueo_motivo IS
    'Último motivo escrito por quien bloqueó. El historial completo vive en
     usuarios_bloqueos; esto es la copia a la mano para mostrarla en el panel.';


-- Solo interesa buscar a los bloqueados, que siempre serán unos pocos: por eso
-- los índices son parciales y no pesan lo que pesaría uno sobre toda la tabla.
CREATE INDEX IF NOT EXISTS usuarios_acceso_bloqueado_idx
    ON usuarios (email) WHERE acceso_bloqueado = TRUE;
CREATE INDEX IF NOT EXISTS usuarios_compras_bloqueadas_idx
    ON usuarios (email) WHERE compras_bloqueadas = TRUE;


-- ── 2. La bitácora ──────────────────────────────────────────────────────────
--
-- Append-only: aquí nunca se hace UPDATE ni DELETE. Cada renglón es un hecho
-- que ya pasó. Si mañana se desbloquea a alguien, se agrega el renglón del
-- desbloqueo — no se borra el del bloqueo.
CREATE TABLE IF NOT EXISTS usuarios_bloqueos (
    id            SERIAL PRIMARY KEY,
    usuario_email TEXT        NOT NULL,
    -- 'acceso' | 'compras' — cuál de los dos interruptores se movió
    tipo          TEXT        NOT NULL,
    -- TRUE = se bloqueó, FALSE = se desbloqueó
    bloqueado     BOOLEAN     NOT NULL,
    motivo        TEXT,
    -- Quién lo hizo. Hoy siempre es el panel ('admin'); queda el campo para
    -- cuando los agentes empiecen a hacerlo solos y haya que distinguirlos.
    hecho_por     TEXT        DEFAULT 'admin',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usuarios_bloqueos_email_idx
    ON usuarios_bloqueos (LOWER(usuario_email), created_at DESC);

COMMENT ON TABLE usuarios_bloqueos IS
    'Historial append-only de bloqueos y desbloqueos. Nunca se borra un
     renglón: es la respuesta escrita a "¿por qué me bloquearon?".';


-- ── 3. Vista para el panel ──────────────────────────────────────────────────
--
-- El panel necesita, de un vistazo: quién es, cómo contactarla, qué tan
-- adentro está (talleres, certificados, gasto) y si está bloqueada. Reunirlo
-- aquí evita que el front haga cinco llamadas y que el criterio de "cuánto ha
-- pagado" se escriba distinto en dos lugares.
--
-- SECURITY INVOKER + sin GRANT a anon: la vista NO abre datos a nadie que no
-- los tuviera ya. Se consulta solo desde la API con la llave de servicio,
-- detrás de authenticateAdmin. (Ver migración 004.)
DROP VIEW IF EXISTS v_usuarios_admin;
CREATE VIEW v_usuarios_admin
WITH (security_invoker = true) AS
SELECT
    u.id,
    u.email,
    u.nombre,
    u.apellido,
    u.whatsapp,
    u.estado,
    u.acceso_bloqueado,
    u.compras_bloqueadas,
    u.bloqueo_motivo,
    u.bloqueo_at,
    u.bloqueo_por,
    u.estrellas,
    u.created_at,
    u.ultima_actividad,
    -- Accesos vivos: chispas no revocadas y no vencidas.
    COALESCE(ch.talleres_activos, 0)::int  AS talleres_activos,
    COALESCE(ch.cortesias, 0)::int         AS cortesias,
    COALESCE(cert.certificados, 0)::int    AS certificados,
    COALESCE(rep.reportes_pago, 0)::int    AS reportes_pago
FROM usuarios u
LEFT JOIN (
    SELECT LOWER(usuario_email) AS email,
           COUNT(*)                                     AS talleres_activos,
           COUNT(*) FILTER (WHERE is_demo = TRUE)       AS cortesias
      FROM chispas
     WHERE revoked = FALSE
       AND (expires_at IS NULL OR expires_at > NOW())
     GROUP BY 1
) ch   ON ch.email   = LOWER(u.email)
LEFT JOIN (
    SELECT LOWER(usuario_email) AS email, COUNT(*) AS certificados
      FROM certificados
     WHERE anulado = FALSE
     GROUP BY 1
) cert ON cert.email = LOWER(u.email)
LEFT JOIN (
    SELECT LOWER(email) AS email, COUNT(*) AS reportes_pago
      FROM reportes_acceso
     WHERE motivo = 'reporte_pago'
     GROUP BY 1
) rep  ON rep.email  = LOWER(u.email);

COMMENT ON VIEW v_usuarios_admin IS
    'Ficha de cada usuario para la pestaña Usuarios del panel: contacto,
     estado de bloqueo y qué tan adentro está (accesos, certificados, pagos
     reportados). Solo la consume la API detrás de authenticateAdmin.';


-- ── Verificar ───────────────────────────────────────────────────────────────

-- Las cinco columnas nuevas, todas con default FALSE/NULL: nadie queda
-- bloqueado por correr esto.
SELECT column_name, data_type, column_default, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'usuarios'
   AND column_name IN ('acceso_bloqueado','compras_bloqueadas',
                       'bloqueo_motivo','bloqueo_at','bloqueo_por')
 ORDER BY column_name;

-- Debe dar 0 y 0. Si no, algo bloqueó cuentas y hay que revisarlo AHORA.
SELECT COUNT(*) FILTER (WHERE acceso_bloqueado)   AS acceso_bloqueado,
       COUNT(*) FILTER (WHERE compras_bloqueadas) AS compras_bloqueadas
  FROM usuarios;

-- La vista responde y trae a todos los usuarios.
SELECT COUNT(*) AS usuarios_en_la_vista FROM v_usuarios_admin;

-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 014_sincronizar_horas_taller
--  Archivo real: apps/api/src/db/migrations/014_sincronizar_horas_taller.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================================
-- 014 · Sincronizar hora_inicio / hora_fin con el texto de `horario`
--
-- EL BUG (25 ago 2026)
--
-- Un taller dice a qué hora es en DOS lugares:
--
--   · `horario`                   texto libre, "5:00 PM – 10:00 PM"
--                                 → es lo que se ve en el panel y en el Habitat
--   · `hora_inicio` / `hora_fin`  columnas TIME
--                                 → es lo que la API usa para ABRIR EL AULA
--
-- El panel de admin solo escribía el texto. Paola puso su taller de 5 a 10 PM,
-- el panel lo mostró bien, y por dentro `hora_inicio` seguía en 12:00: el aula
-- habría abierto a las 11:30 de la mañana y a las 5 de la tarde el botón ya no
-- estaría. El síntoma que lo delató fue el badge del dashboard diciendo
-- "Hoy · 12:00 PM" en un taller de las 5.
--
-- `tallerService.js` ya deriva las horas del texto al crear y al actualizar,
-- así que de aquí en adelante no se vuelven a separar. Esto arregla lo que ya
-- estaba guardado mal.
--
-- Es IDEMPOTENTE: correrlo dos veces no hace daño.
-- ============================================================================

BEGIN;

-- ── Antes: qué está desalineado ─────────────────────────────────────────────
-- Se deja como SELECT para poder MIRAR antes de tocar. Si esta lista sale
-- vacía, no había nada que arreglar.
SELECT id,
       nombre,
       horario,
       hora_inicio AS hora_inicio_actual,
       hora_fin    AS hora_fin_actual
FROM talleres
WHERE horario IS NOT NULL AND horario <> ''
ORDER BY fecha_inicio NULLS LAST;

-- ── Traductor de "5:00 PM" a 17:00:00 ──────────────────────────────────────
-- Vive solo lo que dura la transacción: no queda nada raro en la base.
CREATE OR REPLACE FUNCTION pg_temp.hora_desde_texto(txt TEXT)
RETURNS TIME AS $$
DECLARE
    limpio  TEXT;
    partes  TEXT[];
    h       INT;
    m       INT;
    sufijo  TEXT;
BEGIN
    IF txt IS NULL THEN RETURN NULL; END IF;

    -- Quitar puntos de "a.m." y espacios raros, y normalizar a minúsculas.
    limpio := lower(regexp_replace(trim(txt), '\.', '', 'g'));

    partes := regexp_match(limpio, '^([0-9]{1,2})(?::([0-9]{2}))?\s*(am|pm)?$');
    IF partes IS NULL THEN RETURN NULL; END IF;

    h      := partes[1]::INT;
    m      := COALESCE(partes[2], '00')::INT;
    sufijo := partes[3];

    IF h > 23 OR m > 59 THEN RETURN NULL; END IF;

    IF sufijo = 'pm' AND h < 12 THEN h := h + 12; END IF;
    IF sufijo = 'am' AND h = 12 THEN h := 0;      END IF;

    RETURN make_time(h, m, 0);
EXCEPTION WHEN OTHERS THEN
    -- Un texto que no se entiende deja NULL, nunca una hora inventada. Con
    -- NULL la API cae a la regla por día, que es el comportamiento seguro:
    -- deja entrar el día correcto en vez de cerrar la clase en silencio.
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Parte el texto por el guion largo, el corto o " a ".
--
-- ⚠️ `\y`, NO `\b`. Postgres usa ARE, donde el límite de palabra se escribe
-- `\y` — `\b` significa "backspace" y el separador simplemente nunca coincide,
-- en silencio. Con `\b` un horario escrito "10:00 a 2:00 PM" no se partía y se
-- quedaba sin hora. (En JavaScript sí es `\b`; son dialectos distintos.)
CREATE OR REPLACE FUNCTION pg_temp.partes_horario(txt TEXT)
RETURNS TEXT[] AS $$
    SELECT regexp_split_to_array(COALESCE(txt, ''), '\s*(?:–|—|-|\ya\y)\s*');
$$ LANGUAGE sql IMMUTABLE;

-- ── El arreglo ──────────────────────────────────────────────────────────────
UPDATE talleres t
SET hora_inicio = src.nueva_inicio,
    hora_fin    = src.nueva_fin,
    updated_at  = NOW()
FROM (
    SELECT id,
           -- COALESCE: si el texto no se entiende, se conserva lo que había.
           -- Nunca se borra una hora buena por culpa de un texto raro.
           COALESCE(pg_temp.hora_desde_texto(p[1]), hora_inicio) AS nueva_inicio,
           COALESCE(pg_temp.hora_desde_texto(p[2]), hora_fin)    AS nueva_fin,
           hora_inicio AS vieja_inicio,
           hora_fin    AS vieja_fin
    FROM (
        SELECT id, hora_inicio, hora_fin, pg_temp.partes_horario(horario) AS p
        FROM talleres
        WHERE horario IS NOT NULL AND horario <> ''
    ) AS partido
) AS src
WHERE t.id = src.id
  -- Solo tocar los que de verdad cambian. Así el `updated_at` no miente sobre
  -- talleres que nadie modificó, y correr esto dos veces hace cero updates la
  -- segunda vez.
  AND (src.nueva_inicio IS DISTINCT FROM src.vieja_inicio
    OR src.nueva_fin    IS DISTINCT FROM src.vieja_fin);

-- ── Después: cómo quedó ─────────────────────────────────────────────────────
-- Revisar esta lista ANTES del COMMIT. La columna `coincide` debe decir 'sí'
-- en todos los que tengan un horario legible.
-- Ojo con los paréntesis de `(...)[1]`: Postgres no acepta un subíndice pegado
-- directo al resultado de una función, hay que envolver la llamada. Sin ellos
-- truena con `syntax error at or near "["`.
SELECT id,
       nombre,
       horario,
       hora_inicio,
       hora_fin,
       CASE
           WHEN esperada IS NULL THEN 'texto no legible — se quedó como estaba'
           WHEN hora_inicio = esperada THEN 'sí'
           ELSE 'NO ⚠️'
       END AS coincide
FROM (
    SELECT id, nombre, horario, hora_inicio, hora_fin, fecha_inicio,
           pg_temp.hora_desde_texto((pg_temp.partes_horario(horario))[1]) AS esperada
    FROM talleres
    WHERE horario IS NOT NULL AND horario <> ''
) AS revision
ORDER BY fecha_inicio NULLS LAST;

COMMIT;

-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 015_usuario_id_paso1
--  Archivo real: apps/api/src/db/migrations/015_usuario_id_paso1.sql
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 015: usuario_id en chispas y lista_espera (T-13, PASO 1 de 4)
-- ════════════════════════════════════════════════════════════════════════════
--
-- QUÉ RESUELVE
--
-- Hoy `chispas` y `lista_espera` se relacionan con un usuario por su CORREO
-- (texto), no por un id. Eso trae tres problemas:
--   · Si alguien cambia de correo, se rompe la cadena — sus chispas y su
--     historial en lista de espera quedan huérfanos.
--   · Cada consulta tiene que comparar con LOWER(email) = LOWER($1) para no
--     fallar por mayúsculas — repetitivo y fácil de olvidar en una query nueva.
--   · Comparar texto es más lento que comparar un id indexado.
--
-- Lo correcto es relacionar por `usuario_id` (FK a `usuarios.id`). Esta
-- migración es SOLO el primer paso de 4 (ver docs/backlog-tickets.md, T-13):
--
--   1. [ESTA MIGRACIÓN] Agregar `usuario_id` nullable a las dos tablas.
--   2. Rellenarlo desde el correo actual (`UPDATE ... FROM usuarios WHERE
--      LOWER(email) = LOWER(...)`) — migración aparte.
--   3. Migrar las consultas de los servicios una por una, dejando el email
--      como respaldo mientras se verifica cada una.
--   4. Recién entonces: `NOT NULL` y quitar `chispas_usuario_email_fkey`.
--
-- ⚠️ NO HACERLO DE UN TIRÓN. Con esta migración sola, `usuario_id` queda
-- agregado pero VACÍO (NULL en todas las filas existentes) — ningún código
-- lo lee ni lo escribe todavía. `chispas.usuario_email` sigue siendo la
-- relación real hasta que se complete el paso 4. La FK vieja
-- (`chispas_usuario_email_fkey`) NO se toca aquí.
--
-- Por qué el mismo id (INTEGER) que `usuarios.id`: `usuarios.id` es
-- SERIAL (INTEGER), no UUID — hay que hacer match con el tipo real de la
-- columna, no con lo que uno asumiría por costumbre.

ALTER TABLE chispas
    ADD COLUMN IF NOT EXISTS usuario_id INTEGER
        REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE lista_espera
    ADD COLUMN IF NOT EXISTS usuario_id INTEGER
        REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;

COMMENT ON COLUMN chispas.usuario_id IS
    'T-13, paso 1 de 4 (18 sep 2026): columna nueva, todavía sin poblar ni
     usada por ningún código. La relación real sigue siendo usuario_email
     hasta que se complete la migración por etapas — ver docs/backlog-tickets.md.';
COMMENT ON COLUMN lista_espera.usuario_id IS
    'T-13, paso 1 de 4 (18 sep 2026): columna nueva, todavía sin poblar ni
     usada por ningún código. La relación real sigue siendo email hasta que
     se complete la migración por etapas — ver docs/backlog-tickets.md.';

-- Nullable hoy, pero ya se puede indexar: los JOINs del paso 3 la van a usar.
CREATE INDEX IF NOT EXISTS idx_chispas_usuario_id       ON chispas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_lista_espera_usuario_id  ON lista_espera(usuario_id);

-- ════════════════════════════════════════════════════════════
--  MIGRACIÓN: 016_usuario_id_paso2
--  Archivo real: apps/api/src/db/migrations/016_usuario_id_paso2.sql
-- ════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 016: rellenar usuario_id en chispas y lista_espera (T-13, PASO 2 de 4)
-- ════════════════════════════════════════════════════════════════════════════
--
-- QUÉ HACE
--
-- La migración 015 agregó `usuario_id` (nullable) pero la dejó vacía a
-- propósito. Esta la rellena cruzando por correo (sin distinguir mayúsculas,
-- igual que ya hace todo el código vivo) contra `usuarios.email`.
--
-- Es IDEMPOTENTE: solo toca filas donde `usuario_id IS NULL`, así que
-- correrla dos veces no hace nada la segunda vez.
--
-- Lo que NO hace: no toca ninguna consulta del código (siguen leyendo por
-- email, paso 3), no pone `NOT NULL`, no quita la FK vieja (paso 4).
--
-- Filas que se quedan sin `usuario_id` después de esto son las que tienen un
-- correo que no corresponde a ningún `usuarios.email` — la revisión al final
-- las cuenta para que se puedan mirar antes de seguir al paso 3.

BEGIN;

UPDATE chispas c
   SET usuario_id = u.id
  FROM usuarios u
 WHERE c.usuario_id IS NULL
   AND c.usuario_email IS NOT NULL
   AND LOWER(u.email) = LOWER(c.usuario_email);

UPDATE lista_espera le
   SET usuario_id = u.id
  FROM usuarios u
 WHERE le.usuario_id IS NULL
   AND le.email IS NOT NULL
   AND LOWER(u.email) = LOWER(le.email);

COMMIT;

-- ── Revisión: cuántas quedaron pobladas vs. huérfanas ────────────────────────
-- Una fila "huérfana" tiene un correo que no existe en `usuarios` — vale la
-- pena mirarlas antes de migrar las consultas (paso 3), pero no bloquean nada.
SELECT
    'chispas' AS tabla,
    COUNT(*)                                   AS total,
    COUNT(usuario_id)                          AS con_usuario_id,
    COUNT(*) FILTER (WHERE usuario_id IS NULL
                        AND usuario_email IS NOT NULL) AS huerfanas_con_email,
    COUNT(*) FILTER (WHERE usuario_email IS NULL)      AS sin_asignar
FROM chispas
UNION ALL
SELECT
    'lista_espera' AS tabla,
    COUNT(*)                          AS total,
    COUNT(usuario_id)                 AS con_usuario_id,
    COUNT(*) FILTER (WHERE usuario_id IS NULL AND email IS NOT NULL) AS huerfanas_con_email,
    0                                  AS sin_asignar
FROM lista_espera;
