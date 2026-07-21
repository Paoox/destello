/**
 * Destello — Entry Point
 * Inyecta design tokens, configura providers globales, monta la app
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'
import { useAuthStore } from './store/useAuthStore.js'
import './styles/global.css'
// Los tokens CSS ahora viven en src/styles/tokens.css
// importado automáticamente por global.css — no se necesita inyección JS

// Restaura token + usuario desde sessionStorage antes del primer render
useAuthStore.getState().restoreSession()

// Tras un deploy, el index.html en caché apunta a chunks con hash viejo que ya
// no existen. Al navegar a una página lazy, el import dinámico falla (Vercel
// devuelve el HTML de fallback → error de MIME). Vite emite 'vite:preloadError';
// aquí recargamos para bajar el index.html nuevo. El candado de 10s evita bucles.
window.addEventListener('vite:preloadError', () => {
    const now  = Date.now()
    const last = Number(sessionStorage.getItem('destello_reload_ts') || 0)
    if (now - last > 10000) {
        sessionStorage.setItem('destello_reload_ts', String(now))
        window.location.reload()
    }
})

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>
)