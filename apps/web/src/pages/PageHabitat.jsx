/**
 * PageHabitat — "Mi hábitat": el espacio de la persona (T-49, `src/habitat/`).
 * El catálogo de talleres se mudó a Novedades (`/novedades`, 19 nov 2026);
 * `/habitat?vista=talleres` (ligas viejas de notificaciones y correos)
 * redirige allá.
 */
import { Navigate, useSearchParams } from 'react-router-dom'
import MiHabitat from '@/habitat/MiHabitat.jsx'

export default function PageHabitat() {
  const [params] = useSearchParams()
  if (params.get('vista') === 'talleres') return <Navigate to="/novedades" replace />

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>Mi hábitat</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Tu espacio crece con cada taller que completas</p>
      </div>
      <MiHabitat />
    </div>
  )
}
