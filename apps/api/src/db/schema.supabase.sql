-- ============================================================
--  Destello — Esquema limpio para Supabase (PostgreSQL)
--  Pegar completo en: Supabase → SQL Editor → Run.
--
--  Es idempotente: se puede correr de nuevo sin miedo (borra y
--  recrea todo). Los datos actuales son de prueba, así que no se
--  conserva nada — arrancamos limpio.
--
--  Reglas de negocio reflejadas aquí:
--   · talleres.id  = slug de texto (ej. 'taller-auriculoterapia')
--   · cupo_maximo  = 20 por defecto (control de reventa)
--   · chispas.usuario_email → usuarios.email  (FK INTENCIONAL:
--     una chispa solo existe para un usuario con cuenta)
--   · resplandores.email ≠ chispas.usuario_email (columnas distintas)
--   · La ventana de material (30 días desde el día siguiente a que
--     concluye el taller) NO se guarda: se calcula en la API a partir
--     de talleres.fecha_fin (o fecha_inicio si no hay fin).
-- ============================================================

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
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Talleres ─────────────────────────────────────────────────
CREATE TABLE talleres (
    id            TEXT PRIMARY KEY,              -- slug: 'taller-nombre'
    nombre        TEXT NOT NULL,
    descripcion   TEXT,
    precio        NUMERIC(10,2),
    horario       TEXT,                          -- ej. '9:00 AM (CDMX)'
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

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX idx_chispas_email        ON chispas(usuario_email);
CREATE INDEX idx_chispas_taller       ON chispas(taller_id);
CREATE INDEX idx_resplandores_email   ON resplandores(email);
CREATE INDEX idx_lista_espera_estado  ON lista_espera(estado);
CREATE INDEX idx_lista_espera_taller  ON lista_espera(taller_id);
CREATE INDEX idx_usuarios_email       ON usuarios(email);
CREATE INDEX idx_usuarios_codigo_ref  ON usuarios(codigo_referido);
CREATE INDEX idx_referidos_referidor  ON referidos(referidor_email);
CREATE INDEX idx_canjes_usuario       ON canjes_supernova(usuario_email);
