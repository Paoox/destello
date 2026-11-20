-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 026: ficha pública de cada profe (19 nov 2026)
-- ════════════════════════════════════════════════════════════════════════════
--
-- "Conoce a tus profes" en Novedades. La llena Paola desde el panel
-- (pestaña Profesores); nombre y talleres que imparte salen solos.
--
--   foto              data URL (JPEG ya achicado en el navegador, ~50-150 KB).
--                     Si está vacía se usa usuarios.foto (la de su Perfil).
--   formacion         una línea por estudio/certificación.
--   ficha_publicada   para esconder una ficha sin borrarla.
--
-- Aditiva e idempotente.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE profesores ADD COLUMN IF NOT EXISTS foto               TEXT;
ALTER TABLE profesores ADD COLUMN IF NOT EXISTS especialidad       TEXT;
ALTER TABLE profesores ADD COLUMN IF NOT EXISTS semblanza          TEXT;
ALTER TABLE profesores ADD COLUMN IF NOT EXISTS anios_experiencia  INTEGER
    CHECK (anios_experiencia IS NULL OR anios_experiencia BETWEEN 0 AND 80);
ALTER TABLE profesores ADD COLUMN IF NOT EXISTS formacion          TEXT;
ALTER TABLE profesores ADD COLUMN IF NOT EXISTS ficha_publicada    BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profesores ADD COLUMN IF NOT EXISTS ficha_updated_at   TIMESTAMPTZ;
