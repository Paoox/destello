-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 017: 'pendiente' ya ocupa cupo desde que se crea (T-36)
-- ════════════════════════════════════════════════════════════════════════════
--
-- LA REGLA VIEJA (migración 008): solo `cupo_confirmado`/`pagado` apartaban
-- lugar. Un renglón `pendiente` —el que crea el bot en cuanto alguien elige
-- taller, ANTES de que Paola confirme nada— no contaba.
--
-- POR QUÉ CAMBIA (decidido con Paola, 18 sep 2026, T-36): el bot le dice
-- "¡Quedaste inscrito!" + medios de pago apenas hay cupo, sin esperar a que el
-- admin conteste. Si `pendiente` no ocupa lugar, varias personas casi al mismo
-- tiempo pueden pasar la validación de cupo y a TODAS se les promete un lugar
-- que el sistema no les estaba apartando — el primero que paga se queda, a los
-- demás se les mintió sin querer.
--
-- LA REGLA NUEVA: `pendiente` cuenta contra el cupo desde que se crea, igual
-- que `cupo_confirmado`/`pagado`.
--
-- EL RIESGO QUE ESTO ABRE, Y CÓMO SE CUBRE: sin nada más, un `pendiente` que
-- Paola nunca revisa se quedaría ocupando el lugar PARA SIEMPRE — nadie lo
-- libera. Por eso esta migración también extiende el reloj de 48 h + 24 h de
-- gracia que ya existía (migración 007) para que arranque en `pendiente`
-- también, usando `created_at` como base cuando no hay `confirmado_at` (ese
-- campo solo se llena al confirmar el lugar, que en `pendiente` nunca pasó
-- todavía). El botón "Liberar" del panel (`ListaEsperaAdmin.jsx`) ya funciona
-- para cualquier estado — con esto, un `pendiente` viejo aparece con el mismo
-- reloj y el mismo botón que un `cupo_confirmado` vencido, sin UI nueva.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- ── v_cupo_taller: 'pendiente' ya cuenta ────────────────────────────────────
-- Mismas columnas que la migración 008 (CREATE OR REPLACE no puede reordenar
-- ni quitar columnas), solo cambia qué estados de lista_espera se cuentan.

CREATE OR REPLACE VIEW v_cupo_taller AS
SELECT
    t.id,
    t.nombre,
    t.estado                                        AS estado_taller,
    COALESCE(t.cupo_maximo, 0)                      AS cupo_maximo,
    COALESCE(ocupados.n, 0)                         AS cupo_ocupado,
    GREATEST(COALESCE(t.cupo_maximo, 0) - COALESCE(ocupados.n, 0), 0) AS lugares_libres,
    (COALESCE(t.cupo_maximo, 0) > 0
     AND COALESCE(ocupados.n, 0) >= t.cupo_maximo)  AS agotado
FROM talleres t
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS n
    FROM lista_espera le
    WHERE le.taller_id = t.id
      -- ⚠️ T-36: 'pendiente' se agregó aquí — antes solo apartaban
      -- 'cupo_confirmado'/'confirmado'/'pagado'. 'rechazado' sigue sin contar.
      AND le.estado IN ('pendiente', 'cupo_confirmado', 'confirmado', 'pagado')
      AND (
          -- Nunca se le emitió chispa: tiene el lugar apartado esperando pagar.
          NOT EXISTS (
              SELECT 1 FROM chispas c
              WHERE LOWER(c.usuario_email) = LOWER(le.email)
                AND c.taller_id = le.taller_id
          )
          -- O tiene una chispa VIVA. Si todas las suyas están revocadas o
          -- vencidas, ya no ocupa nada: el lugar se liberó solo.
          OR EXISTS (
              SELECT 1 FROM chispas c
              WHERE LOWER(c.usuario_email) = LOWER(le.email)
                AND c.taller_id = le.taller_id
                AND c.revoked = FALSE
                AND (c.expires_at IS NULL OR c.expires_at > NOW())
          )
      )
) ocupados ON TRUE;

COMMENT ON VIEW v_cupo_taller IS
    'Fuente única de verdad del cupo. `agotado = true` → no aceptar más
     inscripciones. Un cupo_maximo de 0 o NULL significa SIN LÍMITE.
     Desde T-36 (18 sep 2026), "pendiente" ya ocupa lugar, no solo
     "cupo_confirmado"/"pagado" — ver el encabezado de la migración 017.';

