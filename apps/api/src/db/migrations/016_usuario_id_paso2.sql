-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 016: rellenar usuario_id en chispas y lista_espera (T-13, PASO 2 de 4)
-- ════════════════════════════════════════════════════════════════════════════
--
-- QUÉ HACE
--
-- La migración 015 agregó `usuario_id` (nullable) pero la dejó vacía a
-- propósito. Esta la rellena cruzando por correo (sin distinguir mayúsculas,
-- igual que ya hace todo el código vivo) contra `usuarios.email`.
--
-- Es IDEMPOTENTE: solo toca filas donde `usuario_id IS NULL`, así que
-- correrla dos veces no hace nada la segunda vez.
--
-- Lo que NO hace: no toca ninguna consulta del código (siguen leyendo por
-- email, paso 3), no pone `NOT NULL`, no quita la FK vieja (paso 4).
--
-- Filas que se quedan sin `usuario_id` después de esto son las que tienen un
-- correo que no corresponde a ningún `usuarios.email` — la revisión al final
-- las cuenta para que se puedan mirar antes de seguir al paso 3.

BEGIN;

UPDATE chispas c
   SET usuario_id = u.id
  FROM usuarios u
 WHERE c.usuario_id IS NULL
   AND c.usuario_email IS NOT NULL
   AND LOWER(u.email) = LOWER(c.usuario_email);

UPDATE lista_espera le
   SET usuario_id = u.id
  FROM usuarios u
 WHERE le.usuario_id IS NULL
   AND le.email IS NOT NULL
   AND LOWER(u.email) = LOWER(le.email);

COMMIT;

-- ── Revisión: cuántas quedaron pobladas vs. huérfanas ────────────────────────
-- Una fila "huérfana" tiene un correo que no existe en `usuarios` — vale la
-- pena mirarlas antes de migrar las consultas (paso 3), pero no bloquean nada.
SELECT
    'chispas' AS tabla,
    COUNT(*)                                   AS total,
    COUNT(usuario_id)                          AS con_usuario_id,
    COUNT(*) FILTER (WHERE usuario_id IS NULL
                        AND usuario_email IS NOT NULL) AS huerfanas_con_email,
    COUNT(*) FILTER (WHERE usuario_email IS NULL)      AS sin_asignar
FROM chispas
UNION ALL
SELECT
    'lista_espera' AS tabla,
    COUNT(*)                          AS total,
    COUNT(usuario_id)                 AS con_usuario_id,
    COUNT(*) FILTER (WHERE usuario_id IS NULL AND email IS NOT NULL) AS huerfanas_con_email,
    0                                  AS sin_asignar
FROM lista_espera;
