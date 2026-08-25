-- ============================================================================
-- 014 · Sincronizar hora_inicio / hora_fin con el texto de `horario`
--
-- EL BUG (25 ago 2026)
--
-- Un taller dice a qué hora es en DOS lugares:
--
--   · `horario`                   texto libre, "5:00 PM – 10:00 PM"
--                                 → es lo que se ve en el panel y en el Habitat
--   · `hora_inicio` / `hora_fin`  columnas TIME
--                                 → es lo que la API usa para ABRIR EL AULA
--
-- El panel de admin solo escribía el texto. Paola puso su taller de 5 a 10 PM,
-- el panel lo mostró bien, y por dentro `hora_inicio` seguía en 12:00: el aula
-- habría abierto a las 11:30 de la mañana y a las 5 de la tarde el botón ya no
-- estaría. El síntoma que lo delató fue el badge del dashboard diciendo
-- "Hoy · 12:00 PM" en un taller de las 5.
--
-- `tallerService.js` ya deriva las horas del texto al crear y al actualizar,
-- así que de aquí en adelante no se vuelven a separar. Esto arregla lo que ya
-- estaba guardado mal.
--
-- Es IDEMPOTENTE: correrlo dos veces no hace daño.
-- ============================================================================

BEGIN;

-- ── Antes: qué está desalineado ─────────────────────────────────────────────
-- Se deja como SELECT para poder MIRAR antes de tocar. Si esta lista sale
-- vacía, no había nada que arreglar.
SELECT id,
       nombre,
       horario,
       hora_inicio AS hora_inicio_actual,
       hora_fin    AS hora_fin_actual
FROM talleres
WHERE horario IS NOT NULL AND horario <> ''
ORDER BY fecha_inicio NULLS LAST;

-- ── Traductor de "5:00 PM" a 17:00:00 ──────────────────────────────────────
-- Vive solo lo que dura la transacción: no queda nada raro en la base.
CREATE OR REPLACE FUNCTION pg_temp.hora_desde_texto(txt TEXT)
RETURNS TIME AS $$
DECLARE
    limpio  TEXT;
    partes  TEXT[];
    h       INT;
    m       INT;
    sufijo  TEXT;
BEGIN
    IF txt IS NULL THEN RETURN NULL; END IF;

    -- Quitar puntos de "a.m." y espacios raros, y normalizar a minúsculas.
    limpio := lower(regexp_replace(trim(txt), '\.', '', 'g'));

    partes := regexp_match(limpio, '^([0-9]{1,2})(?::([0-9]{2}))?\s*(am|pm)?$');
    IF partes IS NULL THEN RETURN NULL; END IF;

    h      := partes[1]::INT;
    m      := COALESCE(partes[2], '00')::INT;
    sufijo := partes[3];

    IF h > 23 OR m > 59 THEN RETURN NULL; END IF;

    IF sufijo = 'pm' AND h < 12 THEN h := h + 12; END IF;
    IF sufijo = 'am' AND h = 12 THEN h := 0;      END IF;

    RETURN make_time(h, m, 0);
EXCEPTION WHEN OTHERS THEN
    -- Un texto que no se entiende deja NULL, nunca una hora inventada. Con
    -- NULL la API cae a la regla por día, que es el comportamiento seguro:
    -- deja entrar el día correcto en vez de cerrar la clase en silencio.
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Parte el texto por el guion largo, el corto o " a ".
--
-- ⚠️ `\y`, NO `\b`. Postgres usa ARE, donde el límite de palabra se escribe
-- `\y` — `\b` significa "backspace" y el separador simplemente nunca coincide,
-- en silencio. Con `\b` un horario escrito "10:00 a 2:00 PM" no se partía y se
-- quedaba sin hora. (En JavaScript sí es `\b`; son dialectos distintos.)
CREATE OR REPLACE FUNCTION pg_temp.partes_horario(txt TEXT)
RETURNS TEXT[] AS $$
    SELECT regexp_split_to_array(COALESCE(txt, ''), '\s*(?:–|—|-|\ya\y)\s*');
$$ LANGUAGE sql IMMUTABLE;

-- ── El arreglo ──────────────────────────────────────────────────────────────
UPDATE talleres t
SET hora_inicio = src.nueva_inicio,
    hora_fin    = src.nueva_fin,
    updated_at  = NOW()
FROM (
    SELECT id,
           -- COALESCE: si el texto no se entiende, se conserva lo que había.
           -- Nunca se borra una hora buena por culpa de un texto raro.
           COALESCE(pg_temp.hora_desde_texto(p[1]), hora_inicio) AS nueva_inicio,
           COALESCE(pg_temp.hora_desde_texto(p[2]), hora_fin)    AS nueva_fin,
           hora_inicio AS vieja_inicio,
           hora_fin    AS vieja_fin
    FROM (
        SELECT id, hora_inicio, hora_fin, pg_temp.partes_horario(horario) AS p
        FROM talleres
        WHERE horario IS NOT NULL AND horario <> ''
    ) AS partido
) AS src
WHERE t.id = src.id
  -- Solo tocar los que de verdad cambian. Así el `updated_at` no miente sobre
  -- talleres que nadie modificó, y correr esto dos veces hace cero updates la
  -- segunda vez.
  AND (src.nueva_inicio IS DISTINCT FROM src.vieja_inicio
    OR src.nueva_fin    IS DISTINCT FROM src.vieja_fin);

-- ── Después: cómo quedó ─────────────────────────────────────────────────────
-- Revisar esta lista ANTES del COMMIT. La columna `coincide` debe decir 'sí'
-- en todos los que tengan un horario legible.
-- Ojo con los paréntesis de `(...)[1]`: Postgres no acepta un subíndice pegado
-- directo al resultado de una función, hay que envolver la llamada. Sin ellos
-- truena con `syntax error at or near "["`.
SELECT id,
       nombre,
       horario,
       hora_inicio,
       hora_fin,
       CASE
           WHEN esperada IS NULL THEN 'texto no legible — se quedó como estaba'
           WHEN hora_inicio = esperada THEN 'sí'
           ELSE 'NO ⚠️'
       END AS coincide
FROM (
    SELECT id, nombre, horario, hora_inicio, hora_fin, fecha_inicio,
           pg_temp.hora_desde_texto((pg_temp.partes_horario(horario))[1]) AS esperada
    FROM talleres
    WHERE horario IS NOT NULL AND horario <> ''
) AS revision
ORDER BY fecha_inicio NULLS LAST;

COMMIT;
