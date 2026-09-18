-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 015: usuario_id en chispas y lista_espera (T-13, PASO 1 de 4)
-- ════════════════════════════════════════════════════════════════════════════
--
-- QUÉ RESUELVE
--
-- Hoy `chispas` y `lista_espera` se relacionan con un usuario por su CORREO
-- (texto), no por un id. Eso trae tres problemas:
--   · Si alguien cambia de correo, se rompe la cadena — sus chispas y su
--     historial en lista de espera quedan huérfanos.
--   · Cada consulta tiene que comparar con LOWER(email) = LOWER($1) para no
--     fallar por mayúsculas — repetitivo y fácil de olvidar en una query nueva.
--   · Comparar texto es más lento que comparar un id indexado.
--
-- Lo correcto es relacionar por `usuario_id` (FK a `usuarios.id`). Esta
-- migración es SOLO el primer paso de 4 (ver docs/backlog-tickets.md, T-13):
--
--   1. [ESTA MIGRACIÓN] Agregar `usuario_id` nullable a las dos tablas.
--   2. Rellenarlo desde el correo actual (`UPDATE ... FROM usuarios WHERE
--      LOWER(email) = LOWER(...)`) — migración aparte.
--   3. Migrar las consultas de los servicios una por una, dejando el email
--      como respaldo mientras se verifica cada una.
--   4. Recién entonces: `NOT NULL` y quitar `chispas_usuario_email_fkey`.
--
-- ⚠️ NO HACERLO DE UN TIRÓN. Con esta migración sola, `usuario_id` queda
-- agregado pero VACÍO (NULL en todas las filas existentes) — ningún código
-- lo lee ni lo escribe todavía. `chispas.usuario_email` sigue siendo la
-- relación real hasta que se complete el paso 4. La FK vieja
-- (`chispas_usuario_email_fkey`) NO se toca aquí.
--
-- Por qué el mismo id (INTEGER) que `usuarios.id`: `usuarios.id` es
-- SERIAL (INTEGER), no UUID — hay que hacer match con el tipo real de la
-- columna, no con lo que uno asumiría por costumbre.

ALTER TABLE chispas
    ADD COLUMN IF NOT EXISTS usuario_id INTEGER
        REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE lista_espera
    ADD COLUMN IF NOT EXISTS usuario_id INTEGER
        REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;

COMMENT ON COLUMN chispas.usuario_id IS
    'T-13, paso 1 de 4 (18 sep 2026): columna nueva, todavía sin poblar ni
     usada por ningún código. La relación real sigue siendo usuario_email
     hasta que se complete la migración por etapas — ver docs/backlog-tickets.md.';
COMMENT ON COLUMN lista_espera.usuario_id IS
    'T-13, paso 1 de 4 (18 sep 2026): columna nueva, todavía sin poblar ni
     usada por ningún código. La relación real sigue siendo email hasta que
     se complete la migración por etapas — ver docs/backlog-tickets.md.';

-- Nullable hoy, pero ya se puede indexar: los JOINs del paso 3 la van a usar.
CREATE INDEX IF NOT EXISTS idx_chispas_usuario_id       ON chispas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_lista_espera_usuario_id  ON lista_espera(usuario_id);
