-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 020: datos de pago de las profesoras (18 nov 2026)
-- ════════════════════════════════════════════════════════════════════════════
--
-- A dónde pagarle a cada profesora: titular, banco, CLABE y/o tarjeta. Los
-- captura ELLA desde su Perfil; Paola los ve en Admin → Profesores para
-- generar los pagos. Uno por profesora.
--
-- Son datos para DEPOSITARLE (como la CLABE que Paola pone en sus propios
-- correos), no para cobrarle. Aun así no se exponen fuera de su Perfil y del
-- panel admin, y la API valida el dígito de control de la CLABE y el de la
-- tarjeta (Luhn) para que un dedazo no mande un pago a otra cuenta.
--
-- Más adelante (pagos pendientes por profe) colgará de aquí.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS profesor_datos_pago (
    usuario_id  INTEGER PRIMARY KEY REFERENCES profesores(usuario_id) ON DELETE CASCADE,
    titular     TEXT NOT NULL,
    banco       TEXT NOT NULL,
    clabe       TEXT,             -- 18 dígitos, validada
    tarjeta     TEXT,             -- 15-16 dígitos, validada (Luhn)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT profesor_datos_pago_algun_dato CHECK (clabe IS NOT NULL OR tarjeta IS NOT NULL)
);

COMMENT ON TABLE profesor_datos_pago IS
    'A dónde depositarle a cada profesora. Lo captura ella en /perfil; Paola lo ve en Admin → Profesores.';
