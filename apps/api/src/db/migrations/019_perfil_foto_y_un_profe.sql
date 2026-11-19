-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 019: foto de perfil + un solo profesor por taller (18 nov 2026)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 1. `usuarios.foto` — la foto de perfil. Guarda o la URL de la foto de
--    Google (se llena sola al entrar con Google, solo si no tenía) o una
--    imagen que la persona subió desde /perfil: el navegador la recorta a
--    256×256 y la manda como data URL webp/jpeg (~20-60 KB). La API rechaza
--    cualquier cosa que no sea imagen o pese más de 300 KB.
--
-- 2. Un taller lo da UNA profesora. Hasta hoy `taller_profesores` permitía
--    varias por taller (llave = taller + profesora). Paola decidió que no:
--    si un taller ya tiene profe, no se le puede asignar a nadie más hasta
--    quitarla en el panel. La API ya lo valida con un mensaje claro; este
--    índice es la red de seguridad por si dos asignaciones llegan a la vez.
--    Verificado antes de crearlo: ningún taller tenía dos profesoras.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto TEXT;

COMMENT ON COLUMN usuarios.foto IS
    'Foto de perfil: URL (Google) o data URL de imagen chica subida en /perfil.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_taller_profesores_un_profe
    ON taller_profesores (taller_id);
