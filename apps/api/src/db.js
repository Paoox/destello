/**
 * Destello API — Conexión a PostgreSQL
 * Pool compartido para toda la aplicación.
 * Importar { query } en cualquier servicio que necesite la BD.
 */

import pg from 'pg'
const { Pool } = pg

export const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'destello_db',
    user:     process.env.DB_USER     || 'destello',
    password: process.env.DB_PASSWORD,
    max:               10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
    console.error('⚠  Error en el pool de PostgreSQL:', err.message)
})

export async function query(text, params) {
    return pool.query(text, params)
}