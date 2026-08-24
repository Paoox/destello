-- ════════════════════════════════════════════════════════════════════════════
-- Destello — datos que el certificado imprime
-- Correr en: Supabase → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════════════════
--
-- El certificado copia estos datos EN EL MOMENTO DE EMITIR. Los certificados
-- que ya se emitieron NO cambian con esto — conservan lo que decían ese día.
-- Si quieres corregir uno viejo: anúlalo desde el panel y vuélvelo a emitir.

-- Todos los talleres duran 4 horas.
ALTER TABLE talleres ALTER COLUMN duracion_horas SET DEFAULT 4;
UPDATE talleres SET duracion_horas = 4 WHERE duracion_horas IS NULL;

-- 👇 CAMBIA el nombre por el que quieres que aparezca firmando.
UPDATE talleres SET instructor = 'Paola Arreola' WHERE instructor IS NULL;

-- Verificar
SELECT id, nombre, instructor, duracion_horas FROM talleres ORDER BY fecha_inicio;
