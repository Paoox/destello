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
  logout: () => {
    sessionStorage.removeItem('destello_token')
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