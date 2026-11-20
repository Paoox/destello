/**
 * Hábitat — dibujo de cada objeto del catálogo (mismo `id` que
 * `apps/api/src/services/habitatCatalogo.js`, donde viven nombre y precio).
 *
 *   orden  profundidad para dibujar (más alto = más al frente). Lo que va en
 *          pared usa negativos para quedar detrás de todo.
 *   caja   [x, y, z, w, d, h] aproximada: miniatura de la tienda y zona de toque.
 */
import { Caja, Bola, Ovalo, Plano, Linea, EnParedDer, EnParedIzq, P, TRAZO, tono } from './iso.jsx'

const MADERA = '#b7794a', MADERA_CLARA = '#d9a66f', TERRACOTA = '#c8643b', VERDE = '#3f9b5f', VERDE_OSC = '#2b7a4b'

// ── Estilos ──────────────────────────────────────────────────────────────
export const PAREDES = {
  'pared-crema':   '#f3e9d8', 'pared-jade': '#7fc4b6', 'pared-ambar': '#f2c27b',
  'pared-lavanda': '#c9b8e8', 'pared-cielo': '#a9d4f0', 'pared-noche': '#3a4a7a',
}
export const PISOS = {
  'piso-madera':  { base: '#c98d5a', linea: '#a86e40' },
  'piso-clara':   { base: '#ecd3a8', linea: '#cfae7c' },
  'piso-tatami':  { base: '#cfd49a', linea: '#7f8a4a' },
  'piso-mosaico': { base: '#f1e6d2', linea: '#c9b79a', a: '#7fc4b6', b: '#f2a65a' },
}

// ── Piezas que se repiten ──────────────────────────────────────────────────
const Maceta = ({ x, y, s = 1, c = TERRACOTA }) => (
  <>
    <Caja x={x} y={y} w={s} d={s} h={0.9 * s} c={c} />
    <Caja x={x - 0.08} y={y - 0.08} z={0.9 * s} w={s + 0.16} d={s + 0.16} h={0.18} c={tono(c, 0.1)} />
  </>
)
const Hojas = ({ x, y, z, lista, c = VERDE }) => lista.map(([dx, dy, r, k], i) =>
  <Bola key={i} x={x} y={y} z={z} dx={dx} dy={dy} r={r} fill={tono(c, k ?? 0)} />)

const Libros = ({ y0, z, colores }) => colores.map((c, i) =>
  <Caja key={i} x={0.3} y={y0 + i * 0.32} z={z} w={0.75} d={0.26} h={0.7 + (i % 3) * 0.12} c={c} sw={1} />)

