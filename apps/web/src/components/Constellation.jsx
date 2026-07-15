/**
 * Destello — Constellation
 * Fondo animado global (detrás del menú y de todas las páginas autenticadas).
 *
 * Ocupa TODO el área de contenido (desde donde termina el menú hasta el borde
 * derecho, altura completa). Dos constelaciones de tamaño medio —Piscis y
 * Acuario— viajan lento por toda la pantalla rebotando en los bordes, sobre un
 * campo de estrellas que parpadean. Respeta prefers-reduced-motion.
 */
import { useRef, useEffect } from 'react'

const CSS = `
.ds-constellation {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  left: var(--navbar-width, 240px);   /* arranca donde termina el menú */
  z-index: -1;
  pointer-events: none;
  opacity: 0.85;
}
@media (max-width: 768px) {
  .ds-constellation { left: 0; }       /* en móvil el menú es drawer → ancho completo */
}
@media (prefers-color-scheme: light) {
  .ds-constellation { opacity: 0.7; }
}
`

/* ── Piscis ── dos peces unidos por el cordón (nudo = Alrescha). */
const PISCES = {
  stars: [
    [58, 82], [50, 69], [41, 57], [31, 46], [23, 38],
    [15, 34], [10, 26], [15, 18], [24, 17], [29, 26], [24, 33],
    [67, 71], [75, 59], [83, 48], [90, 39],
    [97, 32], [89, 30],
  ],
  edges: [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 4],
    [0, 11], [11, 12], [12, 13], [13, 14],
    [14, 15], [15, 16], [16, 14],
  ],
  amber: new Set([0, 8, 14, 15]),
}

/* ── Acuario ── hombros, cántaro (water jar) y el chorro que baja a Fomalhaut. */
const AQUARIUS = {
  stars: [
    [18, 28], [34, 24], [50, 28],   // hombros (β, α, γ)
    [57, 23], [62, 29], [54, 34],   // cántaro (ζ, η, π)
    [60, 42], [66, 54], [72, 66], [79, 79], // chorro → Fomalhaut
    [14, 40], [20, 52],             // brazo izquierdo
  ],
  edges: [
    [0, 1], [1, 2],
    [2, 3], [3, 4], [4, 5], [5, 2],
    [5, 6], [6, 7], [7, 8], [8, 9],
    [0, 10], [10, 11],
  ],
  amber: new Set([1, 9]),
}

function bbox(stars) {
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity
  for (const [x, y] of stars) {
    if (x < xmin) xmin = x; if (x > xmax) xmax = x
    if (y < ymin) ymin = y; if (y > ymax) ymax = y
  }
  return { w: xmax - xmin, h: ymax - ymin, cx: (xmin + xmax) / 2, cy: (ymin + ymax) / 2 }
}

const JADE = '47,150,153'
const AMBER = '217,119,6'

/* Paleta de tonos para el campo estelar: del más brillante (casi blanco) al
   más tenue, con algo de ámbar. Se repiten los jade para que dominen. */
const STAR_PALETTE = [
  '215,238,236', // blanco cyan (brillante)
  '160,220,214', // jade claro
  '47,150,153',  // jade
  '47,150,153',
  '47,150,153',
  '32,98,102',   // jade oscuro (tenue)
  '32,98,102',
  '217,119,6',   // ámbar
  '242,188,98',  // ámbar claro
]

