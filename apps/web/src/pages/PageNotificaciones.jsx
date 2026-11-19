/**
 * PageNotificaciones — /notifs (T-44, 19 nov 2026)
 *
 * La lista de avisos de la persona. NO los crea nadie desde aquí: los arma el
 * revisor automático de la API (`notificacionService.js`, cada 5 min) a partir
 * de lo que pasa en la base — taller mañana / en 1 hora, certificado listo,
 * pago confirmado, taller nuevo, y para profes: su clase y alumnas nuevas.
 *
 *   GET  /users/me/notificaciones        → las últimas 50 + cuántas sin leer
 *   POST /users/me/notificaciones/leer   → { ids } o todas
 *
 * Al abrir la página se marcan todas como leídas, pero las que eran nuevas se
 * siguen viendo resaltadas durante esta visita (si no, se apagarían antes de
 * que alcances a leerlas).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, CalendarBlank, Clock, Sparkle, Certificate, CheckCircle, Student,
  CaretRight, CircleNotch,
} from '@phosphor-icons/react'
import { useAuthStore } from '@store/useAuthStore.js'
import { EVENTO_NOTIFS_LEIDAS } from '@/constants.js'

const ICONO = {
  taller_24h:      { Icon: CalendarBlank, color: 'var(--color-jade-500)' },
  profe_24h:       { Icon: CalendarBlank, color: 'var(--color-jade-500)' },
  taller_1h:       { Icon: Clock,         color: 'var(--color-amber-500)' },
  profe_1h:        { Icon: Clock,         color: 'var(--color-amber-500)' },
  nuevo_taller:    { Icon: Sparkle,       color: 'var(--color-amber-500)' },
  certificado:     { Icon: Certificate,   color: 'var(--color-jade-500)' },
  pago_confirmado: { Icon: CheckCircle,   color: 'var(--color-success, #22c55e)' },
  nueva_alumna:    { Icon: Student,       color: 'var(--color-jade-500)' },
}

/** "hace 5 min", "ayer", "12 nov" */
function hace(iso) {
  const d = new Date(iso)
  const seg = (Date.now() - d.getTime()) / 1000
  if (seg < 60)    return 'justo ahora'
  if (seg < 3600)  return `hace ${Math.floor(seg / 60)} min`
  if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`
  if (seg < 172800) return 'ayer'
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function PageNotificaciones() {
  const navigate = useNavigate()
  const token = useAuthStore(s => s.token)

  const [lista, setLista]       = useState([])
  const [nuevas, setNuevas]     = useState(new Set())  // las que llegaron sin leer
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (!token) return
    const auth = { Authorization: `Bearer ${token}` }
    let vivo = true
    fetch('/api/users/me/notificaciones', { headers: auth })
      .then(r => (r.ok ? r.json() : Promise.reject(r)))
      .then(async (data) => {
        if (!vivo) return
        const items = data.notificaciones ?? []
        setLista(items)
        const sinLeer = items.filter(n => !n.leida_at).map(n => n.id)
        setNuevas(new Set(sinLeer))
        if (data.noLeidas > 0) {
          await fetch('/api/users/me/notificaciones/leer', {
            method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{}',
          }).catch(() => {})
          window.dispatchEvent(new Event(EVENTO_NOTIFS_LEIDAS))
        }
      })
      .catch(() => vivo && setError('No pudimos cargar tus notificaciones. Intenta recargar la página.'))
      .finally(() => vivo && setCargando(false))
    return () => { vivo = false }
  }, [token])

  return (
    <div style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: 720, margin: '0 auto' }}>
      <style>{CSS}</style>
      <h1 style={{
        display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 var(--space-6)',
        fontSize: 'var(--text-2xl)', fontWeight: 700,
      }}>
        <Bell size={26} weight="fill" color="var(--color-jade-500)" />
        Notificaciones
      </h1>

      {cargando ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
          <CircleNotch size={32} color="var(--color-jade-500)" style={{ animation: 'ds-giro .8s linear infinite' }} />
        </div>
      ) : error ? (
        <p className="nt-vacio">{error}</p>
      ) : lista.length === 0 ? (
        <div className="nt-vacio">
          <Bell size={40} color="var(--text-muted)" />
          <p style={{ margin: '12px 0 4px', fontWeight: 600, color: 'var(--text-primary)' }}>Todo tranquilo por aquí</p>
          <p style={{ margin: 0 }}>
            Te avisaremos un día antes de tu taller, una hora antes de que empiece,
            cuando abramos talleres nuevos y cuando tu certificado esté listo.
          </p>
        </div>
      ) : (
        <ul className="nt-lista">
          {lista.map(n => {
            const { Icon, color } = ICONO[n.tipo] ?? { Icon: Bell, color: 'var(--color-jade-500)' }
            const nueva = nuevas.has(n.id)
            return (
              <li key={n.id}>
                <button
                  type="button"
                  className={`nt-item${nueva ? ' nt-item--nueva' : ''}`}
                  onClick={() => n.liga && navigate(n.liga)}
                >
                  <span className="nt-ico" style={{ color }}><Icon size={22} weight="fill" /></span>
                  <span className="nt-txt">
                    <span className="nt-titulo">{n.titulo}</span>
                    {n.cuerpo && <span className="nt-cuerpo">{n.cuerpo}</span>}
                    <span className="nt-hora">{hace(n.created_at)}</span>
                  </span>
                  {nueva && <span className="nt-punto" aria-label="Nueva" />}
                  {n.liga && <CaretRight size={16} className="nt-flecha" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const CSS = `
@keyframes ds-giro { to { transform: rotate(360deg) } }
.nt-vacio {
  text-align: center; color: var(--text-muted); font-size: var(--text-sm);
  background: var(--bg-card); border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl); padding: var(--space-8) var(--space-5);
}
.nt-lista {
  list-style: none; margin: 0; padding: 0; overflow: hidden;
  background: var(--bg-card); border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
}
.nt-lista li + li { border-top: 1px solid var(--border-subtle); }
.nt-item {
  width: 100%; display: flex; align-items: flex-start; gap: var(--space-3);
  padding: var(--space-4) var(--space-5); background: none; border: none;
  text-align: left; cursor: pointer; font-family: var(--font-sans); color: inherit;
  transition: background .15s ease;
}
.nt-item:hover { background: rgba(13, 115, 119, 0.08); }
.nt-item--nueva { background: rgba(13, 115, 119, 0.10); }
.nt-ico {
  flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(13, 115, 119, 0.12);
}
.nt-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.nt-titulo { font-weight: 600; font-size: var(--text-sm); color: var(--text-primary); }
.nt-cuerpo { font-size: var(--text-sm); color: var(--text-muted); line-height: 1.5; }
.nt-hora { font-size: var(--text-xs); color: var(--text-muted); opacity: .8; }
.nt-punto {
  flex-shrink: 0; width: 9px; height: 9px; margin-top: 6px; border-radius: 50%;
  background: var(--color-amber-600);
}
.nt-flecha { flex-shrink: 0; margin-top: 4px; color: var(--text-muted); }
@media (max-width: 480px) {
  .nt-item { padding: var(--space-3) var(--space-4); }
}
`
