/**
 * Destello API — Prospectos (19 nov 2026)
 *
 * Panel → Prospectos: quien se interesó en un taller y no lo tomó, para
 * invitarla cuando ese taller vuelva a abrir.
 *
 *   · no_pago   → lista_espera 'rechazado' sin pago (se liberó su lugar)
 *   · sin_cupo  → prospectos_sin_cupo (intentó inscribirse y estaba lleno)
 *
 * No aparece quien después sí pagó ese taller o ya está otra vez apartándolo,
 * y no se contacta a cuentas bloqueadas o dadas de baja. Se respetan sus
 * interruptores de avisos (Ajustes) si tiene cuenta.
 */
import { query } from '../db/db.js'
import { AppError } from '../middleware/errorHandler.js'
import { sendWhatsapp } from './botService.js'
import { sendInvitacionTaller } from './mailService.js'
import { mensajeInvitacion } from './prospectoTextos.js'

const PAUSA_WA_MS = 2500     // mismo respiro que el revisor de notificaciones
export const MAX_POR_ENVIO = 60

/** Lo llama listaEsperaService cuando el taller está lleno. Nunca truena. */
export async function registrarSinCupo({ email, nombre, whatsapp, tallerId }) {
    try {
        await query(
            `INSERT INTO prospectos_sin_cupo (email, nombre, whatsapp, taller_id)
             VALUES (LOWER(TRIM($1)), $2, $3, $4)
             ON CONFLICT (LOWER(email), taller_id) DO UPDATE
                SET intentos = prospectos_sin_cupo.intentos + 1,
                    ultimo_intento_at = NOW(),
                    nombre   = COALESCE(EXCLUDED.nombre, prospectos_sin_cupo.nombre),
                    whatsapp = COALESCE(EXCLUDED.whatsapp, prospectos_sin_cupo.whatsapp)`,
            [email, nombre || null, whatsapp || null, tallerId])
    } catch (err) {
        console.error('[prospectos] no se pudo guardar sin_cupo:', err.message)
    }
}

/**
 * @param {{ origen?: 'no_pago'|'sin_cupo'|null, tallerId?: string|null }} filtros
 */
export async function listar({ origen = null, tallerId = null } = {}) {
    const { rows } = await query(
        `WITH base AS (
            (SELECT DISTINCT ON (LOWER(le.email), le.taller_id)
                   LOWER(le.email) AS email, le.nombre, le.whatsapp, le.taller_id,
                   'no_pago'::text AS origen, le.created_at AS fecha, 1 AS intentos
              FROM lista_espera le
             WHERE le.estado = 'rechazado' AND le.pagado_at IS NULL AND le.email IS NOT NULL
             ORDER BY LOWER(le.email), le.taller_id, le.created_at DESC)
            UNION ALL
            SELECT LOWER(p.email), p.nombre, p.whatsapp, p.taller_id,
                   'sin_cupo', p.ultimo_intento_at, p.intentos
              FROM prospectos_sin_cupo p
         )
         SELECT b.*, t.nombre AS taller_nombre,
                COALESCE(u.nombre, b.nombre)                  AS nombre_mostrar,
                COALESCE(NULLIF(b.whatsapp, ''), u.whatsapp)  AS whatsapp_final,
                COALESCE(u.avisos_whatsapp, TRUE)             AS avisos_whatsapp,
                COALESCE(u.avisos_correo, TRUE)               AS avisos_correo,
                (COALESCE(u.acceso_bloqueado, FALSE) OR u.baja_solicitada_at IS NOT NULL) AS no_contactar,
                inv.ultima AS ultima_invitacion, COALESCE(inv.n, 0) AS invitaciones
           FROM base b
                JOIN talleres t ON t.id = b.taller_id
                LEFT JOIN usuarios u ON LOWER(u.email) = b.email
                LEFT JOIN LATERAL (
                    SELECT MAX(pi.created_at) AS ultima, COUNT(*)::int AS n
                      FROM prospecto_invitaciones pi
                     WHERE LOWER(pi.email) = b.email AND pi.taller_id = b.taller_id
                ) inv ON TRUE
          WHERE ($1::text IS NULL OR b.origen = $1)
            AND ($2::text IS NULL OR b.taller_id = $2)
            -- Ya no es prospecto si pagó ese taller o lo está apartando otra vez.
            AND NOT EXISTS (
                SELECT 1 FROM lista_espera x
                 WHERE LOWER(x.email) = b.email AND x.taller_id = b.taller_id
                   AND (x.pagado_at IS NOT NULL OR x.estado IN ('pendiente', 'cupo_confirmado', 'confirmado', 'pagado')))
          ORDER BY b.fecha DESC`,
        [origen || null, tallerId || null])

    return rows.map(r => ({
        email: r.email, nombre: r.nombre_mostrar, whatsapp: r.whatsapp_final,
        tallerId: r.taller_id, tallerNombre: r.taller_nombre, origen: r.origen,
        fecha: r.fecha, intentos: r.intentos,
        avisosWhatsapp: r.avisos_whatsapp, avisosCorreo: r.avisos_correo, noContactar: r.no_contactar,
        ultimaInvitacion: r.ultima_invitacion, invitaciones: r.invitaciones,
    }))
}

