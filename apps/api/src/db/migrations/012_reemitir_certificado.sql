-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 012: poder reemitir un certificado anulado
-- ════════════════════════════════════════════════════════════════════════════
--
-- EL BUG (mío, 24 ago 2026):
--
-- La migración 010 creó `certificados_persona_taller` como índice único sobre
-- (correo, taller) **sin distinguir si el certificado está anulado**. Con eso,
-- una persona podía tener UN certificado de ese taller en toda la historia.
--
-- Resultado: Paola anulaba un certificado y al volver a emitirlo el panel
-- respondía "Ese registro ya existe" — la base rechazaba el INSERT contra el
-- certificado anulado, que sigue ahí porque **anular no borra**.
--
-- Las dos reglas eran correctas por separado y se contradecían juntas:
--   · "un certificado emitido no se borra, se anula"  (queda la fila)
--   · "una persona = un certificado por taller"        (no cabe otra fila)
--
-- LA CORRECCIÓN: el índice pasa a ser **parcial**. La unicidad aplica solo a
-- los certificados VIGENTES. Así:
--   · sigue siendo imposible tener dos certificados válidos del mismo taller;
--   · se pueden acumular todos los anulados que haga falta, cada uno con su
--     folio y su motivo, que es justo el historial que queremos conservar.
--
-- Aditiva e idempotente. No borra ni cambia un solo dato. Correr en:
-- Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- El índice viejo abarcaba todo; el nuevo solo lo vigente.
DROP INDEX IF EXISTS certificados_persona_taller;

CREATE UNIQUE INDEX IF NOT EXISTS certificados_persona_taller_vigente
    ON certificados (LOWER(usuario_email), taller_id)
    WHERE anulado = FALSE;

COMMENT ON INDEX certificados_persona_taller_vigente IS
    'Un solo certificado VIGENTE por persona y taller. Los anulados no cuentan:
     se conservan como historial y por eso el índice es parcial — si abarcara
     todo, un certificado anulado impediría reemitir uno nuevo.';


-- ── Verificar ───────────────────────────────────────────────────────────────
-- Debe aparecer el índice nuevo, con su cláusula WHERE, y NO el viejo.
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE tablename = 'certificados'
   AND indexname LIKE 'certificados_persona%';

-- Nadie debe tener dos certificados vigentes del mismo taller (0 filas).
SELECT LOWER(usuario_email) AS correo, taller_id, COUNT(*) AS vigentes
  FROM certificados
 WHERE anulado = FALSE
 GROUP BY 1, 2
HAVING COUNT(*) > 1;
