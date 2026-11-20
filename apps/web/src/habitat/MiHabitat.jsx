/**
 * Hábitat (T-49) — "Mi hábitat": la islita de la persona.
 *
 * Desbloqueo (decisión de Paola, 19 nov 2026): cada taller COMPLETADO, o sea
 * con certificado emitido y no anulado, hace aparecer su objeto. Los talleres
 * que está cursando se ven como silueta "?" para dar ganas de terminarlos.
 * No necesita backend propio: usa GET /users/me/certificados y
 * GET /users/me/talleres, que ya existían.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Certificate, Sparkle } from '@phosphor-icons/react'
import { useAuthStore } from '@store/useAuthStore.js'
import { esOscuro } from '@utils/tema.js'
import Escena, { MAX_LUGARES } from './Escena.jsx'
import { OBJETOS, objetoDeTaller } from './objetos.jsx'

// 'YYYY-MM-DD' como fecha local (con new Date() directo se corre un día en CDMX).
function fechaBonita(v) {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v))
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function MiHabitat() {
  const navigate = useNavigate()
  const token = useAuthStore(s => s.token)
  const [certs, setCerts]       = useState(null)
  const [talleres, setTalleres] = useState([])
  const [elegido, setElegido]   = useState(null)
  const noche = esOscuro()

  useEffect(() => {
    if (!token) return
    const h = { headers: { Authorization: `Bearer ${token}` } }
    fetch('/api/users/me/certificados', h).then(r => (r.ok ? r.json() : null))
      .then(d => setCerts(d?.certificados ?? [])).catch(() => setCerts([]))
    fetch('/api/users/me/talleres', h).then(r => (r.ok ? r.json() : null))
      .then(d => setTalleres(d?.talleres ?? [])).catch(() => {})
  }, [token])

  const items = useMemo(() => {
    if (!certs) return []
    const categoria = Object.fromEntries(talleres.map(t => [t.tallerId ?? t.taller_id ?? t.id, t.categoria]))
    const vistos = new Set()
    const ganados = []
    // Del más viejo al más nuevo: el primero que completó queda al frente.
    for (const c of [...certs].reverse()) {
      if (vistos.has(c.taller_id)) continue
      vistos.add(c.taller_id)
      const objeto = objetoDeTaller({ nombre: c.taller_nombre, categoria: categoria[c.taller_id] })
      ganados.push({
        clave: `c-${c.taller_id}`, objeto, bloqueado: false,
        titulo: `${OBJETOS[objeto].nombre} — ${c.taller_nombre}`,
        taller: c.taller_nombre, fecha: c.fecha_taller ?? c.created_at, folio: c.folio,
      })
    }
    const enCurso = talleres
      .filter(t => !t.esProfe && !vistos.has(t.tallerId ?? t.taller_id ?? t.id))
      .map(t => ({
        clave: `t-${t.tallerId ?? t.taller_id ?? t.id}`, objeto: null, bloqueado: true,
        titulo: `Por descubrir — ${t.nombre}`, taller: t.nombre,
      }))
    return [...ganados, ...enCurso]
  }, [certs, talleres])

  const ganados = items.filter(i => !i.bloqueado).length
  const sel = items.find(i => i.clave === elegido)

  if (!certs) return <div className="hb-cargando" aria-busy="true">Cargando tu hábitat…</div>

  return (
    <div className="hb">
      <div className="hb-marco">
        <Escena items={items} noche={noche} elegido={elegido}
          onElegir={c => setElegido(prev => (prev === c ? null : c))} />
        <div className="hb-contador">
          <Sparkle size={14} weight="fill" />
          {ganados === 0 ? 'Tu islita te espera' : `${ganados} ${ganados === 1 ? 'objeto' : 'objetos'}`}
        </div>
      </div>

      {/* Lo que pasa al tocar algo */}
      <div className="hb-tarjeta" aria-live="polite">
        {sel && !sel.bloqueado && (
          <>
            <strong>{OBJETOS[sel.objeto].nombre}</strong>
            <p>Lo ganaste al completar <em>{sel.taller}</em>{fechaBonita(sel.fecha) ? ` el ${fechaBonita(sel.fecha)}` : ''}.</p>
            {sel.folio && (
              <Link to={`/certificado/${sel.folio}`} className="hb-link"><Certificate size={15} /> Ver tu certificado</Link>
            )}
          </>
        )}
        {sel && sel.bloqueado && (
          <>
            <strong>¿Qué será?</strong>
            <p>Completa <em>{sel.taller}</em> y descubre qué aparece aquí.</p>
          </>
        )}
        {!sel && ganados === 0 && (
          <>
            <strong>Cada taller que completes hace aparecer algo en tu islita</strong>
            <p>
              {items.length
                ? 'Las siluetas "?" son tus talleres en curso: al recibir tu certificado se revela su objeto.'
                : 'Toma tu primer taller y aquí aparecerá tu primer objeto.'}
            </p>
            {!items.length && <button type="button" className="hb-link" onClick={() => navigate('/novedades')}>Ver talleres disponibles</button>}
          </>
        )}
        {!sel && ganados > 0 && (
          <p className="hb-pista">Toca un objeto para ver de qué taller viene.</p>
        )}
        {items.length > MAX_LUGARES && (
          <p className="hb-pista">Tu islita ya está llena: se ven tus primeros {MAX_LUGARES} objetos. ¡Pronto habrá más espacio!</p>
        )}
      </div>
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.hb { display: flex; flex-direction: column; gap: var(--space-4); }
.hb-cargando { padding: var(--space-16); text-align: center; color: var(--text-muted); }
.hb-marco { position: relative; border-radius: var(--radius-xl, 20px); overflow: hidden; border: 1px solid var(--border-subtle); box-shadow: 0 10px 30px rgba(0,0,0,.12); }
.hb-escena { display: block; width: 100%; height: auto; user-select: none;
  --hb-cielo1: #bfe9e4; --hb-cielo2: #faf7f2; --hb-nube: #ffffff;
  --hb-colina1: #9fd8c8; --hb-colina2: #6cc4a8; --hb-pasto: #86c98b; --hb-pasto2: #6fb877;
  --hb-camino: #e9dcc3; --hb-copa: #2f9e6e; --hb-copa2: #3fb27f; --hb-ventana: #bae6fd;
  --hb-silueta: rgba(255,255,255,.35); --hb-silueta-borde: #4b7a66; }
.hb-escena.hb-noche {
  --hb-cielo1: #061a18; --hb-cielo2: #0d3b38; --hb-nube: #1e4d48;
  --hb-colina1: #0f3b33; --hb-colina2: #134e43; --hb-pasto: #1d5c45; --hb-pasto2: #174d3a;
  --hb-camino: #6b5d45; --hb-copa: #14532d; --hb-copa2: #166534; --hb-ventana: #fbbf24;
  --hb-silueta: rgba(255,255,255,.08); --hb-silueta-borde: #8fd3bf; }
.hb-nube { animation: hb-flota linear infinite alternate; }
@keyframes hb-flota { from { transform: translateX(-40px); } to { transform: translateX(60px); } }
.hb-estrella { animation: hb-brilla 3s ease-in-out infinite; }
@keyframes hb-brilla { 50% { opacity: .25; } }
.hb-obj { cursor: pointer; outline: none; }
.hb-obj-dibujo { transition: transform .25s ease; transform-box: fill-box; transform-origin: 50% 100%; }
.hb-obj:hover .hb-obj-dibujo, .hb-obj:focus-visible .hb-obj-dibujo, .hb-obj--on .hb-obj-dibujo { transform: translateY(-6px) scale(1.05); }
.hb-obj--bloq { opacity: .9; }
@media (prefers-reduced-motion: reduce) { .hb-nube, .hb-estrella { animation: none; } .hb-obj-dibujo { transition: none; } }
.hb-contador { position: absolute; top: 12px; left: 12px; display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: var(--radius-full); background: rgba(6,26,24,.55); color: #faf7f2;
  font-size: var(--text-xs); font-weight: 600; backdrop-filter: blur(4px); }
.hb-tarjeta { min-height: 64px; padding: var(--space-4); border-radius: var(--radius-lg); background: var(--bg-surface); border: 1px solid var(--border-subtle); }
.hb-tarjeta strong { display: block; font-size: var(--text-base); margin-bottom: 4px; }
.hb-tarjeta p { margin: 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.5; }
.hb-tarjeta .hb-pista { color: var(--text-muted); font-size: var(--text-xs); }
.hb-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; color: var(--color-jade-500); font-weight: 600;
  font-size: var(--text-sm); text-decoration: none; background: none; border: none; padding: 0; cursor: pointer; font-family: var(--font-sans); }
`