const dormir = (ms) => new Promise(r => setTimeout(r, ms))

/**
 * Invita a los prospectos elegidos a `tallerId` por WhatsApp y correo.
 * `seleccion`: [{ email, tallerId, origen }] tal como vienen en `listar()`;
 * se vuelven a leer de la BD (no se confía en lo que manda el navegador).
 */
export async function invitar({ seleccion = [], tallerId }) {
    if (!Array.isArray(seleccion) || !seleccion.length) throw new AppError('Elige al menos una persona', 400, 'BAD_REQUEST')
    if (seleccion.length > MAX_POR_ENVIO) {
        throw new AppError(`Máximo ${MAX_POR_ENVIO} personas por envío`, 400, 'DEMASIADOS')
    }
    const { rows: [taller] } = await query(
        `SELECT id, nombre, descripcion, horario, precio, estado,
                to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha
           FROM talleres WHERE id = $1`, [tallerId])
    if (!taller) throw new AppError('Taller no encontrado', 404, 'NOT_FOUND')

    const todos = await listar()
    const clave = (p) => `${p.origen}|${String(p.email).toLowerCase()}|${p.tallerId}`
    const elegidos = new Set(seleccion.map(clave))
    // Una sola invitación por persona en cada envío, aunque salga dos veces.
    const porEmail = new Map()
    for (const p of todos) if (elegidos.has(clave(p)) && !porEmail.has(p.email)) porEmail.set(p.email, p)

    const resultado = { invitados: 0, whatsapp: 0, correo: 0, omitidos: [] }
    for (const p of porEmail.values()) {
        if (p.noContactar) { resultado.omitidos.push({ email: p.email, motivo: 'cuenta bloqueada o dada de baja' }); continue }
        let wa = false, mail = false
        if (p.whatsapp && p.avisosWhatsapp) {
            try {
                await sendWhatsapp(p.whatsapp, mensajeInvitacion({ nombre: p.nombre, origen: p.origen, taller }))
                wa = true
                await dormir(PAUSA_WA_MS)
            } catch (err) { console.error(`[prospectos] WA a ${p.email}:`, err.message) }
        }
        if (p.avisosCorreo) {
            try {
                await sendInvitacionTaller({ to: p.email, nombre: p.nombre, origen: p.origen, taller })
                mail = true
            } catch (err) { console.error(`[prospectos] correo a ${p.email}:`, err.message) }
        }
        if (!wa && !mail) { resultado.omitidos.push({ email: p.email, motivo: 'no se pudo mandar ni WhatsApp ni correo' }); continue }
        await query(
            `INSERT INTO prospecto_invitaciones (email, taller_id, origen, wa_enviado, correo_enviado)
             VALUES ($1, $2, $3, $4, $5)`, [p.email, taller.id, p.origen, wa, mail])
        resultado.invitados++
        if (wa) resultado.whatsapp++
        if (mail) resultado.correo++
    }
    return resultado
}
