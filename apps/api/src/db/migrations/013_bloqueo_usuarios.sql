-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 013: bloquear usuarios sin borrarlos
-- ════════════════════════════════════════════════════════════════════════════
--
-- QUÉ RESUELVE
--
-- Hasta hoy, cuando alguien intentaba defraudar (comprobantes falsos, códigos
-- revendidos, una cuenta compartida entre diez), la única herramienta era
-- revocar chispas una por una. No había forma de decir "esta persona, por
-- ahora, no". Y borrar la cuenta nunca fue opción: se lleva por delante su
-- historial, sus certificados y las métricas del negocio.
--
-- DOS INTERRUPTORES, NO UNO
--
-- Se separan a propósito porque son dos castigos distintos:
--
--   · `acceso_bloqueado`   → no puede entrar a la plataforma. Es el grave.
--   · `compras_bloqueadas` → puede entrar y tomar lo que ya pagó, pero no
--                            puede apartar lugar en nada nuevo. Es el que se
--                            usa mientras se aclara un pago sospechoso, sin
--                            castigar a quien quizá no hizo nada.
--
-- Bloquear compras NO toca lo que la persona ya tenía apartado: sus chispas y
-- sus lugares siguen vivos. Si además hay que quitárselos, se revocan a mano
-- desde Accesos. Un interruptor que hiciera las dos cosas a la vez sería
-- imposible de deshacer sin adivinar qué había antes.
--
-- NADA DE BORRADO DURO
--
-- Ninguna columna borra nada y ambas se pueden apagar. Cada encendido y cada
-- apagado deja renglón en `usuarios_bloqueos` con el motivo: dentro de tres
-- meses, cuando alguien reclame, la respuesta tiene que estar escrita en algún
-- lado y no en la memoria de nadie.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Los dos interruptores, en la propia cuenta ───────────────────────────
--
-- Van en `usuarios` y no en una tabla aparte porque se consultan en CADA
-- login y en cada intento de apartar lugar: un JOIN extra en el camino
-- caliente, en la Toshiba, se nota.
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS acceso_bloqueado   BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS compras_bloqueadas BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS bloqueo_motivo     TEXT,
    ADD COLUMN IF NOT EXISTS bloqueo_at         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS bloqueo_por        TEXT;

COMMENT ON COLUMN usuarios.acceso_bloqueado IS
    'TRUE = no puede iniciar sesión ni usar la API, y el bot también lo rechaza.
     Reversible: apagarlo devuelve la cuenta intacta.';
COMMENT ON COLUMN usuarios.compras_bloqueadas IS
    'TRUE = no puede apartar lugar en talleres nuevos (web, bot ni panel).
     Lo que ya tenía apartado NO se toca.';
COMMENT ON COLUMN usuarios.bloqueo_motivo IS
    'Último motivo escrito por quien bloqueó. El historial completo vive en
     usuarios_bloqueos; esto es la copia a la mano para mostrarla en el panel.';


-- Solo interesa buscar a los bloqueados, que siempre serán unos pocos: por eso
-- los índices son parciales y no pesan lo que pesaría uno sobre toda la tabla.
CREATE INDEX IF NOT EXISTS usuarios_acceso_bloqueado_idx
    ON usuarios (email) WHERE acceso_bloqueado = TRUE;
CREATE INDEX IF NOT EXISTS usuarios_compras_bloqueadas_idx
    ON usuarios (email) WHERE compras_bloqueadas = TRUE;


