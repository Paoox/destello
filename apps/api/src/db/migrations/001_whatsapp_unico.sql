-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 001: un número de WhatsApp = una sola cuenta
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUÉ: el login por número (`POST /auth/phone/verify`) busca al usuario con
-- `WHERE whatsapp = $1`. Si dos cuentas comparten número, la persona entra a la
-- cuenta equivocada — acceso cruzado a los datos de alguien más.
--
-- Correr en el SQL Editor de Supabase, EN ORDEN. El paso 3 falla si todavía
-- quedan duplicados: eso es a propósito.
-- ════════════════════════════════════════════════════════════════════════════


-- ── PASO 0 · Normalizar antes de comparar ──────────────────────────────────
-- Si un número quedó guardado como '+52 55 1234 5678' y otro como '5512345678',
-- son el mismo número pero el índice no los vería como iguales. Se dejan todos
-- en el formato canónico: 10 dígitos, sin lada ni signos. Las cadenas vacías
-- pasan a NULL para que el índice parcial las ignore.

UPDATE usuarios
SET whatsapp = NULLIF(RIGHT(REGEXP_REPLACE(whatsapp, '\D', '', 'g'), 10), '')
WHERE whatsapp IS NOT NULL
  AND whatsapp <> NULLIF(RIGHT(REGEXP_REPLACE(whatsapp, '\D', '', 'g'), 10), '');

-- Los que no quedaron en 10 dígitos son basura (números incompletos): a NULL.
UPDATE usuarios
SET whatsapp = NULL
WHERE whatsapp IS NOT NULL AND LENGTH(whatsapp) <> 10;


-- ── PASO 1 · ¿Qué duplicados quedan? ───────────────────────────────────────
-- Revisar el resultado ANTES de seguir. Si sale vacío, saltar al paso 3.

SELECT whatsapp,
       COUNT(*)                                AS cuentas,
       ARRAY_AGG(id       ORDER BY id)         AS ids,
       ARRAY_AGG(email    ORDER BY id)         AS correos,
       ARRAY_AGG(estado   ORDER BY id)         AS estados,
       ARRAY_AGG(created_at::date ORDER BY id) AS creadas
FROM usuarios
WHERE whatsapp IS NOT NULL
GROUP BY whatsapp
HAVING COUNT(*) > 1
ORDER BY cuentas DESC;


-- ── PASO 2 · Resolver los duplicados ───────────────────────────────────────
-- El número se queda con UNA cuenta; a las demás se les pone NULL (la persona
-- podrá volver a ligarlo desde su perfil, y ahí sí se valida).
--
-- Criterio sugerido: gana la cuenta ACTIVA; si hay varias activas, la más
-- antigua (menor id). Nunca se borra ninguna cuenta — solo se suelta el número.
--
-- ⚠️ Revisa primero el resultado del paso 1. Si en algún caso quieres que gane
-- otra cuenta, hazlo a mano con:
--     UPDATE usuarios SET whatsapp = NULL WHERE id = <id_que_pierde>;

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY whatsapp
               ORDER BY (estado = 'activo') DESC, id ASC
           ) AS pos
    FROM usuarios
    WHERE whatsapp IS NOT NULL
)
UPDATE usuarios u
SET whatsapp = NULL
FROM ranked r
WHERE u.id = r.id AND r.pos > 1;


-- ── PASO 3 · El candado ────────────────────────────────────────────────────
-- Índice ÚNICO PARCIAL: solo aplica a las filas con número. Así muchas cuentas
-- pueden seguir teniendo whatsapp NULL (en un índice único normal, varios NULL
-- sí se permiten, pero el parcial además mantiene el índice pequeño y rápido).

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_whatsapp_unico
    ON usuarios (whatsapp)
    WHERE whatsapp IS NOT NULL;


-- ── PASO 4 · Verificar ─────────────────────────────────────────────────────
-- Debe devolver 0 filas.

SELECT whatsapp, COUNT(*)
FROM usuarios
WHERE whatsapp IS NOT NULL
GROUP BY whatsapp
HAVING COUNT(*) > 1;
