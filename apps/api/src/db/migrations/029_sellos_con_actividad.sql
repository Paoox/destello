-- 029 — Sellos que abren actividades en el Hábitat (19 nov 2026)
--
-- El Hábitat es el contenedor de los sellos. Cuando la profe pone un sello con
-- una actividad abierta en el pizarrón, el sello "se lleva" esa actividad: en
-- el Hábitat, al tocarlo, la persona la vuelve a jugar.
--
--   · insignias.actividad_id / actividad_tipo — qué material abre (null = solo adorno)
--   · insignias.acceso — 'siempre' (lo básico), '30dias' (30 días después del
--     taller) o 'premium' (membresía, todavía no existe: queda bloqueado)
--   · Reto: terminarla en el tiempo límite da Supernovas UNA vez por
--     actividad (motivo 'reto', ref = actividad_id). El tiempo lo mide el
--     servidor (habitat_juegos), no el navegador.

ALTER TABLE insignias
    ADD COLUMN IF NOT EXISTS actividad_id   TEXT,
    ADD COLUMN IF NOT EXISTS actividad_tipo TEXT,
    ADD COLUMN IF NOT EXISTS acceso         TEXT NOT NULL DEFAULT 'siempre'
        CHECK (acceso IN ('siempre', '30dias', 'premium'));

-- El mismo sello puede llegar dos veces del mismo taller si abre actividades distintas.
DROP INDEX IF EXISTS uq_insignias_sello_taller;
CREATE UNIQUE INDEX uq_insignias_sello_taller
    ON insignias (LOWER(usuario_email), taller_id, nombre, COALESCE(actividad_id, ''));

ALTER TABLE supernovas_movimientos DROP CONSTRAINT IF EXISTS supernovas_movimientos_motivo_check;
ALTER TABLE supernovas_movimientos ADD CONSTRAINT supernovas_movimientos_motivo_check
    CHECK (motivo IN ('taller', 'referido', 'compra', 'ajuste', 'estrellas', 'reto'));

CREATE TABLE IF NOT EXISTS habitat_juegos (
    id           SERIAL PRIMARY KEY,
    usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    insignia_id  INTEGER NOT NULL REFERENCES insignias(id) ON DELETE CASCADE,
    iniciado_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    terminado_at TIMESTAMPTZ,
    segundos     NUMERIC(8,1)
);
CREATE INDEX IF NOT EXISTS idx_habitat_juegos_usuario ON habitat_juegos (usuario_id, iniciado_at DESC);