export default function Constellation() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let w, h, dpr, raf, t = 0
    const stars = []

    // Un "cuerpo" por constelación, con su bbox, posición, velocidad y escala.
    const bodies = [
      { def: PISCES,   box: bbox(PISCES.stars),   cvx: 0.12,  cvy: 0.085, seed: 0.2 },
      { def: AQUARIUS, box: bbox(AQUARIUS.stars), cvx: -0.10, cvy: 0.11,  seed: 0.6 },
    ]

    const navW = () => (window.innerWidth <= 768 ? 0 : 240)

    const build = () => {
      // Más densidad y variedad: tamaños (sesgo a pequeñas + algunas grandes),
      // colores de la paleta e intensidades distintas por estrella.
      const count = Math.min(360, Math.floor((w * h) / 5500))
      stars.length = 0
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.3 + Math.pow(Math.random(), 2.2) * 2.2,
          col: STAR_PALETTE[(Math.random() * STAR_PALETTE.length) | 0],
          base: 0.12 + Math.random() * 0.33, // brillo base
          amp: 0.08 + Math.random() * 0.30,  // amplitud del parpadeo
          ph: Math.random() * Math.PI * 2,
          sp: 0.5 + Math.random() * 1.1,
        })
      }
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = Math.max(1, window.innerWidth - navW())
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      build()

      // Tamaño MEDIO: ~30% del ancho, acotado.
      const drawnW = Math.max(240, Math.min(w * 0.3, 420))
      bodies.forEach((b, i) => {
        b.scale = drawnW / b.box.w
        b.halfW = (b.box.w * b.scale) / 2
        b.halfH = (b.box.h * b.scale) / 2
        if (b.cx === undefined) {
          b.cx = w * (i === 0 ? 0.32 : 0.7)
          b.cy = h * (i === 0 ? 0.4 : 0.62)
        }
        // Mantener dentro de la pantalla tras un resize.
        b.cx = Math.max(b.halfW + 24, Math.min(w - b.halfW - 24, b.cx))
        b.cy = Math.max(b.halfH + 24, Math.min(h - b.halfH - 24, b.cy))
      })
    }
    resize()

    const drawBody = (b) => {
      // Desplazamiento + rebote en los bordes.
      if (!reduce) {
        b.cx += b.cvx
        b.cy += b.cvy
        const pad = 24
        if (b.cx - b.halfW < pad)     { b.cx = b.halfW + pad; b.cvx = Math.abs(b.cvx) }
        if (b.cx + b.halfW > w - pad) { b.cx = w - b.halfW - pad; b.cvx = -Math.abs(b.cvx) }
        if (b.cy - b.halfH < pad)     { b.cy = b.halfH + pad; b.cvy = Math.abs(b.cvy) }
        if (b.cy + b.halfH > h - pad) { b.cy = h - b.halfH - pad; b.cvy = -Math.abs(b.cvy) }
      }

      const pts = b.def.stars.map(
        ([px, py]) => [b.cx + (px - b.box.cx) * b.scale, b.cy + (py - b.box.cy) * b.scale]
      )

      ctx.strokeStyle = `rgba(${JADE},0.6)`
      ctx.lineWidth = 1.2
      ctx.lineCap = 'round'
      b.def.edges.forEach(([i, j]) => {
        ctx.beginPath()
        ctx.moveTo(pts[i][0], pts[i][1])
        ctx.lineTo(pts[j][0], pts[j][1])
        ctx.stroke()
      })

      pts.forEach((p, i) => {
        const twinkle = reduce ? 0.9 : 0.68 + 0.32 * Math.sin(t + i * 0.7 + b.seed)
        const amber = b.def.amber.has(i)
        const base = amber ? AMBER : JADE
        const r = (amber ? 2.5 : 1.9) + (reduce ? 0 : Math.sin(t + i) * 0.3)
        ctx.shadowColor = `rgba(${base},0.9)`
        ctx.shadowBlur = amber ? 12 : 8
        ctx.fillStyle = `rgba(${base},${twinkle})`
        ctx.beginPath()
        ctx.arc(p[0], p[1], r, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.shadowBlur = 0
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      // Campo de estrellas: tamaño, color e intensidad variados por estrella.
      stars.forEach((s) => {
        const a = reduce
          ? Math.min(1, s.base + s.amp * 0.5)
          : Math.max(0, Math.min(1, s.base + s.amp * Math.sin(t * s.sp + s.ph)))
        ctx.fillStyle = `rgba(${s.col},${a})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      })

      bodies.forEach(drawBody)

      if (!reduce) {
        t += 0.03
        raf = requestAnimationFrame(draw)
      }
    }
    draw()

    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <>
      <style>{CSS}</style>
      <canvas ref={canvasRef} className="ds-constellation" aria-hidden="true" />
    </>
  )
}
