-- ════════════════════════════════════════════════════════════════════════════
-- Destello — ¿Quiénes son las alertas reales?
-- Pegar en Supabase → SQL Editor → Run
-- Solo LEE. No modifica nada.
--
-- OJO: la alerta 'activo_sin_entrar' todavía NO sirve. Lee primer_login_at,
-- columna recién creada que la API aún no escribe. Está vacía para todos, así
-- que marca a todo el mundo. Ignórala hasta que instrumentemos el login.
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- 1 · Las personas pagadas que NO ven su taller  ← LA QUE IMPORTA
-- ════════════════════════════════════════════════════════════════════════════
SELECT
    le.email,
    le.nombre,
    le.whatsapp,
    t.nombre                AS taller,
    le.estado               AS estado_lista,
    COALESCE(u.estado, '(sin cuenta)') AS estado_cuenta,
    le.pagado_at,
    (SELECT COUNT(*) FROM chispas c
      WHERE LOWER(c.usuario_email) = LOWER(le.email)
        AND c.taller_id = le.taller_id)          AS chispas_totales,
    CASE
        WHEN u.email IS NULL      THEN 'No tiene cuenta en usuarios'
        WHEN u.estado <> 'activo' THEN 'Cuenta existe pero NO está activa'
        WHEN (SELECT COUNT(*) FROM chispas c
               WHERE LOWER(c.usuario_email) = LOWER(le.email)
                 AND c.taller_id = le.taller_id) > 0
                                  THEN 'Tenía chispa pero fue revocada'
        ELSE                           'Nunca se le creó la chispa'
    END                     AS diagnostico
FROM lista_espera le
LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(le.email)
LEFT JOIN talleres t ON t.id = le.taller_id
WHERE le.estado = 'pagado'
  AND NOT EXISTS (
      SELECT 1 FROM chispas c
      WHERE LOWER(c.usuario_email) = LOWER(le.email)
        AND c.taller_id = le.taller_id
        AND c.revoked = FALSE)
ORDER BY le.pagado_at DESC NULLS LAST;


-- ════════════════════════════════════════════════════════════════════════════
-- 2 · Foto completa: toda la lista de espera con su situación real
-- ════════════════════════════════════════════════════════════════════════════
SELECT
    le.email,
    le.nombre,
    t.nombre                AS taller,
    le.estado               AS en_lista,
    COALESCE(u.estado, '—') AS cuenta,
    (SELECT COUNT(*) FROM chispas c
      WHERE LOWER(c.usuario_email) = LOWER(le.email)
        AND c.taller_id = le.taller_id
        AND c.revoked = FALSE
        AND (c.expires_at IS NULL OR c.expires_at > NOW()))  AS chispa_viva,
    le.created_at::date     AS se_inscribio,
    le.confirmado_at::date  AS le_dieron_cupo,
    le.pagado_at::date      AS pago,
    CASE
        WHEN le.estado = 'pagado' AND COALESCE(u.estado,'') <> 'activo'
             THEN '🔴 pagó y su cuenta no está activa'
        WHEN le.estado = 'pagado' AND NOT EXISTS (
             SELECT 1 FROM chispas c
             WHERE LOWER(c.usuario_email) = LOWER(le.email)
               AND c.taller_id = le.taller_id AND c.revoked = FALSE)
             THEN '🔴 pagó y no ve su taller'
        WHEN le.estado = 'pagado' THEN '✅ todo en orden'
        WHEN le.estado IN ('cupo_confirmado','confirmado') THEN '⏳ esperando pago'
        WHEN le.estado = 'rechazado' THEN '✖ liberado'
        ELSE '· pendiente de cupo'
    END                     AS situacion
FROM lista_espera le
LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(le.email)
LEFT JOIN talleres t ON t.id = le.taller_id
ORDER BY le.created_at DESC;


-- ════════════════════════════════════════════════════════════════════════════
-- 3 · El embudo de hoy
-- ════════════════════════════════════════════════════════════════════════════
SELECT * FROM v_embudo;


-- ════════════════════════════════════════════════════════════════════════════
-- 4 · Cupo por taller (las demos SÍ cuentan como lugar ocupado)
-- ════════════════════════════════════════════════════════════════════════════
SELECT nombre, cupo_maximo, cupo_ocupado, lugares_libres,
       en_lista, pagados, tasa_conversion, ingresos
FROM v_metricas_taller
ORDER BY cupo_ocupado DESC;
