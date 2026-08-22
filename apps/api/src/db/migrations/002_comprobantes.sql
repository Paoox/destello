-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 002: guardar los comprobantes de pago
-- ════════════════════════════════════════════════════════════════════════════
--
-- Hasta ahora la foto del comprobante solo llegaba al WhatsApp de Paola. Para
-- verla desde el panel hay que guardarla, y para eso hace falta saber dónde
-- quedó dentro de Supabase Storage.
--
-- Se guarda la RUTA, no una URL pública: un comprobante trae nombre, banco y
-- monto, así que el bucket es privado y la API firma una URL temporal (1 h)
-- cada vez que se abre la bandeja.
-- ════════════════════════════════════════════════════════════════════════════


-- ── PASO 1 · La columna ─────────────────────────────────────────────────────

ALTER TABLE reportes_acceso
    ADD COLUMN IF NOT EXISTS comprobante_path TEXT;

COMMENT ON COLUMN reportes_acceso.comprobante_path IS
    'Ruta dentro del bucket privado de Supabase Storage. NULL = sin imagen.';


-- ── PASO 2 · El bucket ──────────────────────────────────────────────────────
--
-- Esto NO se corre como SQL. Hazlo en el dashboard:
--   Storage → New bucket
--     · Name: comprobantes
--     · Public bucket: **DESACTIVADO** ← importante
--   Create bucket
--
-- No hacen falta políticas RLS: la API entra con la service key, que las omite.
-- Justamente por eso el bucket debe quedar privado — así el único camino para
-- ver un comprobante es una URL firmada por la API.


-- ── PASO 3 · Variables de entorno de la API ─────────────────────────────────
--
-- En el .env que usa el contenedor de la API (y en docker-compose si hace falta
-- pasarlas explícitas):
--
--   SUPABASE_URL=https://wqofkllxkrjjifpzsfwm.supabase.co
--   SUPABASE_SERVICE_KEY=<Project Settings → API → service_role secret>
--
-- ⚠️ La service_role key salta TODAS las reglas de seguridad de Supabase.
--    Va solo en el servidor, nunca en el frontend ni en el repo.
--
-- Sin estas variables no truena nada: el reporte se guarda igual, solo sin
-- imagen, y en los logs de la API aparece "Storage sin configurar".


-- ── PASO 4 · Verificar ──────────────────────────────────────────────────────

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'reportes_acceso' AND column_name = 'comprobante_path';
