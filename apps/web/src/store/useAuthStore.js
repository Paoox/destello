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
      // Guardar token en sessionStorage (NO localStorage por seguridad)
      sessionStorage.setItem('destello_token', data.token)
    } catch (err) {
      set({ error: err.message, isLoading: false })
    }
  },

  logout: () => {
    sessionStorage.removeItem('destello_token')
    set({ user: null, token: null, error: null })
  },

  restoreSession: () => {
    const token = sessionStorage.getItem('destello_token')
    if (token) set({ token })
  },

  clearError: () => set({ error: null }),
}))
