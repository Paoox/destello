-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 025: Prospectos (19 nov 2026)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Panel → Prospectos: gente que se interesó en un taller y no lo tomó, para
-- invitarla (WhatsApp + correo) cuando ese taller vuelva a abrir.
--
--   · "No pagaron"         → sale de lista_espera ('rechazado' sin pago); no
--                            necesita tabla nueva.
--   · "No alcanzaron lugar" → NO quedaba registrado en ningún lado: el bot y
--                            el Hábitat solo decían "te avisamos". Ahora
--                            listaEsperaService los guarda aquí.
--
-- prospecto_invitaciones: bitácora de cada invitación mandada, para no
-- invitar dos veces a lo mismo sin darse cuenta.
--
-- Aditiva e idempotente. talleres.id es TEXT (slug).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prospectos_sin_cupo (
    id                 SERIAL PRIMARY KEY,
    email              TEXT NOT NULL,
    nombre             TEXT,
    whatsapp           TEXT,
    taller_id          TEXT NOT NULL REFERENCES talleres(id) ON DELETE CASCADE,
    intentos           INTEGER NOT NULL DEFAULT 1,      -- cuántas veces lo intentó
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultimo_intento_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una fila por persona y taller (se suman los intentos).
CREATE UNIQUE INDEX IF NOT EXISTS ux_prospectos_sin_cupo_email_taller
    ON prospectos_sin_cupo (LOWER(email), taller_id);

CREATE TABLE IF NOT EXISTS prospecto_invitaciones (
    id              SERIAL PRIMARY KEY,
    email           TEXT NOT NULL,
    taller_id       TEXT REFERENCES talleres(id) ON DELETE SET NULL,  -- a qué se le invitó
    origen          TEXT NOT NULL CHECK (origen IN ('no_pago', 'sin_cupo')),
    wa_enviado      BOOLEAN NOT NULL DEFAULT FALSE,
    correo_enviado  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospecto_invitaciones_email
    ON prospecto_invitaciones (LOWER(email), created_at DESC);
