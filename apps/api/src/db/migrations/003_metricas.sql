-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 003: métricas del embudo, pagos y bitácora de eventos
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUÉ:
-- Hoy no se puede responder ninguna de estas preguntas con la BD:
--   · ¿Cuánta gente entró al bot y cuánta terminó pagando?
--   · ¿Cuánto tarda alguien de "pendiente" a "pagado"?
--   · ¿Cuánto dinero entró este mes y por qué taller?
--   · ¿En qué paso del bot se cae la gente?
--   · ¿Cuántos usuarios activos entran de verdad a la plataforma?
--
-- La razón es que los cambios de estado se hacen con `UPDATE ... SET estado`
-- a secas: se sabe DÓNDE está cada quien, pero no CUÁNDO llegó ahí ni por
-- dónde pasó. Un estado sin fecha no es una métrica, es una foto.
--
-- CÓMO ESTÁ RESUELTO:
-- Las fechas NO se escriben desde la API — se estampan con TRIGGERS en la BD.
-- Es a propósito: hoy hay tres rutas distintas que activan a un usuario y dos
-- que lo marcan como pagado. Si cada una tuviera que acordarse de escribir la
-- fecha, tarde o temprano una se olvida y la métrica miente. Con el trigger,
-- da igual quién haga el UPDATE: la fecha siempre queda.
--
-- SEGURIDAD DE ESTA MIGRACIÓN:
--   · Es 100% ADITIVA. No borra ni renombra nada. No rompe el código actual.
--   · Es idempotente: se puede correr dos veces sin miedo.
--   · Hace backfill de lo que sí se puede reconstruir del pasado.
--
-- Correr completo en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 1 · Fechas de transición en lista_espera
-- ════════════════════════════════════════════════════════════════════════════
-- El embudo completo de una inscripción vive en esta tabla. Sin estas cuatro
-- fechas no hay forma de medir tiempos ni conversión.

ALTER TABLE lista_espera
    ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS confirmado_at   TIMESTAMPTZ,  -- pasó a cupo_confirmado
    ADD COLUMN IF NOT EXISTS pagado_at       TIMESTAMPTZ,  -- pasó a pagado
    ADD COLUMN IF NOT EXISTS rechazado_at    TIMESTAMPTZ,  -- pasó a rechazado / liberado
    ADD COLUMN IF NOT EXISTS origen          TEXT,         -- bot | web | admin
    ADD COLUMN IF NOT EXISTS confirmado_por  TEXT,         -- quién confirmó el cupo
    ADD COLUMN IF NOT EXISTS pagado_por      TEXT;         -- quién validó el pago

COMMENT ON COLUMN lista_espera.origen IS
    'Por dónde llegó esta inscripción: bot (WhatsApp) | web (Habitat) | admin (alta manual)';


-- ── Backfill: recuperar lo que sí se puede del pasado ───────────────────────
-- El panel ya derivaba la fecha de apartado desde chispas.created_at
-- (routes/admin.js). Se usa el mismo criterio para no inventar datos nuevos.

UPDATE lista_espera le
SET pagado_at = c.created_at
FROM (
    SELECT usuario_email, taller_id, MIN(created_at) AS created_at
    FROM chispas
    WHERE revoked = FALSE
    GROUP BY usuario_email, taller_id
) c
WHERE le.pagado_at IS NULL
  AND le.estado = 'pagado'
  AND LOWER(le.email) = LOWER(c.usuario_email)
  AND le.taller_id    = c.taller_id;

-- Lo que sigue sin fecha pero ya está en un estado avanzado: se marca con la
-- fecha de creación como piso, para que no cuente como "nunca pasó".
UPDATE lista_espera
SET confirmado_at = COALESCE(confirmado_at, created_at)
WHERE estado IN ('cupo_confirmado', 'confirmado', 'pagado');

UPDATE lista_espera
SET pagado_at = COALESCE(pagado_at, created_at)
WHERE estado = 'pagado';


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 2 · Fechas de ciclo de vida en usuarios
-- ════════════════════════════════════════════════════════════════════════════
-- Hoy no se sabe cuándo una cuenta pasó a 'activo' — ni siquiera se toca
-- updated_at en dos de las tres rutas que la activan.

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS activado_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS activado_por     TEXT,        -- admin | sistema | pago
    ADD COLUMN IF NOT EXISTS origen           TEXT,        -- bot | google | web | admin
    ADD COLUMN IF NOT EXISTS primer_login_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ultimo_login_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS total_logins     INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS metodo_login     TEXT;        -- google | whatsapp | password

