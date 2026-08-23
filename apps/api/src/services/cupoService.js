/**
 * Destello API — Cupo de los talleres
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 *
 * `talleres.cupo_maximo` se guardaba y se editaba desde el panel, pero **ningún
 * endpoint lo consultaba antes de inscribir a alguien**. Se podía sobrevender un
 * taller sin que nada avisara — y en un taller en vivo eso significa gente que
 * pagó y se queda sin lugar.
 *
 * ── La regla ────────────────────────────────────────────────────────────────
 *
 * Ocupa lugar quien está en `cupo_confirmado` o `pagado`. Los `pendiente` NO:
 * están formados, todavía sin permiso. Y quien tenía chispa y ya se le venció
 * deja de ocupar — así una cortesía sin usar libera su asiento sola.
 *
 * El cálculo vive en la vista `v_cupo_taller` (migración 008), no aquí. Una
 * sola fórmula para todos: el panel, el bot y el Habitat leen lo mismo. Dos
 * fórmulas para la misma cosa es como empiezan los números que no cuadran.
 */

import { query } from '../db/db.js'

/**
 * Estado del cupo de un taller.
 *
 * @returns {Promise<{
 *   id: string, nombre: string, cupoMaximo: number, ocupados: number,
 *   libres: number, agotado: boolean, sinLimite: boolean
 * } | null>}  null si el taller no existe
 */
export async function estadoCupo(tallerId) {
    if (!tallerId) return null
    const { rows } = await query(
        `SELECT id, nombre, cupo_maximo, cupo_ocupado, lugares_libres, agotado
           FROM v_cupo_taller WHERE id = $1`,
        [tallerId]
    )
    if (!rows.length) return null
    const r = rows[0]
    return {
        id:         r.id,
        nombre:     r.nombre,
        cupoMaximo: Number(r.cupo_maximo),
        ocupados:   Number(r.cupo_ocupado),
        libres:     Number(r.lugares_libres),
        agotado:    r.agotado,
        // Un cupo_maximo de 0 o NULL significa SIN LÍMITE, no "cero lugares".
        // Sin esta distinción, un taller al que se le olvidó poner cupo
        // rechazaría a todo el mundo.
        sinLimite:  Number(r.cupo_maximo) <= 0,
    }
}

/**
 * ¿Se puede meter a alguien más a este taller?
 *
 * Se usa ANTES de inscribir, de confirmar un lugar o de crear una chispa.
 * Si el taller no existe devuelve `hayCupo: true` — no es tarea de esta función
 * validar que el taller exista, y bloquear por algo que no le toca escondería
 * el error real.
 *
 * @returns {Promise<{ hayCupo: boolean, cupo: object|null, motivo: string|null }>}
 */
export async function hayCupo(tallerId) {
    const cupo = await estadoCupo(tallerId)
    if (!cupo) return { hayCupo: true, cupo: null, motivo: null }
    if (cupo.sinLimite) return { hayCupo: true, cupo, motivo: null }
    if (cupo.agotado) {
        return {
            hayCupo: false,
            cupo,
            motivo:  `El taller "${cupo.nombre}" ya está lleno (${cupo.ocupados}/${cupo.cupoMaximo}).`,
        }
    }
    return { hayCupo: true, cupo, motivo: null }
}

/**
 * Sincroniza `talleres.estado` con la realidad del cupo.
 *
 * Se llama después de inscribir o de liberar un lugar. Mantiene el estado
 * 'lleno' al día solo, para que el Habitat y el bot no tengan que calcular
 * nada: les basta con leer el taller.
 *
 * Solo mueve entre 'activo' y 'lleno'. Nunca toca 'proximamente', 'pausado' ni
 * 'borrador': esos los decide Paola y no le corresponde a un automatismo
 * cambiarlos.
 */
export async function sincronizarEstadoCupo(tallerId) {
    if (!tallerId) return null
    try {
        const { rows } = await query(
            `UPDATE talleres t
                SET estado = CASE WHEN cu.agotado THEN 'lleno' ELSE 'activo' END,
                    updated_at = NOW()
               FROM v_cupo_taller cu
              WHERE cu.id = t.id
                AND t.id = $1
                AND t.estado IN ('activo', 'lleno')
                AND t.estado <> CASE WHEN cu.agotado THEN 'lleno' ELSE 'activo' END
            RETURNING t.id, t.estado`,
            [tallerId]
        )
        return rows[0] ?? null
    } catch (err) {
        // Que no se pueda actualizar la etiqueta no debe tumbar una inscripción
        // que ya es válida.
        console.error('[cupo] No se pudo sincronizar el estado:', err.message)
        return null
    }
}

/** Cupo de todos los talleres, para pintar el Habitat de una sola consulta. */
export async function cupoDeTodos() {
    const { rows } = await query(
        `SELECT id, cupo_maximo, cupo_ocupado, lugares_libres, agotado
           FROM v_cupo_taller`
    )
    return new Map(rows.map(r => [r.id, {
        cupoMaximo: Number(r.cupo_maximo),
        ocupados:   Number(r.cupo_ocupado),
        libres:     Number(r.lugares_libres),
        agotado:    Number(r.cupo_maximo) > 0 && r.agotado,
    }]))
}
