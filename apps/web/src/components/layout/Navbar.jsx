/**
 * Destello — Navbar (Sidebar)
 * Navegación lateral con iconos de Phosphor Icons.
 * Exportado como módulo independiente → reutilizable y fácil de modificar.
 */
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  House,
  GlobeHemisphereWest,
  User,
  Bell,
  Gear,
  SignOut,
  ShieldCheck,
  List,
  X,
} from '@phosphor-icons/react'
import { useAuthStore } from '@store/useAuthStore.js'
import { isAdminEmail } from '@/constants.js'
import logoDestello from '../../Images/destello-logo-512.png'

// Definición de rutas — modificar aquí afecta toda la nav
const NAV_ITEMS = [
  { label: 'Inicio',    path: '/home',    Icon: House },
  { label: 'Habitat',   path: '/habitat', Icon: GlobeHemisphereWest },
  //
  // ⚠️ NO devolver "Mi Aula" aquí. Decisión de Paola, 25 ago 2026.
  //
  // Antes apuntaba a `/aula/1` escrito a mano —un taller inexistente— así que
  // siempre caía en "bloqueado". Y ponerlo a apuntar a Inicio solo duplicaba
  // Inicio.
  //
  // El fondo es que **un aula no es un lugar fijo, es un taller a una hora.**
  // No existe "mi clase" en abstracto: existe la clase de las 4. Quien no tiene
  // taller activo no tiene a qué entrar, y un menú que siempre está ahí promete
  // un lugar que la mayoría de los días está vacío.
  //
  // Al aula se entra desde su taller, en Inicio: la tarjeta muestra
  // "Entrar a clase" **solo cuando la clase está abierta** (el backend lo
  // calcula con la hora de inicio y su margen, ver `estadoTaller`).
  { label: 'Perfil',    path: '/perfil',  Icon: User },
]

const NAV_BOTTOM = [
  { label: 'Notificaciones', path: '/notifs',    Icon: Bell },
  { label: 'Ajustes',        path: '/settings',  Icon: Gear },
]

/**
 * Estilos e interacciones de la navbar.
 * El hover y el filo activo viven en el <style> inyectado (NAV_CSS) porque
 * los pseudo-selectores (:hover) no se pueden expresar con estilos inline.
 */
const NAV_CSS = `
.ds-nav {
  position: fixed;
  left: 0; top: 0; bottom: 0;
  width: var(--navbar-width, 240px);
  background: var(--bg-card);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  padding: var(--space-4);
  z-index: 100;
}
.ds-nav__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: var(--space-2);
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  background: none;
  border-top: none; border-left: none; border-right: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
}
.ds-nav__logo {
  width: 30px;
  height: 30px;
  object-fit: contain;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ds-nav__brand:hover .ds-nav__logo { transform: rotate(8deg) scale(1.06); }
.ds-nav__brand-text {
  font-weight: 700;
  font-size: var(--text-xl);
  color: var(--text-primary);
  letter-spacing: -0.02em;
}
.ds-nav__section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.ds-nav__bottom {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  border-top: 1px solid var(--border-subtle);
  padding-top: var(--space-4);
  margin-top: var(--space-4);
}
.ds-nav__link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: 400;
  text-decoration: none;
  border-left: 3px solid transparent;
  cursor: pointer;
  background: none; border-top: none; border-right: none; border-bottom: none;
  width: 100%;
  text-align: left;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
}
.ds-nav__link .ds-nav__ico {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.18s ease;
  display: inline-flex;
}
.ds-nav__link:hover {
  background: rgba(13, 115, 119, 0.14);
  color: var(--text-primary);
  transform: translateX(3px);
}
.ds-nav__link:hover .ds-nav__ico {
  transform: scale(1.12);
  color: var(--color-jade-400);
}
.ds-nav__link.active {
  background: rgba(13, 115, 119, 0.20);
  color: var(--text-primary);
  font-weight: 600;
  border-left: 3px solid var(--color-jade-500);
}
.ds-nav__link.active .ds-nav__ico { color: var(--color-jade-400); }
/* "Salir" siempre en ámbar para que resalte y se lea en modo claro y oscuro */
.ds-nav__link--danger { color: var(--color-amber-600); font-weight: 600; }
.ds-nav__link--danger .ds-nav__ico { color: var(--color-amber-600); }
.ds-nav__link--danger:hover {
  background: rgba(217, 119, 6, 0.14);
  color: var(--color-amber-700);
}
.ds-nav__link--danger:hover .ds-nav__ico { color: var(--color-amber-700); }

/* Overlay de confirmación de salida */
.ds-nav__overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2, 20, 18, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: ds-fade 0.18s ease;
}
.ds-nav__dialog {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  width: min(360px, 90vw);
  box-shadow: var(--shadow-jade);
  text-align: center;
  animation: ds-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ds-nav__dialog h3 {
  color: var(--text-primary);
  font-size: var(--text-lg, 1.125rem);
  font-weight: 700;
  margin: 0 0 var(--space-2);
}
.ds-nav__dialog p {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-5);
}
.ds-nav__actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}
.ds-nav__btn {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s ease, transform 0.1s ease;
  border: none;
}
.ds-nav__btn:active { transform: scale(0.97); }
.ds-nav__btn--ghost {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
}
.ds-nav__btn--ghost:hover { color: var(--text-primary); }
.ds-nav__btn--danger {
  background: var(--color-amber-600);
  color: #fff;
}
.ds-nav__btn--danger:hover { filter: brightness(1.08); }

@keyframes ds-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ds-pop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }

/* ── Modo claro: fondo traslúcido claro + divisores jade visibles ── */
@media (prefers-color-scheme: light) {
  .ds-nav { border-right: 1px solid rgba(13, 115, 119, 0.18); }
  .ds-nav__brand { border-bottom-color: rgba(13, 115, 119, 0.28); }
  .ds-nav__bottom { border-top-color: rgba(13, 115, 119, 0.28); }
}

/* ── Botón hamburguesa (solo móvil) ── */
.ds-nav__hamburger {
  display: none;
  position: fixed;
  top: 10px; left: 10px;
  z-index: 250;
  width: 42px; height: 42px;
  align-items: center; justify-content: center;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}
.ds-nav__scrim { display: none; }

/* ═══════════════ RESPONSIVE ═══════════════ */
@media (max-width: 768px) {
  .ds-nav__hamburger { display: inline-flex; }
  .ds-nav {
    width: min(268px, 82vw);
    padding-top: 62px;
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: var(--shadow-lg);
  }
  .ds-nav--open { transform: translateX(0); }
  .ds-nav__scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(2, 20, 18, 0.5);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    animation: ds-fade 0.2s ease;
  }
}
`

