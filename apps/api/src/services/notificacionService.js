/**
 * Destello API — Notificaciones (T-44, 19 nov 2026)
 *
 * ── Cómo funciona ───────────────────────────────────────────────────────────
 *
 * Nadie "dispara" una notificación desde un botón. Un revisor corre cada
 * 5 min (ver `index.js`, solo en producción) y mira el estado de la base:
 * talleres que empiezan pronto, certificados recién emitidos, pagos recién
 * confirmados, talleres nuevos. De cada hecho saca una notificación por
 * persona. `(usuario_id, tipo, ref)` es único en la tabla, así que pasar
 * mil veces por el mismo hecho no la duplica.
 *
 * Después de crearlas hay una segunda fase que manda lo que va por fuera de
 * la app: el WhatsApp de los recordatorios (por el bot Faro) y el correo de
 * "nuevo taller" (Resend). Si algo falla se reintenta en la siguiente vuelta,
 * hasta 3 veces.
 *
 * ⚠️ WhatsApp va con pausa entre mensaje y mensaje: Faro usa Baileys (no la
 * API oficial) y una ráfaga de mensajes iguales es lo que hace que WhatsApp
 * banee un número. Por eso "nuevo taller" — que le llega a TODAS las
 * cuentas — va por correo y nunca por WhatsApp.
 *
 * Los textos viven en `notificacionTextos.js` (funciones puras, con pruebas).
 */
import { query } from '../db/db.js'
import { sendWhatsapp } from './botService.js'
import { sendNuevoTaller } from './mailService.js'
// Lo único que se le dice a la profe: cuántos alumnos con PAGO CONFIRMADO
// tiene — misma regla que la pestaña Detalle talleres del panel.
import { SQL_REGISTRADOS } from './conteoAlumnos.js'
import { armarNotificacion, mensajeWhatsapp, yaNoSirve, TIPOS_WA, TIPOS_CORREO } from './notificacionTextos.js'

const PAUSA_WA_MS     = 2500
const PAUSA_CORREO_MS = 600     // Resend: 2 correos por segundo en el plan base
const MAX_ENVIOS_VUELTA = 80
const MAX_INTENTOS    = 3
/** Hechos (pagos, certificados, inscripciones) más viejos que esto ya no avisan. */
const VENTANA_HECHOS  = "INTERVAL '3 days'"

const pausa = (ms) => new Promise(r => setTimeout(r, ms))


// ── Crear ─────────────────────────────────────────────────────────────────

/**
 * Inserta una notificación si no existía. Decide aquí si además lleva
 * WhatsApp o correo, según el tipo y las preferencias de la persona.
 * @returns {Promise<boolean>} true si era nueva
 */
async function crear(u, tipo, ref, datos) {
    const { titulo, cuerpo, liga } = armarNotificacion(tipo, datos)
    const enviarWa     = TIPOS_WA.has(tipo) && u.avisos_whatsapp !== false && !!u.whatsapp
    const enviarCorreo = TIPOS_CORREO.has(tipo) && u.avisos_correo !== false && !!u.email
    const { rowCount } = await query(
        `INSERT INTO notificaciones
            (usuario_id, tipo, ref, titulo, cuerpo, liga, datos, enviar_wa, enviar_correo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (usuario_id, tipo, ref) DO NOTHING`,
        [u.id, tipo, String(ref), titulo, cuerpo, liga,
         JSON.stringify({ ...datos, nombre: u.nombre ?? null }), enviarWa, enviarCorreo]
    )
    return rowCount > 0
}

/** Columnas de `usuarios` que necesita `crear()`. */
const COLS_U = 'u.id, u.email, u.nombre, u.whatsapp, u.avisos_whatsapp, u.avisos_correo'

/**
 * Talleres que empiezan en las próximas 24 h. `inicio` se arma en hora de
 * CDMX (fecha_inicio + hora_inicio son hora local). `dias` = 0 hoy, 1 mañana.
 */