export const MUEBLES = {
  // Alfombras (en el piso, antes que todo lo demás)
  'alfombra-zen': { orden: -1, caja: [3, 4, 0, 6, 6, 0.2], Dibujo: () => (
    <>
      <Ovalo x={6} y={7} rx={3} ry={2.6} fill="#9fd3c7" />
      <Ovalo x={6} y={7} rx={2.1} ry={1.8} fill="#c6e8df" sw={1} />
      <Ovalo x={6} y={7} rx={1.1} ry={0.9} fill="#9fd3c7" sw={1} />
    </>
  ) },
  'alfombra-rayas': { orden: -1, caja: [3.4, 4.6, 0, 5.4, 5, 0.2], Dibujo: () => (
    <>
      <Plano fill="#f6eedf" p={[[3.4, 4.6, 0], [8.8, 4.6, 0], [8.8, 9.6, 0], [3.4, 9.6, 0]]} />
      {[0, 1, 2, 3, 4].map(i => (
        <Plano key={i} sw={0} stroke="none" fill={i % 2 ? '#f2a65a' : '#0d7377'}
          p={[[3.4 + 0.5 + i * 1, 4.6, 0], [3.4 + 1 + i * 1, 4.6, 0], [3.4 + 1 + i * 1, 9.6, 0], [3.4 + 0.5 + i * 1, 9.6, 0]]} />
      ))}
      <Plano fill="none" p={[[3.4, 4.6, 0], [8.8, 4.6, 0], [8.8, 9.6, 0], [3.4, 9.6, 0]]} />
    </>
  ) },

  // En las paredes
  'cuadro-montana': { orden: -5, caja: [2.4, 0, 3.6, 2.8, 0.1, 2], Dibujo: () => (
    <>
      <EnParedDer x={2.4} z={3.6} w={2.8} h={2} fill={MADERA} />
      <EnParedDer x={2.6} z={3.8} w={2.4} h={1.6} fill="#cfe9f3" sw={1} />
      <Plano sw={1} fill="#5a8f7b" p={[[2.6, 0.03, 3.8], [3.4, 0.03, 5.0], [4.0, 0.03, 4.3], [4.5, 0.03, 4.9], [5.0, 0.03, 3.8]]} />
      <Plano sw={1} fill="#ffffff" p={[[3.2, 0.03, 4.7], [3.4, 0.03, 5.0], [3.6, 0.03, 4.75]]} />
      <Bola x={4.6} y={0.03} z={5.15} r={4} fill="#f6c453" sw={1} />
    </>
  ) },
  'cuadro-ola': { orden: -5, caja: [0, 10, 3.8, 0.1, 1.6, 1.8], Dibujo: () => (
    <>
      <EnParedIzq y={10} z={3.8} w={1.6} h={1.8} fill="#1f2a44" />
      <EnParedIzq y={10.15} z={3.95} w={1.3} h={1.5} fill="#f3ead6" sw={1} />
      <Plano sw={1} fill="#2f6fa8" p={[[0.03, 10.15, 3.95], [0.03, 11.45, 3.95], [0.03, 11.45, 4.5], [0.03, 11.0, 4.9], [0.03, 10.6, 5.0], [0.03, 10.4, 4.6], [0.03, 10.15, 4.4]]} />
      <Plano sw={1} fill="#ffffff" p={[[0.03, 10.55, 4.95], [0.03, 10.8, 5.05], [0.03, 10.95, 4.9]]} />
    </>
  ) },
  'cortinas': { orden: -4, caja: [0, 5.6, 3.2, 0.1, 4.4, 3.8], Dibujo: () => (
    <>
      <Linea a={[0.1, 5.4, 6.9]} b={[0.1, 10.1, 6.9]} sw={3} stroke={MADERA} />
      {[[5.5, 6.3], [9.2, 10.0]].map(([a, b], i) => (
        <Plano key={i} fill="#f2a65a" p={[[0.06, a, 6.85], [0.06, b, 6.85], [0.06, b - 0.1, 3.3], [0.06, (a + b) / 2, 3.1], [0.06, a + 0.1, 3.3]]} />
      ))}
    </>
  ) },
  'repisa': { orden: -3, caja: [7.6, 0, 4.4, 3.2, 0.8, 1.6], Dibujo: () => (
    <>
      <Caja x={7.6} y={0} z={4.6} w={3.2} d={0.7} h={0.16} c={MADERA_CLARA} />
      {[8.0, 9.0, 10.0].map((x, i) => (
        <g key={x}>
          <Caja x={x} y={0.15} z={4.76} w={0.45} d={0.4} h={0.45} c={['#f2a65a', '#7fc4b6', '#e88aa6'][i]} sw={1} />
          <Hojas x={x + 0.22} y={0.35} z={5.3} c={i === 1 ? '#5aa469' : VERDE} lista={[[0, 0, 7], [-6, 6, 5], [6, 5, 5]]} />
          {i !== 1 && [0, 1, 2].map(k => <Bola key={k} x={x + 0.45} y={0.4} z={4.6 - k * 0.32} r={3.5} fill={VERDE} sw={1} />)}
        </g>
      ))}
    </>
  ) },

  // Muebles
  'librero': { orden: 3.5, caja: [0, 1.8, 0, 1.2, 2.6, 5.5], Dibujo: () => (
    <>
      <Caja x={0} y={1.8} w={1.15} d={2.6} h={5.5} c={MADERA} caras={{ der: '#5e3a22' }} />
      {[0.15, 1.55, 2.95, 4.25].map(z => (
        <Caja key={z} x={0} y={1.85} z={z} w={1.15} d={2.5} h={0.14} c={MADERA_CLARA} sw={1} />
      ))}
      <Libros y0={1.95} z={0.29} colores={['#e0524c', '#3a7bd5', '#f2c94c', '#2d9c74', '#9b59b6', '#e67e22']} />
      <Libros y0={2.2} z={1.69} colores={['#16a085', '#f39c12', '#c0392b', '#2c3e50', '#d35400']} />
      <Libros y0={1.95} z={3.09} colores={['#8e44ad', '#27ae60', '#e74c3c', '#f1c40f']} />
      <Hojas x={0.6} y={3.9} z={4.9} lista={[[0, 0, 6], [-5, 4, 5], [5, 4, 5]]} />
    </>
  ) },
  'cama-nube': { orden: 11.5, caja: [7.4, 0, 0, 3.4, 4.8, 2.2], Dibujo: () => (
    <>
      <Caja x={7.4} y={0} w={3.4} d={0.3} h={2.2} c={MADERA} />
      <Caja x={7.4} y={0.3} w={3.4} d={4.5} h={0.8} c={MADERA} />
      <Caja x={7.5} y={0.35} z={0.8} w={3.2} d={4.4} h={0.5} c="#fbf6ee" />
      <Caja x={7.8} y={0.5} z={1.3} w={1.2} d={0.9} h={0.35} c="#ffffff" sw={1.1} />
      <Caja x={9.3} y={0.5} z={1.3} w={1.2} d={0.9} h={0.35} c="#ffffff" sw={1.1} />
      <Caja x={7.45} y={1.9} z={0.8} w={3.3} d={2.95} h={0.62} c="#5bb6a6" />
      <Linea a={[7.45, 2.8, 1.42]} b={[10.75, 2.8, 1.42]} stroke="#ffffff" sw={1.5} />
    </>
  ) },
  'cama-futon': { orden: 11.5, caja: [7.4, 0.3, 0, 3.4, 4.6, 1], Dibujo: () => (
    <>
      <Caja x={7.4} y={0.4} w={3.3} d={4.4} h={0.35} c="#f4ede0" />
      <Caja x={7.4} y={1.9} z={0.35} w={3.3} d={2.9} h={0.22} c="#e98b55" />
      <Caja x={8.4} y={0.6} z={0.35} w={1.4} d={0.8} h={0.3} c="#ffffff" sw={1.1} />
    </>
  ) },
  'sofa-jade': { orden: 5, caja: [1.8, 0.2, 0, 4, 2, 1.9], Dibujo: () => <Sofa c="#2f8f86" /> },
  'sofa-ambar': { orden: 5, caja: [1.8, 0.2, 0, 4, 2, 1.9], Dibujo: () => <Sofa c="#d9902f" /> },
  'escritorio': { orden: 9.5, caja: [0, 5.5, 0, 3.8, 4, 4], Dibujo: () => (
    <>
      <Caja x={0.25} y={5.7} w={0.2} d={0.2} h={2.4} c={MADERA} sw={1} />
      <Caja x={1.9} y={5.7} w={0.2} d={0.2} h={2.4} c={MADERA} sw={1} />
      <Caja x={0.25} y={9.1} w={0.2} d={0.2} h={2.4} c={MADERA} sw={1} />
      <Caja x={1.9} y={9.1} w={0.2} d={0.2} h={2.4} c={MADERA} sw={1} />
      <Caja x={0.15} y={5.6} z={2.4} w={2.1} d={3.8} h={0.2} c={MADERA_CLARA} />
      <Caja x={0.5} y={7.1} z={2.6} w={0.4} d={0.5} h={0.1} c="#3b3f4a" sw={1} />
      <Caja x={0.6} y={7.25} z={2.7} w={0.12} d={0.2} h={0.6} c="#3b3f4a" sw={1} />
      <Caja x={0.45} y={6.45} z={3.2} w={0.15} d={1.8} h={1.15} c="#3b3f4a" caras={{ der: '#7fd1e8' }} />
      <Caja x={1.2} y={6.8} z={2.6} w={0.5} d={1.2} h={0.06} c="#e6e6e6" sw={1} />
      <Caja x={1.2} y={8.5} z={2.6} w={0.4} d={0.4} h={0.5} c="#f2a65a" sw={1} />
      {/* Silla */}
      <Caja x={3.0} y={7.1} w={0.12} d={0.12} h={1.4} c="#3b3f4a" sw={1} />
      <Caja x={2.6} y={6.7} z={1.3} w={1.0} d={1.0} h={0.25} c="#0d7377" />
      <Caja x={3.45} y={6.7} z={1.55} w={0.2} d={1.0} h={1.4} c="#0d7377" />
    </>
  ) },
  'mesa-te': { orden: 12.5, caja: [5.1, 6, 0, 2, 1.8, 1.3], Dibujo: () => (
    <>
      {[[5.3, 6.3], [6.8, 6.3], [5.3, 7.5], [6.8, 7.5]].map(([x, y]) => <Caja key={`${x}${y}`} x={x} y={y} w={0.15} d={0.15} h={0.6} c={MADERA} sw={1} />)}
      <Caja x={5.1} y={6.1} z={0.6} w={2} d={1.7} h={0.18} c={MADERA_CLARA} />
      <Bola x={6.1} y={6.9} z={0.95} r={8} fill="#f6efe2" />
      <Bola x={6.1} y={6.9} z={1.35} r={3} fill="#0d7377" sw={1} />
      <path d={(() => { const [x, y] = P(6.1, 6.9, 0.95); return `M${x + 7} ${y - 2} q8 -2 9 -8` })()} stroke={TRAZO} strokeWidth="1.6" fill="none" />
      {[[5.5, 7.4], [6.8, 6.5]].map(([x, y]) => <Caja key={x} x={x} y={y} z={0.78} w={0.3} d={0.3} h={0.25} c="#ffffff" sw={1} />)}
    </>
  ) },
  'lampara': { orden: 12, caja: [10.9, 0.2, 0, 1, 1, 4.6], Dibujo: () => (
    <>
      <Caja x={11.05} y={0.35} w={0.7} d={0.7} h={0.12} c="#3b3f4a" sw={1} />
      <Caja x={11.35} y={0.65} z={0.12} w={0.1} d={0.1} h={3.4} c="#3b3f4a" sw={1} />
      <Caja x={10.95} y={0.25} z={3.5} w={0.9} d={0.9} h={0.95} c="#f8e3b0" />
    </>
  ) },
  'puff': { orden: 13, caja: [2.4, 9.4, 0, 1.4, 1.4, 0.9], Dibujo: () => (
    <>
      <Caja x={2.4} y={9.4} w={1.3} d={1.3} h={0.8} c="#e88aa6" />
      <Bola x={3.05} y={10.05} z={0.8} r={2.5} fill="#ffffff" sw={1} />
    </>
  ) },

  // Plantas
  'helecho': { orden: 19.8, caja: [10, 9.4, 0, 1.2, 1.2, 2.4], Dibujo: () => (
    <>
      <Maceta x={10.1} y={9.5} s={0.9} />
      <Hojas x={10.55} y={9.95} z={1.2} lista={[[0, -14, 12], [-13, -4, 10, -0.1], [13, -4, 10, 0.08], [-6, -24, 8, 0.12], [8, -22, 8]]} />
    </>
  ) },
  'cactus': { orden: 19.8, caja: [10, 9.4, 0, 1.2, 1.2, 3], Dibujo: () => (
    <>
      <Maceta x={10.1} y={9.5} s={0.9} c="#3a7bd5" />
      <Caja x={10.35} y={9.75} z={0.95} w={0.45} d={0.45} h={1.9} c="#4caf6a" />
      <Caja x={10.1} y={9.75} z={1.6} w={0.25} d={0.3} h={0.7} c="#4caf6a" sw={1} />
      <Caja x={10.8} y={9.8} z={1.3} w={0.25} d={0.3} h={0.6} c="#4caf6a" sw={1} />
      <Bola x={10.6} y={10} z={2.9} r={3.5} fill="#f06292" sw={1} />
    </>
  ) },
  'monstera': { orden: 1, caja: [0.2, 0.2, 0, 1.4, 1.4, 3.4], Dibujo: () => (
    <>
      <Maceta x={0.3} y={0.3} s={1.1} c="#efe6d6" />
      <Hojas x={0.85} y={0.85} z={1.4} c={VERDE_OSC} lista={[[-6, -26, 16], [-22, -14, 13, 0.1], [10, -16, 12, -0.1], [-14, -46, 12, 0.15], [4, -42, 12], [-6, -6, 9, 0.2]]} />
    </>
  ) },
  'bambu': { orden: 1, caja: [0.2, 0.2, 0, 1.4, 1.4, 4.6], Dibujo: () => (
    <>
      <Maceta x={0.3} y={0.3} s={1.1} c="#2f8f86" />
      {[[0.55, 0.6, 3.6], [0.9, 0.8, 4.2], [0.7, 1.0, 3.0]].map(([x, y, h], i) => (
        <g key={i}>
          <Caja x={x} y={y} z={1.1} w={0.14} d={0.14} h={h} c="#8bc34a" sw={1} />
          <Hojas x={x} y={y} z={1.1 + h} c="#5aa469" lista={[[6, 0, 5], [-6, 4, 4]]} />
        </g>
      ))}
    </>
  ) },

  // Mascotas
  'gato': { orden: 16.8, caja: [6.3, 9, 0, 1.4, 1.2, 1.4], Dibujo: () => <Mascota c="#f2a65a" orejas="punta" /> },
  'perrito': { orden: 16.8, caja: [6.3, 9, 0, 1.4, 1.2, 1.4], Dibujo: () => <Mascota c="#c08a5b" orejas="caidas" /> },
}

