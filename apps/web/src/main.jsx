/**
 * Destello — Entry Point
 * Inyecta design tokens, configura providers globales, monta la app
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'
import './styles/global.css'
// Los tokens CSS ahora viven en src/styles/tokens.css
// importado automáticamente por global.css — no se necesita inyección JS

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>
)