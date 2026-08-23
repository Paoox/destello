/**
 * Destello API — Métricas del panel
 *
 * Tres vistas, tres endpoints:
 *   GET /admin/metricas             → el resumen (embudo, talleres, actividad)
 *   GET /admin/metricas/financiero  → el dinero, con detalle operación por operación
 *   GET /admin/metricas/alumno/:email → todo lo de una persona en una pantalla
 *
 * Más dos auxiliares para llenar los filtros y el buscador:
 *   GET /admin/metricas/categorias
 *   GET /admin/metricas/alumnos?q=
 *
 * ── Por qué SQL y no pandas ─────────────────────────────────────────────────
 *
 * Todo lo que hay aquí son agregaciones: contar, sumar, promediar, agrupar por
 * día o por mes. PostgreSQL hace eso donde viven los datos, en milisegundos.
 * Traerlos crudos a otro lenguaje para volver a agruparlos sería más lento, más
 * código y un runtime más que mantener en la Toshiba.
 */

import { Router }  from 'express'
import { query }   from '../db/db.js'

const router = Router()

/** Fecha válida o null. Evita que un parámetro raro se cuele al SQL. */
function fechaONull(v) {
    if (!v) return null
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : v
}

/**
 * Filtro compartido por todas las consultas que miran `lista_espera`.
 *
 * Se arma UNA sola vez y se reutiliza para que los números del panel cuadren
 * entre sí: si cada consulta filtrara a su manera, el embudo diría una cosa y
 * la gráfica otra.
 *
 * La categoría se resuelve con un subquery en vez de un JOIN para no tener que
 * agregar la tabla `talleres` a media docena de consultas.
 */
const FILTRO_LISTA = `
    ($1::date IS NULL OR le.created_at >= $1::date)
    AND ($2::date IS NULL OR le.created_at < ($2::date + INTERVAL '1 day'))
    AND ($3::text IS NULL OR le.taller_id = $3::text)
    AND ($4::text IS NULL OR le.taller_id IN (
            SELECT t2.id FROM talleres t2 WHERE t2.categoria = $4::text))`

function leerFiltros(req) {
    return [
        fechaONull(req.query.desde),
        fechaONull(req.query.hasta),
        req.query.tallerId  || null,
        req.query.categoria || null,
    ]
}

// ════════════════════════════════════════════════════════════════════════════
//  Auxiliares para los filtros
// ════════════════════════════════════════════════════════════════════════════

/** Categorías que existen de verdad. Se leen de la BD, no se hardcodean. */
router.get('/categorias', async (_req, res, next) => {
    try {
        const { rows } = await query(
            `SELECT categoria, COUNT(*)::int AS talleres
             FROM talleres
             WHERE categoria IS NOT NULL AND TRIM(categoria) <> ''
             GROUP BY categoria ORDER BY categoria`
        )
        res.json({ status: 'ok', categorias: rows })
    } catch (err) { next(err) }
})

/** Buscador de alumnos para la ficha. Busca por nombre o correo. */
router.get('/alumnos', async (req, res, next) => {
    try {
        const q = (req.query.q || '').trim()
        if (q.length < 2) return res.json({ status: 'ok', alumnos: [] })

        const { rows } = await query(
            `SELECT u.email, u.nombre, u.apellido, u.estado, u.whatsapp,
                    (SELECT COUNT(*) FROM pagos p
                      WHERE LOWER(p.usuario_email) = LOWER(u.email)
                        AND p.estado = 'verificado')::int AS compras
             FROM usuarios u
             WHERE u.email ILIKE '%' || $1 || '%'
                OR COALESCE(u.nombre, '')   ILIKE '%' || $1 || '%'
                OR COALESCE(u.apellido, '') ILIKE '%' || $1 || '%'
                OR COALESCE(u.whatsapp, '') ILIKE '%' || $1 || '%'
             ORDER BY compras DESC, u.created_at DESC
             LIMIT 12`,
            [q]
        )
        res.json({ status: 'ok', alumnos: rows })
    } catch (err) { next(err) }
})

// ════════════════════════════════════════════════════════════════════════════
//  Estado financiero
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/metricas/financiero
 *
 * ⚠️ Las cortesías (`metodo = 'cortesia'`, `monto = 0`) **cuentan como lugar
 * pero NUNCA como ingreso**. Se reportan aparte, con su valor equivalente —
 * cuánto habrías cobrado si no las hubieras regalado — porque ese número sí
 * sirve para decidir cuántas cortesías puedes seguir dando.
 */
