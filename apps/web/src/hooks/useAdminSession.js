/**
 * Destello Web — useAdminSession
 * Maneja la sesión de admin: login, logout, verificación de token.
 * Exportable → cualquier componente puede usarlo.
 */
import { useState, useEffect, useCallback } from 'react'

const SESSION_KEY = 'destello_admin_token'

export function useAdminSession() {
    const [adminToken,       setAdminToken]       = useState(null)
    const [isAuthenticated,  setIsAuthenticated]  = useState(false)
    const [isLoading,        setIsLoading]        = useState(false)
    const [error,            setError]            = useState(null)

    // Restaurar sesión al montar (si el tab sigue abierto)
    useEffect(() => {
        const stored = sessionStorage.getItem(SESSION_KEY)
        if (stored) {
            setAdminToken(stored)
            setIsAuthenticated(true)
        }
    }, [])

    /**
     * Envía la contraseña al backend y, si es válida, guarda el adminToken.
     * @param {string} password
     */
    const login = useCallback(async (password) => {
        setIsLoading(true)
        setError(null)
        try {
            const res  = await fetch('/api/admin/login', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ password }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message ?? 'Contraseña incorrecta')
            }
            const { adminToken: token } = await res.json()
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