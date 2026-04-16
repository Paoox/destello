/**
 * Destello — AuthLayout
 * Layout para páginas de autenticación (Login, Registro).
 * Centrado, sin navbar, con fondo oscuro y decoración sutil.
 */
import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-dark)',
      padding: 'var(--space-4)',
    }}>
      {/* Glow decorativo de fondo */}
      <div style={{
        position: 'fixed',
        top: '20%', left: '50%',
        transform: 'translateX(-50%)',
        width: '600px', height: '400px',
        background: 'radial-gradient(ellipse, rgba(13,115,119,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
        <Outlet />
      </div>
    </div>
  )
}
