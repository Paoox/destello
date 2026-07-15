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
