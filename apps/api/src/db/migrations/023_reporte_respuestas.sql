-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 023: responder reportes desde el panel (19 nov 2026)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Paola contesta un reporte en el tab Reportes y a la persona le llega la
-- respuesta en su campanita (notificación 'respuesta_soporte', T-44). Puede
-- contestar varias veces; aquí queda la conversación.
--
-- Solo se puede responder así a quien tiene cuenta (si no, no hay campanita):
-- a los demás se les contesta por WhatsApp.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reporte_respuestas (
    id              SERIAL PRIMARY KEY,
    reporte_id      INTEGER NOT NULL REFERENCES reportes_acceso(id) ON DELETE CASCADE,
    texto           TEXT    NOT NULL,
    usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,  -- a quién le llegó
    hecho_por       TEXT    NOT NULL DEFAULT 'admin',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reporte_respuestas_reporte
    ON reporte_respuestas (reporte_id, created_at);
