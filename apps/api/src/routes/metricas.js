/**
 * Destello API — Métricas del panel
 *
 * ── Por qué UN endpoint y no cinco ──────────────────────────────────────────
 *
 * El dashboard pinta todo junto: si fueran cinco llamadas, la pantalla se
 * armaría a pedazos y cada filtro dispararía cinco peticiones más. Una sola
 * consulta devuelve el paquete completo y el panel se dibuja de golpe.
 *
 * ── Por qué SQL y no pandas ─────────────────────────────────────────────────
 *
 * Todo lo que hay aquí son agregaciones: contar, sumar, promediar, agrupar por
 * día. PostgreSQL hace eso donde viven los datos, en milisegundos. Traerlos
 * crudos a otro lenguaje para volver a agruparlos sería más lento, más código y
 * un runtime más que mantener en la Toshiba.
 *
 * El día que haya cientos de miles de eventos y haga falta análisis de cohortes
 * o predicción, la tabla `eventos` ya es la materia prima. Hoy no lo es.
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
 * GET /admin/metricas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&tallerId=slug
 *
 * Los filtros son opcionales. Sin ellos devuelve todo el histórico.
 * `desde`/`hasta` aplican a la fecha de inscripción y a la actividad diaria;
 * el cupo y las alertas siempre reflejan el AHORA — filtrar "cuántos lugares
 * quedan" por un rango de fechas no significaría nada.
 */
router.get('/', async (req, res, next) => {
    try {
        const desde    = fechaONull(req.query.desde)
        const hasta    = fechaONull(req.query.hasta)
        const tallerId = req.query.tallerId || null

        // Se arma UNA vez y se reutiliza: mismo filtro en todas las consultas
        // que miran lista_espera, para que los números del panel cuadren entre sí.
        const filtro = `
            ($1::date IS NULL OR le.created_at >= $1::date)
            AND ($2::date IS NULL OR le.created_at < ($2::date + INTERVAL '1 day'))
            AND ($3::text IS NULL OR le.taller_id = $3::text)`
        const params = [desde, hasta, tallerId]

        const [embudo, talleres, actividad, tiempos, alertas, ingresos, bot] =
            await Promise.all([

            // ── El embudo, con los filtros aplicados ────────────────────────
            query(
                `SELECT
                    COUNT(*)                                            AS inscripciones,
                    COUNT(*) FILTER (WHERE le.confirmado_at IS NOT NULL) AS cupos_confirmados,
                    COUNT(*) FILTER (WHERE le.pagado_at     IS NOT NULL) AS pagados,
                    COUNT(*) FILTER (WHERE le.estado = 'rechazado')      AS liberados,
                    COUNT(DISTINCT LOWER(le.email))                      AS personas
                 FROM lista_espera le
                 WHERE ${filtro}`, params),

            // ── Por taller ──────────────────────────────────────────────────
            query(
                `SELECT m.id, m.nombre, m.precio, m.cupo_maximo, m.cupo_ocupado,
                        m.lugares_libres, m.agotado, m.en_lista, m.pendientes,
                        m.confirmados, m.pagados, m.rechazados,
                        m.tasa_conversion, m.ingresos
                 FROM v_metricas_taller m
                 WHERE ($1::text IS NULL OR m.id = $1::text)
                 ORDER BY m.ingresos DESC, m.cupo_ocupado DESC`, [tallerId]),

            // ── Altas por día (para la gráfica de líneas) ───────────────────
            // Se cuenta desde `lista_espera` y no desde `eventos` a propósito:
            // los eventos solo existen desde que se instrumentó el bot, así que
            // usarlos haría ver el pasado vacío como si nadie se hubiera inscrito.
            query(
                `SELECT (le.created_at AT TIME ZONE 'America/Mexico_City')::date AS dia,
                        COUNT(*)                                            AS altas,
                        COUNT(*) FILTER (WHERE le.pagado_at IS NOT NULL)    AS pagados,
                        COUNT(*) FILTER (WHERE le.origen = 'bot')           AS por_bot,
                        COUNT(*) FILTER (WHERE le.origen = 'web')           AS por_web
                 FROM lista_espera le
                 WHERE ${filtro}
                 GROUP BY 1 ORDER BY 1`, params),

            // ── Cuánto tarda la gente en avanzar ────────────────────────────
            query(
                `SELECT
                    ROUND(AVG(EXTRACT(EPOCH FROM (le.confirmado_at - le.created_at))   / 3600)::numeric, 1) AS horas_alta_a_cupo,
                    ROUND(AVG(EXTRACT(EPOCH FROM (le.pagado_at     - le.confirmado_at))/ 3600)::numeric, 1) AS horas_cupo_a_pago,
                    ROUND(AVG(EXTRACT(EPOCH FROM (le.pagado_at     - le.created_at))   / 3600)::numeric, 1) AS horas_alta_a_pago
                 FROM lista_espera le
                 WHERE ${filtro}`, params),

            // ── Lo que necesita atención HOY (sin filtrar por fecha) ────────
            query(`SELECT tipo, COUNT(*)::int AS total FROM v_alertas GROUP BY tipo ORDER BY tipo`),

            // ── El dinero ───────────────────────────────────────────────────
            query(
                `SELECT p.metodo,
                        COUNT(*)::int          AS operaciones,
                        COALESCE(SUM(p.monto), 0) AS monto
                 FROM pagos p
                 WHERE p.estado = 'verificado'
                   AND ($1::date IS NULL OR p.created_at >= $1::date)
                   AND ($2::date IS NULL OR p.created_at < ($2::date + INTERVAL '1 day'))
                   AND ($3::text IS NULL OR p.taller_id = $3::text)
                 GROUP BY p.metodo
                 ORDER BY monto DESC`, params),

            // ── Embudo del bot ──────────────────────────────────────────────
            query(
                `SELECT COUNT(*)::int                                   AS conversaciones,
                        COUNT(*) FILTER (WHERE completada)::int          AS completadas,
                        COUNT(*) FILTER (WHERE NOT completada)::int      AS abandonadas
                 FROM bot_conversaciones
                 WHERE ($1::date IS NULL OR created_at >= $1::date)
                   AND ($2::date IS NULL OR created_at < ($2::date + INTERVAL '1 day'))`,
                [desde, hasta]),
        ])

        // ── Cuentas de usuario (no dependen de lista_espera) ────────────────
        const { rows: [usuarios] } = await query(
            `SELECT COUNT(*)::int                                          AS total,
                    COUNT(*) FILTER (WHERE estado = 'activo')::int          AS activos,
                    COUNT(*) FILTER (WHERE primer_login_at IS NOT NULL)::int AS entraron,
                    COUNT(*) FILTER (WHERE estado = 'espera')::int           AS en_espera
             FROM usuarios`
        )

        // ── Dónde se cae la gente en el bot ─────────────────────────────────
        const { rows: abandonos } = await query(
            `SELECT abandonada_en AS paso, COUNT(*)::int AS total
             FROM bot_conversaciones
             WHERE NOT completada AND abandonada_en IS NOT NULL
             GROUP BY 1 ORDER BY 2 DESC LIMIT 6`
        )

        res.json({
            status: 'ok',
            filtros: { desde, hasta, tallerId },
            embudo:  {
                ...embudo.rows[0],
                ...bot.rows[0],
                usuarios,
            },
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
