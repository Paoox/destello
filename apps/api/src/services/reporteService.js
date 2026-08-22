/**
 * Destello API — Reportes de Acceso
 *
 * Cuando un alumno reporta por el bot que no puede entrar (a la plataforma o a
 * un taller que ya pagó), se guarda aquí un reporte y se le avisa a la admin por
 * WhatsApp. El bot NUNCA libera un taller solo — eso lo hace la admin desde el
 * panel después de verificar el pago.
 */
import { query } from '../db/db.js'
import { sendWhatsapp } from './botService.js'
import { urlFirmada } from './storageService.js'

/** Número (10 dígitos MX) al que llegan los avisos. Configurable en .env */
const ADMIN_WA = process.env.ADMIN_WA || null

export const MOTIVOS = {
    SIN_PLATAFORMA: 'sin_acceso_plataforma', // tiene permiso pero no logra entrar
    SIN_TALLER:     'sin_acceso_taller',     // está activo y no ve su taller
    REPORTE_PAGO:   'reporte_pago',          // reporta un pago para cotejar
}

const MOTIVO_TEXTO = {
    [MOTIVOS.SIN_PLATAFORMA]: 'No puede entrar a la plataforma',
    [MOTIVOS.SIN_TALLER]:     'Está activo y no ve su taller',
    [MOTIVOS.REPORTE_PAGO]:   'REPORTA UN PAGO — cotejar con el banco',
}

/**
 * Crea un reporte y avisa por WhatsApp a la admin.
 * El aviso es best-effort: si el bot no responde, el reporte igual queda guardado.
 */
export async function crearReporte({ email, nombre, whatsapp, motivo, detalle = null, comprobantePath = null, permitirDuplicado = false }) {
    const emailNorm = String(email).toLowerCase().trim()

    // Si ya hay un reporte abierto por el mismo motivo, no duplicar.
    //
    // EXCEPCIÓN (permitirDuplicado): los reportes de PAGO sí se repiten a
    // propósito. Una persona puede pagar dos talleres, o mandar el comprobante
    // de una transferencia y luego el de otra. Silenciar el segundo haría que un
    // pago real se perdiera sin que nadie se entere.
    if (!permitirDuplicado) {
        const { rows: abiertos } = await query(
            `SELECT * FROM reportes_acceso
             WHERE LOWER(email) = $1 AND motivo = $2 AND estado = 'abierto'`,
            [emailNorm, motivo]
        )
        if (abiertos.length > 0) {
            return { nuevo: false, reporte: abiertos[0] }
        }
    }

    const { rows } = await query(
        `INSERT INTO reportes_acceso (email, nombre, whatsapp, motivo, detalle, comprobante_path, estado)
         VALUES ($1, $2, $3, $4, $5, $6, 'abierto')
         RETURNING *`,
        [emailNorm, nombre || null, whatsapp || null, motivo, detalle, comprobantePath]
    )
    const reporte = rows[0]

    await avisarAdmin(reporte).catch(err => {
        console.error('[reporteService] No se pudo avisar por WA:', err.message)
    })

    return { nuevo: true, reporte }
}

async function avisarAdmin(reporte) {
    if (!ADMIN_WA) {
        console.warn('[reporteService] ADMIN_WA no configurado — se omite el aviso')
        return
    }

    const mensaje =
        '🔔 *Reporte de acceso*\n\n' +
        `👤 ${reporte.nombre || 'Sin nombre'}\n` +
        `✉️ ${reporte.email}\n` +
        `📱 ${reporte.whatsapp || 'sin número'}\n\n` +
        `⚠️ ${MOTIVO_TEXTO[reporte.motivo] || reporte.motivo}\n` +
        (reporte.detalle ? `📝 ${reporte.detalle}\n` : '') +
        '\n_Revisa el pago antes de liberar el taller._'

    await sendWhatsapp(ADMIN_WA, mensaje)
}

/**
 * Reportes para el panel, con la URL del comprobante ya firmada.
 *
 * Las URLs se firman al vuelo y caducan en una hora: nunca se guarda una URL
 * pública en la BD, porque un comprobante trae nombre, banco y monto.
 */
export async function listReportes({ soloAbiertos = false } = {}) {
    const { rows } = await query(
        `SELECT r.*,
                u.id      IS NOT NULL          AS tiene_cuenta,
                u.estado  = 'activo'           AS cuenta_activa,
                u.estado                       AS cuenta_estado
         FROM reportes_acceso r
                  LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(r.email)
         ${soloAbiertos ? "WHERE r.estado = 'abierto'" : ''}
         ORDER BY r.created_at DESC`
    )

    // Se firman en paralelo; si alguna falla devuelve null y la tarjeta
    // simplemente se muestra sin imagen.
    return Promise.all(rows.map(async (r) => ({
        ...r,
        comprobante_url: r.comprobante_path ? await urlFirmada(r.comprobante_path) : null,
    })))
}

export async function resolverReporte(id, nota = null) {
    const { rows } = await query(
        `UPDATE reportes_acceso
         SET estado = 'resuelto', resuelto_at = NOW(), nota = $2
         WHERE id = $1
         RETURNING *`,
        [id, nota]
    )
    return rows[0] ?? null
}
