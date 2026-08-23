-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 007: las 24 h de gracia después del recordatorio
-- ════════════════════════════════════════════════════════════════════════════
--
-- LA REGLA (definida por Paola el 23 ago 2026):
--
--   1. Le confirmas el lugar        → se lo apartas
--   2. Tiene 48 h para pagar        → si no, el panel te avisa
--   3. Le mandas un recordatorio    → se le dan 24 h MÁS
--   4. Si no responde en esas 24 h  → puedes liberar el lugar
--
-- El paso 3 no existía como dato. El panel dejaba liberar el lugar en cuanto
-- se cumplían las 48 h, sin distinguir si ya se le había avisado o no. Y eso
-- importa: **liberar el lugar de alguien a quien nunca le avisaste es muy
-- distinto de liberarlo después de que no contestó.**
--
-- `recordatorio_at` es la fecha que faltaba. Con ella el panel puede mostrar
-- en qué etapa va cada quien y no ofrecer "liberar" antes de tiempo.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


ALTER TABLE lista_espera
    ADD COLUMN IF NOT EXISTS recordatorio_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS recordatorios      INTEGER DEFAULT 0;

COMMENT ON COLUMN lista_espera.recordatorio_at IS
    'Cuándo se le mandó el último recordatorio de pago. NULL = todavía no se le
     avisa, así que NO se le debe liberar el lugar aunque ya pasaran las 48 h.';

COMMENT ON COLUMN lista_espera.recordatorios IS
    'Cuántos recordatorios se le han mandado. Sirve para saber a quién hay que
     perseguir siempre y para no mandarle diez mensajes a la misma persona.';


-- ── Alertas actualizadas: distinguir las tres etapas ────────────────────────
-- Antes `cupo_vencido` mezclaba a quien nunca supo que tenía que pagar con
-- quien ya no contestó. Son dos acciones distintas: al primero se le manda un
-- recordatorio, al segundo se le libera el lugar.

CREATE OR REPLACE VIEW v_alertas AS
-- Pagó pero su cuenta sigue en espera
SELECT 'pagado_sin_activar' AS tipo, le.email, le.taller_id,
       le.pagado_at AS desde,
       'Pagó pero su cuenta no está activa' AS detalle
FROM lista_espera le
JOIN usuarios u ON LOWER(u.email) = LOWER(le.email)
WHERE le.estado = 'pagado' AND u.estado <> 'activo'

UNION ALL
-- Pagó, está activo, pero no tiene chispa: su taller NO aparece
SELECT 'pagado_sin_taller', le.email, le.taller_id, le.pagado_at,
       'Pagado y activo pero sin chispa: no ve su taller'
FROM lista_espera le
WHERE le.estado = 'pagado'
  AND NOT EXISTS (
      SELECT 1 FROM chispas c
      WHERE LOWER(c.usuario_email) = LOWER(le.email)
        AND c.taller_id = le.taller_id AND c.revoked = FALSE)

UNION ALL
-- Activo desde hace más de 3 días y nunca ha entrado
SELECT 'activo_sin_entrar', u.email, NULL, u.activado_at,
       'Lleva más de 3 días activo y nunca ha entrado'
FROM usuarios u
WHERE u.estado = 'activo' AND u.primer_login_at IS NULL
  AND u.activado_at < NOW() - INTERVAL '3 days'

UNION ALL
-- ETAPA 1 · Se le venció el plazo y NUNCA se le avisó → mandar recordatorio
SELECT 'falta_recordatorio', le.email, le.taller_id, le.confirmado_at,
       'Se le venció el plazo de 48 h y aún no se le manda recordatorio'
FROM lista_espera le
WHERE le.estado IN ('cupo_confirmado', 'confirmado')
  AND le.confirmado_at < NOW() - INTERVAL '48 hours'
  AND le.recordatorio_at IS NULL

UNION ALL
-- ETAPA 2 · Ya se le avisó y pasaron sus 24 h de gracia → se puede liberar
SELECT 'gracia_vencida', le.email, le.taller_id, le.recordatorio_at,
       'Ya se le recordó y pasaron sus 24 h de gracia: se puede liberar el lugar'
FROM lista_espera le
WHERE le.estado IN ('cupo_confirmado', 'confirmado')
  AND le.recordatorio_at IS NOT NULL
  AND le.recordatorio_at < NOW() - INTERVAL '24 hours'

UNION ALL
-- Talleres sobrevendidos
SELECT 'taller_sobrevendido', NULL, t.id, NOW(),
       'Tiene más inscritos que cupo_maximo'
FROM talleres t
WHERE (SELECT COUNT(*) FROM chispas c
       WHERE c.taller_id = t.id AND c.revoked = FALSE
         AND (c.expires_at IS NULL OR c.expires_at > NOW())) > t.cupo_maximo;

ALTER VIEW v_alertas SET (security_invoker = on);
REVOKE ALL ON v_alertas FROM anon, authenticated;


-- ── Verificar ───────────────────────────────────────────────────────────────
SELECT column_name FROM information_schema.columns
WHERE table_name = 'lista_espera'
  AND column_name IN ('recordatorio_at', 'recordatorios');

SELECT tipo, COUNT(*) FROM v_alertas GROUP BY tipo ORDER BY tipo;