router.get('/financiero', async (req, res, next) => {
    try {
        const [desde, hasta, tallerId, categoria] = leerFiltros(req)
        const params = [desde, hasta, tallerId, categoria]

        // Mismo filtro que el resto del panel, pero sobre la fecha del pago.
        const filtroPago = `
            p.estado = 'verificado'
            AND ($1::date IS NULL OR p.created_at >= $1::date)
            AND ($2::date IS NULL OR p.created_at < ($2::date + INTERVAL '1 day'))
            AND ($3::text IS NULL OR p.taller_id = $3::text)
            AND ($4::text IS NULL OR p.taller_id IN (
                    SELECT t2.id FROM talleres t2 WHERE t2.categoria = $4::text))`

        const [resumen, porMetodo, porTaller, porMes, porBanco, operaciones] =
            await Promise.all([

            query(
                `SELECT
                    COUNT(*) FILTER (WHERE p.metodo <> 'cortesia')::int        AS operaciones,
                    COALESCE(SUM(p.monto) FILTER (WHERE p.metodo <> 'cortesia'), 0) AS ingresos,
                    ROUND(AVG(p.monto) FILTER (WHERE p.metodo <> 'cortesia' AND p.monto > 0), 2) AS ticket_promedio,
                    COUNT(*) FILTER (WHERE p.metodo = 'cortesia')::int         AS cortesias,
                    -- Lo que habrías cobrado por esas cortesías al precio de lista
                    COALESCE(SUM(t.precio) FILTER (WHERE p.metodo = 'cortesia'), 0) AS valor_cortesias
                 FROM pagos p
                 LEFT JOIN talleres t ON t.id = p.taller_id
                 WHERE ${filtroPago}`, params),

            query(
                `SELECT p.metodo,
                        COUNT(*)::int             AS operaciones,
                        COALESCE(SUM(p.monto), 0) AS monto
                 FROM pagos p
                 WHERE ${filtroPago}
                 GROUP BY p.metodo ORDER BY monto DESC`, params),

            query(
                `SELECT COALESCE(t.nombre, '(sin taller)') AS taller,
                        t.categoria,
                        COUNT(*) FILTER (WHERE p.metodo <> 'cortesia')::int        AS operaciones,
                        COUNT(*) FILTER (WHERE p.metodo =  'cortesia')::int        AS cortesias,
                        COALESCE(SUM(p.monto), 0)                                  AS monto
                 FROM pagos p
                 LEFT JOIN talleres t ON t.id = p.taller_id
                 WHERE ${filtroPago}
                 GROUP BY t.nombre, t.categoria ORDER BY monto DESC`, params),

            // Mes contra mes. `to_char` da la etiqueta; el date_trunc ordena.
            query(
                `SELECT TO_CHAR(DATE_TRUNC('month', p.created_at AT TIME ZONE 'America/Mexico_City'), 'YYYY-MM') AS mes,
                        COUNT(*) FILTER (WHERE p.metodo <> 'cortesia')::int        AS operaciones,
                        COALESCE(SUM(p.monto), 0)                                  AS monto
                 FROM pagos p
                 WHERE ${filtroPago}
                 GROUP BY 1 ORDER BY 1`, params),

            query(
                `SELECT COALESCE(NULLIF(TRIM(p.banco), ''), '(no especificado)') AS banco,
                        COUNT(*)::int             AS operaciones,
                        COALESCE(SUM(p.monto), 0) AS monto
                 FROM pagos p
                 WHERE ${filtroPago} AND p.metodo <> 'cortesia'
                 GROUP BY 1 ORDER BY monto DESC`, params),

            // El detalle. Se limita a 300: más que eso no se lee en pantalla y
            // para un corte largo conviene filtrar por mes.
            query(
                `SELECT p.id, p.created_at, p.fecha_pago, p.usuario_email,
                        COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellido, '') AS nombre,
                        t.nombre AS taller, p.monto, p.metodo, p.banco, p.titular,
                        p.folio, p.verificado_por, p.nota,
                        (p.comprobante_path IS NOT NULL) AS tiene_comprobante
                 FROM pagos p
                 LEFT JOIN talleres t ON t.id = p.taller_id
                 LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(p.usuario_email)
                 WHERE ${filtroPago}
                 ORDER BY p.created_at DESC
                 LIMIT 300`, params),
        ])

        res.json({
            status:   'ok',
            filtros:  { desde, hasta, tallerId, categoria },
            resumen:  resumen.rows[0],
            porMetodo: porMetodo.rows,
            porTaller: porTaller.rows,
            porMes:    porMes.rows,
            porBanco:  porBanco.rows,
            operaciones: operaciones.rows,
        })
    } catch (err) { next(err) }
})

