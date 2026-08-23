-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 006: reparar las chispas que se quedaron sin lugar en la lista
-- ════════════════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA (detectado el 23 ago 2026 probando el flujo real):
--
-- Antes del fix de las cortesías, `createChispa` se saltaba `lista_espera`
-- cuando `isDemo` era true. Esas chispas quedaron huérfanas: existen y dan
-- acceso, pero no tienen renglón en la lista.
--
-- Eso provocaba DOS síntomas que parecían no tener nada que ver:
--
--   1. El filtro "🎁 Demo" del panel salía vacío aunque las estadísticas
--      contaran 1 demo. El filtro lee `lista_espera`, y ahí no había nada.
--
--   2. **El bot dejaba inscribirse otra vez a un taller que la persona ya
--      tenía.** `registrarEnLista` busca duplicados en `lista_espera`; como no
--      había renglón, concluía que era gente nueva y la volvía a formar.
--
-- Un solo hueco, dos síntomas. Esta migración lo tapa hacia atrás; el código
-- ya lo evita hacia adelante.
--
-- Aditiva e idempotente: solo crea lo que falta, nunca pisa lo que existe.
-- Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- ── PASO 1 · Ver qué está huérfano ANTES de tocar nada ──────────────────────
SELECT c.code, c.usuario_email, c.taller_id, c.is_demo, c.created_at::date
FROM chispas c
WHERE c.revoked = FALSE
  AND c.usuario_email IS NOT NULL
  AND c.taller_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM lista_espera le
      WHERE LOWER(le.email) = LOWER(c.usuario_email)
        AND le.taller_id = c.taller_id
  )
ORDER BY c.created_at;


-- ── PASO 2 · Crearles su renglón ────────────────────────────────────────────
-- Entran como 'pagado' porque ya tienen acceso: la chispa existe. Que haya
-- sido cortesía o pago se distingue por el renglón de `pagos`, no por aquí.
--
-- `created_at` se copia de la chispa para no falsear las métricas de tiempo:
-- se apuntó cuando se le dio la chispa, no hoy.
--
-- `pagado_at` y `confirmado_at` se ponen a mano aquí porque los triggers de la
-- 003 se disparan en UPDATE, no en INSERT. Sin ellos, la fila diría 'pagado'
-- con la fecha vacía y el embudo no la contaría: el estado y su fecha SIEMPRE
-- deben ir juntos, o las métricas empiezan a mentir.
INSERT INTO lista_espera (email, taller_id, nombre, whatsapp, estado, origen,
                          created_at, confirmado_at, pagado_at)
SELECT DISTINCT ON (LOWER(c.usuario_email), c.taller_id)
       LOWER(c.usuario_email),
       c.taller_id,
       COALESCE(c.usuario_nombre, u.nombre),
       COALESCE(c.usuario_wa, u.whatsapp),
       'pagado',
       'admin',
       c.created_at,
       c.created_at,
       c.created_at
FROM chispas c
LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(c.usuario_email)
WHERE c.revoked = FALSE
  AND c.usuario_email IS NOT NULL
  AND c.taller_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM lista_espera le
      WHERE LOWER(le.email) = LOWER(c.usuario_email)
        AND le.taller_id = c.taller_id
  )
ORDER BY LOWER(c.usuario_email), c.taller_id, c.created_at ASC;


-- ── PASO 3 · Registrar las cortesías en `pagos` ─────────────────────────────
-- Para que el dinero cuadre: una demo es un pago de $0 con metodo='cortesia'.
-- Sin esto, una cortesía se vería igual que un pago que nunca se registró.

INSERT INTO pagos (usuario_email, lista_espera_id, taller_id, monto, metodo,
                   estado, verificado_por, nota, origen, created_at)
SELECT LOWER(c.usuario_email), le.id, c.taller_id, 0, 'cortesia',
       'verificado', 'backfill',
       'Cortesía anterior al cambio de regla — reconstruida desde la chispa',
       'admin', c.created_at
FROM chispas c
JOIN lista_espera le
  ON LOWER(le.email) = LOWER(c.usuario_email) AND le.taller_id = c.taller_id
WHERE c.is_demo = TRUE
  AND c.revoked = FALSE
  AND NOT EXISTS (
      SELECT 1 FROM pagos p WHERE p.lista_espera_id = le.id AND p.metodo = 'cortesia'
  );


-- ── PASO 4 · Verificar ──────────────────────────────────────────────────────

-- Debe devolver 0 filas: ya no quedan chispas sin lugar en la lista.
SELECT c.code, c.usuario_email, c.taller_id
FROM chispas c
WHERE c.revoked = FALSE
  AND c.usuario_email IS NOT NULL AND c.taller_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM lista_espera le
      WHERE LOWER(le.email) = LOWER(c.usuario_email) AND le.taller_id = c.taller_id
  );

-- Las demos ya deben aparecer en la lista (esto alimenta el filtro 🎁 Demo).
SELECT le.email, le.taller_id, le.estado, c.is_demo, c.expires_at::date AS vence
FROM lista_espera le
JOIN chispas c ON LOWER(c.usuario_email) = LOWER(le.email)
              AND c.taller_id = le.taller_id AND c.revoked = FALSE
WHERE c.is_demo = TRUE;

-- Y el cupo, con las cortesías contando como el lugar que son.
SELECT nombre, cupo_maximo, cupo_ocupado, lugares_libres, pagados, ingresos
FROM v_metricas_taller
WHERE cupo_ocupado > 0;
