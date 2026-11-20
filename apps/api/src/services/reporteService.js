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
import { AppError } from '../middleware/errorHandler.js'
import { notificarAhora } from './notificacionService.js'
import { urlFirmada, subirImagenSoporte } from './storageService.js'

/** Número (10 dígitos MX) al que llegan los avisos. Configurable en .env */
const ADMIN_WA = process.env.ADMIN_WA || null

export const MOTIVOS = {
    SIN_PLATAFORMA: 'sin_acceso_plataforma', // tiene permiso pero no logra entrar
    SIN_TALLER:     'sin_acceso_taller',     // está activo y no ve su taller
    REPORTE_PAGO:   'reporte_pago',          // reporta un pago para cotejar
    PROBLEMA:       'problema_plataforma',   // "Reportar un problema" en Ajustes (T-45)
    BAJA:           'baja_cuenta',           // pidió la baja desde Ajustes (T-45)
}

const MOTIVO_TEXTO = {
    [MOTIVOS.SIN_PLATAFORMA]: 'No puede entrar a la plataforma',
    [MOTIVOS.SIN_TALLER]:     'Está activo y no ve su taller',
    [MOTIVOS.REPORTE_PAGO]:   'REPORTA UN PAGO — cotejar con el banco',
    [MOTIVOS.PROBLEMA]:       'Reporta un problema (desde Ajustes)',
    [MOTIVOS.BAJA]:           'Pidió la BAJA de su cuenta (desde Ajustes)',
}

/** Cómo lo ve la PERSONA en "Mis reportes" (MOTIVO_TEXTO es para Paola). */
const MOTIVO_PERSONA = {
    [MOTIVOS.SIN_PLATAFORMA]: 'No podía entrar a la plataforma',
    [MOTIVOS.SIN_TALLER]:     'No veía mi taller',
    [MOTIVOS.REPORTE_PAGO]:   'Reporte de pago',
    [MOTIVOS.PROBLEMA]:       'Reporte de un problema',
}

/** Pie del WhatsApp a la admin según el motivo. */
const MOTIVO_PIE = {
    [MOTIVOS.REPORTE_PAGO]: '_Revisa el pago antes de liberar el taller._',
    [MOTIVOS.PROBLEMA]:     '_Lo ves completo en el panel → Reportes._',
    [MOTIVOS.BAJA]:         '_Su acceso ya quedó bloqueado. Para reactivarla: panel → Usuarios → desbloquear acceso._',
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
        `🔔 *Reporte ${folioReporte(reporte.id)}*\n\n` +
        `👤 ${reporte.nombre || 'Sin nombre'}\n` +
        `✉️ ${reporte.email}\n` +
        `📱 ${reporte.whatsapp || 'sin número'}\n\n` +
        `⚠️ ${MOTIVO_TEXTO[reporte.motivo] || reporte.motivo}\n` +
        (reporte.detalle ? `📝 ${reporte.detalle}\n` : '') +
        (reporte.comprobante_path && reporte.motivo !== MOTIVOS.REPORTE_PAGO ? '📎 Adjuntó una imagen\n' : '') +
        '\n' + (MOTIVO_PIE[reporte.motivo] ?? '_Revisa el pago antes de liberar el taller._')

    await sendWhatsapp(ADMIN_WA, mensaje)
}

/**
 * Reportes para el panel, con la URL del comprobante ya firmada.
 *
 * Las URLs se firman al vuelo y caducan en una hora: nunca se guarda una URL
 * pública en la BD, porque un comprobante trae nombre, banco y monto.
 */
/** Firma las imágenes de un hilo (la ruta nunca sale de la API). */
async function firmarMensajes(mensajes = []) {
    return Promise.all(mensajes.map(async ({ imagen_path, ...m }) => ({
        ...m,
        imagen_url: imagen_path ? await urlFirmada(imagen_path) : null,
    })))
}

