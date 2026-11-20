-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 027: Supernovas (moneda) + Hábitat (casa de cada persona)
-- 19 nov 2026, decisión de Paola
-- ════════════════════════════════════════════════════════════════════════════
--
-- Supernovas = la moneda de Destello. Se ganan al COMPRAR un taller (100,
-- pago confirmado, sin cortesías) y por referidos (50). Se gastan en muebles
-- y estilos del Hábitat. El catálogo vive en código (habitatCatalogo.js).
--
--   supernovas_movimientos  libro mayor append-only; el saldo es la SUMA.
--                           (motivo, ref) único por persona → acreditar dos
--                           veces lo mismo es imposible.
--   habitat_objetos         lo que cada persona ya compró.
--   habitat_casa            qué tiene puesto en cada lugar (también pared y piso).
--
-- Retroactivo (decisión de Paola): 100 por cada taller ya pagado (una vez por
-- persona y taller) y las Estrellas que ya existían pasan a Supernovas 1:1.
-- La tabla vieja `supernovas` (premios) y `usuarios.estrellas` no se tocan.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS supernovas_movimientos (
    id          BIGSERIAL PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    cantidad    INTEGER NOT NULL CHECK (cantidad <> 0),
    motivo      TEXT    NOT NULL CHECK (motivo IN ('taller', 'referido', 'compra', 'ajuste', 'estrellas')),
    ref         TEXT    NOT NULL,
    detalle     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, motivo, ref)
);
CREATE INDEX IF NOT EXISTS idx_supernovas_mov_usuario ON supernovas_movimientos(usuario_id, created_at DESC);

CREATE TABLE IF NOT EXISTS habitat_objetos (
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    objeto_id   TEXT    NOT NULL,
    comprado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usuario_id, objeto_id)
);

CREATE TABLE IF NOT EXISTS habitat_casa (
    usuario_id  INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    puestos     JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { lugar: objeto_id } (pared y piso incluidos)
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Retroactivo: talleres ya pagados (sin cortesías), una vez por persona+taller
INSERT INTO supernovas_movimientos (usuario_id, cantidad, motivo, ref, detalle, created_at)
SELECT DISTINCT ON (u.id, le.taller_id)
       u.id, 100, 'taller', 'le-' || le.id, t.nombre, le.pagado_at
  FROM lista_espera le
  JOIN usuarios u ON u.id = le.usuario_id OR (le.usuario_id IS NULL AND LOWER(u.email) = LOWER(le.email))
  LEFT JOIN talleres t ON t.id = le.taller_id
 WHERE le.pagado_at IS NOT NULL
   AND NOT (
       EXISTS (SELECT 1 FROM pagos p WHERE p.lista_espera_id = le.id AND p.metodo = 'cortesia')
       AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.lista_espera_id = le.id
                         AND p.estado = 'verificado' AND COALESCE(p.metodo, '') <> 'cortesia'
                         AND COALESCE(p.monto, 0) > 0))
 ORDER BY u.id, le.taller_id, le.pagado_at
ON CONFLICT DO NOTHING;

-- ── Retroactivo: Estrellas → Supernovas (1:1)
INSERT INTO supernovas_movimientos (usuario_id, cantidad, motivo, ref, detalle)
SELECT id, estrellas, 'estrellas', 'migracion-027', 'Tus Estrellas ahora son Supernovas'
  FROM usuarios WHERE COALESCE(estrellas, 0) > 0
ON CONFLICT DO NOTHING;
