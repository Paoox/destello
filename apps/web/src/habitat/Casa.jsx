/**
 * Hábitat — la casa de la persona: un cuarto en corte isométrico sobre una
 * islita de pasto (estilo ilustración con contornos, referencia de Paola).
 *
 * `puestos`: { lugar: objeto_id } tal como lo guarda la API (pared y piso
 * siempre vienen). Lo que no tenga dibujo en `muebles.jsx` se ignora.
 */
import { Caja, Plano, Linea, Bola, EnParedIzq, P, VISTA, vistaDe, ARTE, Arte, ANCHO as W, FONDO as D, ALTO as H, tono } from './iso.jsx'
import { MUEBLES, PAREDES, PISOS } from './muebles.jsx'
import { selloPorId } from '@/aula/catalogo.js'


function Piso({ estilo }) {
  const p = PISOS[estilo] ?? PISOS['piso-madera']
  if (estilo === 'piso-mosaico') {
    const t = []
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      const c = (i + j) % 3 === 0 ? p.a : (i + j) % 3 === 1 ? p.base : p.b
      t.push(<Plano key={`${i}-${j}`} sw={0.8} stroke={p.linea} fill={c}
        p={[[i * 2, j * 2, 0], [i * 2 + 2, j * 2, 0], [i * 2 + 2, j * 2 + 2, 0], [i * 2, j * 2 + 2, 0]]} />)
    }
    return <>{t}</>
  }
  const lineas = []
  if (estilo === 'piso-tatami') {
    for (let y = 0; y <= D; y += 3) lineas.push(<Linea key={`h${y}`} a={[0, y, 0]} b={[W, y, 0]} stroke={p.linea} sw={1.6} />)
    for (let r = 0; r < 4; r++) for (let x = r % 2 ? 3 : 6; x < W; x += 6)
      lineas.push(<Linea key={`v${r}-${x}`} a={[x, r * 3, 0]} b={[x, r * 3 + 3, 0]} stroke={p.linea} sw={1.6} />)
  } else {
    for (let y = 1; y < D; y++) lineas.push(<Linea key={`h${y}`} a={[0, y, 0]} b={[W, y, 0]} stroke={p.linea} sw={0.9} />)
    for (let y = 0; y < D; y++) for (let x = (y * 5) % 7 + 1; x < W; x += 6)
      lineas.push(<Linea key={`c${y}-${x}`} a={[x, y, 0]} b={[x, y + 1, 0]} stroke={p.linea} sw={0.9} />)
  }
  return <><Plano fill={p.base} sw={0} stroke="none" p={[[0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0]]} />{lineas}</>
}

function Ventana({ noche }) {
  const cielo = noche ? '#1d2b55' : '#bfe6f7'
  return (
    <g>
      <EnParedIzq y={5.9} z={3.5} w={3.7} h={3.1} fill="#fbf6ee" />
      <EnParedIzq y={6.1} z={3.7} w={3.3} h={2.7} fill={cielo} sw={1.2} />
      {noche
        ? <><Bola x={0.04} y={8.6} z={5.8} r={6} fill="#fef3c7" sw={1} /><Bola x={0.04} y={7.0} z={6.0} r={1.2} fill="#fff" sw={0} /><Bola x={0.04} y={7.6} z={4.6} r={1} fill="#fff" sw={0} /></>
        : <><Bola x={0.04} y={8.7} z={5.7} r={6} fill="#fbbf24" sw={1} /><Plano sw={1} fill="#ffffff" p={[[0.04, 6.6, 4.6], [0.04, 7.8, 4.6], [0.04, 7.5, 4.95], [0.04, 6.9, 5.0]]} /></>}
      <Linea a={[0.05, 7.75, 3.7]} b={[0.05, 7.75, 6.4]} sw={2.2} stroke="#fbf6ee" />
      <Linea a={[0.05, 6.1, 5.05]} b={[0.05, 9.4, 5.05]} sw={2.2} stroke="#fbf6ee" />
      <Caja x={0} y={5.8} z={3.3} w={0.45} d={3.9} h={0.2} c="#fbf6ee" sw={1.1} />
    </g>
  )
}

