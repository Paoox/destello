/**
 * Hábitat (T-49) — la islita en 2D ilustrado (diorama por capas, en SVG).
 *
 * De día con el tema claro y de noche (luna y estrellas) con el oscuro.
 * La casita, el árbol y las flores siempre están; los objetos de los
 * talleres completados van en los LUGARES, del frente hacia atrás, y los
 * talleres en curso se ven como silueta punteada con "?".
 *
 * `items`: [{ clave, objeto, bloqueado, titulo }] — ver PageHabitat.
 */
import { OBJETOS } from './objetos.jsx'

/** Lugares sobre el pasto: x, y (base) y escala (más chico = más lejos). */
const LUGARES = [
  [520, 400, 1.15], [730, 392, 1.1], [330, 404, 1.12], [880, 372, 0.95],
  [610, 336, 0.85], [130, 440, 1.0], [430, 326, 0.8], [790, 320, 0.78],
  [250, 318, 0.75], [930, 310, 0.72], [80, 330, 0.75], [680, 300, 0.68],
]
export const MAX_LUGARES = LUGARES.length

const Nube = ({ x, y, s = 1, dur }) => (
  <g className="hb-nube" style={{ animationDuration: `${dur}s` }}>
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity=".9">
      <ellipse cx="0" cy="0" rx="46" ry="16" fill="var(--hb-nube)" />
      <ellipse cx="-20" cy="-10" rx="24" ry="16" fill="var(--hb-nube)" />
      <ellipse cx="16" cy="-14" rx="28" ry="20" fill="var(--hb-nube)" />
    </g>
  </g>
)

function Casita() {
  return (
    <g transform="translate(160 300)">
      <ellipse cx="0" cy="0" rx="62" ry="8" fill="#000" opacity=".12" />
      <rect x="-48" y="-62" width="96" height="62" rx="4" fill="#faf7f2" stroke="#d6cfc4" strokeWidth="2" />
      <path d="M-60 -58 L0 -104 L60 -58 Z" fill="#0d7377" />
      <path d="M-60 -58 L0 -104 L0 -96 L-52 -56 Z" fill="#0f766e" opacity=".6" />
      <rect x="-12" y="-36" width="24" height="36" rx="10" fill="#d97706" />
      <circle cx="7" cy="-18" r="2" fill="#78350f" />
      <rect x="-40" y="-48" width="20" height="18" rx="3" fill="var(--hb-ventana)" stroke="#d6cfc4" strokeWidth="2" />
      <rect x="20" y="-48" width="20" height="18" rx="3" fill="var(--hb-ventana)" stroke="#d6cfc4" strokeWidth="2" />
      <text x="0" y="-72" textAnchor="middle" fontSize="16" fill="#fbbf24">✦</text>
    </g>
  )
}

function Arbol({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="0" rx="30" ry="6" fill="#000" opacity=".12" />
      <rect x="-6" y="-40" width="12" height="40" rx="4" fill="#92400e" />
      <circle cx="0" cy="-62" r="30" fill="var(--hb-copa)" />
      <circle cx="-18" cy="-48" r="20" fill="var(--hb-copa)" />
      <circle cx="18" cy="-50" r="20" fill="var(--hb-copa2)" />
    </g>
  )
}

const Flor = ({ x, y, c }) => (
  <g transform={`translate(${x} ${y})`}>
    <line x1="0" y1="0" x2="0" y2="-12" stroke="#15803d" strokeWidth="2" />
    {[0, 72, 144, 216, 288].map(a => (
      <circle key={a} cx="0" cy="-17" r="3.4" fill={c} transform={`rotate(${a} 0 -14)`} />
    ))}
    <circle cx="0" cy="-14" r="2.2" fill="#fbbf24" />
  </g>
)

function Bloqueado() {
  return (
    <g>
      <ellipse cx="0" cy="0" rx="28" ry="5" fill="#000" opacity=".1" />
      <path d="M-26 0 C-30 -40 -18 -70 0 -72 C18 -70 30 -40 26 0 Z"
        fill="var(--hb-silueta)" stroke="var(--hb-silueta-borde)" strokeWidth="2.5" strokeDasharray="6 5" />
      <text x="0" y="-26" textAnchor="middle" fontSize="28" fontWeight="700" fill="var(--hb-silueta-borde)" fontFamily="var(--font-sans)">?</text>
    </g>
  )
}

