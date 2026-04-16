/**
 * Destello — MainLayout
 * Layout principal con navbar lateral y barra superior.
 * Todas las páginas autenticadas usan este layout.
 */
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'

export default function MainLayout() {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--bg-dark)',
    }}>
      {/* Sidebar izquierdo */}
      <Navbar />

      {/* Contenido principal */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        marginLeft: 'var(--navbar-width, 240px)',
        transition: 'margin-left 0.25s ease',
      }}>
        <Outlet />
      </main>
    </div>
  )
}
