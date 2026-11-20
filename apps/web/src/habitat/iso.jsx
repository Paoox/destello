/**
 * Hábitat — piezas para dibujar en isométrico (SVG).
 *
 * Mundo: el cuarto mide 12 × 12 de piso y 8 de alto. (0,0) es la esquina del
 * fondo; x corre hacia la derecha-abajo (pared derecha = plano y=0) y y hacia
 * la izquierda-abajo (pared izquierda = plano x=0). z es la altura.
 */
export const U = 26                       // px por unidad
export const ANCHO = 12, FONDO = 12, ALTO = 8
const C = Math.cos(Math.PI / 6), S = 0.5
export const OX = 345, OY = ALTO * U + 48
export const VISTA = '0 0 690 660'
export const TRAZO = '#2c2a3a'            // contorno, estilo ilustración

export const P = (x, y, z = 0) => [OX + (x - y) * U * C, OY + (x + y) * U * S - z * U]
const pts = (lista) => lista.map(([x, y, z]) => P(x, y, z).map(n => n.toFixed(1)).join(',')).join(' ')

/** Aclara (+) u oscurece (−) un color hex. */
export function tono(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))
  return `#${ch.map(v => v.toString(16).padStart(2, '0')).join('')}`
}

/** Polígono en el mundo. */
export const Plano = ({ p, fill, stroke = TRAZO, sw = 1.4, ...r }) =>
  <polygon points={pts(p)} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" {...r} />

export const Linea = ({ a, b, stroke = TRAZO, sw = 1.2, ...r }) => {
  const [x1, y1] = P(...a), [x2, y2] = P(...b)
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" {...r} />
}

/**
 * Caja con sus 3 caras visibles: arriba (clara), frente-izquierda (+y, base)
 * y frente-derecha (+x, oscura). `caras` permite dar color propio a cada una.
 */
export function Caja({ x, y, z = 0, w, d, h, c = '#cccccc', caras = {}, sw = 1.4 }) {
  const top = caras.top ?? tono(c, 0.28), izq = caras.izq ?? c, der = caras.der ?? tono(c, -0.22)
  return (
    <g>
      <Plano sw={sw} fill={izq} p={[[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]} />
      <Plano sw={sw} fill={der} p={[[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]} />
      <Plano sw={sw} fill={top} p={[[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]} />
    </g>
  )
}

/** Círculo en pantalla anclado a un punto del mundo (hojas, cabezas, tazas). */
export const Bola = ({ x, y, z = 0, r, fill, dx = 0, dy = 0, sw = 1.3, ...rest }) => {
  const [cx, cy] = P(x, y, z)
  return <circle cx={cx + dx} cy={cy + dy} r={r} fill={fill} stroke={TRAZO} strokeWidth={sw} {...rest} />
}

/** Elipse acostada en el piso (o a la altura z): alfombras, platos. */
export function Ovalo({ x, y, z = 0, rx, ry = rx, fill, sw = 1.4, ...r }) {
  const p = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2
    return [x + Math.cos(a) * rx, y + Math.sin(a) * ry, z]
  })
  return <Plano p={p} fill={fill} sw={sw} {...r} />
}

/** Rectángulo sobre la pared derecha (plano y=0). */
export const EnParedDer = ({ x, z, w, h, fill, y = 0.02, ...r }) =>
  <Plano fill={fill} p={[[x, y, z], [x + w, y, z], [x + w, y, z + h], [x, y, z + h]]} {...r} />

/** Rectángulo sobre la pared izquierda (plano x=0). */
export const EnParedIzq = ({ y, z, w, h, fill, x = 0.02, ...r }) =>
  <Plano fill={fill} p={[[x, y, z], [x, y + w, z], [x, y + w, z + h], [x, y, z + h]]} {...r} />

/** viewBox que encierra una caja del mundo (para las miniaturas de la tienda). */
export function vistaDe([x, y, z, w, d, h], margen = 10) {
  const esq = []
  for (const a of [x, x + w]) for (const b of [y, y + d]) for (const c of [z, z + h]) esq.push(P(a, b, c))
  const xs = esq.map(p => p[0]), ys = esq.map(p => p[1])
  const x0 = Math.min(...xs) - margen, y0 = Math.min(...ys) - margen
  const lado = Math.max(Math.max(...xs) - x0 + margen, Math.max(...ys) - y0 + margen)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
  return `${(cx - lado / 2).toFixed(0)} ${(cy - lado / 2).toFixed(0)} ${lado.toFixed(0)} ${lado.toFixed(0)}`
}

/**
 * Arte de Paola (`./piezas/<id>.png|webp`, lienzo completo 1380 × 1320).
 * Si existe la imagen de una pieza, se usa en lugar de su dibujo de código.
 */
const ARCHIVOS = import.meta.glob('./piezas/*.{png,webp}', { eager: true, import: 'default' })
export const ARTE = Object.fromEntries(Object.entries(ARCHIVOS).map(([ruta, url]) => [ruta.replace(/^.*\/|\.(png|webp)$/g, ''), url]))

/** La imagen de una pieza, alineada a la casa completa. */
export const Arte = ({ id }) => <image href={ARTE[id]} x="0" y="0" width="690" height="660" preserveAspectRatio="none" />
