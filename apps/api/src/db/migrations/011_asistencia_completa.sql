-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 011: la lista de asistencia deja de esconder gente
-- ════════════════════════════════════════════════════════════════════════════
--
-- EL BUG (mío, 24 ago 2026):
--
-- `v_asistencia_taller` arrancaba en `FROM lista_espera ... WHERE estado =
-- 'pagado'`. Eso significaba que una persona **solo aparecía si estaba inscrita
-- y pagada**. Consecuencias reales:
--
--   · Un certificado emitido a mano a alguien que no está en `lista_espera`
--     quedaba INVISIBLE en el panel. Existía, se podía descargar, tenía folio
--     circulando… y Paola no podía anularlo desde ningún lado.
--   · Lo mismo con quien entró al aula con una cortesía pero nunca pasó por
--     `lista_espera`: asistió de verdad y la lista decía que no había nadie.
--
-- Una pantalla que se llama "Quién estuvo en la clase" no puede decidir a quién
-- muestra por un criterio administrativo. Si hay rastro de la persona en ese
-- taller — inscripción, asistencia o certificado — tiene que salir.
--
-- LA CORRECCIÓN: la vista ahora arranca de la UNIÓN de las tres fuentes.
-- `estado` puede venir NULL (nunca estuvo en lista_espera) y eso es información
-- legítima, no un error: el panel lo muestra como "sin inscripción".
--
-- Aditiva e idempotente. No borra ni cambia un solo dato. Correr en:
-- Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- CREATE OR REPLACE no basta: cambia el orden y el tipo de las columnas.
DROP VIEW IF EXISTS v_asistencia_taller;

CREATE VIEW v_asistencia_taller AS
WITH gente AS (
    -- Inscritos y pagados: el caso normal.
    SELECT le.taller_id, LOWER(le.email) AS usuario_email
      FROM lista_espera le
     WHERE le.estado = 'pagado'
    UNION
    -- Quien entró al aula, esté o no en la lista.
    SELECT a.taller_id, LOWER(a.usuario_email)
      FROM asistencias a
    UNION
    -- Quien tiene certificado. Incluye los ANULADOS a propósito: si no, un
    -- certificado anulado desaparecería de la pantalla y no quedaría rastro
    -- visible de que existió.
    SELECT c.taller_id, LOWER(c.usuario_email)
      FROM certificados c
)
SELECT t.id                             AS taller_id,
       t.nombre                         AS taller_nombre,
       t.fecha_inicio,
       g.usuario_email,
       u.nombre,
       u.apellido,
       u.nombre_certificado,
       le.estado,                        -- NULL = no está en lista_espera
       (SELECT ch.is_demo FROM chispas ch
         WHERE LOWER(ch.usuario_email) = g.usuario_email
           AND ch.taller_id = t.id AND ch.revoked = FALSE
         ORDER BY ch.created_at DESC LIMIT 1)          AS es_demo,
       le.asistencia_respuesta,
       a.primera_entrada,
       a.ultimo_latido,
       a.entradas,
       COALESCE(a.minutos, 0)           AS minutos,
       (a.id IS NOT NULL)               AS entro,
       a.origen                         AS asistencia_origen,
       c.folio                          AS certificado_folio,
       COALESCE(c.anulado, FALSE)       AS certificado_anulado,
       (c.id IS NOT NULL AND c.anulado = FALSE) AS tiene_certificado
FROM gente g
JOIN talleres t ON t.id = g.taller_id
LEFT JOIN usuarios u ON LOWER(u.email) = g.usuario_email
-- DISTINCT ON por si alguien tuviera más de una fila en lista_espera del mismo
-- taller: gana la más reciente, igual que en el resto del proyecto.
LEFT JOIN LATERAL (
    SELECT le2.estado, le2.asistencia_respuesta
      FROM lista_espera le2
     WHERE LOWER(le2.email) = g.usuario_email AND le2.taller_id = t.id
     ORDER BY le2.created_at DESC LIMIT 1
) le ON TRUE
LEFT JOIN asistencias a ON LOWER(a.usuario_email) = g.usuario_email
                       AND a.taller_id = t.id
-- El vigente manda; si solo hay anulados, se muestra el más reciente para que
-- se vea que hubo uno.
LEFT JOIN LATERAL (
    SELECT c2.id, c2.folio, c2.anulado
      FROM certificados c2
     WHERE LOWER(c2.usuario_email) = g.usuario_email AND c2.taller_id = t.id
     ORDER BY c2.anulado ASC, c2.created_at DESC LIMIT 1
) c ON TRUE;

ALTER VIEW v_asistencia_taller SET (security_invoker = on);
REVOKE ALL ON v_asistencia_taller FROM anon, authenticated;

COMMENT ON VIEW v_asistencia_taller IS
    'Quién tuvo algo que ver con este taller: inscripción pagada, asistencia al
     aula o certificado. Si hay rastro, aparece — aunque no esté en la lista de
     espera. Antes se escondía a quien tenía certificado sin inscripción, y por
     eso ese certificado no se podía anular.';


-- ── Verificar ───────────────────────────────────────────────────────────────
-- Nadie con certificado debe quedar fuera de la vista. Esta consulta tiene que
-- devolver CERO filas.
SELECT c.folio, c.usuario_email, c.taller_id
  FROM certificados c
 WHERE NOT EXISTS (
     SELECT 1 FROM v_asistencia_taller v
      WHERE v.taller_id = c.taller_id
        AND v.usuario_email = LOWER(c.usuario_email));

-- Y aquí sí deben salir todos los certificados que existen hoy.
SELECT taller_nombre, usuario_email, entro, minutos,
       certificado_folio, certificado_anulado
  FROM v_asistencia_taller
 WHERE certificado_folio IS NOT NULL
 ORDER BY taller_nombre;
