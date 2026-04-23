/**
 * Destello API — PostgreSQL Connection Pool
 */
import pg from 'pg'
const { Pool } = pg

export const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'destello_db',
    user:     process.env.DB_USER     || 'destello',
    password: process.env.DB_PASSWORD,
    max: 10,
})

export async function query(text, params) {
    return pool.query(text, params)
}