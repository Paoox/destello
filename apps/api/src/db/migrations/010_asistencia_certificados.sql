-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 010: asistencia real y certificados
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUÉ (decisión de Paola, 23 ago 2026):
--
-- «Vamos a ver quién entró y quién accedió al taller; esas personas son a las
--  que se les debe liberar el certificado. ¿Por qué? Porque qué pasa con las
--  personas que por X no puedan acceder al taller — no tendrían por qué tener
--  un certificado.»
--
-- Hasta hoy la única señal de asistencia era la DECLARADA (migración 009: el
-- alumno responde "sí voy" en un pop-up). Decir que vas no es haber ido.
-- Certificar con esa señal sería certificar intenciones.
--
-- Esta migración agrega la señal REAL: quién abrió su aula, cuándo, y cuánto
-- tiempo la tuvo abierta. De ahí sale el certificado.
--
-- ── Por qué se guarda tiempo y no solo un "entró" ──────────────────────────
-- Un clic no es asistir: alguien puede abrir el aula, ver que no le late y
-- cerrarla en diez segundos. Guardando el primer y el último latido tenemos
-- cuánto tiempo estuvo presente, que es lo que permite decir con honestidad
-- "esta persona tomó el taller". El umbral NO se guarda aquí: es una decisión
-- de negocio y vive en la API, para poder cambiarlo sin migrar.
--
-- ── Por qué los certificados son una tabla y no un cálculo ──────────────────
-- Un certificado es un hecho, no una consulta. Si se calculara al vuelo,
-- cambiar el umbral mañana le quitaría el certificado a alguien que ya lo
-- descargó y lo compartió. Se emite una vez, queda escrito, y ya nadie se lo
-- quita. Por eso también lleva folio: para poder comprobar que es real.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Datos del taller que aparecen en el certificado ──────────────────────
-- Paola pidió que el certificado lleve el nombre del instructor y las horas.
-- Van en `talleres` y no en el certificado porque son del taller, no de la
-- persona: si se corrige un typo en el nombre del instructor, se corrige una
-- vez. Lo que sí se congela en el certificado es lo que ya se emitió (ver §3).

ALTER TABLE talleres
    ADD COLUMN IF NOT EXISTS instructor      TEXT,
    ADD COLUMN IF NOT EXISTS duracion_horas  NUMERIC(4,1);

COMMENT ON COLUMN talleres.instructor IS
    'Quién imparte. Aparece en el certificado.';

COMMENT ON COLUMN talleres.duracion_horas IS
    'Horas de formación que acredita el certificado. NULL = no se imprime.';


-- ── 2. Asistencia real ──────────────────────────────────────────────────────
-- Una fila por persona y taller. No una por entrada: si alguien se le cae el
-- internet y vuelve a entrar tres veces, sigue siendo una asistencia, no tres.
-- Por eso `entradas` es un contador y no filas sueltas.

CREATE TABLE IF NOT EXISTS asistencias (
    id              SERIAL PRIMARY KEY,
    usuario_email   TEXT NOT NULL,
    taller_id       TEXT NOT NULL REFERENCES talleres(id) ON DELETE CASCADE,
    primera_entrada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultimo_latido   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    entradas        INTEGER     NOT NULL DEFAULT 1,
    minutos         INTEGER     NOT NULL DEFAULT 0,
    origen          TEXT,       -- 'aula' | 'admin' (cuando Paola la agrega a mano)
    nota            TEXT,       -- por qué se agregó a mano; el porqué, no solo el qué
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- El correo se guarda en minúsculas desde la API, pero el índice es funcional
-- por si algún día entra por otro camino: una persona = una asistencia.
CREATE UNIQUE INDEX IF NOT EXISTS asistencias_persona_taller
    ON asistencias (LOWER(usuario_email), taller_id);

CREATE INDEX IF NOT EXISTS asistencias_taller ON asistencias (taller_id);

COMMENT ON TABLE asistencias IS
    'Quién estuvo de verdad en la clase. La alimenta el aula: una entrada al
     abrirla y un latido cada pocos minutos mientras siga abierta.';

COMMENT ON COLUMN asistencias.minutos IS
    'Minutos con el aula abierta. Se acumula desde los latidos, así que un
     cierre de pestaña no lo pierde: lo que ya se contó, ya se contó.';

COMMENT ON COLUMN asistencias.origen IS
    'aula = la persona entró sola. admin = Paola la agregó (se le fue el
     internet, entró desde el celular de alguien más, etc.).';


-- ── 3. Certificados ─────────────────────────────────────────────────────────
-- El nombre y los datos del taller se COPIAN al emitir, no se leen por JOIN.
-- Un certificado dice lo que decía el día que se emitió; si mañana la persona
-- cambia cómo se escribe su nombre, el papel que ya descargó no cambia solo.