-- ── 2. La bitácora ──────────────────────────────────────────────────────────
--
-- Append-only: aquí nunca se hace UPDATE ni DELETE. Cada renglón es un hecho
-- que ya pasó. Si mañana se desbloquea a alguien, se agrega el renglón del
-- desbloqueo — no se borra el del bloqueo.
CREATE TABLE IF NOT EXISTS usuarios_bloqueos (
    id            SERIAL PRIMARY KEY,
    usuario_email TEXT        NOT NULL,
    -- 'acceso' | 'compras' — cuál de los dos interruptores se movió
    tipo          TEXT        NOT NULL,
    -- TRUE = se bloqueó, FALSE = se desbloqueó
    bloqueado     BOOLEAN     NOT NULL,
    motivo        TEXT,
    -- Quién lo hizo. Hoy siempre es el panel ('admin'); queda el campo para
    -- cuando los agentes empiecen a hacerlo solos y haya que distinguirlos.
    hecho_por     TEXT        DEFAULT 'admin',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usuarios_bloqueos_email_idx
    ON usuarios_bloqueos (LOWER(usuario_email), created_at DESC);

COMMENT ON TABLE usuarios_bloqueos IS
    'Historial append-only de bloqueos y desbloqueos. Nunca se borra un
     renglón: es la respuesta escrita a "¿por qué me bloquearon?".';


-- ── 3. Vista para el panel ──────────────────────────────────────────────────
--
-- El panel necesita, de un vistazo: quién es, cómo contactarla, qué tan
-- adentro está (talleres, certificados, gasto) y si está bloqueada. Reunirlo
-- aquí evita que el front haga cinco llamadas y que el criterio de "cuánto ha
-- pagado" se escriba distinto en dos lugares.
--
-- SECURITY INVOKER + sin GRANT a anon: la vista NO abre datos a nadie que no
-- los tuviera ya. Se consulta solo desde la API con la llave de servicio,
-- detrás de authenticateAdmin. (Ver migración 004.)
DROP VIEW IF EXISTS v_usuarios_admin;
CREATE VIEW v_usuarios_admin
WITH (security_invoker = true) AS
SELECT
    u.id,
    u.email,
    u.nombre,
    u.apellido,
    u.whatsapp,
    u.estado,
    u.acceso_bloqueado,
    u.compras_bloqueadas,
    u.bloqueo_motivo,
    u.bloqueo_at,
    u.bloqueo_por,
    u.estrellas,
    u.created_at,
    u.ultima_actividad,
    -- Accesos vivos: chispas no revocadas y no vencidas.
    COALESCE(ch.talleres_activos, 0)::int  AS talleres_activos,
    COALESCE(ch.cortesias, 0)::int         AS cortesias,
    COALESCE(cert.certificados, 0)::int    AS certificados,
    COALESCE(rep.reportes_pago, 0)::int    AS reportes_pago
FROM usuarios u
LEFT JOIN (
    SELECT LOWER(usuario_email) AS email,
           COUNT(*)                                     AS talleres_activos,
           COUNT(*) FILTER (WHERE is_demo = TRUE)       AS cortesias
      FROM chispas
     WHERE revoked = FALSE
       AND (expires_at IS NULL OR expires_at > NOW())
     GROUP BY 1
) ch   ON ch.email   = LOWER(u.email)
LEFT JOIN (
    SELECT LOWER(usuario_email) AS email, COUNT(*) AS certificados
      FROM certificados
     WHERE anulado = FALSE
     GROUP BY 1
) cert ON cert.email = LOWER(u.email)
LEFT JOIN (
    SELECT LOWER(email) AS email, COUNT(*) AS reportes_pago
      FROM reportes_acceso
     WHERE motivo = 'reporte_pago'
     GROUP BY 1
) rep  ON rep.email  = LOWER(u.email);

COMMENT ON VIEW v_usuarios_admin IS
    'Ficha de cada usuario para la pestaña Usuarios del panel: contacto,
     estado de bloqueo y qué tan adentro está (accesos, certificados, pagos
     reportados). Solo la consume la API detrás de authenticateAdmin.';


-- ── Verificar ───────────────────────────────────────────────────────────────

-- Las cinco columnas nuevas, todas con default FALSE/NULL: nadie queda
-- bloqueado por correr esto.
SELECT column_name, data_type, column_default, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'usuarios'
   AND column_name IN ('acceso_bloqueado','compras_bloqueadas',
                       'bloqueo_motivo','bloqueo_at','bloqueo_por')
 ORDER BY column_name;

-- Debe dar 0 y 0. Si no, algo bloqueó cuentas y hay que revisarlo AHORA.
SELECT COUNT(*) FILTER (WHERE acceso_bloqueado)   AS acceso_bloqueado,
       COUNT(*) FILTER (WHERE compras_bloqueadas) AS compras_bloqueadas
  FROM usuarios;

-- La vista responde y trae a todos los usuarios.
SELECT COUNT(*) AS usuarios_en_la_vista FROM v_usuarios_admin;
