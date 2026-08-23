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
