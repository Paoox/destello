/**
 * Destello — Certificados
 *
 * Regla que pidió Paola (23 ago 2026): **certifica quien asistió**, no quien
 * pagó. «Qué pasa con las personas que por X no puedan acceder al taller — no
 * tendrían por qué tener un certificado.»
 *
 * ── Por qué un certificado se escribe y no se calcula ───────────────────────
 * Los datos se COPIAN al emitir. Si se leyeran por JOIN, cambiar mañana el
 * umbral de minutos, el nombre del instructor o cómo se escribe el nombre de
 * la persona reescribiría un papel que alguien ya descargó y compartió. Un
 * certificado dice lo que decía el día que se emitió.
 *
 * Y por lo mismo no se borra: se **anula**, guardando el motivo. Borrarlo
 * dejaría un folio circulando sin nada que lo respalde.
 */

import { randomBytes } from 'node:crypto'
import { query, withTransaction } from '../db/db.js'

/**
 * Minutos con el aula abierta a partir de los cuales se considera que la
 * persona tomó el taller.
 *
 * Vive aquí y no en la base a propósito: es una decisión de negocio, y Paola
 * puede querer cambiarla después de ver el primer taller real. Cambiarla NO
 * afecta a los certificados ya emitidos — ese es justo el punto de escribirlos.
 */
export const MINUTOS_PARA_CERTIFICAR = 20

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin I, O, 0, 1: se confunden al dictarlo

function codigoAleatorio(n) {
    const b = randomBytes(n)
    let s = ''
    for (let i = 0; i < n; i++) s += ALFABETO[b[i] % ALFABETO.length]
    return s
}

/** Folio legible por teléfono: DST-2026-K7M3QP */
function generarFolio() {
    return `DST-${new Date().getFullYear()}-${codigoAleatorio(6)}`
}

/**
 * Emite un certificado para una persona.
 *
 * Idempotente: si ya tiene uno vigente de ese taller, devuelve el que ya
 * existe en vez de crear otro. Emitir dos veces el mismo certificado sería
 * dar dos folios para un solo hecho.
 */
export async function emitir(email, tallerId, { actor = 'automatico', minutos = null } = {}) {
    const correo = String(email).trim().toLowerCase()

    return withTransaction(async (q) => {
        const yaTiene = await q(
            `SELECT * FROM certificados
              WHERE LOWER(usuario_email) = LOWER($1) AND taller_id = $2 AND anulado = FALSE`,
            [correo, tallerId])
        if (yaTiene.rows.length) return { certificado: yaTiene.rows[0], nuevo: false }

        const datos = await q(
            `SELECT u.nombre_certificado, u.nombre, u.apellido,
                    t.nombre AS taller_nombre, t.instructor, t.duracion_horas, t.fecha_inicio
               FROM usuarios u, talleres t
              WHERE LOWER(u.email) = LOWER($1) AND t.id = $2`,
            [correo, tallerId])
        if (!datos.rows.length) {
            throw new Error('No existe esa persona o ese taller')
        }
        const d = datos.rows[0]

        // Si nunca dijo cómo quiere aparecer, se usa su nombre de cuenta. Es
        // mejor un certificado con el nombre de la cuenta que ningún
        // certificado; el pop-up de Inicio existe justo para evitar este caso.
        const nombre = (d.nombre_certificado?.trim())
            || [d.nombre, d.apellido].filter(Boolean).join(' ').trim()
        if (!nombre) throw new Error('Esa cuenta no tiene ningún nombre que poner en el certificado')

        // Reintento por si dos emisiones simultáneas generan el mismo folio.
        // Es improbable (32^6), pero un choque aquí perdería un certificado.
        for (let intento = 0; intento < 5; intento++) {
            try {
                const { rows } = await q(
                    `INSERT INTO certificados
                       (folio, usuario_email, taller_id, nombre, taller_nombre,
                        instructor, duracion_horas, fecha_taller, emitido_por, minutos_presente)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                     RETURNING *`,
                    [generarFolio(), correo, tallerId, nombre, d.taller_nombre,
                     d.instructor, d.duracion_horas, d.fecha_inicio, actor, minutos])
                return { certificado: rows[0], nuevo: true }
            } catch (e) {
                if (e.code === '23505' && String(e.detail ?? '').includes('folio')) continue
                throw e
            }
        }
        throw new Error('No se pudo generar un folio único')
    })
}

/**
 * Emite en bloque para todos los que asistieron lo suficiente.
 *
 * Devuelve también a quién NO se le emitió y por qué, porque una emisión
 * silenciosa que deja gente fuera se lee como "ya está todo" cuando no lo está.
 */
export async function emitirTaller(tallerId, { minMinutos = MINUTOS_PARA_CERTIFICAR, actor = 'automatico' } = {}) {
    const { rows } = await query(
        `SELECT usuario_email, minutos, entro, tiene_certificado
           FROM v_asistencia_taller
          WHERE taller_id = $1`,
        [tallerId])

    const emitidos = []
    const omitidos = []

    for (const p of rows) {
        if (p.tiene_certificado) { omitidos.push({ ...p, motivo: 'ya tenía' }); continue }
        if (!p.entro)            { omitidos.push({ ...p, motivo: 'no entró al aula' }); continue }
        if (Number(p.minutos) < minMinutos) {
            omitidos.push({ ...p, motivo: `solo estuvo ${p.minutos} min` }); continue
        }
        try {
            const { certificado } = await emitir(p.usuario_email, tallerId,
                { actor, minutos: p.minutos })
            emitidos.push(certificado)
        } catch (e) {
            omitidos.push({ ...p, motivo: e.message })
        }
    }

    return { emitidos, omitidos, minMinutos }
}

/** Anular. No se borra: el folio ya pudo haber circulado. */
export async function anular(folio, { motivo, actor } = {}) {
    const { rows } = await query(
        `UPDATE certificados
            SET anulado = TRUE, anulado_at = NOW(),
                anulado_motivo = $2
          WHERE folio = $1 AND anulado = FALSE
        RETURNING *`,
        [folio, motivo ? `${motivo}${actor ? ` (${actor})` : ''}` : `anulado por ${actor ?? 'admin'}`])
    return rows[0] ?? null
}

/** Los certificados de una persona, del más nuevo al más viejo. */
export async function deUsuario(email) {
    const { rows } = await query(
        `SELECT folio, taller_id, taller_nombre, nombre, instructor,
                duracion_horas, fecha_taller, created_at
           FROM certificados
          WHERE LOWER(usuario_email) = LOWER($1) AND anulado = FALSE
          ORDER BY COALESCE(fecha_taller, created_at::date) DESC, created_at DESC`,
        [String(email).trim()])
    return rows
}

/**
 * Consulta pública por folio: sirve para comprobar que un certificado es real.
 * Devuelve lo mínimo — nombre, taller, fecha. **Nunca el correo**: el folio lo
 * puede traer cualquiera a quien se lo hayan compartido.
 */
export async function porFolio(folio) {
    const { rows } = await query(
        `SELECT folio, nombre, taller_nombre, instructor, duracion_horas,
                fecha_taller, created_at, anulado
           FROM certificados WHERE folio = $1`,
        [String(folio).trim().toUpperCase()])
    return rows[0] ?? null
}
