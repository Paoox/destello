-- ============================================================
-- Destello — Migración 002: Tabla resplandores
-- Tokens de invitación para crear cuenta (un solo uso, por email)
-- Correr en la Toshiba:
--   psql -U destello -d destello_db -f apps/api/src/migrations/002_create_resplandores.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS resplandores (
    id          SERIAL PRIMARY KEY,

    -- Código de acceso formato RESP-XXXX-XXXX
    code        VARCHAR(20)  UNIQUE NOT NULL,

    -- Email al que va ligado este resplandor
    email       VARCHAR(255) NOT NULL,

    -- Nombre del usuario (opcional, para personalizar el correo)
    nombre      VARCHAR(255),

    -- Taller de origen (por si fue generado desde lista de espera)
    taller_id   VARCHAR(100),

    -- Estado de uso
    used        BOOLEAN      NOT NULL DEFAULT FALSE,
    used_at     TIMESTAMPTZ,

    -- Revocado manualmente por admin
    revoked     BOOLEAN      NOT NULL DEFAULT FALSE,
    revoked_at  TIMESTAMPTZ,

    -- Vigencia opcional (ej: 7 días para aceptar la invitación)
    expires_at  TIMESTAMPTZ,

    -- Auditoría
    created_by  VARCHAR(100) NOT NULL DEFAULT 'admin',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índices útiles para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_resplandores_code  ON resplandores (code);
CREATE INDEX IF NOT EXISTS idx_resplandores_email ON resplandores (email);
CREATE INDEX IF NOT EXISTS idx_resplandores_used  ON resplandores (used);

-- Confirmar
SELECT 'Tabla resplandores creada correctamente ✦' AS resultado;
