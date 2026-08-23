-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 008: el cupo, contado como Paola lo definió
-- ════════════════════════════════════════════════════════════════════════════
--
-- LA REGLA:
-- **Confirmar el lugar YA lo aparta.** Si el taller tiene 20 lugares y confirmas
-- a 20 personas, se llena — aunque ninguna haya pagado todavía. El reloj de
-- 48 h + 24 h de gracia existe justo para poder recuperar esos lugares.
--
-- QUÉ ESTABA MAL:
-- `cupo_ocupado` contaba únicamente **chispas vivas**. Pero una chispa solo
-- existe cuando ya se le dio acceso, así que a todas las personas con el lugar
-- apartado esperando pagar **no se les contaba el lugar**. En un taller de 20
-- podías confirmar a 30 sin que nada avisara.
--
-- CÓMO SE CUENTA AHORA — ocupa lugar quien:
--   · está en `cupo_confirmado` o `pagado`  (los `pendiente` NO apartan nada), Y
--   · no tiene una chispa muerta como única llave.
--
-- Esa segunda condición es la que hace que **una cortesía sin usar se libere
-- sola**: si le diste una demo de 3 días y no entró, su chispa expira, deja de
-- ocupar lugar, y el asiento vuelve a estar disponible sin que hagas nada.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- ── Vista base del cupo — una fila por taller ───────────────────────────────
-- La consultan la API (antes de aceptar una inscripción), el bot y el Habitat.
-- Tener el cálculo en UN solo lugar evita que el panel diga una cosa y el bot
-- otra.

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
      -- 'pendiente' NO aparta lugar: está en la fila, todavía sin permiso.
      AND le.estado IN ('cupo_confirmado', 'confirmado', 'pagado')
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
     inscripciones. Un cupo_maximo de 0 o NULL significa SIN LÍMITE.';

ALTER VIEW v_cupo_taller SET (security_invoker = on);
REVOKE ALL ON v_cupo_taller FROM anon, authenticated;


-- ── v_metricas_taller usa la misma cuenta ──────────────────────────────────
-- Antes tenía su propia fórmula (solo chispas vivas). Dos fórmulas distintas
-- para lo mismo es exactamente cómo empiezan los números que no cuadran.

-- Se DROPEA en vez de REPLACE porque cambia el orden y el número de columnas,
-- y `CREATE OR REPLACE VIEW` solo permite agregar columnas al final. No hay
-- riesgo: una vista no guarda datos, se recalcula sola.
DROP VIEW IF EXISTS v_metricas_taller;
CREATE VIEW v_metricas_taller AS
SELECT
    t.id,
    t.nombre,
    t.precio,
    cu.cupo_maximo,
    COUNT(le.id)                                                      AS en_lista,
    COUNT(le.id) FILTER (WHERE le.estado = 'pendiente')               AS pendientes,
    COUNT(le.id) FILTER (WHERE le.confirmado_at IS NOT NULL)          AS confirmados,
    COUNT(le.id) FILTER (WHERE le.pagado_at     IS NOT NULL)          AS pagados,
    COUNT(le.id) FILTER (WHERE le.estado = 'rechazado')               AS rechazados,
    cu.cupo_ocupado,
    cu.lugares_libres,
    cu.agotado,
    ROUND(100.0 * COUNT(le.id) FILTER (WHERE le.pagado_at IS NOT NULL)
          / NULLIF(COUNT(le.id), 0), 1)                               AS tasa_conversion,
    COALESCE((SELECT SUM(p.monto) FROM pagos p
               WHERE p.taller_id = t.id AND p.estado = 'verificado'), 0) AS ingresos
FROM talleres t
JOIN v_cupo_taller cu ON cu.id = t.id
LEFT JOIN lista_espera le ON le.taller_id = t.id
GROUP BY t.id, t.nombre, t.precio,
         cu.cupo_maximo, cu.cupo_ocupado, cu.lugares_libres, cu.agotado;

ALTER VIEW v_metricas_taller SET (security_invoker = on);
REVOKE ALL ON v_metricas_taller FROM anon, authenticated;


-- ── Marcar como 'lleno' los talleres que ya se agotaron ─────────────────────
-- El estado 'lleno' ya existía en el esquema pero se ponía a mano. Esto pone al
-- día los que hoy estén agotados; de aquí en adelante la API lo hace sola al
-- aceptar la última inscripción.

UPDATE talleres t
SET estado = 'lleno'
FROM v_cupo_taller cu
WHERE cu.id = t.id AND cu.agotado AND t.estado = 'activo';


-- ── Verificar ───────────────────────────────────────────────────────────────

SELECT nombre, estado_taller, cupo_maximo, cupo_ocupado, lugares_libres, agotado
FROM v_cupo_taller
ORDER BY agotado DESC, cupo_ocupado DESC;