export async function listReportes({ soloAbiertos = false } = {}) {
    const { rows } = await query(
        `SELECT r.*,
                u.id      IS NOT NULL          AS tiene_cuenta,
                u.estado  = 'activo'           AS cuenta_activa,
                u.estado                       AS cuenta_estado,
                COALESCE((SELECT json_agg(json_build_object(
                                    'id', rr.id, 'texto', rr.texto, 'created_at', rr.created_at,
                                    'de_persona', rr.hecho_por = 'persona', 'imagen_path', rr.imagen_path)
                                  ORDER BY rr.created_at)
                            FROM reporte_respuestas rr WHERE rr.reporte_id = r.id), '[]') AS respuestas
         FROM reportes_acceso r
                  LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(r.email)
         ${soloAbiertos ? "WHERE r.estado = 'abierto'" : ''}
         -- Por última actividad: si la persona contesta un reporte viejo, sube arriba.
         ORDER BY GREATEST(r.created_at,
                           (SELECT MAX(rr.created_at) FROM reporte_respuestas rr WHERE rr.reporte_id = r.id)) DESC`
    )

    // Se firman en paralelo; si alguna falla devuelve null y la tarjeta
    // simplemente se muestra sin imagen.
    return Promise.all(rows.map(async (r) => ({
        ...r,
        comprobante_url: r.comprobante_path ? await urlFirmada(r.comprobante_path) : null,
        respuestas: await firmarMensajes(r.respuestas),
    })))
}

/**
 * Paola contesta un reporte desde el panel: se guarda la respuesta y a la
 * persona le llega al momento en su campanita. Con `cerrar`, además se marca
 * como revisado.
 */
export async function responderReporte(id, { texto, cerrar = false } = {}) {
    const limpio = String(texto ?? '').trim()
    if (limpio.length < 2)    throw new AppError('Escribe la respuesta', 400, 'BAD_REQUEST')
    if (limpio.length > 2000) throw new AppError('La respuesta es muy larga (máximo 2000 letras)', 400, 'BAD_REQUEST')

    const { rows: [r] } = await query(
        `SELECT r.id, r.motivo, r.detalle, u.id AS usuario_id
           FROM reportes_acceso r LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(r.email)
          WHERE r.id = $1`, [id])
    if (!r) throw new AppError('Reporte no encontrado', 404, 'NOT_FOUND')
    if (!r.usuario_id) {
        throw new AppError('Esta persona no tiene cuenta, así que no tiene notificaciones. Respóndele por WhatsApp.',
            409, 'SIN_CUENTA')
    }

    const { rows: [resp] } = await query(
        `INSERT INTO reporte_respuestas (reporte_id, texto, usuario_id)
         VALUES ($1, $2, $3) RETURNING id, texto, created_at`, [id, limpio, r.usuario_id])

    await notificarAhora(r.usuario_id, 'respuesta_soporte', `respuesta-${resp.id}`, {
        respuesta: limpio,
        asunto: asuntoDeReporte(r),
        folio: folioReporte(r.id),
        reporteId: r.id,
    })

    if (cerrar) await resolverReporte(id, null)
    return { respuesta: resp, cerrado: !!cerrar }
}

/** Folio legible del reporte: 15 → "R-00015". Igual que folioReporte() en el front. */
export function folioReporte(id) {
    return `R-${String(id).padStart(5, '0')}`
}

/**
 * Los reportes de una persona, con su conversación — para "Mis reportes" en
 * Ajustes → Soporte. No incluye la baja (su cuenta ya está cerrada).
 */
export async function reportesDePersona(email) {
    const { rows } = await query(
        `SELECT r.id, r.motivo, r.detalle, r.estado, r.created_at, r.resuelto_at, r.comprobante_path,
                r.nota = '${NOTA_CERRADO_PERSONA}' AS cerrado_por_persona,
                COALESCE((SELECT json_agg(json_build_object(
                                    'id', rr.id, 'texto', rr.texto, 'created_at', rr.created_at,
                                    'de_persona', rr.hecho_por = 'persona', 'imagen_path', rr.imagen_path)
                                  ORDER BY rr.created_at)
                            FROM reporte_respuestas rr WHERE rr.reporte_id = r.id), '[]') AS mensajes
           FROM reportes_acceso r
          WHERE LOWER(r.email) = LOWER($1) AND r.motivo <> 'baja_cuenta'
          ORDER BY r.created_at DESC
          LIMIT 30`, [email])
    return Promise.all(rows.map(async ({ comprobante_path, ...r }) => ({
        ...r,
        imagen_url: comprobante_path ? await urlFirmada(comprobante_path) : null,
        mensajes: await firmarMensajes(r.mensajes),
        folio:  folioReporte(r.id),
        asunto: /^\[/.test(r.detalle ?? '') ? asuntoDeReporte(r) : (MOTIVO_PERSONA[r.motivo] ?? 'Reporte'),
        // Lo que escribió, sin las etiquetas "[categoría] [taller]" del inicio.
        detalle: String(r.detalle ?? '').replace(/^(\[[^\]]*\]\s*)+/, ''),
    })))
}

