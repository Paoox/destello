/**
 * Destello API — PostgreSQL Connection Pool
 *
 * Soporta dos escenarios:
 *   · Supabase (producción): requiere SSL → poner DB_SSL=true en el .env.
 *   · Postgres local (dev):  sin SSL → DB_SSL ausente o 'false'.
 */
import pg from 'pg'
const { Pool } = pg

// Devuelve DATE (1082) y TIME (1083) como texto plano ('YYYY-MM-DD', 'HH:MM:SS')
// para evitar corrimientos de zona horaria al construir fechas en JS.
pg.types.setTypeParser(1082, (v) => v)
pg.types.setTypeParser(1083, (v) => v)

const useSSL = process.env.DB_SSL === 'true'

export const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'destello_db',
    user:     process.env.DB_USER     || 'destello',
    password: process.env.DB_PASSWORD,
    // Supabase usa certificados gestionados; con el pooler basta habilitar TLS.
    ssl:      useSSL ? { rejectUnauthorized: false } : false,
    max: 10,
    keepAlive: true,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
})

export async function query(text, params) {
    return pool.query(text, params)
}

/**
 * Corre varias consultas dentro de UNA transacción.
 *
 * Por qué existe: activar a un alumno toca tres tablas (usuarios, chispas,
 * lista_espera) más el registro del pago. Si falla a la mitad sin transacción,
 * la persona queda en un estado imposible — por ejemplo activa pero sin chispa,
 * que desde la plataforma se ve como "pagué y no aparece mi taller".
 *
 * Uso:
 *   const r = await withTransaction(async (q) => {
 *       await q('UPDATE ...', [x])
 *       return await q('INSERT ... RETURNING *', [y])
 *   })
 *
 * Todo se confirma junto o no se hace nada. ⚠️ El `q` que recibe la función usa
 * la MISMA conexión: si adentro se llama al `query` normal de este módulo, esa
 * consulta sale por otra conexión y queda FUERA de la transacción.
 */
export async function withTransaction(fn) {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const q = (text, params) => client.query(text, params)
        const resultado = await fn(q, client)
        await client.query('COMMIT')
        return resultado
    } catch (err) {
        try { await client.query('ROLLBACK') } catch (rbErr) {
            console.error('[db] Falló el ROLLBACK:', rbErr.message)
        }
        throw err
    } finally {
        client.release()
    }
}
