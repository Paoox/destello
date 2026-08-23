/**
 * Destello API — Conversaciones del bot Faro
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 *
 * El estado de cada conversación vivía en un `Map()` en memoria dentro de
 * `apps/bot/src/flujo.js`. Dos consecuencias, y la primera importa más que la
 * segunda:
 *
 *   1. **Cada vez que se reinicia el bot, toda la gente que estaba a media
 *      captura pierde su conversación.** Le pediste el correo, iba a mandarlo,
 *      reiniciaste el bot, y de pronto el bot no sabe quién es. Eso ya está
 *      pasando hoy, y es una mala experiencia real — no solo una métrica.
 *
 *   2. No hay forma de saber en qué paso se cae la gente. El embudo del bot
 *      (cuántos empiezan vs cuántos terminan inscritos) era invisible.
 *
 * Guardar la conversación resuelve las dos cosas con la misma tabla.
 *
 * ── Qué NO se guarda ────────────────────────────────────────────────────────
 *
 * El texto de los mensajes. No hace falta para el embudo y sería guardar
 * conversaciones privadas sin ninguna razón. Solo se guarda en qué paso va y
 * los datos que la persona ya dio para inscribirse.
 */

import { query } from '../db/db.js'

/**
 * Guarda (o actualiza) el estado de una conversación.
 * Nunca lanza: si esto falla, el bot debe seguir contestando igual.
 *
 * @param {object} c
 * @param {string} c.jid        identificador de WhatsApp — la llave primaria
 * @param {string} [c.whatsapp] 10 dígitos, cuando se pudo extraer
 * @param {string} [c.email]
 * @param {string} [c.paso]     PASO.* actual
 * @param {object} [c.datos]    lo que ya dio (nombre, taller elegido…)
 * @param {boolean}[c.completada] llegó hasta la lista de espera
 */
export async function guardarConversacion({
    jid, whatsapp = null, email = null, paso = null,
    datos = {}, completada = false,
} = {}) {
    if (!jid) return null
    try {
        const { rows } = await query(
            `INSERT INTO bot_conversaciones
                (jid, whatsapp, email, paso, datos, mensajes, completada, abandonada_en)
             VALUES ($1, $2, $3, $4, $5::jsonb, 1, $6, CASE WHEN $6 THEN NULL ELSE $4 END)
             ON CONFLICT (jid) DO UPDATE
               SET whatsapp   = COALESCE(EXCLUDED.whatsapp, bot_conversaciones.whatsapp),
                   email      = COALESCE(EXCLUDED.email,    bot_conversaciones.email),
                   paso       = EXCLUDED.paso,
                   datos      = EXCLUDED.datos,
                   mensajes   = bot_conversaciones.mensajes + 1,
                   -- una vez completada, se queda completada: si vuelve a
                   -- escribir para otro taller no se le quita el logro anterior
                   completada = bot_conversaciones.completada OR EXCLUDED.completada,
                   -- el último paso donde se quedó, para medir dónde se cae la
                   -- gente. Se limpia cuando termina bien.
                   abandonada_en = CASE
                       WHEN bot_conversaciones.completada OR EXCLUDED.completada
                       THEN NULL ELSE EXCLUDED.paso END,
                   updated_at = NOW()
             RETURNING jid`,
            [jid, whatsapp, email ? String(email).toLowerCase().trim() : null,
             paso, JSON.stringify(datos ?? {}), !!completada]
        )
        return rows[0]?.jid ?? null
    } catch (err) {
        console.error('[bot-conv] No se pudo guardar la conversación:', err.message)
        return null
    }
}

/**
 * Recupera una conversación para que sobreviva a un reinicio del bot.
 *
 * Solo devuelve conversaciones **de las últimas 6 horas**: retomar una charla
 * de hace tres días en el paso "dame tu correo" sería más confuso que empezar
 * de cero. Después de ese rato, la persona ya no se acuerda del contexto.
 *
 * Devuelve null si no hay nada que retomar.
 */
export async function obtenerConversacion(jid) {
    if (!jid) return null
    try {
        const { rows } = await query(
            `SELECT jid, whatsapp, email, paso, datos, completada, updated_at
               FROM bot_conversaciones
              WHERE jid = $1
                AND updated_at > NOW() - INTERVAL '6 hours'
              LIMIT 1`,
            [jid]
        )
        return rows[0] ?? null
    } catch (err) {
        console.error('[bot-conv] No se pudo leer la conversación:', err.message)
        return null
    }
}

/** Marca la conversación como terminada con éxito (llegó a la lista de espera). */
export async function marcarCompletada(jid) {
    if (!jid) return
    try {
        await query(
            `UPDATE bot_conversaciones
                SET completada = TRUE, abandonada_en = NULL, updated_at = NOW()
              WHERE jid = $1`,
            [jid]
        )
    } catch (err) {
        console.error('[bot-conv] No se pudo marcar como completada:', err.message)
    }
}