CREATE TABLE IF NOT EXISTS certificados (
    id               SERIAL PRIMARY KEY,
    folio            TEXT UNIQUE NOT NULL,
    usuario_email    TEXT NOT NULL,
    taller_id        TEXT NOT NULL REFERENCES talleres(id) ON DELETE CASCADE,
    -- Congelados al emitir:
    nombre           TEXT NOT NULL,   -- como pidió aparecer
    taller_nombre    TEXT NOT NULL,
    instructor       TEXT,
    duracion_horas   NUMERIC(4,1),
    fecha_taller     DATE,
    -- Trazabilidad:
    emitido_por      TEXT,            -- 'automatico' o quién lo emitió a mano
    minutos_presente INTEGER,         -- lo que justificó la emisión
    anulado          BOOLEAN     NOT NULL DEFAULT FALSE,
    anulado_at       TIMESTAMPTZ,
    anulado_motivo   TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS certificados_persona_taller
    ON certificados (LOWER(usuario_email), taller_id);

CREATE INDEX IF NOT EXISTS certificados_taller ON certificados (taller_id);

COMMENT ON TABLE certificados IS
    'Hechos, no consultas. Se emite una vez y queda escrito con los datos de
     ese día. Un certificado emitido no se borra: se anula, y se guarda por qué.';

COMMENT ON COLUMN certificados.folio IS
    'Código verificable, único. Formato DST-<AÑO>-<6 alfanuméricos>.';

COMMENT ON COLUMN certificados.anulado IS
    'Se anula, no se borra. Borrarlo dejaría un folio circulando sin respaldo.';


-- ── 4. Quién merece certificado ─────────────────────────────────────────────
-- La vista NO decide el umbral: expone los minutos y deja que la API ponga la
-- línea. Así Paola puede cambiar de opinión sobre "cuánto es haber asistido"
-- sin tocar la base.
--
-- Solo aparece quien tenía derecho a estar ahí (pagó o traía cortesía viva).

CREATE OR REPLACE VIEW v_asistencia_taller AS
SELECT t.id                             AS taller_id,
       t.nombre                         AS taller_nombre,
       t.fecha_inicio,
       LOWER(le.email)                  AS usuario_email,
       u.nombre,
       u.apellido,
       u.nombre_certificado,
       le.estado,
       (SELECT ch.is_demo FROM chispas ch
         WHERE LOWER(ch.usuario_email) = LOWER(le.email)
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
       (c.id IS NOT NULL AND c.anulado = FALSE) AS tiene_certificado
FROM lista_espera le
JOIN talleres t ON t.id = le.taller_id
LEFT JOIN usuarios u    ON LOWER(u.email) = LOWER(le.email)
LEFT JOIN asistencias a ON LOWER(a.usuario_email) = LOWER(le.email)
                       AND a.taller_id = t.id
LEFT JOIN certificados c ON LOWER(c.usuario_email) = LOWER(le.email)
                        AND c.taller_id = t.id
WHERE le.estado = 'pagado';

ALTER VIEW v_asistencia_taller SET (security_invoker = on);
REVOKE ALL ON v_asistencia_taller FROM anon, authenticated;

COMMENT ON VIEW v_asistencia_taller IS
    'La lista que ve Paola después de cada taller: quién entró, cuánto tiempo,
     y si ya tiene certificado. El umbral lo pone la API, no esta vista.';


-- ── 5. A quién le falta decir su nombre ─────────────────────────────────────
-- Ya existe v_falta_nombre_certificado (005), pero lista a cualquiera. Esta
-- acota a quien ya tiene un certificado por delante: son a los que urge
-- preguntarles, porque el papel sale con el nombre que tengamos ese día.

CREATE OR REPLACE VIEW v_falta_nombre_con_taller AS
SELECT DISTINCT LOWER(le.email) AS email,
       u.nombre,
       u.apellido,
       COUNT(*) OVER (PARTITION BY LOWER(le.email)) AS talleres_pagados
FROM lista_espera le
JOIN usuarios u ON LOWER(u.email) = LOWER(le.email)
WHERE le.estado = 'pagado'
  AND (u.nombre_certificado IS NULL OR BTRIM(u.nombre_certificado) = '');

ALTER VIEW v_falta_nombre_con_taller SET (security_invoker = on);
REVOKE ALL ON v_falta_nombre_con_taller FROM anon, authenticated;


-- ── 6. Mantener updated_at al día ───────────────────────────────────────────
-- Igual que en 003: lo estampa un trigger, no el código. Ningún camino nuevo
-- puede olvidarlo.

CREATE OR REPLACE FUNCTION tocar_asistencia() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tocar_asistencia ON asistencias;
CREATE TRIGGER trg_tocar_asistencia
    BEFORE UPDATE ON asistencias
    FOR EACH ROW EXECUTE FUNCTION tocar_asistencia();


-- ── 7. Seguridad ────────────────────────────────────────────────────────────
-- RLS encendido y CERO políticas = nadie llega por PostgREST. La API entra con
-- service_role, que salta RLS. Mismo criterio que `pagos` en la migración 004.

ALTER TABLE asistencias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificados ENABLE ROW LEVEL SECURITY;


-- ── Verificar ───────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('asistencias', 'certificados');

SELECT column_name FROM information_schema.columns
WHERE table_name = 'talleres' AND column_name IN ('instructor', 'duracion_horas');

SELECT * FROM v_asistencia_taller LIMIT 5;
