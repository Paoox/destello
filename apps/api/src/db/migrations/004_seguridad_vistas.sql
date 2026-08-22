-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 004: cerrar las vistas de métricas al público
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUÉ:
-- La migración 003 creó cinco vistas (v_embudo, v_alertas, etc.) y el Advisor
-- de Supabase las marcó como CRITICAL — "Security Definer View". Con razón.
--
-- Qué significa, en corto:
-- Supabase expone automáticamente TODO lo que vive en el esquema `public` a
-- través de su API REST, usando dos roles: `anon` (cualquiera con la llave
-- pública) y `authenticated`. Una vista creada por el dueño de la BD corre con
-- los permisos del dueño, no con los de quien pregunta — así que salta
-- cualquier regla de seguridad de las tablas de abajo.
--
-- Traducción a tu caso: `v_alertas` devuelve correos y WhatsApp de tus alumnos,
-- y `v_metricas_taller` devuelve tus ingresos. Quedaron alcanzables por la API
-- pública de Supabase.
--
-- LA BUENA NOTICIA: tu API no las necesita por ahí. Se conecta directo a
-- PostgreSQL con su propio usuario (Session pooler), no por la API REST de
-- Supabase. Así que se le puede quitar el acceso a `anon` sin romper nada.
--
-- QUÉ HACE ESTA MIGRACIÓN:
--   1. Pone las vistas en modo `security_invoker` — respetan los permisos de
--      quien pregunta, no los del dueño.
--   2. Le quita el acceso a `anon` y `authenticated` sobre las vistas y sobre
--      las tablas nuevas (pagos, eventos, bot_conversaciones).
--   3. Te muestra un reporte de qué tablas tienen RLS y cuáles no.
--
-- Correr completo en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 1 · Las vistas respetan al que pregunta, no al dueño
-- ════════════════════════════════════════════════════════════════════════════

ALTER VIEW v_embudo           SET (security_invoker = on);
ALTER VIEW v_tiempos_embudo   SET (security_invoker = on);
ALTER VIEW v_metricas_taller  SET (security_invoker = on);
ALTER VIEW v_actividad_diaria SET (security_invoker = on);
ALTER VIEW v_alertas          SET (security_invoker = on);


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 2 · Quitarle el acceso al público
-- ════════════════════════════════════════════════════════════════════════════
-- Estas vistas y tablas son solo para el panel de administración, que las lee
-- por medio de la API con conexión directa a Postgres. Nadie más las necesita.

REVOKE ALL ON v_embudo           FROM anon, authenticated;
REVOKE ALL ON v_tiempos_embudo   FROM anon, authenticated;
REVOKE ALL ON v_metricas_taller  FROM anon, authenticated;
REVOKE ALL ON v_actividad_diaria FROM anon, authenticated;
REVOKE ALL ON v_alertas          FROM anon, authenticated;

-- Las tablas nuevas traen datos sensibles: montos, comprobantes, teléfonos.
REVOKE ALL ON pagos              FROM anon, authenticated;
REVOKE ALL ON eventos            FROM anon, authenticated;
REVOKE ALL ON bot_conversaciones FROM anon, authenticated;

-- Y sus secuencias, para que nadie pueda insertar.
REVOKE ALL ON SEQUENCE pagos_id_seq   FROM anon, authenticated;
REVOKE ALL ON SEQUENCE eventos_id_seq FROM anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 3 · Candado por si acaso: activar RLS sin políticas
-- ════════════════════════════════════════════════════════════════════════════
-- RLS con CERO políticas = nadie pasa, salvo el dueño de la tabla y los roles
-- con BYPASSRLS (que es como entra tu API). Es el cinturón además del tirante:
-- aunque un día alguien vuelva a dar permisos por error, la puerta sigue
-- cerrada.
--
-- ⚠️ Esto NO afecta a tu API: se conecta como el usuario dueño de la BD.
--    Si algún día mueves el panel a leer por la API REST de Supabase, aquí es
--    donde habría que escribir políticas.

ALTER TABLE pagos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_conversaciones ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 4 · Reporte: ¿qué más está abierto?
-- ════════════════════════════════════════════════════════════════════════════
-- Esto NO cambia nada, solo te enseña la foto. Revisa la columna `riesgo`.
--
-- Las tablas viejas (usuarios, chispas, lista_espera...) traen correos,
-- teléfonos y códigos. Si aparecen como 'ABIERTA AL PÚBLICO', cualquiera con
-- la llave anon de tu proyecto podría leerlas por la API REST de Supabase.

SELECT
    c.relname                                   AS tabla,
    CASE WHEN c.relrowsecurity THEN 'sí' ELSE 'NO' END AS rls_activo,
    COALESCE(
        (SELECT COUNT(*)::text FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = c.relname), '0'
    )                                           AS politicas,
    CASE
        WHEN has_table_privilege('anon', c.oid, 'SELECT') AND NOT c.relrowsecurity
             THEN '🔴 ABIERTA AL PÚBLICO'
        WHEN has_table_privilege('anon', c.oid, 'SELECT')
             THEN '🟡 anon tiene permiso, pero RLS filtra'
        ELSE '🟢 cerrada a anon'
    END                                         AS riesgo
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY
    CASE
        WHEN has_table_privilege('anon', c.oid, 'SELECT') AND NOT c.relrowsecurity THEN 1
        WHEN has_table_privilege('anon', c.oid, 'SELECT') THEN 2
        ELSE 3
    END,
    c.relname;


-- ── Y las vistas, para confirmar que quedaron cerradas ──────────────────────
SELECT
    c.relname AS vista,
    CASE WHEN has_table_privilege('anon', c.oid, 'SELECT')
         THEN '🔴 anon todavía puede leerla' ELSE '🟢 cerrada' END AS estado_anon,
    CASE WHEN array_to_string(c.reloptions, ',') ILIKE '%security_invoker=on%'
         THEN 'sí' ELSE 'NO' END AS security_invoker
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v' AND c.relname LIKE 'v\_%'
ORDER BY c.relname;