async function talleresProximos() {
    const { rows } = await query(
        `WITH t AS (
            SELECT id, nombre, horario, hora_inicio::text AS hora_inicio,
                   to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha,
                   ((fecha_inicio + hora_inicio) AT TIME ZONE 'America/Mexico_City') AS inicio
              FROM talleres
             WHERE fecha_inicio IS NOT NULL AND hora_inicio IS NOT NULL
               AND estado NOT IN ('borrador', 'pausado')
         )
         SELECT t.*,
                (t.inicio <= NOW() + INTERVAL '1 hour') AS en_una_hora,
                (t.inicio AT TIME ZONE 'America/Mexico_City')::date
                  - (NOW() AT TIME ZONE 'America/Mexico_City')::date AS dias,
                ${SQL_REGISTRADOS('t.id')} AS registrados
           FROM t
          WHERE t.inicio > NOW() AND t.inicio <= NOW() + INTERVAL '24 hours'`
    )
    return rows
}

/** Alumnas con chispa vigente del taller (sin contar a la profe). */
async function alumnasDe(tallerId) {
    const { rows } = await query(
        `SELECT DISTINCT ON (u.id) ${COLS_U}
           FROM chispas c
           JOIN usuarios u ON u.id = c.usuario_id
                           OR (c.usuario_id IS NULL AND LOWER(u.email) = LOWER(c.usuario_email))
          WHERE c.taller_id = $1
            AND NOT COALESCE(c.revoked, FALSE)
            AND (c.expires_at IS NULL OR c.expires_at > NOW())
            AND NOT COALESCE(u.acceso_bloqueado, FALSE)
            AND u.id NOT IN (SELECT usuario_id FROM taller_profesores WHERE taller_id = $1)`,
        [tallerId]
    )
    return rows
}

async function profesDe(tallerId) {
    const { rows } = await query(
        `SELECT ${COLS_U}
           FROM taller_profesores tp JOIN usuarios u ON u.id = tp.usuario_id
          WHERE tp.taller_id = $1`,
        [tallerId]
    )
    return rows
}

/** Recordatorios de 24 h y de 1 h, para alumnas y para la profe. */
async function recordatoriosDeClase() {
    let n = 0
    for (const t of await talleresProximos()) {
        const unaHora = t.en_una_hora
        const base = {
            tallerId: t.id, taller: t.nombre, horario: t.horario,
            horaInicio: t.hora_inicio, fecha: t.fecha, dias: t.dias,
            inicio: new Date(t.inicio).toISOString(),
        }
        // `ref` lleva la fecha: si el taller se reprograma, vuelve a avisar.
        const ref = `${t.id}@${t.fecha}`

        for (const u of await alumnasDe(t.id)) {
            if (await crear(u, unaHora ? 'taller_1h' : 'taller_24h', ref, base)) n++
        }
        const conteo = { registrados: t.registrados }
        for (const u of await profesDe(t.id)) {
            if (await crear(u, unaHora ? 'profe_1h' : 'profe_24h', ref, { ...base, ...conteo })) n++
        }
    }
    return n
}

async function certificadosNuevos() {
    const { rows } = await query(
        `SELECT ${COLS_U}, c.folio, c.taller_nombre
           FROM certificados c JOIN usuarios u ON LOWER(u.email) = LOWER(c.usuario_email)
          WHERE NOT c.anulado AND c.created_at > NOW() - ${VENTANA_HECHOS}`
    )
    let n = 0
    for (const r of rows) {
        if (await crear(r, 'certificado', r.folio, { taller: r.taller_nombre, folio: r.folio })) n++
    }
    return n
}

async function pagosConfirmados() {
    const { rows } = await query(
        `SELECT ${COLS_U}, p.id AS pago_id, p.taller_id, t.nombre AS taller_nombre
           FROM pagos p
           JOIN usuarios u ON LOWER(u.email) = LOWER(p.usuario_email)
           LEFT JOIN talleres t ON t.id = p.taller_id
          WHERE p.estado = 'verificado' AND p.created_at > NOW() - ${VENTANA_HECHOS}`
    )
    let n = 0
    for (const r of rows) {
        if (await crear(r, 'pago_confirmado', r.pago_id, { tallerId: r.taller_id, taller: r.taller_nombre })) n++
    }
    return n
}

