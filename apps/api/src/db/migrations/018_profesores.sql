-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 018: tabla de profesores real (T-05)
-- ════════════════════════════════════════════════════════════════════════════
--
-- QUÉ RESUELVE
--
-- Hoy "quién es profe en el aula" lo decide el FRONTEND con una lista fija de
-- un solo correo (`ADMIN_EMAILS` en `apps/web/src/constants.js`), la misma
-- lista que decide quién ve el panel `/admin`. Eso confunde dos cosas que no
-- son la misma: "administra Destello" y "da esta clase en particular". Y para
-- agregar a un profesor nuevo habría que editar y redesplegar el frontend.
--
-- Con esto, "profe de un taller" pasa a ser un dato real en la base,
-- verificado por el SERVIDOR (no el frontend con una lista fija), y por
-- TALLER — alguien puede dar auriculoterapia sin volverse profe de
-- automaquillaje.
--
-- `profesores` es la cuenta ("esta persona puede ser profesora"),
-- `taller_profesores` es la relación (quién da qué taller — muchos a
-- muchos, por si algún taller tiene más de un profesor). Los admins
-- (`ADMIN_EMAILS`) SIGUEN entrando como profe a cualquier aula, sin cambios
-- — esto solo AGREGA la posibilidad de un profesor real sin ser admin.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


CREATE TABLE IF NOT EXISTS profesores (
    usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profesores IS
    'Quién PUEDE ser profesor — la cuenta ya existe en usuarios como
     cualquier otra. No dice qué taller da: eso vive en taller_profesores.';

CREATE TABLE IF NOT EXISTS taller_profesores (
    taller_id  TEXT    NOT NULL REFERENCES talleres(id)   ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES profesores(usuario_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (taller_id, usuario_id)
);

COMMENT ON TABLE taller_profesores IS
    'Quién da qué taller. Muchos a muchos: un profesor puede dar varios
     talleres, y (por si algún día hace falta co-enseñar) un taller puede
     tener más de un profesor.';

CREATE INDEX IF NOT EXISTS idx_taller_profesores_usuario
    ON taller_profesores(usuario_id);


-- ── Verificar ───────────────────────────────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE '✅ Migración 018 completa — profesores y taller_profesores listas';
END $$;

SELECT table_name FROM information_schema.tables
WHERE table_name IN ('profesores', 'taller_profesores') AND table_schema = 'public';
