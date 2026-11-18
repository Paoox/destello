/**
 * Destello — MainLayout
 * Layout principal con navbar lateral y barra superior.
 * Todas las páginas autenticadas usan este layout.
 */
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import Constellation from '../Constellation.jsx'

/* Layout responsive:
   · Desktop → contenido con margen izq. igual al ancho del sidebar fijo.
   · Móvil (<768px) → sidebar colapsa a drawer; el contenido usa todo el
     ancho y deja hueco arriba para el botón hamburguesa. */
const LAYOUT_CSS = `
.ds-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  margin-left: var(--navbar-width, 240px);
  transition: margin-left 0.25s ease;
}
/* En el aula el menú se encoge a una tira de íconos (ver Navbar). */
@media (min-width: 769px) {
  .ds-main--compacta { margin-left: 68px; }
}
@media (max-width: 768px) {
  .ds-main {
    margin-left: 0;
    padding-top: 60px;
  }
}
`

export default function MainLayout() {
  // En el aula el menú se encoge a íconos: el aula necesita todo el ancho
  // (video + pizarrón) y el menú solo le robaba espacio.
  const compacta = useLocation().pathname.startsWith('/aula/')
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      // Sin fondo opaco: el body pinta --bg-dark y así la constelación
      // (z-index negativo) queda visible detrás del contenido.
      background: 'transparent',
    }}>
      <style>{LAYOUT_CSS}</style>

      {/* Fondo de constelación global (detrás de menú y páginas) */}
      <Constellation />

      {/* Sidebar / drawer */}
      <Navbar compacta={compacta} />

      {/* Contenido principal */}
      <main className={compacta ? 'ds-main ds-main--compacta' : 'ds-main'}>
        <Outlet />
      </main>
    </div>
  )
}