function Sofa({ c }) {
  return (
    <>
      <Caja x={1.8} y={0.2} w={4} d={0.55} h={1.9} c={c} />
      <Caja x={1.8} y={0.6} w={4} d={1.7} h={0.85} c={tono(c, -0.05)} />
      <Caja x={2.25} y={0.75} z={0.85} w={1.7} d={1.45} h={0.3} c={tono(c, 0.15)} sw={1.1} />
      <Caja x={3.95} y={0.75} z={0.85} w={1.4} d={1.45} h={0.3} c={tono(c, 0.15)} sw={1.1} />
      <Caja x={1.8} y={0.6} z={0.85} w={0.45} d={1.7} h={0.55} c={c} />
      <Caja x={5.35} y={0.6} z={0.85} w={0.45} d={1.7} h={0.55} c={c} />
      <Caja x={2.5} y={0.8} z={1.15} w={0.9} d={0.3} h={0.75} c="#fbf6ee" sw={1} />
    </>
  )
}

function Mascota({ c, orejas }) {
  const [x, y] = P(6.9, 9.6, 0)
  return (
    <g transform={`translate(${x} ${y})`} stroke={TRAZO} strokeWidth="1.4" strokeLinejoin="round">
      <ellipse cx="0" cy="2" rx="16" ry="5" fill="#000" opacity=".12" stroke="none" />
      <path d="M12 -2 q14 -4 10 -18" fill="none" strokeWidth="4" stroke={TRAZO} />
      <path d="M12 -2 q14 -4 10 -18" fill="none" strokeWidth="2" stroke={c} />
      <ellipse cx="2" cy="-8" rx="14" ry="10" fill={c} />
      <circle cx="-10" cy="-20" r="9" fill={c} />
      {orejas === 'punta'
        ? <><path d="M-17 -25 l2 -10 l6 6 z" fill={c} /><path d="M-6 -28 l5 -8 l3 9 z" fill={c} /></>
        : <><ellipse cx="-18" cy="-20" rx="3.5" ry="6.5" fill={tono(c, -0.3)} /><ellipse cx="-3" cy="-21" rx="3.5" ry="6.5" fill={tono(c, -0.3)} /></>}
      <circle cx="-13" cy="-21" r="1.4" fill={TRAZO} stroke="none" />
      <circle cx="-7" cy="-21" r="1.4" fill={TRAZO} stroke="none" />
      <circle cx="-10" cy="-17" r="1.2" fill="#e88aa6" stroke="none" />
    </g>
  )
}
