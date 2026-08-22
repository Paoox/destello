/**
 * Destello API — Storage Service (Supabase Storage)
 *
 * Guarda los comprobantes de pago que la gente manda por WhatsApp.
 *
 * POR QUÉ AQUÍ Y NO EN EL BOT: así la llave de servicio de Supabase vive en un
 * solo lugar (la API). El bot solo manda los bytes y se mantiene tonto.
 *
 * POR QUÉ SIN `@supabase/supabase-js`: solo se necesitan dos llamadas HTTP
 * (subir y firmar). Meter el SDK completo por eso sería peso muerto en la
 * Toshiba. Node 20 ya trae `fetch` global.
 *
 * ⚠️ El bucket debe ser PRIVADO. Un comprobante de pago trae nombre, banco y
 * montos: no puede quedar accesible con solo adivinar la URL. Por eso se guarda
 * la RUTA en la BD y se genera una URL firmada y temporal al momento de verla.
 */

const SUPABASE_URL  = process.env.SUPABASE_URL || null
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY || null
const BUCKET        = process.env.SUPABASE_BUCKET_COMPROBANTES || 'comprobantes'

/** Cuánto vive una URL firmada. Una hora alcanza de sobra para revisar el panel. */
const VIGENCIA_URL_SEG = 60 * 60

/** Tope de tamaño. Una foto de WhatsApp ronda 100–500 KB; 8 MB es margen amplio. */
export const MAX_BYTES = 8 * 1024 * 1024

const EXT_POR_MIME = {
    'image/jpeg': 'jpg',
    'image/jpg':  'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
}

/** ¿Está configurado? Si no, el reporte igual se guarda, solo sin imagen. */
export function storageDisponible() {
    return Boolean(SUPABASE_URL && SERVICE_KEY)
}

/**
 * Sube un comprobante y devuelve su ruta dentro del bucket.
 *
 * La ruta NO lleva el correo ni el nombre de la persona: es un identificador
 * aleatorio. Aunque una URL firmada se filtrara, no revelaría de quién es.
 *
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @returns {Promise<string>} ruta guardable en la BD
 */
export async function subirComprobante(buffer, mimetype = 'image/jpeg') {
    if (!storageDisponible()) {
        throw new Error('Supabase Storage no está configurado (falta SUPABASE_URL o SUPABASE_SERVICE_KEY)')
    }
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error('Comprobante vacío')
    }
    if (buffer.length > MAX_BYTES) {
        throw new Error(`El comprobante pesa ${(buffer.length / 1048576).toFixed(1)} MB (máximo ${MAX_BYTES / 1048576} MB)`)
    }

    const ext   = EXT_POR_MIME[mimetype] || 'jpg'
    const ahora = new Date()
    // Carpetas por año/mes para que el bucket siga siendo navegable con el tiempo.
    const ruta  =
        `${ahora.getFullYear()}/${String(ahora.getMonth() + 1).padStart(2, '0')}/` +
        `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`

    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${ruta}`, {
        method:  'POST',
        headers: {
            Authorization:  `Bearer ${SERVICE_KEY}`,
            'Content-Type': mimetype,
            'cache-control': '3600',
        },
        body: buffer,
    })

    if (!res.ok) {
        const detalle = await res.text().catch(() => '')
        throw new Error(`Supabase Storage respondió ${res.status}: ${detalle.slice(0, 200)}`)
    }

    return ruta
}

/**
 * URL temporal para ver un comprobante. Devuelve null si algo falla: nunca debe
 * tumbar la carga de la bandeja de reportes por una imagen que no se pudo firmar.
 */
export async function urlFirmada(ruta, segundos = VIGENCIA_URL_SEG) {
    if (!ruta || !storageDisponible()) return null

    try {
        const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${ruta}`, {
            method:  'POST',
            headers: {
                Authorization:  `Bearer ${SERVICE_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ expiresIn: segundos }),
        })

        if (!res.ok) {
            console.error('[storage] No se pudo firmar', ruta, '→', res.status)
            return null
        }

        const { signedURL, signedUrl } = await res.json()
        const parcial = signedURL || signedUrl
        return parcial ? `${SUPABASE_URL}/storage/v1${parcial}` : null
    } catch (err) {
        console.error('[storage] Error al firmar:', err.message)
        return null
    }
}