// ════════════════════════════════════════════════════════════════════════════
//  Ficha de un alumno
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/metricas/alumno/:email
 *
 * Todo lo de una persona en una sola respuesta.
 *
 * ⚠️ `eventos` solo tiene historia desde el 23 ago 2026 (cuando se instrumentó
 * la plataforma). La respuesta incluye `actividadDesde` para que la pantalla
 * pueda decirlo — dibujar un hueco sin explicación se leería como inactividad,
 * y sería mentir.
 */
router.get('/alumno/:email', async (req, res, next) => {
    try {
        const email = String(req.params.email || '').toLowerCase().trim()
        if (!email) return res.status(400).json({ status: 'error', message: 'email requerido' })

        const { rows: perfilRows } = await query(
            `SELECT id, email, nombre, apellido, nombre_certificado, whatsapp, estado,
                    origen, created_at, activado_at, activado_por,
                    primer_login_at, ultimo_login_at, total_logins, metodo_login,
                    estrellas, racha, codigo_referido, referido_por,
                    EXTRACT(DAY FROM (NOW() - created_at))::int AS dias_en_plataforma
             FROM usuarios WHERE LOWER(email) = $1`, [email]
        )
        if (!perfilRows.length) {
            return res.status(404).json({ status: 'error', message: 'No existe esa cuenta' })
        }

        const [compras, inscripciones, referidos, canjes, actividad, recurrencia, insignias] =
            await Promise.all([

            query(
                `SELECT p.id, p.created_at, p.fecha_pago, p.monto, p.metodo, p.banco,
                        p.titular, p.folio, p.nota, p.verificado_por,
                        t.nombre AS taller, t.categoria,
                        (p.comprobante_path IS NOT NULL) AS tiene_comprobante
                 FROM pagos p
                 LEFT JOIN talleres t ON t.id = p.taller_id
                 WHERE LOWER(p.usuario_email) = $1 AND p.estado = 'verificado'
                 ORDER BY p.created_at DESC`, [email]),

            query(
                `SELECT le.id, le.taller_id, t.nombre AS taller, t.categoria,
                        t.fecha_inicio, le.estado, le.origen,
                        le.created_at, le.confirmado_at, le.pagado_at,
                        le.asistencia_respuesta, le.asistencia_confirmada_at,
                        c.code AS chispa, c.is_demo, c.expires_at
                 FROM lista_espera le
                 LEFT JOIN talleres t ON t.id = le.taller_id
                 LEFT JOIN LATERAL (
                     SELECT ch.code, ch.is_demo, ch.expires_at FROM chispas ch
                     WHERE LOWER(ch.usuario_email) = LOWER(le.email)
                       AND ch.taller_id = le.taller_id AND ch.revoked = FALSE
                     ORDER BY ch.created_at DESC LIMIT 1
                 ) c ON TRUE
                 WHERE LOWER(le.email) = $1
                 ORDER BY le.created_at DESC`, [email]),

            query(
                `SELECT r.referido_email, r.codigo_usado, r.estrellas, r.created_at,
                        u.nombre, u.estado
                 FROM referidos r
                 LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(r.referido_email)
                 WHERE LOWER(r.referidor_email) = $1
                 ORDER BY r.created_at DESC`, [email]),

            query(
                `SELECT cs.id, cs.estrellas_gastadas, cs.estado, cs.created_at,
                        s.nombre AS supernova
                 FROM canjes_supernova cs
                 LEFT JOIN supernovas s ON s.id = cs.supernova_id
                 WHERE LOWER(cs.usuario_email) = $1
                 ORDER BY cs.created_at DESC`, [email]),

            query(
                `SELECT (created_at AT TIME ZONE 'America/Mexico_City')::date AS dia,
                        COUNT(*)::int AS total
                 FROM eventos WHERE LOWER(usuario_email) = $1
                 GROUP BY 1 ORDER BY 1`, [email]),

            // Cada cuánto vuelve a comprar. Necesita al menos dos compras: con
            // una sola no hay intervalo que promediar.
            query(
                `SELECT ROUND(AVG(dias)::numeric, 1) AS dias_entre_compras,
                        COUNT(*)::int                AS intervalos
                 FROM (
                     SELECT EXTRACT(DAY FROM (created_at - LAG(created_at)
                            OVER (ORDER BY created_at))) AS dias
                     FROM pagos
                     WHERE LOWER(usuario_email) = $1
                       AND estado = 'verificado' AND metodo <> 'cortesia'
                 ) s WHERE dias IS NOT NULL`, [email]),

            query(
                `SELECT nombre, descripcion, otorgada_por, created_at
                 FROM insignias WHERE LOWER(usuario_email) = $1
                 ORDER BY created_at DESC`, [email]),
        ])

        // Desde cuándo hay historia de eventos: sirve para no dibujar un hueco
        // como si fuera inactividad.
        const { rows: [meta] } = await query(
            `SELECT MIN(created_at)::date AS desde FROM eventos`)

        const totalPagado = compras.rows
            .filter(c => c.metodo !== 'cortesia')
            .reduce((s, c) => s + Number(c.monto), 0)

        res.json({
            status: 'ok',
            perfil: perfilRows[0],
            resumen: {
                total_pagado:   totalPagado,
                compras:        compras.rows.filter(c => c.metodo !== 'cortesia').length,
                cortesias:      compras.rows.filter(c => c.metodo === 'cortesia').length,
                talleres:       inscripciones.rows.length,
                referidos:      referidos.rows.length,
                dias_entre_compras: recurrencia.rows[0]?.dias_entre_compras ?? null,
            },
            compras:       compras.rows,
            inscripciones: inscripciones.rows,
            referidos:     referidos.rows,
            canjes:        canjes.rows,
            insignias:     insignias.rows,
            actividad:     actividad.rows,
            actividadDesde: meta?.desde ?? null,
        })
    } catch (err) { next(err) }
})