export default function Navbar() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const showAdmin = isAdminEmail(user?.email)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false) // drawer en móvil

  const handleSignOut = () => {
    logout()
    navigate('/login')
  }

  const closeMobile = () => setMobileOpen(false)

  // Cierra el drawer al navegar (en móvil) y aplica la clase activa.
  const linkClass = ({ isActive }) =>
    isActive ? 'ds-nav__link active' : 'ds-nav__link'

  return (
    <>
      <style>{NAV_CSS}</style>

      {/* Botón hamburguesa — solo visible en móvil */}
      <button
        type="button"
        className="ds-nav__hamburger"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X size={22} weight="bold" /> : <List size={22} weight="bold" />}
      </button>

      {/* Scrim — oscurece el fondo cuando el drawer está abierto (móvil) */}
      {mobileOpen && <div className="ds-nav__scrim" onClick={closeMobile} />}

      <nav className={mobileOpen ? 'ds-nav ds-nav--open' : 'ds-nav'}>
        {/* Logo → redirige a Inicio */}
        <button
          type="button"
          className="ds-nav__brand"
          onClick={() => { navigate('/home'); closeMobile() }}
          aria-label="Ir a Inicio"
        >
          <img src={logoDestello} alt="Destello" className="ds-nav__logo" />
          <span className="ds-nav__brand-text">Destello</span>
        </button>

        {/* Links principales */}
        <div className="ds-nav__section">
          {NAV_ITEMS.map(({ label, path, Icon }) => (
            <NavLink key={path} to={path} className={linkClass} onClick={closeMobile}>
              <span className="ds-nav__ico"><Icon size={20} weight="regular" /></span>
              {label}
            </NavLink>
          ))}

          {/* Admin — solo visible para cuentas autorizadas */}
          {showAdmin && (
            <NavLink to="/admin" className={linkClass} onClick={closeMobile}>
              <span className="ds-nav__ico"><ShieldCheck size={20} weight="regular" /></span>
              Admin
            </NavLink>
          )}
        </div>

        {/* Links inferiores */}
        <div className="ds-nav__bottom">
          {NAV_BOTTOM.map(({ label, path, Icon }) => (
            <NavLink key={path} to={path} className={linkClass} onClick={closeMobile}>
              <span className="ds-nav__ico"><Icon size={20} weight="regular" /></span>
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            className="ds-nav__link ds-nav__link--danger"
            onClick={() => { setConfirmOpen(true); closeMobile() }}
          >
            <span className="ds-nav__ico"><SignOut size={20} /></span>
            Salir
          </button>
        </div>
      </nav>

      {/* Confirmación de cierre de sesión — hace blur al contenido */}
      {confirmOpen && (
        <div
          className="ds-nav__overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmOpen(false)}
        >
          <div className="ds-nav__dialog" onClick={(e) => e.stopPropagation()}>
            <h3>¿Deseas salir de tu sesión?</h3>
            <p>Tendrás que volver a iniciar sesión para entrar de nuevo.</p>
            <div className="ds-nav__actions">
              <button
                type="button"
                className="ds-nav__btn ds-nav__btn--ghost"
                onClick={() => setConfirmOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ds-nav__btn ds-nav__btn--danger"
                onClick={handleSignOut}
              >
                Sí, salir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
