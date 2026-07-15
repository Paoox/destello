/**
 * Destello — Constellation
 * Fondo animado global (detrás del menú y de todas las páginas autenticadas).
 *
 * Dos capas:
 *   1. Campo ambiental: estrellas jade/ámbar que derivan lento y se unen con
 *      líneas al acercarse.
 *   2. Piscis (marca personal): el asterismo real de Piscis dibujado encima,
 *      con trazo brillante, glow y parpadeo suave para que resalte.
 *
 * Respeta prefers-reduced-motion (queda estático). z-index negativo → siempre
 * detrás del contenido, que puede quedar estático sin posicionarse.
 */
import { useRef, useEffect } from 'react'

const CSS = `
.ds-constellation {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: 0.85;
}
@media (prefers-color-scheme: light) {
  .ds-constellation { opacity: 0.7; }
}
`

/* ── Piscis ──────────────────────────────────────────────────────────────
   Coordenadas locales (x→derecha, y→abajo, escala 0-100). Forma: los dos
   peces unidos por el cordón que se encuentran en el nudo (Alrescha, abajo).
   El "Circlet" (cabeza del pez occidental) es el lazo arriba-izquierda; el
   pez oriental termina en un pequeño triángulo arriba-derecha. */
const PISCES = {
  stars: [
    [58, 82], // 0  Alrescha (nudo)
    [50, 69], // 1  cordón O
    [41, 57], // 2
    [31, 46], // 3
    [23, 38], // 4  entrada al Circlet
    [15, 34], // 5  Circlet
    [10, 26], // 6
    [15, 18], // 7
    [24, 17], // 8
    [29, 26], // 9
    [24, 33], // 10 cierre Circlet
    [67, 71], // 11 cordón E
    [75, 59], // 12
    [83, 48], // 13
    [90, 39], // 14 nudo pez oriental
    [97, 32], // 15 triángulo cabeza
    [89, 30], // 16
  ],
  edges: [
    [0, 1], [1, 2], [2, 3], [3, 4],               // cordón occidental
    [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 4], // Circlet (lazo)
    [0, 11], [11, 12], [12, 13], [13, 14],         // cordón oriental
    [14, 15], [15, 16], [16, 14],                  // cabeza pez oriental
  ],
  amber: new Set([0, 8, 14, 15]), // estrellas destacadas en ámbar
}

export default function Constellation() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let w, h, dpr, raf, t = 0
    const stars = []

    const build = () => {
      // Polvo estelar tenue de fondo (solo puntos, sin telaraña de líneas):
      // da profundidad sin competir con Piscis. Densidad generosa.
      const count = Math.min(160, Math.floor((window.innerWidth * window.innerHeight) / 11000))
      stars.length = 0
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.1 + 0.4,
          ph: Math.random() * Math.PI * 2,  // fase de parpadeo
          sp: 0.6 + Math.random() * 0.9,    // velocidad de parpadeo
        })
      }
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      build()
    }
    resize()

    const JADE = '47,150,153'
    const AMBER = '217,119,6'

    // Piscis con TAMAÑO FIJO (acotado) y centrado en el viewport, para que se
    // vea igual en claro/oscuro y sin importar el scroll. Un leve flotar (bob)
    // la mantiene viva.
    const piscesLayout = () => {
      const midX = 53.5, midY = 49.5 // centro del bounding box local (10-97, 17-82)
      // Ancho objetivo acotado: ni diminuta ni gigante.
      const size = Math.max(420, Math.min(760, Math.min(w, h) * 0.72))
      const scale = size / 87 // 87 = ancho local (xmax-xmin)
      const bobX = reduce ? 0 : Math.sin(t * 0.25) * 6
      const bobY = reduce ? 0 : Math.cos(t * 0.2) * 5
      const cx = w / 2 + bobX
      const cy = h / 2 + bobY
      return PISCES.stars.map(([px, py]) => [cx + (px - midX) * scale, cy + (py - midY) * scale])
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      // ── Capa 1: polvo estelar tenue (solo puntos, con parpadeo) ──
      stars.forEach((s, i) => {
        const tw = reduce ? 0.4 : 0.24 + 0.28 * Math.sin(t * s.sp + s.ph)
        ctx.fillStyle = i % 7 === 0 ? `rgba(${AMBER},${tw})` : `rgba(${JADE},${tw})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      })

      // ── Capa 2: Piscis (marca, protagonista) ──
      const pts = piscesLayout()

      // Cordones y trazos
      ctx.strokeStyle = `rgba(${JADE},0.62)`
      ctx.lineWidth = 1.2
      ctx.lineCap = 'round'
      PISCES.edges.forEach(([i, j]) => {
        ctx.beginPath()
        ctx.moveTo(pts[i][0], pts[i][1])
        ctx.lineTo(pts[j][0], pts[j][1])
        ctx.stroke()
      })

      // Estrellas con glow + parpadeo suave
      pts.forEach((p, i) => {
        const twinkle = reduce ? 0.9 : 0.68 + 0.32 * Math.sin(t + i * 0.7)
        const amber = PISCES.amber.has(i)
        const base = amber ? AMBER : JADE
        const r = (amber ? 2.6 : 2.0) + (reduce ? 0 : Math.sin(t + i) * 0.3)
        ctx.shadowColor = `rgba(${base},0.9)`
        ctx.shadowBlur = amber ? 12 : 8
        ctx.fillStyle = `rgba(${base},${twinkle})`
        ctx.beginPath()
        ctx.arc(p[0], p[1], r, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.shadowBlur = 0

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