// ════════════════════════════════════════════════════════════════════════════
//  Resumen general
// ════════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/metricas?desde=&hasta=&tallerId=&categoria=
 *
 * Los filtros son opcionales. `desde`/`hasta` aplican a la fecha de
 * inscripción; el cupo y las alertas siempre reflejan el AHORA — filtrar
 * "cuántos lugares quedan" por un rango pasado no significaría nada.
 */
router.get('/', async (req, res, next) => {
    try {
        const params = leerFiltros(req)
        const [desde, hasta, tallerId, categoria] = params

        const [embudo, talleres, actividad, tiempos, alertas, ingresos, bot] =
            await Promise.all([

            query(
                `SELECT
                    COUNT(*)                                            AS inscripciones,
                    COUNT(*) FILTER (WHERE le.confirmado_at IS NOT NULL) AS cupos_confirmados,
                    COUNT(*) FILTER (WHERE le.pagado_at     IS NOT NULL) AS pagados,
                    COUNT(*) FILTER (WHERE le.estado = 'rechazado')      AS liberados,
                    COUNT(DISTINCT LOWER(le.email))                      AS personas
                 FROM lista_espera le
                 WHERE ${FILTRO_LISTA}`, params),

            // Por taller, ahora con categoría y con el tiempo que tardó en
            // llenarse: del primer registro al último pago.
            query(
                `SELECT m.id, m.nombre, m.precio, m.cupo_maximo, m.cupo_ocupado,
                        m.lugares_libres, m.agotado, m.en_lista, m.pendientes,
                        m.confirmados, m.pagados, m.rechazados,
                        m.tasa_conversion, m.ingresos,
                        t.categoria, t.fecha_inicio,
                        v.horas_en_llenarse,
                        v.cortesias
                 FROM v_metricas_taller m
                 JOIN talleres t ON t.id = m.id
                 LEFT JOIN LATERAL (
                     SELECT
                        -- Solo cuando el último pago es POSTERIOR al primer
                        -- registro. Las filas rellenadas por la migración 006
                        -- traen pagado_at anterior al alta y daban tiempos
                        -- negativos ("tardó −911 h"). Mejor NULL que mentira.
                        CASE WHEN MAX(le.pagado_at) > MIN(le.created_at)
                             THEN ROUND(EXTRACT(EPOCH FROM (MAX(le.pagado_at) - MIN(le.created_at))) / 3600)
                        END                                                      AS horas_en_llenarse,
                        (SELECT COUNT(*)::int FROM pagos p
                          WHERE p.taller_id = m.id AND p.metodo = 'cortesia')     AS cortesias
                     FROM lista_espera le
                     WHERE le.taller_id = m.id AND le.pagado_at IS NOT NULL
                 ) v ON TRUE
                 WHERE ($1::text IS NULL OR m.id = $1::text)
                   AND ($2::text IS NULL OR t.categoria = $2::text)
                 ORDER BY m.ingresos DESC, m.cupo_ocupado DESC`, [tallerId, categoria]),

            // La actividad se cuenta desde `lista_espera` y no desde `eventos`:
            // los eventos solo existen desde que se instrumentó el bot, así que
            // usarlos haría ver el pasado vacío como si nadie se hubiera inscrito.
            query(
                `SELECT (le.created_at AT TIME ZONE 'America/Mexico_City')::date AS dia,
                        COUNT(*)                                            AS altas,
                        COUNT(*) FILTER (WHERE le.pagado_at IS NOT NULL)    AS pagados,
                        COUNT(*) FILTER (WHERE le.origen = 'bot')           AS por_bot,
                        COUNT(*) FILTER (WHERE le.origen = 'web')           AS por_web
                 FROM lista_espera le
                 WHERE ${FILTRO_LISTA}
                 GROUP BY 1 ORDER BY 1`, params),

            query(
                `SELECT
                    ROUND(AVG(EXTRACT(EPOCH FROM (le.confirmado_at - le.created_at))   / 3600)::numeric, 1) AS horas_alta_a_cupo,
                    ROUND(AVG(EXTRACT(EPOCH FROM (le.pagado_at     - le.confirmado_at))/ 3600)::numeric, 1) AS horas_cupo_a_pago,
                    ROUND(AVG(EXTRACT(EPOCH FROM (le.pagado_at     - le.created_at))   / 3600)::numeric, 1) AS horas_alta_a_pago
                 FROM lista_espera le
                 WHERE ${FILTRO_LISTA}`, params),

            query(`SELECT tipo, COUNT(*)::int AS total FROM v_alertas GROUP BY tipo ORDER BY tipo`),

            query(
                `SELECT p.metodo, COUNT(*)::int AS operaciones, COALESCE(SUM(p.monto), 0) AS monto
                 FROM pagos p
                 WHERE p.estado = 'verificado'
                   AND ($1::date IS NULL OR p.created_at >= $1::date)
                   AND ($2::date IS NULL OR p.created_at < ($2::date + INTERVAL '1 day'))
                   AND ($3::text IS NULL OR p.taller_id = $3::text)
                   AND ($4::text IS NULL OR p.taller_id IN (
                           SELECT t2.id FROM talleres t2 WHERE t2.categoria = $4::text))
                 GROUP BY p.metodo ORDER BY monto DESC`, params),

            query(
                `SELECT COUNT(*)::int                              AS conversaciones,
                        COUNT(*) FILTER (WHERE completada)::int     AS completadas,
                        COUNT(*) FILTER (WHERE NOT completada)::int AS abandonadas
                 FROM bot_conversaciones
                 WHERE ($1::date IS NULL OR created_at >= $1::date)
                   AND ($2::date IS NULL OR created_at < ($2::date + INTERVAL '1 day'))`,
                [desde, hasta]),
        ])

        const { rows: [usuarios] } = await query(
            `SELECT COUNT(*)::int                                          AS total,
                    COUNT(*) FILTER (WHERE estado = 'activo')::int          AS activos,
                    COUNT(*) FILTER (WHERE primer_login_at IS NOT NULL)::int AS entraron,
                    COUNT(*) FILTER (WHERE estado = 'espera')::int           AS en_espera
             FROM usuarios`
        )

        const { rows: abandonos } = await query(
            `SELECT abandonada_en AS paso, COUNT(*)::int AS total
             FROM bot_conversaciones
             WHERE NOT completada AND abandonada_en IS NOT NULL
             GROUP BY 1 ORDER BY 2 DESC LIMIT 6`
        )

        res.json({
            status:  'ok',
            filtros: { desde, hasta, tallerId, categoria },
            embudo:  { ...embudo.rows[0], ...bot.rows[0], usuarios },
            talleres:  talleres.rows,
            actividad: actividad.rows,
            tiempos:   tiempos.rows[0],
            alertas:   alertas.rows,
            ingresos:  ingresos.rows,
            abandonos,
        })
    } catch (err) { next(err) }
})

export default router
