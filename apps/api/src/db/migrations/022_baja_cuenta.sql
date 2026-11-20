-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 022: baja de cuenta desde Ajustes (T-45, 19 nov 2026)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Regla decidida con Paola (19 nov 2026):
--   · La persona puede pedir la baja cuando quiera, desde /settings.
--   · Al momento: se bloquea su acceso (mismo interruptor `acceso_bloqueado`
--     del tab Usuarios, con su renglón en `usuarios_bloqueos`), se apagan sus
--     avisos y se liberan los lugares que tenía apartados sin pagar.
--   · Sus datos personales se borran cuando lleve 6 meses sin ningún taller
--     (T-50 en el backlog — todavía no hay proceso que lo haga).
--   · Mientras tanto Paola la puede reactivar: desbloquear su acceso en el tab
--     Usuarios limpia `baja_solicitada_at`.
--   · Pagos y certificados se conservan siempre (contabilidad y verificación
--     pública por QR).
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS baja_solicitada_at TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS baja_motivo        TEXT;
-- La llenará el proceso de T-50 cuando borre los datos personales.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS anonimizada_at     TIMESTAMPTZ;

COMMENT ON COLUMN usuarios.baja_solicitada_at IS
    'Cuándo pidió la baja desde Ajustes. NULL = cuenta normal (o reactivada).';

-- Dos motivos nuevos de reporte (reporteService.MOTIVOS): "Reportar un
-- problema" y la baja. El CHECK viejo solo aceptaba los tres originales.
ALTER TABLE reportes_acceso DROP CONSTRAINT IF EXISTS reportes_acceso_motivo_check;
ALTER TABLE reportes_acceso ADD CONSTRAINT reportes_acceso_motivo_check
    CHECK (motivo IN ('sin_acceso_plataforma', 'sin_acceso_taller', 'reporte_pago',
                      'problema_plataforma', 'baja_cuenta'));