/**
 * Una chispa nueva NO demo = alguien con pago confirmado → aviso a la profe.
 * Las cortesías/demos no avisan (Paola: a la profe solo los de pago).
 */
async function alumnasNuevas() {
    const { rows } = await query(
        `SELECT ${COLS_U}, c.code, c.taller_id, t.nombre AS taller_nombre,
                COALESCE(NULLIF(TRIM(CONCAT(a.nombre, ' ', LEFT(a.apellido, 1),
                         CASE WHEN a.apellido <> '' THEN '.' END)), ''), c.usuario_nombre) AS alumna,
                ${SQL_REGISTRADOS('c.taller_id')} AS registrados
           FROM chispas c
           JOIN taller_profesores tp ON tp.taller_id = c.taller_id
           JOIN usuarios u ON u.id = tp.usuario_id
           JOIN talleres t ON t.id = c.taller_id
           LEFT JOIN usuarios a ON a.id = c.usuario_id
                                OR (c.usuario_id IS NULL AND LOWER(a.email) = LOWER(c.usuario_email))
          WHERE NOT COALESCE(c.revoked, FALSE)
            AND NOT COALESCE(c.is_demo, FALSE)
            AND c.usuario_email IS NOT NULL
            AND c.created_at > NOW() - ${VENTANA_HECHOS}
            AND (a.id IS NULL OR a.id <> u.id)`
    )
    let n = 0
    for (const r of rows) {
        const datos = { tallerId: r.taller_id, taller: r.taller_nombre, alumna: r.alumna,
                        registrados: r.registrados }
        if (await crear(r, 'nueva_alumna', r.code, datos)) n++
    }
    return n
}

/**
 * Talleres abiertos que todavía no se anuncian. Espera 20 min desde la última
 * edición para no anunciar uno que Paola sigue llenando en el panel.
 */
async function talleresNuevos() {
    const { rows: talleres } = await query(
        `SELECT id, nombre, descripcion, horario, precio, hora_inicio::text AS hora_inicio,
                to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha
           FROM talleres
          WHERE anunciado_at IS NULL
            AND estado IN ('activo', 'proximamente')
            AND (fecha_inicio IS NULL OR fecha_inicio >= (NOW() AT TIME ZONE 'America/Mexico_City')::date)
            AND COALESCE(updated_at, created_at) < NOW() - INTERVAL '20 minutes'`
    )
    let n = 0
    for (const t of talleres) {
        const { rows: gente } = await query(
            `SELECT ${COLS_U} FROM usuarios u
              WHERE u.estado = 'activo' AND NOT COALESCE(u.acceso_bloqueado, FALSE)
                AND u.id NOT IN (SELECT usuario_id FROM taller_profesores WHERE taller_id = $1)`,
            [t.id]
        )
        const datos = { tallerId: t.id, taller: t.nombre, descripcion: t.descripcion,
                        horario: t.horario, horaInicio: t.hora_inicio, fecha: t.fecha,
                        precio: t.precio }
        for (const u of gente) {
            if (await crear(u, 'nuevo_taller', t.id, datos)) n++
        }
        await query(`UPDATE talleres SET anunciado_at = NOW() WHERE id = $1`, [t.id])
    }
    return n
}

// ── Mandar por fuera de la app ─────────────────────────────────────────────

