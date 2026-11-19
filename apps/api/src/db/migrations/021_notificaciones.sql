-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 021: notificaciones (T-44, 19 nov 2026)
-- ════════════════════════════════════════════════════════════════════════════
--
-- La campanita del menú (/notifs). Las notificaciones NO se crean desde cada
-- botón del panel: las arma un revisor automático (`notificacionService.js`,
-- cada 5 min, solo en producción) mirando el estado de la base. Así no hay
-- que acordarse de "avisar" en cada ruta nueva que confirme un pago o emita
-- un certificado.
--
-- Qué se avisa (decidido con Paola, 19 nov 2026):
--   alumnas · tu taller es mañana/hoy (24 h antes)       → app + WhatsApp
--           · tu taller empieza en 1 hora                → app + WhatsApp
--           · nuevo taller abierto                       → app + correo
--           · tu certificado ya está listo               → app
--           · tu pago quedó confirmado                   → app
--   profes  · mañana/hoy impartes X (inscritas/pagadas)  → app + WhatsApp
--           · tu clase empieza en 1 hora                 → app + WhatsApp
--           · nueva alumna inscrita en tu taller         → app
--
-- `(usuario_id, tipo, ref)` es único: el revisor puede pasar mil veces por el
-- mismo hecho y la notificación se crea una sola vez.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notificaciones (
    id               BIGSERIAL PRIMARY KEY,
    usuario_id       INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo             TEXT    NOT NULL,   -- taller_24h · taller_1h · profe_24h · profe_1h ·
                                         -- nuevo_taller · certificado · pago_confirmado · nueva_alumna
    ref              TEXT    NOT NULL,   -- de qué hecho sale (id del taller, folio, id del pago…)
    titulo           TEXT    NOT NULL,
    cuerpo           TEXT,
    liga             TEXT,               -- ruta dentro de la app, ej. '/home'
    datos            JSONB   NOT NULL DEFAULT '{}'::jsonb,  -- para armar el WhatsApp/correo
    leida_at         TIMESTAMPTZ,
    -- Envío por fuera de la app. `enviar_*` = hay que mandarlo; `*_enviado_at`
    -- = ya salió. Si el bot o Resend fallan, se reintenta hasta 3 veces.
    enviar_wa        BOOLEAN NOT NULL DEFAULT FALSE,
    wa_enviado_at    TIMESTAMPTZ,
    enviar_correo    BOOLEAN NOT NULL DEFAULT FALSE,
    correo_enviado_at TIMESTAMPTZ,
    envio_intentos   INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, tipo, ref)
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario
    ON notificaciones (usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notificaciones_por_enviar
    ON notificaciones (created_at)
    WHERE (enviar_wa AND wa_enviado_at IS NULL)
       OR (enviar_correo AND correo_enviado_at IS NULL);

-- Preferencias (la pantalla de Ajustes, T-45, las va a poder cambiar).
-- Apagarlas solo corta el WhatsApp/correo: la notificación en la app siempre llega.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avisos_whatsapp BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avisos_correo   BOOLEAN NOT NULL DEFAULT TRUE;

-- Cuándo se anunció un taller como "nuevo". Los que ya existen se marcan como
-- anunciados para que al desplegar no le llegue a todo el mundo un aviso de
-- cada taller viejo. Un taller que pasa de borrador/pausado a activo se
-- anuncia en ese momento (sigue con NULL hasta entonces).
ALTER TABLE talleres ADD COLUMN IF NOT EXISTS anunciado_at TIMESTAMPTZ;
UPDATE talleres SET anunciado_at = NOW()
 WHERE anunciado_at IS NULL AND estado IN ('activo', 'proximamente', 'lleno');