/**
 * La persona agrega algo a su reporte. Se reabre (vuelve a "Por revisar")
 * y se le avisa a Paola por WhatsApp.
 */
export async function mensajeDePersona(reporteId, { email, usuarioId, nombre, texto, imagen = null }) {
    const limpio = String(texto ?? '').trim()
    if (limpio.length < 2 && !imagen) throw new AppError('Escribe tu mensaje', 400, 'BAD_REQUEST')
    if (limpio.length > 2000) throw new AppError('El mensaje es muy largo (máximo 2000 letras)', 400, 'BAD_REQUEST')

    const { rows: [r] } = await query(
        `SELECT id, motivo, detalle FROM reportes_acceso
          WHERE id = $1 AND LOWER(email) = LOWER($2) AND motivo <> 'baja_cuenta'`, [reporteId, email])
    // Mismo 404 si no existe o si es de otra persona: no se revela cuál.
    if (!r) throw new AppError('Reporte no encontrado', 404, 'NOT_FOUND')

    // Se sube DESPUÉS de comprobar que el reporte es suyo.
    const imagenPath = imagen ? await subirImagenSoporte(imagen) : null
    const { rows: [msg] } = await query(
        `INSERT INTO reporte_respuestas (reporte_id, texto, usuario_id, hecho_por, imagen_path)
         VALUES ($1, $2, $3, 'persona', $4) RETURNING id, texto, created_at`,
        [r.id, limpio || '📎 Imagen adjunta', usuarioId, imagenPath])
    await query(
        `UPDATE reportes_acceso SET estado = 'abierto', resuelto_at = NULL, nota = NULL WHERE id = $1`, [r.id])

    if (ADMIN_WA) {
        sendWhatsapp(ADMIN_WA,
            `💬 *Nuevo mensaje en el reporte ${folioReporte(r.id)}*\n\n` +
            `👤 ${nombre || email}\n` +
            (asuntoDeReporte(r) ? `📌 ${asuntoDeReporte(r)}\n` : '') +
            `📝 ${limpio || '(sin texto)'}\n` + (imagenPath ? '📎 Adjuntó una imagen\n' : '') +
            `\n_Contéstale en el panel → Reportes._`
        ).catch(err => console.error('[reporteService] aviso de mensaje nuevo:', err.message))
    }
    return { ...msg, de_persona: true, imagen_url: imagenPath ? await urlFirmada(imagenPath) : null }
}

/** Nota que queda cuando la persona misma da por resuelto su reporte. */
export const NOTA_CERRADO_PERSONA = 'La persona lo dio por resuelto'

/**
 * "Ya se resolvió, gracias" en Mis reportes: la persona cierra su reporte.
 * Si después escribe algo más, se reabre igual que siempre.
 */
export async function cerrarPorPersona(reporteId, email) {
    const { rows: [r] } = await query(
        `UPDATE reportes_acceso SET estado = 'resuelto', resuelto_at = NOW(), nota = $3
          WHERE id = $1 AND LOWER(email) = LOWER($2) AND motivo <> 'baja_cuenta'
      RETURNING id`, [reporteId, email, NOTA_CERRADO_PERSONA])
    if (!r) throw new AppError('Reporte no encontrado', 404, 'NOT_FOUND')
    return { cerrado: true }
}

/** "[Perdí el acceso a mi correo] [Iridología] texto…" → "Perdí el acceso a mi correo" */
export function asuntoDeReporte({ motivo, detalle }) {
    const m = /^\[([^\]]+)\]/.exec(String(detalle ?? ''))
    return m ? m[1] : (MOTIVO_TEXTO[motivo] ?? null)
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