COMMENT ON COLUMN usuarios.activado_at IS
    'Cuándo Paola le dio permiso de entrar (estado espera -> activo). Lo estampa un trigger.';
COMMENT ON COLUMN usuarios.primer_login_at IS
    'Primera vez que entró de verdad. activado_at sin primer_login_at = pagó y nunca entró.';

-- Backfill: los que ya están activos, con lo más cercano que hay.
UPDATE usuarios
SET activado_at  = COALESCE(activado_at, updated_at, created_at),
    activado_por = COALESCE(activado_por, 'backfill')
WHERE estado = 'activo' AND activado_at IS NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 3 · Tabla de pagos
-- ════════════════════════════════════════════════════════════════════════════
-- Hoy el dinero NO existe como dato: el monto, el banco y el folio viven
-- concatenados como texto libre dentro de reportes_acceso.detalle. Así no se
-- puede sumar, ni filtrar por taller, ni sacar un corte del mes.
--
-- Un pago es una entidad propia: tiene monto, método, quién lo verificó y
-- cuándo. Esto también es la base para cuando entre Stripe/Conekta.

CREATE TABLE IF NOT EXISTS pagos (
    id               SERIAL PRIMARY KEY,
    usuario_email    TEXT,                          -- sin FK: puede reportar antes de tener cuenta
    lista_espera_id  INTEGER REFERENCES lista_espera(id) ON DELETE SET NULL,
    taller_id        TEXT    REFERENCES talleres(id)     ON UPDATE CASCADE ON DELETE SET NULL,

    monto            NUMERIC(10,2),
    moneda           TEXT DEFAULT 'MXN',
    metodo           TEXT,                          -- transferencia | efectivo | tarjeta | cortesia
    banco            TEXT,
    titular          TEXT,
    folio            TEXT,
    fecha_pago       TIMESTAMPTZ,                   -- cuándo dice el usuario que pagó
    comprobante_path TEXT,                          -- ruta en el bucket privado

    estado           TEXT DEFAULT 'reportado',      -- reportado | verificado | rechazado
    verificado_por   TEXT,
    verificado_at    TIMESTAMPTZ,
    nota             TEXT,                          -- el PORQUÉ de la decisión

    origen           TEXT DEFAULT 'bot',            -- bot | admin | pasarela
    reporte_id       INTEGER,                       -- liga al reporte del bot que lo originó
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE  pagos IS 'Un renglón por pago reportado. Es la fuente de verdad del dinero.';
COMMENT ON COLUMN pagos.nota IS
    'Por qué se aceptó o rechazó. Cuando los agentes tomen esta decisión, aprenden de aquí.';

CREATE INDEX IF NOT EXISTS idx_pagos_email   ON pagos(usuario_email);
CREATE INDEX IF NOT EXISTS idx_pagos_taller  ON pagos(taller_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado  ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha   ON pagos(created_at);


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 4 · Bitácora de eventos
-- ════════════════════════════════════════════════════════════════════════════
-- Esta es la pieza que evita tener que migrar la BD cada vez que quieras medir
-- algo nuevo. Una sola tabla append-only: cada cosa que pasa deja un renglón.
--
-- Con esto puedes contestar preguntas que hoy ni te has hecho, sin tocar el
-- esquema otra vez. Y es la memoria que van a leer los agentes cuando empiecen
-- a tomar decisiones: qué pasó, cuándo, y con qué contexto.

CREATE TABLE IF NOT EXISTS eventos (
    id             BIGSERIAL PRIMARY KEY,
    tipo           TEXT NOT NULL,          -- ver catálogo abajo
    usuario_email  TEXT,
    taller_id      TEXT,
    origen         TEXT,                   -- bot | web | admin | sistema
    actor          TEXT,                   -- quién lo provocó (email, 'admin', 'sistema')
    metadata       JSONB DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE eventos IS
    'Bitácora append-only. Nunca se hace UPDATE ni DELETE aquí. Catálogo de tipos:
     bot_conversacion_inicio · bot_menu_opcion · bot_registro_completo
     lista_espera_alta · cupo_confirmado · pago_reportado · pago_verificado
     usuario_activado · login · taller_asignado · taller_abierto
     chispa_creada · chispa_revocada · reporte_abierto · reporte_resuelto';

CREATE INDEX IF NOT EXISTS idx_eventos_tipo    ON eventos(tipo);
CREATE INDEX IF NOT EXISTS idx_eventos_email   ON eventos(usuario_email);
CREATE INDEX IF NOT EXISTS idx_eventos_fecha   ON eventos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_taller  ON eventos(taller_id);
-- Índice GIN para poder filtrar por dentro del JSON sin escanear toda la tabla
CREATE INDEX IF NOT EXISTS idx_eventos_meta    ON eventos USING GIN (metadata);


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 5 · Conversaciones del bot
-- ════════════════════════════════════════════════════════════════════════════
-- Hoy el estado de la conversación vive en un Map() en memoria (flujo.js).
-- Dos consecuencias:
--   1. Si el bot se reinicia, todos pierden su conversación a media captura.
--      Eso no es solo una métrica faltante, es una mala experiencia real.
--   2. No hay forma de saber en qué paso se cae la gente.

CREATE TABLE IF NOT EXISTS bot_conversaciones (
    jid            TEXT PRIMARY KEY,       -- identificador de WhatsApp
    whatsapp       TEXT,                   -- 10 dígitos, cuando se puede extraer
    email          TEXT,
    paso           TEXT,                   -- PASO.* actual
    datos          JSONB DEFAULT '{}'::jsonb,
    ultimo_menu    TEXT,
    mensajes       INTEGER DEFAULT 0,
    completada     BOOLEAN DEFAULT FALSE,  -- llegó hasta lista de espera
    abandonada_en  TEXT,                   -- último paso si se quedó a medias
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_conv_email  ON bot_conversaciones(email);
CREATE INDEX IF NOT EXISTS idx_bot_conv_fecha  ON bot_conversaciones(created_at);


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 6 · Triggers — las fechas se estampan solas
-- ════════════════════════════════════════════════════════════════════════════
-- Esta es la parte importante. La API NO tiene que acordarse de nada.

-- ── 6.1 · updated_at genérico ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION destello_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lista_espera_touch ON lista_espera;
CREATE TRIGGER trg_lista_espera_touch
    BEFORE UPDATE ON lista_espera
    FOR EACH ROW EXECUTE FUNCTION destello_touch_updated_at();

DROP TRIGGER IF EXISTS trg_pagos_touch ON pagos;
CREATE TRIGGER trg_pagos_touch
    BEFORE UPDATE ON pagos
    FOR EACH ROW EXECUTE FUNCTION destello_touch_updated_at();

DROP TRIGGER IF EXISTS trg_bot_conv_touch ON bot_conversaciones;
CREATE TRIGGER trg_bot_conv_touch
    BEFORE UPDATE ON bot_conversaciones
    FOR EACH ROW EXECUTE FUNCTION destello_touch_updated_at();


-- ── 6.2 · lista_espera: estampar la fecha de cada transición ───────────────
-- Da igual si el cambio viene del selector del panel, del botón "Confirmar
-- pago" o de un script: la fecha queda y el evento se registra.

CREATE OR REPLACE FUNCTION destello_lista_espera_transicion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN

        IF NEW.estado IN ('cupo_confirmado', 'confirmado') AND NEW.confirmado_at IS NULL THEN
            NEW.confirmado_at := NOW();
        END IF;

        IF NEW.estado = 'pagado' AND NEW.pagado_at IS NULL THEN
            NEW.pagado_at := NOW();
            -- si nunca se marcó el cupo, se asume que se confirmó junto con el pago
            IF NEW.confirmado_at IS NULL THEN
                NEW.confirmado_at := NOW();
            END IF;
        END IF;

        IF NEW.estado = 'rechazado' AND NEW.rechazado_at IS NULL THEN
            NEW.rechazado_at := NOW();
        END IF;

        INSERT INTO eventos (tipo, usuario_email, taller_id, origen, metadata)
        VALUES (
            'lista_espera_' || NEW.estado,
            LOWER(NEW.email),
            NEW.taller_id,
            'sistema',
            jsonb_build_object(
                'estado_anterior', OLD.estado,
                'estado_nuevo',    NEW.estado,
                'lista_espera_id', NEW.id
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lista_espera_transicion ON lista_espera;
CREATE TRIGGER trg_lista_espera_transicion
    BEFORE UPDATE ON lista_espera
    FOR EACH ROW EXECUTE FUNCTION destello_lista_espera_transicion();


-- ── 6.3 · lista_espera: registrar el alta ──────────────────────────────────
CREATE OR REPLACE FUNCTION destello_lista_espera_alta()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO eventos (tipo, usuario_email, taller_id, origen, metadata)
    VALUES ('lista_espera_alta', LOWER(NEW.email), NEW.taller_id,
            COALESCE(NEW.origen, 'desconocido'),
            jsonb_build_object('lista_espera_id', NEW.id));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lista_espera_alta ON lista_espera;
CREATE TRIGGER trg_lista_espera_alta
    AFTER INSERT ON lista_espera
    FOR EACH ROW EXECUTE FUNCTION destello_lista_espera_alta();


-- ── 6.4 · usuarios: estampar la activación ─────────────────────────────────
-- Cierra el hueco de las tres rutas que activan sin dejar rastro.

CREATE OR REPLACE FUNCTION destello_usuario_activacion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado = 'activo' AND OLD.estado IS DISTINCT FROM 'activo' THEN
        IF NEW.activado_at IS NULL THEN
            NEW.activado_at := NOW();
        END IF;
        NEW.updated_at := NOW();

        INSERT INTO eventos (tipo, usuario_email, origen, metadata)
        VALUES ('usuario_activado', LOWER(NEW.email), 'sistema',
                jsonb_build_object('estado_anterior', OLD.estado,
                                   'activado_por', COALESCE(NEW.activado_por, 'desconocido')));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuario_activacion ON usuarios;
CREATE TRIGGER trg_usuario_activacion
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION destello_usuario_activacion();


-- ── 6.5 · pagos: registrar verificación ────────────────────────────────────
CREATE OR REPLACE FUNCTION destello_pago_verificado()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado IS DISTINCT FROM OLD.estado
       AND NEW.estado IN ('verificado', 'rechazado') THEN
        IF NEW.verificado_at IS NULL THEN
            NEW.verificado_at := NOW();
        END IF;
        INSERT INTO eventos (tipo, usuario_email, taller_id, origen, actor, metadata)
        VALUES ('pago_' || NEW.estado, LOWER(NEW.usuario_email), NEW.taller_id,
                'admin', NEW.verificado_por,
                jsonb_build_object('monto', NEW.monto, 'metodo', NEW.metodo,
                                   'nota', NEW.nota, 'pago_id', NEW.id));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pago_verificado ON pagos;
CREATE TRIGGER trg_pago_verificado
    BEFORE UPDATE ON pagos
    FOR EACH ROW EXECUTE FUNCTION destello_pago_verificado();


-- ── 6.6 · chispas: guardar CUÁNDO se revocó ────────────────────────────────
-- La columna revoked_at existe desde el principio y nunca se ha escrito:
-- hay tres lugares que revocan y ninguno la llena.

CREATE OR REPLACE FUNCTION destello_chispa_revocada()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.revoked = TRUE AND OLD.revoked IS DISTINCT FROM TRUE THEN
        IF NEW.revoked_at IS NULL THEN
            NEW.revoked_at := NOW();
        END IF;
        INSERT INTO eventos (tipo, usuario_email, taller_id, origen, metadata)
        VALUES ('chispa_revocada', LOWER(NEW.usuario_email), NEW.taller_id, 'admin',
                jsonb_build_object('code', NEW.code));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chispa_revocada ON chispas;
CREATE TRIGGER trg_chispa_revocada
    BEFORE UPDATE ON chispas
    FOR EACH ROW EXECUTE FUNCTION destello_chispa_revocada();


-- ── 6.7 · chispas: registrar la creación (= taller asignado) ───────────────
CREATE OR REPLACE FUNCTION destello_chispa_creada()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO eventos (tipo, usuario_email, taller_id, origen, metadata)
    VALUES ('taller_asignado', LOWER(NEW.usuario_email), NEW.taller_id, 'admin',
            jsonb_build_object('code', NEW.code, 'is_demo', NEW.is_demo,
                               'expires_at', NEW.expires_at));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chispa_creada ON chispas;
CREATE TRIGGER trg_chispa_creada
    AFTER INSERT ON chispas
    FOR EACH ROW EXECUTE FUNCTION destello_chispa_creada();


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 7 · Vistas del dashboard
-- ════════════════════════════════════════════════════════════════════════════
-- El panel consulta estas vistas en vez de armar el SQL a mano. Si cambia el
-- cálculo, se cambia aquí y todo el panel se entera.

-- ── 7.1 · Embudo global ────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_embudo AS
SELECT
    (SELECT COUNT(*)                       FROM bot_conversaciones)                     AS conversaciones_bot,
    (SELECT COUNT(*)                       FROM bot_conversaciones WHERE completada)    AS bot_completadas,
    (SELECT COUNT(*)                       FROM usuarios)                               AS usuarios_registrados,
    (SELECT COUNT(*)                       FROM lista_espera)                           AS inscripciones,
    (SELECT COUNT(*)                       FROM lista_espera WHERE confirmado_at IS NOT NULL) AS cupos_confirmados,
    (SELECT COUNT(*)                       FROM lista_espera WHERE pagado_at    IS NOT NULL) AS pagados,
    (SELECT COUNT(*)                       FROM usuarios WHERE estado = 'activo')        AS cuentas_activas,
    (SELECT COUNT(*)                       FROM usuarios WHERE primer_login_at IS NOT NULL) AS entraron_alguna_vez,
    (SELECT COALESCE(SUM(monto), 0)        FROM pagos WHERE estado = 'verificado')       AS ingresos_verificados;

COMMENT ON VIEW v_embudo IS
    'Una sola fila con el embudo completo. La diferencia entre cuentas_activas y
     entraron_alguna_vez es la métrica más importante: gente que pagó y nunca entró.';


-- ── 7.2 · Tiempos del embudo (qué tan rápido se mueve la gente) ────────────
CREATE OR REPLACE VIEW v_tiempos_embudo AS
SELECT
    taller_id,
    COUNT(*) FILTER (WHERE confirmado_at IS NOT NULL) AS n_confirmados,
    COUNT(*) FILTER (WHERE pagado_at     IS NOT NULL) AS n_pagados,
    ROUND(AVG(EXTRACT(EPOCH FROM (confirmado_at - created_at))   / 3600)::numeric, 1) AS horas_alta_a_cupo,
    ROUND(AVG(EXTRACT(EPOCH FROM (pagado_at     - confirmado_at))/ 3600)::numeric, 1) AS horas_cupo_a_pago,
    ROUND(AVG(EXTRACT(EPOCH FROM (pagado_at     - created_at))   / 3600)::numeric, 1) AS horas_alta_a_pago
FROM lista_espera
GROUP BY taller_id;


-- ── 7.3 · Métricas por taller ──────────────────────────────────────────────
CREATE OR REPLACE VIEW v_metricas_taller AS
SELECT
    t.id,
    t.nombre,
    t.precio,
    t.cupo_maximo,
    COUNT(le.id)                                                      AS en_lista,
    COUNT(le.id) FILTER (WHERE le.estado = 'pendiente')               AS pendientes,
    COUNT(le.id) FILTER (WHERE le.confirmado_at IS NOT NULL)          AS confirmados,
    COUNT(le.id) FILTER (WHERE le.pagado_at     IS NOT NULL)          AS pagados,
    COUNT(le.id) FILTER (WHERE le.estado = 'rechazado')               AS rechazados,
    -- Cupo ocupado = pagados + cortesías vigentes. Las demos SÍ cuentan.
    (SELECT COUNT(*) FROM chispas c
      WHERE c.taller_id = t.id AND c.revoked = FALSE
        AND (c.expires_at IS NULL OR c.expires_at > NOW()))           AS cupo_ocupado,
    GREATEST(t.cupo_maximo - (SELECT COUNT(*) FROM chispas c
      WHERE c.taller_id = t.id AND c.revoked = FALSE
        AND (c.expires_at IS NULL OR c.expires_at > NOW())), 0)       AS lugares_libres,
    ROUND(100.0 * COUNT(le.id) FILTER (WHERE le.pagado_at IS NOT NULL)
          / NULLIF(COUNT(le.id), 0), 1)                               AS tasa_conversion,
    COALESCE((SELECT SUM(p.monto) FROM pagos p
               WHERE p.taller_id = t.id AND p.estado = 'verificado'), 0) AS ingresos
FROM talleres t
LEFT JOIN lista_espera le ON le.taller_id = t.id
GROUP BY t.id, t.nombre, t.precio, t.cupo_maximo;

COMMENT ON VIEW v_metricas_taller IS
    'cupo_ocupado incluye las chispas demo a propósito: una cortesía ocupa un
     lugar real en el salón igual que un pago.';


-- ── 7.4 · Altas por día (para las gráficas) ────────────────────────────────
CREATE OR REPLACE VIEW v_actividad_diaria AS
SELECT
    (created_at AT TIME ZONE 'America/Mexico_City')::date AS dia,
    tipo,
    COUNT(*) AS total
FROM eventos
GROUP BY 1, 2
ORDER BY 1 DESC, 2;


-- ── 7.5 · Alertas: lo que necesita atención de Paola ───────────────────────
-- Esta vista es la que debería mandar el panel a la parte de arriba.
CREATE OR REPLACE VIEW v_alertas AS
-- Pagó pero su cuenta sigue en espera (el desfase que el bot ya detecta)
SELECT 'pagado_sin_activar' AS tipo, le.email, le.taller_id,
       le.pagado_at AS desde,
       'Pagó pero su cuenta no está activa' AS detalle
FROM lista_espera le
JOIN usuarios u ON LOWER(u.email) = LOWER(le.email)
WHERE le.estado = 'pagado' AND u.estado <> 'activo'

UNION ALL
-- Pagó, está activo, pero no tiene chispa: su taller NO aparece
SELECT 'pagado_sin_taller', le.email, le.taller_id, le.pagado_at,
       'Pagado y activo pero sin chispa: no ve su taller'
FROM lista_espera le
WHERE le.estado = 'pagado'
  AND NOT EXISTS (
      SELECT 1 FROM chispas c
      WHERE LOWER(c.usuario_email) = LOWER(le.email)
        AND c.taller_id = le.taller_id AND c.revoked = FALSE)

UNION ALL
-- Activo desde hace más de 3 días y nunca ha entrado
SELECT 'activo_sin_entrar', u.email, NULL, u.activado_at,
       'Lleva más de 3 días activo y nunca ha entrado'
FROM usuarios u
WHERE u.estado = 'activo' AND u.primer_login_at IS NULL
  AND u.activado_at < NOW() - INTERVAL '3 days'

UNION ALL
-- Cupo confirmado hace más de 48h sin pagar (el reloj que hoy solo vive en el front)
SELECT 'cupo_vencido', le.email, le.taller_id, le.confirmado_at,
       'Se le apartó lugar hace más de 48h y no ha pagado'
FROM lista_espera le
WHERE le.estado IN ('cupo_confirmado', 'confirmado')
  AND le.confirmado_at < NOW() - INTERVAL '48 hours'

UNION ALL
-- Talleres sobrevendidos
SELECT 'taller_sobrevendido', NULL, t.id, NOW(),
       'Tiene más inscritos que cupo_maximo'
FROM talleres t
WHERE (SELECT COUNT(*) FROM chispas c
       WHERE c.taller_id = t.id AND c.revoked = FALSE
         AND (c.expires_at IS NULL OR c.expires_at > NOW())) > t.cupo_maximo;


-- ════════════════════════════════════════════════════════════════════════════
-- PARTE 8 · Verificación
-- ════════════════════════════════════════════════════════════════════════════

-- Debe devolver 5 tablas/vistas nuevas y las columnas agregadas.
SELECT 'tablas nuevas' AS chequeo, string_agg(table_name, ', ' ORDER BY table_name) AS resultado
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('pagos', 'eventos', 'bot_conversaciones')
UNION ALL
SELECT 'vistas nuevas', string_agg(table_name, ', ' ORDER BY table_name)
FROM information_schema.views
WHERE table_schema = 'public' AND table_name LIKE 'v_%'
UNION ALL
SELECT 'cols lista_espera', string_agg(column_name, ', ' ORDER BY column_name)
FROM information_schema.columns
WHERE table_name = 'lista_espera'
  AND column_name IN ('updated_at','confirmado_at','pagado_at','rechazado_at','origen')
UNION ALL
SELECT 'cols usuarios', string_agg(column_name, ', ' ORDER BY column_name)
FROM information_schema.columns
WHERE table_name = 'usuarios'
  AND column_name IN ('activado_at','origen','primer_login_at','ultimo_login_at','total_logins');

-- El embudo, ya con los datos de hoy:
SELECT * FROM v_embudo;

-- Lo que necesita tu atención ahorita:
SELECT tipo, COUNT(*) FROM v_alertas GROUP BY tipo;