async function mandarPendientes() {
    const { rows } = await query(
        `SELECT n.id, n.tipo, n.datos, n.enviar_wa, n.wa_enviado_at,
                n.enviar_correo, n.correo_enviado_at,
                u.email, u.nombre, u.whatsapp, u.avisos_whatsapp, u.avisos_correo
           FROM notificaciones n JOIN usuarios u ON u.id = n.usuario_id
          WHERE ((n.enviar_wa AND n.wa_enviado_at IS NULL)
              OR (n.enviar_correo AND n.correo_enviado_at IS NULL))
            AND n.envio_intentos < $1
            AND n.created_at > NOW() - INTERVAL '2 days'
          ORDER BY n.created_at
          LIMIT $2`,
        [MAX_INTENTOS, MAX_ENVIOS_VUELTA]
    )

    let enviados = 0
    for (const n of rows) {
        // Si ya no tiene caso (la clase empezó, o apagó los avisos en Ajustes),
        // se da por cerrada sin mandar nada.
        const waVivo     = n.enviar_wa && !n.wa_enviado_at && n.avisos_whatsapp && n.whatsapp
        const correoVivo = n.enviar_correo && !n.correo_enviado_at && n.avisos_correo && n.email
        if (yaNoSirve(n) || (!waVivo && !correoVivo)) {
            await query(`UPDATE notificaciones SET envio_intentos = $2 WHERE id = $1`, [n.id, MAX_INTENTOS])
            continue
        }

        let falla = false
        if (waVivo) {
            try {
                await sendWhatsapp(n.whatsapp, mensajeWhatsapp(n.tipo, n.datos))
                await query(`UPDATE notificaciones SET wa_enviado_at = NOW() WHERE id = $1`, [n.id])
                enviados++
            } catch (err) {
                falla = true
                console.error(`[notificaciones] WhatsApp #${n.id} falló:`, err.message)
            }
            await pausa(PAUSA_WA_MS)
        }
        if (correoVivo) {
            try {
                await sendNuevoTaller({
                    to: n.email, nombre: n.nombre,
                    taller: { nombre: n.datos.taller, fecha: n.datos.fecha, horario: n.datos.horario,
                              descripcion: n.datos.descripcion, precio: n.datos.precio },
                })
                await query(`UPDATE notificaciones SET correo_enviado_at = NOW() WHERE id = $1`, [n.id])
                enviados++
            } catch (err) {
                falla = true
                console.error(`[notificaciones] correo #${n.id} falló:`, err.message)
            }
            await pausa(PAUSA_CORREO_MS)
        }
        if (falla) {
            await query(`UPDATE notificaciones SET envio_intentos = envio_intentos + 1 WHERE id = $1`, [n.id])
        }
    }
    return enviados
}

// ── La vuelta completa ────────────────────────────────────────────────────

let corriendo = false

/**
 * Una vuelta del revisor. Si la anterior sigue mandando (un lote grande de
 * correos tarda), esta se salta para no mandar nada dos veces.
 */
export async function revisarNotificaciones() {
    if (corriendo) return null
    corriendo = true
    try {
        const pasos = { recordatoriosDeClase, certificadosNuevos, pagosConfirmados, alumnasNuevas, talleresNuevos }
        const creadas = {}
        for (const [nombre, paso] of Object.entries(pasos)) {
            // Un paso que truena no debe tumbar a los demás.
            try { creadas[nombre] = await paso() }
            catch (err) { console.error(`[notificaciones] ${nombre}:`, err.message) }
        }
        const enviados = await mandarPendientes()
        const total = Object.values(creadas).reduce((a, b) => a + (b || 0), 0)
        if (total || enviados) console.log('[notificaciones]', { creadas, enviados })
        return { creadas, enviados }
    } finally {
        corriendo = false
    }
}

// ── Lo que usa la app (/users/me/notificaciones) ───────────────────────────

export async function listar(usuarioId, limite = 50) {
    const { rows } = await query(
        `SELECT id, tipo, titulo, cuerpo, liga, created_at, leida_at
           FROM notificaciones WHERE usuario_id = $1
          ORDER BY created_at DESC LIMIT $2`,
        [usuarioId, limite]
    )
    return rows
}

export async function contarNoLeidas(usuarioId) {
    const { rows } = await query(
        `SELECT COUNT(*)::int AS n FROM notificaciones WHERE usuario_id = $1 AND leida_at IS NULL`,
        [usuarioId]
    )
    return rows[0].n
}

/** Marca como leídas las indicadas, o todas si `ids` no viene. */
export async function marcarLeidas(usuarioId, ids = null) {
    const lista = Array.isArray(ids) ? ids.map(Number).filter(Number.isInteger) : null
    const { rowCount } = await query(
        `UPDATE notificaciones SET leida_at = NOW()
          WHERE usuario_id = $1 AND leida_at IS NULL
            AND ($2::bigint[] IS NULL OR id = ANY($2::bigint[]))`,
        [usuarioId, lista]
    )
    return rowCount
}