-- Confirmación de este paso. Al correr el script COMPLETO de un tirón, el
-- SQL Editor de Supabase solo pinta la cuadrícula del ÚLTIMO SELECT — los
-- pasos de en medio no dejan rastro visual salvo que avisen por su cuenta.
-- `RAISE NOTICE` sí aparece, TODOS y en orden, en el panel "Messages" de
-- Supabase (junto a "Results"), sin importar cuántos SELECT haya después.
DO $$
DECLARE
    v_talleres int;
BEGIN
    SELECT COUNT(*) INTO v_talleres FROM v_cupo_taller;
    RAISE NOTICE '✅ Paso 1/2 — v_cupo_taller actualizada: % talleres calculados, "pendiente" ya cuenta', v_talleres;
END $$;


-- ── v_alertas: el reloj de 48h+24h también arranca en 'pendiente' ──────────
-- Mismas 6 columnas que la migración 007 (CREATE OR REPLACE, no se puede
-- reordenar/quitar). Solo cambian las dos etapas del reloj de pago: se agrega
-- 'pendiente' a los estados que aplican, y la base del plazo pasa de
-- `confirmado_at` a `COALESCE(confirmado_at, created_at)` — un 'pendiente'
-- nunca tiene `confirmado_at` (ese campo lo llena "confirmar lugar"), así que
-- sin este COALESCE el reloj nunca arrancaría para esos renglones.

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
-- (T-36: ahora también incluye 'pendiente', con created_at como respaldo de
-- confirmado_at)
SELECT 'falta_recordatorio', le.email, le.taller_id,
       COALESCE(le.confirmado_at, le.created_at),
       'Se le venció el plazo de 48 h y aún no se le manda recordatorio'
FROM lista_espera le
WHERE le.estado IN ('pendiente', 'cupo_confirmado', 'confirmado')
  AND COALESCE(le.confirmado_at, le.created_at) < NOW() - INTERVAL '48 hours'
  AND le.recordatorio_at IS NULL

UNION ALL
-- ETAPA 2 · Ya se le avisó y pasaron sus 24 h de gracia → se puede liberar
-- (T-36: ahora también incluye 'pendiente')
SELECT 'gracia_vencida', le.email, le.taller_id, le.recordatorio_at,
       'Ya se le recordó y pasaron sus 24 h de gracia: se puede liberar el lugar'
FROM lista_espera le
WHERE le.estado IN ('pendiente', 'cupo_confirmado', 'confirmado')
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

ALTER VIEW v_cupo_taller SET (security_invoker = on);
REVOKE ALL ON v_cupo_taller FROM anon, authenticated;

DO $$
DECLARE
    v_total_alertas int;
    v_recordatorios int;
    v_gracia        int;
BEGIN
    SELECT COUNT(*) INTO v_total_alertas FROM v_alertas;
    SELECT COUNT(*) INTO v_recordatorios FROM v_alertas WHERE tipo = 'falta_recordatorio';
    SELECT COUNT(*) INTO v_gracia        FROM v_alertas WHERE tipo = 'gracia_vencida';
    RAISE NOTICE '✅ Paso 2/2 — v_alertas actualizada: % alertas en total (% en falta_recordatorio, % en gracia_vencida — ambas ya incluyen "pendiente")',
        v_total_alertas, v_recordatorios, v_gracia;
    RAISE NOTICE '✅ Permisos aplicados (security_invoker + REVOKE) en las 2 vistas';
    RAISE NOTICE '✅ Migración 017 completa';
END $$;


-- ── Verificar ───────────────────────────────────────────────────────────────
-- Estas dos SÍ hay que correrlas SEPARADAS (seleccionar solo el bloque y dar
-- Run) para ver su cuadrícula completa — si se corre el script de un tirón,
-- solo se ve la de la última.

SELECT nombre, estado_taller, cupo_maximo, cupo_ocupado, lugares_libres, agotado
FROM v_cupo_taller
ORDER BY agotado DESC, cupo_ocupado DESC;

SELECT tipo, COUNT(*) FROM v_alertas GROUP BY tipo ORDER BY tipo;