export default function Escena({ items = [], noche = false, elegido, onElegir }) {
  const colocados = items.slice(0, MAX_LUGARES).map((it, i) => ({ ...it, lugar: LUGARES[i] }))
  // Se dibujan de atrás hacia adelante para que los de enfrente tapen.
  const enOrden = [...colocados].sort((a, b) => a.lugar[1] - b.lugar[1])

  return (
    <svg className={`hb-escena${noche ? ' hb-noche' : ''}`} viewBox="0 0 1000 480"
      role="img" aria-label={`Tu hábitat: ${items.filter(i => !i.bloqueado).length} objetos desbloqueados`}>
      <defs>
        <linearGradient id="hb-cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--hb-cielo1)" />
          <stop offset="1" stopColor="var(--hb-cielo2)" />
        </linearGradient>
      </defs>

      {/* Cielo */}
      <rect width="1000" height="480" fill="url(#hb-cielo)" />
      {noche ? (
        <>
          {[[90, 60], [210, 110], [330, 40], [470, 90], [560, 30], [700, 70], [860, 40], [940, 120], [150, 160], [620, 140]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 ? 1.6 : 2.4} fill="#fff" className="hb-estrella" style={{ animationDelay: `${i * 0.37}s` }} />
          ))}
          <circle cx="820" cy="90" r="34" fill="#fef3c7" />
          <circle cx="806" cy="80" r="30" fill="var(--hb-cielo1)" />
        </>
      ) : (
        <>
          <circle cx="820" cy="90" r="46" fill="#fde68a" opacity=".45" />
          <circle cx="820" cy="90" r="32" fill="#fbbf24" />
        </>
      )}
      <Nube x={180} y={90} s={1} dur={70} />
      <Nube x={520} y={60} s={0.75} dur={95} />
      <Nube x={700} y={150} s={0.6} dur={120} />

      {/* Colinas al fondo */}
      <path d="M0 260 C120 190 240 220 360 240 C480 200 600 180 720 230 C820 200 920 210 1000 230 V480 H0 Z" fill="var(--hb-colina1)" />
      <path d="M0 290 C140 250 300 280 420 270 C560 250 700 290 820 268 C900 255 960 262 1000 270 V480 H0 Z" fill="var(--hb-colina2)" />

      {/* Pasto */}
      <path d="M0 300 C200 284 420 296 600 290 C780 284 900 292 1000 296 V480 H0 Z" fill="var(--hb-pasto)" />
      <path d="M0 440 C220 420 520 432 760 424 C860 420 940 426 1000 430 V480 H0 Z" fill="var(--hb-pasto2)" />
      {/* Caminito de la casita */}
      <path d="M170 302 C220 340 330 360 420 380 C470 392 500 420 520 470" stroke="var(--hb-camino)" strokeWidth="22" fill="none" strokeLinecap="round" opacity=".8" />

      <Arbol x={960} y={300} s={0.9} />
      <Arbol x={40} y={290} s={0.75} />
      <Casita />
      {[[260, 452, '#f472b6'], [300, 460, '#fbbf24'], [640, 456, '#a78bfa'], [690, 462, '#f472b6'], [880, 450, '#fbbf24'], [60, 446, '#a78bfa']].map(([x, y, c], i) => (
        <Flor key={i} x={x} y={y} c={c} />
      ))}

      {/* Objetos */}
      {enOrden.map(({ clave, objeto, bloqueado, titulo, lugar: [x, y, s] }) => {
        const Dibujo = OBJETOS[objeto]?.Dibujo
        const activo = elegido === clave
        return (
          <g key={clave} transform={`translate(${x} ${y}) scale(${s})`}
            className={`hb-obj${activo ? ' hb-obj--on' : ''}${bloqueado ? ' hb-obj--bloq' : ''}`}
            role="button" tabIndex={0} aria-label={titulo} aria-pressed={activo}
            onClick={() => onElegir?.(clave)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onElegir?.(clave))}>
            <title>{titulo}</title>
            {/* zona de toque más grande que el dibujo */}
            <rect x="-46" y="-96" width="92" height="104" fill="transparent" />
            {activo && <ellipse cx="0" cy="0" rx="42" ry="9" fill="none" stroke="#fbbf24" strokeWidth="3" />}
            <g className="hb-obj-dibujo">{bloqueado || !Dibujo ? <Bloqueado /> : <Dibujo />}</g>
          </g>
        )
      })}
    </svg>
  )
}
