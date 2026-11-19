/**
 * Destello API — Datos de pago de las profesoras (migración 020)
 *
 * Ella los captura en su Perfil; Paola los ve en Admin → Profesores para
 * pagarle. La validación es pura (sin BD) para poder probarla sola.
 */
import { query } from '../db/db.js'
import { AppError } from '../middleware/errorHandler.js'

const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '')

/** Dígito de control de la CLABE (pesos 3-7-1 sobre los primeros 17). */
export function clabeValida(clabe) {
    if (!/^\d{18}$/.test(clabe)) return false
    const pesos = [3, 7, 1]
    let suma = 0
    for (let i = 0; i < 17; i++) suma += (Number(clabe[i]) * pesos[i % 3]) % 10
    return (10 - (suma % 10)) % 10 === Number(clabe[17])
}

/** Algoritmo de Luhn — el dígito de control de las tarjetas. */
export function tarjetaValida(num) {
    if (!/^\d{15,16}$/.test(num)) return false
    let suma = 0
    for (let i = 0; i < num.length; i++) {
        let d = Number(num[num.length - 1 - i])
        if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9 }
        suma += d
    }
    return suma % 10 === 0
}

/**
 * Limpia y valida lo que manda el formulario. Lanza AppError 400 con un
 * mensaje que la profe entiende.
 */
export function validarDatosPago({ titular, banco, clabe, tarjeta } = {}) {
    const limpio = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()
    const t = limpio(titular), b = limpio(banco)
    const c = soloDigitos(clabe), n = soloDigitos(tarjeta)
    if (t.length < 3)  throw new AppError('Escribe el nombre del titular de la cuenta', 400, 'BAD_REQUEST')
    if (b.length < 2)  throw new AppError('Escribe el banco', 400, 'BAD_REQUEST')
    if (!c && !n)      throw new AppError('Pon al menos la CLABE o el número de tarjeta', 400, 'BAD_REQUEST')
    if (c && !clabeValida(c)) {
        throw new AppError('La CLABE no es válida: son 18 dígitos y el último es de control. Revísala.', 400, 'BAD_REQUEST')
    }
    if (n && !tarjetaValida(n)) {
        throw new AppError('El número de tarjeta no es válido. Revisa que esté completo (16 dígitos).', 400, 'BAD_REQUEST')
    }
    return { titular: t.slice(0, 120), banco: b.slice(0, 60), clabe: c || null, tarjeta: n || null }
}

const COLUMNAS = 'usuario_id, titular, banco, clabe, tarjeta, updated_at'

export async function obtener(usuarioId) {
    const { rows } = await query(`SELECT ${COLUMNAS} FROM profesor_datos_pago WHERE usuario_id = $1`, [usuarioId])
    return rows[0] ?? null
}

/** Solo una profesora (tabla `profesores`) puede tener datos de pago. */
export async function guardar(usuarioId, datos) {
    const d = validarDatosPago(datos)
    const { rows: es } = await query('SELECT 1 FROM profesores WHERE usuario_id = $1', [usuarioId])
    if (!es.length) throw new AppError('Solo las profesoras registran datos de pago', 403, 'FORBIDDEN')
    const { rows } = await query(
        `INSERT INTO profesor_datos_pago (usuario_id, titular, banco, clabe, tarjeta)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (usuario_id) DO UPDATE
           SET titular = EXCLUDED.titular, banco = EXCLUDED.banco,
               clabe = EXCLUDED.clabe, tarjeta = EXCLUDED.tarjeta, updated_at = NOW()
         RETURNING ${COLUMNAS}`,
        [usuarioId, d.titular, d.banco, d.clabe, d.tarjeta]
    )
    return rows[0]
}

/** Para el panel admin: todos, por usuario_id. */
export async function listarTodos() {
    const { rows } = await query(`SELECT ${COLUMNAS} FROM profesor_datos_pago`)
    return rows
}