export default function Casa({ puestos = {}, noche = false, elegido, onElegir, nombres = {}, sellos = [], selloElegido, onElegirSello }) {
  const pared = PAREDES[puestos.pared] ?? PAREDES['pared-crema']
  const PASTO = noche ? '#3f7a52' : '#7cc576', TIERRA = noche ? '#4a3424' : '#7a5236'
  const muebles = Object.entries(puestos)
    .filter(([lugar, id]) => lugar !== 'pared' && lugar !== 'piso' && MUEBLES[id])
    .map(([lugar, id]) => ({ lugar, id, ...MUEBLES[id] }))
    .sort((a, b) => a.orden - b.orden)
  const enPared = muebles.filter(m => m.orden < -1)
  const enPiso  = muebles.filter(m => m.orden === -1)
  const resto   = muebles.filter(m => m.orden >= 0)

  const Objeto = ({ m }) => {
    const activo = elegido === m.lugar
    return (
      <g className={`hb-mueble${activo ? ' hb-mueble--on' : ''}`} role="button" tabIndex={0}
        aria-label={nombres[m.id] ?? m.id} aria-pressed={activo}
        onClick={() => onElegir?.(m.lugar)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onElegir?.(m.lugar))}>
        <title>{nombres[m.id] ?? m.id}</title>
        {ARTE[m.id] ? <Arte id={m.id} /> : <m.Dibujo />}
      </g>
    )
  }

  return (
    <svg className="hb-casa" viewBox={VISTA} role="img" aria-label="Tu casa en el Hábitat">
      {/* Islita de pasto */}
      {ARTE.isla ? <Arte id="isla" /> : <>
      <Caja x={-1.4} y={-1.4} z={-1.5} w={15.2} d={15.2} h={0.9} c={TIERRA} caras={{ top: PASTO, izq: TIERRA, der: tono(TIERRA, -0.25) }} />
      {[[13.4, 1.5], [13.2, 6.5], [12.9, 12.9], [6.5, 13.4], [1.0, 13.2], [10, 13.5], [13.5, 10]].map(([x, y], i) => (
        <g key={i}>
          <Bola x={x} y={y} z={-0.6} dy={-4} r={11} fill={tono(PASTO, -0.18)} sw={1.2} />
          <Bola x={x} y={y} z={-0.6} dx={9} dy={-2} r={8} fill={tono(PASTO, 0.05)} sw={1.2} />
          {i % 2 === 0 && <Bola x={x} y={y} z={-0.6} dx={-3} dy={-14} r={3.4} fill={i % 4 ? '#f6c453' : '#f48fb1'} sw={1} />}
        </g>
      ))}
      </>}

      {/* Losa, paredes y piso */}
      {ARTE.losa ? <Arte id="losa" /> : <Caja x={-0.5} y={-0.5} z={-0.6} w={W + 0.5} d={D + 0.5} h={0.6} c="#efe6d6" caras={{ top: '#000', izq: '#e7dccb', der: '#d6c8b2' }} />}
      {ARTE[puestos.pared] ? <Arte id={puestos.pared} /> : <>
      <Caja x={-0.5} y={-0.5} w={W + 0.5} d={0.5} h={H} c={pared} caras={{ top: '#fbf6ee', izq: pared, der: '#e7dccb' }} />
      <Caja x={-0.5} y={0} w={0.5} d={D} h={H} c={pared} caras={{ top: '#fbf6ee', izq: '#e7dccb', der: tono(pared, -0.12) }} />
      {puestos.pared === 'pared-noche' && [[3, 0, 6.5], [6, 0, 5.2], [9.5, 0, 6.8], [11, 0, 3.4], [0, 2.5, 6.2], [0, 4.2, 3.8], [0, 11, 6.8]].map(([x, y, z], i) => (
        <Bola key={i} x={x + (x ? 0 : 0.03)} y={y + (y ? 0 : 0.03)} z={z} r={1.6} fill="#fde68a" sw={0} />
      ))}
      <Linea a={[0, 0, 0.35]} b={[W, 0, 0.35]} stroke={tono(pared, -0.3)} sw={1} />
      <Linea a={[0, 0, 0.35]} b={[0, D, 0.35]} stroke={tono(pared, -0.3)} sw={1} />
      </>}
      {ARTE[puestos.piso] ? <Arte id={puestos.piso} /> : <>
        <Piso estilo={puestos.piso} />
        <Plano fill="none" p={[[0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0]]} />
      </>}
      {ARTE[noche ? 'ventana-noche' : 'ventana-dia'] ? <Arte id={noche ? 'ventana-noche' : 'ventana-dia'} /> : <Ventana noche={noche} />}

      <RepisasDeSellos sellos={sellos} elegido={selloElegido} onElegir={onElegirSello} />
      {enPared.map(m => <Objeto key={m.lugar} m={m} />)}
      {enPiso.map(m => <Objeto key={m.lugar} m={m} />)}
      {resto.map(m => <Objeto key={m.lugar} m={m} />)}

      {noche && puestos.lampara && (() => {
        const [x, y] = P(11.4, 0.7, 4)
        return <circle cx={x} cy={y} r="60" fill="url(#hb-luz)" pointerEvents="none" />
      })()}
      <defs>
        <radialGradient id="hb-luz">
          <stop offset="0" stopColor="#fde68a" stopOpacity=".55" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  )
}

