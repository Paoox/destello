-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 024: imágenes en el seguimiento de reportes (19 nov 2026)
-- ════════════════════════════════════════════════════════════════════════════
--
-- La persona (o Paola) puede adjuntar una captura con el clip 📎 en cada
-- mensaje del seguimiento. La imagen vive en Supabase Storage (bucket
-- PRIVADO, carpeta soporte/); aquí solo se guarda la RUTA y se firma una URL
-- temporal al mostrarla, igual que los comprobantes de pago.
--
-- La imagen del reporte inicial usa la columna que ya existía:
-- reportes_acceso.comprobante_path.
--
-- Aditiva e idempotente.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE reporte_respuestas ADD COLUMN IF NOT EXISTS imagen_path TEXT;
