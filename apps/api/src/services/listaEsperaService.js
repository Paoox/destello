/**
 * Destello API — Lista de Espera Service
 */
import { query } from '../db/db.js'

export async function listTodas() {
    const { rows } = await query(
        `SELECT le.*,
                t.nombre AS taller_nombre,
                EXISTS (
                    SELECT 1 FROM resplandores r
                    WHERE LOWER(r.email) = LOWER(le.email)
                ) AS tiene_resplandor
         FROM lista_espera le
                  JOIN talleres t ON t.id = le.taller_id
         ORDER BY le.created_at DESC`
    )
    return rows
}

export async function listPorTaller(tallerId) {
    const { rows } = await query(
        `SELECT le.*, t.nombre AS taller_nombre
         FROM lista_espera le
                  JOIN talleres t ON t.id = le.taller_id
         WHERE le.taller_id = $1
         ORDER BY le.created_at ASC`,
        [tallerId]
    )
    return rows
}

/**
 * Da de alta a alguien en la lista de espera de un taller.
 *
 * `origen` dice POR DÓNDE llegó — 'bot' (WhatsApp), 'web' (modal del Habitat)
 * o 'admin' (alta manual). Sin ese dato no se puede saber qué canal trae más
 * gente ni cuál convierte mejor, que es lo primero que se quiere saber en
 * cuanto se empieza a pagar publicidad.
 */
export async function registrarEnLista({ email, tallerId, nombre, whatsapp, origen = null }) {
    const emailNorm = email.toLowerCase().trim()

    // ── Un lugar por persona y por taller ───────────────────────────────────
    //
    // La regla de negocio: cada quien necesita su propia cuenta para tomar la
    // clase, aunque sean familiares. Así que nadie puede ocupar dos lugares del
    // mismo taller.
    //
    // Se revisan DOS cosas, no una:
    //
    //   1. ¿Ya está en la lista? (comparando en minúsculas — antes se comparaba
    //      con `email = $1` contra la columna cruda, así que "Ana@x.com" y
    //      "ana@x.com" pasaban como personas distintas.)
    //
    //   2. ¿Ya tiene una chispa viva de ese taller? Esto es lo que faltaba.
    //      Las cortesías viejas no dejaban renglón en `lista_espera`, así que
    //      alguien con acceso por demo podía volver a inscribirse por el bot y
    //      terminar ocupando DOS lugares del mismo taller.
    const { rows: existe } = await query(
        `SELECT * FROM lista_espera WHERE LOWER(email) = $1 AND taller_id = $2`,
        [emailNorm, tallerId]
    )
    if (existe.length > 0) return { nuevo: false, registro: existe[0] }

    const { rows: conAcceso } = await query(
        `SELECT code, is_demo FROM chispas
          WHERE LOWER(usuario_email) = $1
            AND taller_id = $2
            AND revoked = FALSE
            AND (expires_at IS NULL OR expires_at > NOW())
          LIMIT 1`,
        [emailNorm, tallerId]
    )
    if (conAcceso.length > 0) {
        return {
            nuevo:         false,
            yaTieneAcceso: true,
            esCortesia:    !!conAcceso[0].is_demo,
            registro:      null,
        }
    }

    const { rows } = await query(
        `INSERT INTO lista_espera (email, taller_id, nombre, whatsapp, estado, origen)
         VALUES ($1, $2, $3, $4, 'pendiente', $5) RETURNING *`,
        [emailNorm, tallerId, nombre || null, whatsapp || null, origen]
    )
    return { nuevo: true, registro: rows[0] }
}

export async function actualizarEstado(id, estado) {
    const { rows } = await query(
        `UPDATE lista_espera SET estado = $1 WHERE id = $2 RETURNING *`,
        [estado, id]
    )
    return rows[0] ?? null
}

export async function getListasPorEmail(email) {
    const { rows } = await query(
        `SELECT le.*, t.nombre AS taller_nombre
         FROM lista_espera le
                  JOIN talleres t ON t.id = le.taller_id
         WHERE le.email = $1
         ORDER BY le.created_at DESC`,
        [email.toLowerCase().trim()]
    )
    return rows
}

/**
 * Devuelve chispas activas y resplandores activos pendientes para un email.
 * Usado por el bot cuando el alumno dice "no me llegó mi código".
 */
export async function getPendientesPorEmail(email) {
    const emailNorm = email.toLowerCase().trim()

    const { rows: chispas } = await query(
        `SELECT c.code, t.nombre AS taller_nombre
         FROM chispas c
                  JOIN talleres t ON t.id = c.taller_id
         WHERE LOWER(c.usuario_email) = $1
           AND c.used = FALSE
           AND c.revoked = FALSE
           AND (c.expires_at IS NULL OR c.expires_at > NOW())`,
        [emailNorm]
    )

    const { rows: resplandores } = await query(
        `SELECT code, email
         FROM resplandores
         WHERE LOWER(email) = $1
           AND used = FALSE
           AND revoked = FALSE
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [emailNorm]
    )

    return { chispas, resplandores }
}