/**
 * Los sellos que le dio la profe en clase (migración 028): sus primeros
 * objetos. Van en dos repisas altas — pared derecha primero, luego la
 * izquierda — 6 por repisa. La repisa aparece con el primer sello.
 */
export const SELLOS_EN_CASA = 12
const LUGAR_SELLO = [
  ...[1.0, 2.0, 3.0, 4.0, 5.0, 6.0].map(x => ({ x, y: 0.3, pared: 'der' })),
  ...[1.0, 1.8, 2.6, 3.4, 4.2, 5.0].map(y => ({ x: 0.3, y, pared: 'izq' })),
]
function RepisasDeSellos({ sellos, elegido, onElegir }) {
  const lista = sellos.slice(0, SELLOS_EN_CASA)
  if (!lista.length) return null
  const Z = 6.3
  return (
    <g>
      <Caja x={0.4} y={0} z={Z} w={6.4} d={0.6} h={0.16} c="#d9a66f" />
      {lista.length > 6 && <Caja x={0} y={0.4} z={Z} w={0.6} d={5.0} h={0.16} c="#d9a66f" />}
      {lista.map((s, i) => {
        const def = selloPorId(s.sello)
        const { x, y } = LUGAR_SELLO[i]
        const [cx, cy] = P(x, y, Z + 0.16)
        const activo = elegido === s.sello
        const R = 15
        return (
          <g key={s.sello} className={`hb-mueble${activo ? ' hb-mueble--on' : ''}`} role="button" tabIndex={0}
            aria-label={`Sello ${def?.nombre ?? s.sello}`} aria-pressed={activo}
            onClick={() => onElegir?.(s.sello)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onElegir?.(s.sello))}>
            <title>{`Sello: ${def?.nombre ?? s.sello}${s.juegos?.length ? ' — tócalo para jugar' : ''}`}</title>
            <ellipse cx={cx} cy={cy} rx="9" ry="3" fill="#000" opacity=".15" />
            <rect x={cx - 1.5} y={cy - 6} width="3" height="6" fill="#8a5a33" />
            <circle cx={cx} cy={cy - 6 - R} r={R} fill="#fffaf0" stroke={def?.color ?? '#D97706'} strokeWidth="3" />
            {def?.imagen
              ? <image href={def.imagen} x={cx - R + 3} y={cy - 6 - 2 * R + 3} width={2 * R - 6} height={2 * R - 6} />
              : <text x={cx} y={cy - 6 - R + 5} textAnchor="middle" fontSize="13">{def?.emoji ?? '✦'}</text>}
            {s.juegos?.length > 0 && (
              <g className="hb-sello-juego" aria-hidden="true">
                <circle cx={cx + R - 2} cy={cy - 6 - 2 * R + 4} r="6.5" fill="#D97706" stroke="#fff" strokeWidth="1.5" />
                <path d={`M${cx + R - 4} ${cy - 6 - 2 * R + 1} l5 3 -5 3 z`} fill="#fff" />
              </g>
            )}
          </g>
        )
      })}
    </g>
  )
}

/** Miniatura de un objeto o estilo para la tienda. */
export function Miniatura({ id, lugar }) {
  if ((lugar === 'pared' || lugar === 'piso') && ARTE[id]) {
    return <svg viewBox={lugar === 'piso' ? '65 230 560 360' : '0 0 690 560'} className="hb-mini" aria-hidden="true"><Arte id={id} /></svg>
  }
  if (lugar === 'pared') {
    const c = PAREDES[id]
    return (
      <svg viewBox="0 0 100 100" className="hb-mini" aria-hidden="true">
        <path d="M50 12 L14 30 L14 82 L50 64 Z" fill={tono(c, -0.12)} stroke="#2c2a3a" strokeWidth="2" strokeLinejoin="round" />
        <path d="M50 12 L86 30 L86 82 L50 64 Z" fill={c} stroke="#2c2a3a" strokeWidth="2" strokeLinejoin="round" />
        {id === 'pared-noche' && <><circle cx="66" cy="40" r="2.5" fill="#fde68a" /><circle cx="30" cy="48" r="2" fill="#fde68a" /></>}
      </svg>
    )
  }
  if (lugar === 'piso') {
    return (
      <svg viewBox="65 230 560 360" className="hb-mini" aria-hidden="true">
        <Piso estilo={id} />
        <Plano fill="none" p={[[0, 0, 0], [W, 0, 0], [W, D, 0], [0, D, 0]]} sw={3} />
      </svg>
    )
  }
  const m = MUEBLES[id]
  if (!m) return <svg viewBox="0 0 10 10" className="hb-mini" aria-hidden="true" />
  return (
    <svg viewBox={vistaDe(m.caja, 12)} className="hb-mini" aria-hidden="true">{ARTE[id] ? <Arte id={id} /> : <m.Dibujo />}</svg>
  )
}

