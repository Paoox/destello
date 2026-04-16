/**
 * Destello — Entry Point
 * Inyecta design tokens, configura providers globales, monta la app
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './App.jsx'
import './styles/global.css'

// Inyectar CSS variables desde tokens (una sola vez, en el root)
// Los tokens viven en packages/tokens — single source of truth
import { cssVars } from '@destello/tokens'
const style = document.createElement('style')
style.textContent = `:root { ${cssVars} }`
document.head.appendChild(style)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
