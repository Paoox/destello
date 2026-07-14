/**
 * Destello — Auth Store (Zustand)
 * Estado global de autenticación.
 * Importar en cualquier componente: import { useAuthStore } from '@store/useAuthStore'
 */
import { create } from 'zustand'

export const useAuthStore = create((set, get) => ({
  // ── Estado ────────────────────────────────────────────────
  user:        null,
  token:       null,
  isLoading:   false,
  error:       null,
  isLoggedIn:  () => !!get().token,

  // ── Acciones ──────────────────────────────────────────────
  login: async (credentials) => {
    set({ isLoading: true, error: null })
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(credentials),
      })
      if (!res.ok) throw new Error('Credenciales incorrectas')
      const data = await res.json()
      set({ user: data.user, token: data.token, isLoading: false })
      sessionStorage.setItem('destello_token', data.token)
      if (data.user) sessionStorage.setItem('destello_user', JSON.stringify(data.user))
    } catch (err) {
      set({ error: err.message, isLoading: false })
    }
  },

  /**
   * Crea cuenta nueva usando un Resplandor.
   * @param {{ email: string, password: string, nombre?: string, resplandorCode: string }} opts
   * @returns {{ ok: boolean, error?: string }}
   */
  register: async ({ email, password, nombre, resplandorCode }) => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password, nombre, resplandorCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Error al crear cuenta')

      set({ user: data.user, token: data.token, isLoading: false })
      sessionStorage.setItem('destello_token', data.token)
      if (data.user) sessionStorage.setItem('destello_user', JSON.stringify(data.user))
      // Limpiar el resplandor del sessionStorage — ya fue consumido
      sessionStorage.removeItem('destello_resplandor')
      return { ok: true }
    } catch (err) {
      set({ error: err.message, isLoading: false })
      return { ok: false, error: err.message }
    }
  },

  logout: () => {
    sessionStorage.removeItem('destello_token')
    sessionStorage.removeItem('destello_resplandor')
    sessionStorage.removeItem('destello_user')
    set({ user: null, token: null, error: null })
  },

  restoreSession: () => {
    const token = sessionStorage.getItem('destello_token')
    let user = null
    try {
      const raw = sessionStorage.getItem('destello_user')
      if (raw) user = JSON.parse(raw)
    } catch { /* ignora JSON corrupto */ }
    if (token) set({ token, user })
  },

  clearError: () => set({ error: null }),
}))