/**
 * Destello — Navbar (Sidebar)
 * Navegación lateral con iconos de Phosphor Icons.
 * Exportado como módulo independiente → reutilizable y fácil de modificar.
 */
import { NavLink, useNavigate } from 'react-router-dom'
import {
  House,
  GlobeHemisphereWest,
  VideoCamera,
  User,
  Bell,
  Gear,
  SignOut,
  Sparkle,
} from '@phosphor-icons/react'

// Definición de rutas — modificar aquí afecta toda la nav
const NAV_ITEMS = [
  { label: 'Inicio',    path: '/home',    Icon: House },
  { label: 'Habitat',   path: '/habitat', Icon: GlobeHemisphereWest },
  { label: 'Mi Aula',   path: '/aula/1',  Icon: VideoCamera },
  { label: 'Perfil',    path: '/perfil',  Icon: User },
]

const NAV_BOTTOM = [
  { label: 'Notificaciones', path: '/notifs',    Icon: Bell },
  { label: 'Ajustes',        path: '/settings',  Icon: Gear },
]

const styles = {
  nav: {
    position: 'fixed',
    left: 0, top: 0, bottom: 0,
    width: '240px',
    background: 'var(--bg-card)',
    borderRight: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    padding: 'var(--space-4)',
    zIndex: 100,
    transition: 'width 0.25s ease',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-3) var(--space-2)',
    marginBottom: 'var(--space-6)',
    borderBottom: '1px solid var(--border-subtle)',
    paddingBottom: 'var(--space-4)',
  },
  logoIcon: {
    color: 'var(--color-jade-500)',
  },
  logoText: {
    fontWeight: 700,
    fontSize: 'var(--text-xl)',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  section: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
  },
  link: (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-lg)',
    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
    background: isActive ? 'var(--border-subtle)' : 'transparent',
    fontWeight: isActive ? 600 : 400,
    fontSize: 'var(--text-sm)',
    transition: 'all 0.15s ease',
    textDecoration: 'none',
    borderLeft: isActive ? '3px solid var(--color-jade-500)' : '3px solid transparent',
  }),
  bottom: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: 'var(--space-4)',
    marginTop: 'var(--space-4)',
  },
  signout: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--text-muted)',
    fontSize: 'var(--text-sm)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    transition: 'color 0.15s ease',
  },
}

export default function Navbar() {
  const navigate = useNavigate()

  const handleSignOut = () => {
    // TODO: limpiar sesión en Zustand store
    navigate('/login')
  }

  return (
    <nav style={styles.nav}>
      {/* Logo */}
      <div style={styles.logo}>
        <Sparkle size={24} weight="fill" style={styles.logoIcon} />
        <span style={styles.logoText}>destello</span>
      </div>

      {/* Links principales */}
      <div style={styles.section}>
        {NAV_ITEMS.map(({ label, path, Icon }) => (
          <NavLink
            key={path}
            to={path}
            style={({ isActive }) => styles.link(isActive)}
          >
            <Icon size={20} weight="regular" />
            {label}
          </NavLink>
        ))}
      </div>

      {/* Links inferiores */}
      <div style={styles.bottom}>
        {NAV_BOTTOM.map(({ label, path, Icon }) => (
          <NavLink
            key={path}
            to={path}
            style={({ isActive }) => styles.link(isActive)}
          >
            <Icon size={20} weight="regular" />
            {label}
          </NavLink>
        ))}
        <button style={styles.signout} onClick={handleSignOut}>
          <SignOut size={20} />
          Salir
        </button>
      </div>
    </nav>
  )
}
