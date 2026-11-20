/**
 * Destello Web — useAdminSession
 * Maneja la sesión de admin: login, logout, verificación de token.
 * Exportable → cualquier componente puede usarlo.
 */
import { useState, useEffect, useCallback } from 'react'

const SESSION_KEY = 'destello_admin_token'

/**
 * Cuándo vence el token (ms), leyendo el `exp` del JWT. La sesión de admin
 * dura 2 h (ADMIN_TOKEN_EXPIRES); antes el panel seguía usando un token
 * vencido y cada pestaña mostraba "Token de admin inválido o expirado".
 */
function venceEn(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        return payload.exp ? payload.exp * 1000 : null
    } catch { return null }
}

const MSG_VENCIDA = 'Tu sesión de admin venció (dura 2 horas). Vuelve a entrar.'

export function useAdminSession() {
    const [adminToken,       setAdminToken]       = useState(null)
    const [isAuthenticated,  setIsAuthenticated]  = useState(false)
    const [isLoading,        setIsLoading]        = useState(false)
    const [error,            setError]            = useState(null)

    // Restaurar sesión al montar (si el tab sigue abierto)
    useEffect(() => {
        const stored = sessionStorage.getItem(SESSION_KEY)
        if (stored) {
            const vence = venceEn(stored)
            if (vence && vence <= Date.now()) {
                sessionStorage.removeItem(SESSION_KEY)
                setError(MSG_VENCIDA)
                return
            }
            setAdminToken(stored)
            setIsAuthenticated(true)
        }
    }, [])

    // Al llegar la hora de vencimiento, se cierra la sesión sola y se pide
    // la contraseña otra vez (en vez de que todo empiece a fallar).
    useEffect(() => {
        if (!adminToken) return
        const vence = venceEn(adminToken)
        if (!vence) return
        const t = setTimeout(() => {
            sessionStorage.removeItem(SESSION_KEY)
            setAdminToken(null)
            setIsAuthenticated(false)
            setError(MSG_VENCIDA)
        }, Math.max(0, vence - Date.now()))
        return () => clearTimeout(t)
    }, [adminToken])

    /**
     * Envía la contraseña al backend y, si es válida, guarda el adminToken.
     * @param {string} password
     */
    const login = useCallback(async (password) => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/login', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ password }),
            })

            // Se lee como TEXTO primero. Si la API está caída o reiniciándose,
            // lo que llega es la página HTML de error del túnel, y `res.json()`
            // reventaba con "Unexpected token '<', "<!DOCTYPE "...", que se le
            // mostraba a Paola en la pantalla de contraseña como si hubiera
            // escrito algo mal.
            const crudo = await res.text()
            let data = null
            try { data = crudo ? JSON.parse(crudo) : null }
            catch {
                console.error('[adminLogin] Respuesta no-JSON:', res.status, crudo.slice(0, 200))
                throw new Error(
                    'El servidor no responde ahorita. Si acabas de reiniciar la API, ' +
                    'espera unos segundos e intenta de nuevo.'
                )
            }

            if (!res.ok) throw new Error(data?.message ?? 'Contraseña incorrecta')

            const token = data?.adminToken
            if (!token) throw new Error('El servidor no devolvió una sesión válida.')
            sessionStorage.setItem(SESSION_KEY, token)
            setAdminToken(token)
            setIsAuthenticated(true)
        } catch (err) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const logout = useCallback(() => {
        sessionStorage.removeItem(SESSION_KEY)
        setAdminToken(null)
        setIsAuthenticated(false)
        setError(null)
    }, [])

    return { adminToken, isAuthenticated, isLoading, error, login, logout }
}