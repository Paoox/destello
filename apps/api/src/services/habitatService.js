/**
 * Hábitat + Supernovas (19 nov 2026, migración 027).
 * Saldo = SUMA del libro mayor `supernovas_movimientos`.
 */
import { query, withTransaction } from '../db/db.js'
import { AppError } from '../middleware/errorHandler.js'
import { CATALOGO, POR_ID, LUGARES, PUESTOS_INICIALES, limpiarPuestos,
         SUPERNOVAS_POR_TALLER, SUPERNOVAS_POR_REFERIDO, SUPERNOVAS_POR_RETO, RETO_SEGUNDOS,
         disponibilidadSello, evaluarReto } from './habitatCatalogo.js'

async function saldoDe(usuarioId, q = query) {
    const { rows } = await q('SELECT COALESCE(SUM(cantidad), 0)::int AS saldo FROM supernovas_movimientos WHERE usuario_id = $1', [usuarioId])
    return rows[0].saldo
}

/** Acredita (idempotente por motivo+ref). `q` permite usarlo dentro de otra transacción. */
export async function acreditar(usuarioId, { cantidad, motivo, ref, detalle = null }, q = query) {
    const { rowCount } = await q(
        `INSERT INTO supernovas_movimientos (usuario_id, cantidad, motivo, ref, detalle)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [usuarioId, cantidad, motivo, String(ref), detalle])
    return rowCount > 0
}

export const acreditarTaller = (usuarioId, listaEsperaId, tallerNombre, q = query) =>
    acreditar(usuarioId, { cantidad: SUPERNOVAS_POR_TALLER, motivo: 'taller', ref: `le-${listaEsperaId}`, detalle: tallerNombre }, q)

export const acreditarReferido = (usuarioId, referidoEmail, q = query) =>
    acreditar(usuarioId, { cantidad: SUPERNOVAS_POR_REFERIDO, motivo: 'referido', ref: String(referidoEmail).toLowerCase(), detalle: 'Invitaste a alguien' }, q)

export async function estado(usuarioId) {
    const [saldo, propios, casa, movs] = await Promise.all([
        saldoDe(usuarioId),
        query('SELECT objeto_id FROM habitat_objetos WHERE usuario_id = $1', [usuarioId]),
        query('SELECT puestos FROM habitat_casa WHERE usuario_id = $1', [usuarioId]),
        query(`SELECT cantidad, motivo, detalle, created_at FROM supernovas_movimientos
                WHERE usuario_id = $1 ORDER BY created_at DESC, id DESC LIMIT 15`, [usuarioId]),
    ])
    const mios = propios.rows.map(r => r.objeto_id)
    return {
        saldo,
        catalogo: CATALOGO,
        lugares: LUGARES,
        propios: [...new Set([...CATALOGO.filter(x => x.precio === 0).map(x => x.id), ...mios])],
        puestos: limpiarPuestos(casa.rows[0]?.puestos ?? PUESTOS_INICIALES, mios),
        movimientos: movs.rows,
        reglas: { porTaller: SUPERNOVAS_POR_TALLER, porReferido: SUPERNOVAS_POR_REFERIDO, porReto: SUPERNOVAS_POR_RETO },
    }
}

/** Compra y lo pone de una vez en su lugar. */
export async function comprar(usuarioId, objetoId) {
    const obj = POR_ID[objetoId]
    if (!obj || obj.precio === 0) throw new AppError('Ese objeto no está a la venta', 404, 'NOT_FOUND')
    await withTransaction(async (q) => {
        // Candado por persona: dos compras al mismo tiempo no gastan dos veces.
        await q('SELECT id FROM usuarios WHERE id = $1 FOR UPDATE', [usuarioId])
        const { rows: ya } = await q('SELECT 1 FROM habitat_objetos WHERE usuario_id = $1 AND objeto_id = $2', [usuarioId, objetoId])
        if (ya.length) throw new AppError('Ya lo tienes', 409, 'YA_LO_TIENES')
        const saldo = await saldoDe(usuarioId, q)
        if (saldo < obj.precio) throw new AppError(`Te faltan ${obj.precio - saldo} Supernovas`, 409, 'SALDO_INSUFICIENTE')
        await q(`INSERT INTO supernovas_movimientos (usuario_id, cantidad, motivo, ref, detalle)
                 VALUES ($1, $2, 'compra', $3, $4)`, [usuarioId, -obj.precio, objetoId, obj.nombre])
        await q('INSERT INTO habitat_objetos (usuario_id, objeto_id) VALUES ($1, $2)', [usuarioId, objetoId])
        const { rows } = await q('SELECT puestos FROM habitat_casa WHERE usuario_id = $1', [usuarioId])
        const puestos = { ...(rows[0]?.puestos ?? PUESTOS_INICIALES), [obj.lugar]: objetoId }
        await guardarEn(q, usuarioId, puestos)
    })
    return estado(usuarioId)
}

async function guardarEn(q, usuarioId, puestos) {
    const { rows } = await q('SELECT objeto_id FROM habitat_objetos WHERE usuario_id = $1', [usuarioId])
    const limpio = limpiarPuestos(puestos, rows.map(r => r.objeto_id))
    await q(`INSERT INTO habitat_casa (usuario_id, puestos) VALUES ($1, $2)
             ON CONFLICT (usuario_id) DO UPDATE SET puestos = EXCLUDED.puestos, updated_at = NOW()`,
        [usuarioId, JSON.stringify(limpio)])
}

/** Poner / quitar / cambiar lo que ya tiene. */
export async function acomodar(usuarioId, puestos) {
    if (!puestos || typeof puestos !== 'object') throw new AppError('Datos inválidos', 400, 'BAD_REQUEST')
    await guardarEn(query, usuarioId, puestos)
    return estado(usuarioId)
}


// ══════════════════════════════════════════════════════════════════════════
// Sellos que abren actividades (migración 029)
// ══════════════════════════════════════════════════════════════════════════

/** Los sellos de la persona, con su actividad, si se puede jugar y su reto. */
export async function sellos(usuarioId) {
    const { rows } = await query(
        `SELECT i.id, i.nombre AS sello, i.taller_id, t.nombre AS taller_nombre, i.created_at,
                i.actividad_id, i.actividad_tipo, i.acceso,
                COALESCE(t.fecha_fin, t.fecha_inicio)::text AS fecha_taller,
                EXISTS (SELECT 1 FROM supernovas_movimientos m
                         WHERE m.usuario_id = u.id AND m.motivo = 'reto' AND m.ref = i.actividad_id) AS reto_ganado,
                (SELECT MIN(j.segundos) FROM habitat_juegos j
                  JOIN insignias i2 ON i2.id = j.insignia_id
                 WHERE j.usuario_id = u.id AND i2.actividad_id = i.actividad_id) AS mejor_tiempo
           FROM usuarios u
           JOIN insignias i ON LOWER(i.usuario_email) = LOWER(u.email)
           LEFT JOIN talleres t ON t.id = i.taller_id
          WHERE u.id = $1
          ORDER BY i.created_at`, [usuarioId])
    return rows.map(({ fecha_taller, ...r }) => {
        if (!r.actividad_id) return { ...r, juego: null }
        const d = disponibilidadSello({ acceso: r.acceso, fechaTaller: fecha_taller })
        return {
            ...r,
            juego: {
                id: r.actividad_id, tipo: r.actividad_tipo, acceso: r.acceso,
                disponible: d.disponible, venceAt: d.venceAt, motivo: d.motivo,
                reto: RETO_SEGUNDOS[r.actividad_tipo]
                    ? { segundos: RETO_SEGUNDOS[r.actividad_tipo], supernovas: SUPERNOVAS_POR_RETO, ganado: r.reto_ganado }
                    : null,
                mejorTiempo: r.mejor_tiempo == null ? null : Number(r.mejor_tiempo),
            },
        }
    })
}

/** Empieza a jugar la actividad de un sello: el reloj del reto arranca AQUÍ. */
export async function iniciarJuego(usuarioId, insigniaId) {
    const mios = await sellos(usuarioId)
    const s = mios.find(x => x.id === Number(insigniaId))
    if (!s?.juego) throw new AppError('Ese sello no tiene actividad', 404, 'NOT_FOUND')
    if (!s.juego.disponible) {
        throw new AppError(s.juego.motivo === 'premium'
            ? 'Este contenido es de la membresía, que llega pronto ✦'
            : 'El material de este taller ya cerró', 403, 'NO_DISPONIBLE')
    }
    const { rows } = await query(
        'INSERT INTO habitat_juegos (usuario_id, insignia_id) VALUES ($1, $2) RETURNING id', [usuarioId, s.id])
    return { juegoId: rows[0].id, reto: s.juego.reto }
}

/**
 * Terminó la actividad. El tiempo lo calcula el servidor (ahora − inicio).
 * Solo cuenta la primera vez que se termina cada partida.
 */
export async function terminarJuego(usuarioId, juegoId) {
    return withTransaction(async q => {
        const { rows } = await q(
            `UPDATE habitat_juegos j
                SET terminado_at = NOW(),
                    segundos = ROUND(EXTRACT(EPOCH FROM NOW() - j.iniciado_at)::numeric, 1)
               FROM insignias i
              WHERE j.id = $1 AND j.usuario_id = $2 AND j.terminado_at IS NULL AND i.id = j.insignia_id
          RETURNING j.segundos, i.actividad_id, i.actividad_tipo`, [juegoId, usuarioId])
        if (!rows[0]) throw new AppError('Esa partida no existe o ya terminó', 404, 'NOT_FOUND')
        const { segundos, actividad_id: actividadId, actividad_tipo: tipo } = rows[0]
        const { rows: ya } = await q(
            `SELECT 1 FROM supernovas_movimientos WHERE usuario_id = $1 AND motivo = 'reto' AND ref = $2`, [usuarioId, actividadId])
        const r = evaluarReto({ tipo, segundos, yaGanado: ya.length > 0 })
        let ganadas = 0
        if (r.gano && await acreditar(usuarioId,
            { cantidad: SUPERNOVAS_POR_RETO, motivo: 'reto', ref: actividadId, detalle: 'Reto superado en tu Hábitat' }, q)) {
            ganadas = SUPERNOVAS_POR_RETO
        }
        return { segundos: Number(segundos), limite: r.limite, ganadas, yaGanado: ya.length > 0, saldo: await saldoDe(usuarioId, q) }
    })
}
