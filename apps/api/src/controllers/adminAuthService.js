/**
 * Destello API — Admin Auth Service
 * Lógica pura para autenticación del super-admin.
 * Sin Express. Sin estado. Solo lógica.
 */
import bcrypt from 'bcryptjs'
import jwt    from 'jsonwebtoken'

/**
 * Verifica la contraseña contra el hash en .env.
 * @param {string} password  Contraseña en texto plano ingresada por el admin
 * @returns {Promise<boolean>}
 */
export async function verifyAdminPassword(password) {
    const hash = process.env.ADMIN_PASSWORD_HASH
    if (!hash) throw new Error('ADMIN_PASSWORD_HASH no configurado en .env')
    return bcrypt.compare(password, hash)
}

/**
 * Emite un JWT de admin con rol superadmin.
 * Usa una clave DIFERENTE al JWT de usuarios → un token de usuario
 * nunca puede hacerse pasar por admin.
 * @returns {string}
 */
export function signAdminToken() {
    const secret = process.env.ADMIN_TOKEN_SECRET
    if (!secret) throw new Error('ADMIN_TOKEN_SECRET no configurado en .env')
    return jwt.sign(
        { role: 'superadmin' },
        secret,
        { expiresIn: process.env.ADMIN_TOKEN_EXPIRES || '2h' }
    )
}

/**
 * Verifica un adminToken y retorna el payload.
 * Lanza error si es inválido o expirado.
 * @param {string} token
 * @returns {{ role: string, iat: number, exp: number }}
 */
export function verifyAdminToken(token) {
    const secret = process.env.ADMIN_TOKEN_SECRET
    if (!secret) throw new Error('ADMIN_TOKEN_SECRET no configurado en .env')
    return jwt.verify(token, secret)
}