-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 028: referidos que pagan, cupones y sellos guardados (19 nov 2026)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Reglas de Paola:
--   · El código de referido se captura al inscribirse (web) o en el Perfil.
--   · Quien invita gana 50 Supernovas cuando la persona invitada PAGA su
--     taller (no al registrarse). `referidos.recompensado_at` marca cuándo.
--   · Cada 5 referidos que pagaron → cupón de 30% para su siguiente taller:
--     se aplica solo en su próxima compra, vence en 6 meses, intransferible
--     (va ligado a usuario_id).
--   · Los sellos que pone la profe en clase ahora se GUARDAN en `insignias`
--     (antes solo vivían durante la clase) — son los primeros objetos del
--     Hábitat. Un mismo sello del mismo taller se guarda una vez.
--
-- Aditiva e idempotente.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE lista_espera ADD COLUMN IF NOT EXISTS codigo_referido TEXT;
ALTER TABLE referidos    ADD COLUMN IF NOT EXISTS recompensado_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS cupones (
    id               SERIAL PRIMARY KEY,
    usuario_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo           TEXT    NOT NULL UNIQUE,
    porcentaje       INTEGER NOT NULL CHECK (porcentaje BETWEEN 1 AND 100),
    motivo           TEXT    NOT NULL,
    ref              TEXT    NOT NULL,
    vence_at         TIMESTAMPTZ NOT NULL,
    usado_at         TIMESTAMPTZ,
    lista_espera_id  INTEGER REFERENCES lista_espera(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, motivo, ref)
);
CREATE INDEX IF NOT EXISTS idx_cupones_usuario ON cupones(usuario_id) WHERE usado_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_insignias_sello_taller
    ON insignias (LOWER(usuario_email), taller_id, nombre);
