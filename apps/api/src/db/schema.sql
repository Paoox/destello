-- ============================================================
--  Destello — Schema PostgreSQL
--  Ejecutar en orden la primera vez, o correr migrations/
--  Requiere: psql -U destello -d destello_db -f schema.sql
-- ============================================================

-- ── Extensiones ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Usuarios ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
                                        id          SERIAL PRIMARY KEY,
                                        email       TEXT UNIQUE NOT NULL,
                                        nombre      TEXT,
                                        apellido    TEXT,
                                        whatsapp    TEXT,
                                        password    TEXT,                      -- bcrypt hash
                                        estado      TEXT DEFAULT 'activo',     -- activo | inactivo | baneado
                                        created_at  TIMESTAMPTZ DEFAULT NOW()
    );

-- ── Talleres ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS talleres (
                                        id               SERIAL PRIMARY KEY,
                                        nombre           TEXT NOT NULL,
                                        descripcion      TEXT,
                                        precio           NUMERIC(10,2),
    horario          TEXT,                 -- ej: '9:00 AM'
    fecha_disponible DATE,
    estado           TEXT DEFAULT 'activo', -- activo | pausado | borrador
    categoria        TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
    );

-- ── Chispas (códigos de acceso de pago) ──────────────────────
-- Mientras chispaService.js use Map en memoria, esta tabla queda
-- como referencia. Cuando migren, INSERT aquí en vez del Map.
CREATE TABLE IF NOT EXISTS chispas (
                                       code             TEXT PRIMARY KEY,     -- DEST-XXXX-XXXX
                                       taller_id        TEXT,
                                       taller_nombre    TEXT,
                                       created_by       TEXT,
                                       created_at       TIMESTAMPTZ DEFAULT NOW(),
    expires_at       TIMESTAMPTZ,
    used             BOOLEAN DEFAULT FALSE,
    used_by          TEXT,
    revoked          BOOLEAN DEFAULT FALSE,
    is_demo          BOOLEAN DEFAULT FALSE,
    usuario_nombre   TEXT,
    usuario_email    TEXT,
    usuario_wa       TEXT                  -- 10 dígitos, sin lada
    );

-- ── Resplandores (códigos de registro de cuenta) ─────────────
CREATE TABLE IF NOT EXISTS resplandores (
                                            id             SERIAL PRIMARY KEY,
                                            code           TEXT UNIQUE NOT NULL,   -- RES-XXXX-XXXX
                                            usuario_email  TEXT NOT NULL,
                                            created_at     TIMESTAMPTZ DEFAULT NOW(),
    expires_at     TIMESTAMPTZ,
    used           BOOLEAN DEFAULT FALSE,
    used_at        TIMESTAMPTZ,
    revoked        BOOLEAN DEFAULT FALSE
    );

-- ── Lista de espera ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lista_espera (
                                            id         SERIAL PRIMARY KEY,
                                            nombre     TEXT,
                                            email      TEXT,
                                            whatsapp   TEXT,
                                            taller_id  INTEGER REFERENCES talleres(id) ON DELETE SET NULL,
    estado     TEXT DEFAULT 'pendiente',   -- pendiente | confirmado | rechazado
    notas      TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chispas_email    ON chispas(usuario_email);
CREATE INDEX IF NOT EXISTS idx_resplandores_email ON resplandores(usuario_email);
CREATE INDEX IF NOT EXISTS idx_lista_espera_estado ON lista_espera(estado);
CREATE INDEX IF NOT EXISTS idx_usuarios_email   ON usuarios(email);