/**
 * Hábitat (T-49) — objetos que aparecen en la islita al completar un taller.
 *
 * Cada objeto es un dibujo SVG con la base en (0, 0): crece hacia arriba
 * (y negativa) y mide ~80 px de ancho. La escena lo coloca y lo escala.
 *
 * Cuál le toca a cada taller lo decide `objetoDeTaller()` por palabras del
 * nombre (y la categoría como respaldo). Para un taller nuevo basta agregar
 * una regla en REGLAS; si no coincide con nada, sale el cristal ✦.
 * Los dibujos son provisionales: se pueden cambiar por ilustraciones de
 * Paola sin tocar la escena (mismo origen y tamaño).
 */

const Sombra = ({ w = 34 }) => <ellipse cx="0" cy="0" rx={w} ry="5" fill="#000" opacity=".14" />

function Piedras() {
  return (
    <g>
      <Sombra w={36} />
      <ellipse cx="0" cy="-10" rx="34" ry="12" fill="#4b5563" />
      <ellipse cx="-4" cy="-13" rx="26" ry="5" fill="#6b7280" opacity=".6" />
      <ellipse cx="2" cy="-30" rx="25" ry="10" fill="#374151" />
      <ellipse cx="-2" cy="-33" rx="18" ry="4" fill="#4b5563" opacity=".7" />
      <ellipse cx="-1" cy="-47" rx="16" ry="8" fill="#1f2937" />
      <ellipse cx="-4" cy="-49" rx="9" ry="2.5" fill="#6b7280" opacity=".6" />
      {/* vapor: son piedras calientes */}
      <path d="M-8 -60 q-5 -8 0 -14 q5 -6 0 -13" stroke="#fff" strokeWidth="2.5" fill="none" opacity=".7" strokeLinecap="round" />
      <path d="M6 -62 q-5 -8 0 -14 q5 -6 0 -12" stroke="#fff" strokeWidth="2.5" fill="none" opacity=".5" strokeLinecap="round" />
    </g>
  )
}

function Bonsai() {
  return (
    <g>
      <Sombra w={30} />
      <path d="M-26 -18 h52 l-6 18 h-40 z" fill="#b45309" />
      <rect x="-28" y="-22" width="56" height="6" rx="2" fill="#d97706" />
      <path d="M0 -22 C2 -34 -10 -40 -6 -52 M-4 -44 C6 -48 14 -50 18 -58" stroke="#78350f" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="-14" cy="-60" r="15" fill="#0f766e" />
      <circle cx="4" cy="-68" r="16" fill="#0d9488" />
      <circle cx="22" cy="-60" r="12" fill="#0f766e" />
      <circle cx="-2" cy="-56" r="10" fill="#14b8a6" opacity=".7" />
    </g>
  )
}

function Huella() {
  return (
    <g>
      <Sombra w={30} />
      <ellipse cx="0" cy="-6" rx="30" ry="7" fill="#a8a29e" />
      {/* planta del pie en piedra */}
      <path d="M-6 -12 C-20 -14 -18 -46 -4 -56 C8 -64 18 -50 12 -36 C8 -26 12 -14 -6 -12 Z" fill="#e7e5e4" stroke="#78716c" strokeWidth="2" />
      {[[-12, -64, 6], [-1, -70, 5], [9, -69, 4.5], [17, -64, 4], [22, -56, 3.5]].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#e7e5e4" stroke="#78716c" strokeWidth="2" />
      ))}
      <circle cx="0" cy="-36" r="4" fill="#f59e0b" opacity=".8" />
    </g>
  )
}

function Loto() {
  return (
    <g>
      <ellipse cx="0" cy="-4" rx="38" ry="9" fill="#5eead4" opacity=".55" />
      <ellipse cx="0" cy="-5" rx="30" ry="6" fill="#16a34a" />
      {[-40, -20, 0, 20, 40].map((a, i) => (
        <ellipse key={i} cx="0" cy="-26" rx="9" ry="22" fill={i % 2 ? '#f9a8d4' : '#f472b6'}
          transform={`rotate(${a} 0 -8)`} />
      ))}
      <circle cx="0" cy="-18" r="6" fill="#fbbf24" />
    </g>
  )
}

function Robot() {
  return (
    <g>
      <Sombra w={26} />
      <rect x="-18" y="-34" width="36" height="32" rx="8" fill="#94a3b8" />
      <rect x="-10" y="-26" width="20" height="12" rx="3" fill="#0f766e" />
      <circle cx="0" cy="-20" r="3" fill="#5eead4" />
      <rect x="-22" y="-70" width="44" height="34" rx="10" fill="#cbd5e1" />
      <circle cx="-9" cy="-54" r="6" fill="#0f172a" />
      <circle cx="9" cy="-54" r="6" fill="#0f172a" />
      <circle cx="-7" cy="-56" r="2" fill="#fff" />
      <circle cx="11" cy="-56" r="2" fill="#fff" />
      <path d="M-6 -44 q6 4 12 0" stroke="#0f172a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <line x1="0" y1="-70" x2="0" y2="-82" stroke="#64748b" strokeWidth="3" />
      <circle cx="0" cy="-85" r="5" fill="#d97706" />
    </g>
  )
}

function Paleta() {
  return (
    <g>
      <Sombra w={28} />
      {/* caballete */}
      <path d="M-20 0 L-6 -78 M20 0 L6 -78 M0 -78 L0 0" stroke="#92400e" strokeWidth="4" strokeLinecap="round" />
      <rect x="-26" y="-74" width="52" height="40" rx="3" fill="#faf7f2" stroke="#92400e" strokeWidth="3" />
      <path d="M-20 -42 C-8 -62 4 -48 20 -66" stroke="#0d9488" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="-10" cy="-62" r="6" fill="#f59e0b" />
      <circle cx="12" cy="-48" r="5" fill="#ec4899" />
    </g>
  )
}

function Globito() {
  return (
    <g>
      <Sombra w={18} />
      <line x1="0" y1="0" x2="0" y2="-26" stroke="#78716c" strokeWidth="3" />
      <path d="M-30 -84 h60 a10 10 0 0 1 10 10 v24 a10 10 0 0 1 -10 10 h-24 l-10 12 l-2 -12 h-24 a10 10 0 0 1 -10 -10 v-24 a10 10 0 0 1 10 -10 z"
        fill="#ccfbf1" stroke="#0d9488" strokeWidth="3" />
      <circle cx="-14" cy="-62" r="4.5" fill="#0d9488" />
      <circle cx="0" cy="-62" r="4.5" fill="#0d9488" />
      <circle cx="14" cy="-62" r="4.5" fill="#0d9488" />
    </g>
  )
}

function Reloj() {
  return (
    <g>
      <Sombra w={24} />
      <rect x="-24" y="-8" width="48" height="8" rx="3" fill="#92400e" />
      <rect x="-24" y="-82" width="48" height="8" rx="3" fill="#92400e" />
      <line x1="-20" y1="-74" x2="-20" y2="-8" stroke="#b45309" strokeWidth="3" />
      <line x1="20" y1="-74" x2="20" y2="-8" stroke="#b45309" strokeWidth="3" />
      <path d="M-15 -74 h30 c0 18 -12 22 -12 33 c0 11 12 15 12 33 h-30 c0 -18 12 -22 12 -33 c0 -11 -12 -15 -12 -33 z"
        fill="#e0f2fe" opacity=".85" stroke="#7dd3fc" strokeWidth="2" />
      <path d="M-11 -66 h22 c-2 9 -8 13 -11 18 c-3 -5 -9 -9 -11 -18 z" fill="#f59e0b" />
      <path d="M-12 -8 c2 -10 8 -14 12 -16 c4 2 10 6 12 16 z" fill="#f59e0b" />
    </g>
  )
}

function Hamaca() {
  return (
    <g>
      <Sombra w={40} />
      <line x1="-36" y1="0" x2="-36" y2="-60" stroke="#78350f" strokeWidth="5" strokeLinecap="round" />
      <line x1="36" y1="0" x2="36" y2="-60" stroke="#78350f" strokeWidth="5" strokeLinecap="round" />
      <path d="M-36 -52 Q0 -14 36 -52" stroke="#d97706" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M-36 -52 Q0 -22 36 -52" stroke="#fbbf24" strokeWidth="3" fill="none" />
      {/* robotito echado */}
      <rect x="-12" y="-46" width="22" height="16" rx="5" fill="#cbd5e1" />
      <path d="M-6 -39 h4 M3 -39 h4" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
      <text x="16" y="-56" fontSize="12" fill="#64748b" fontFamily="sans-serif">z z</text>
    </g>
  )
}

function Gomitas() {
  return (
    <g>
      <Sombra w={24} />
      <rect x="-22" y="-62" width="44" height="60" rx="10" fill="#e0f2fe" opacity=".75" stroke="#93c5fd" strokeWidth="2" />
      <rect x="-24" y="-70" width="48" height="10" rx="4" fill="#d97706" />
      {[[-11, -14, '#ef4444'], [3, -12, '#22c55e'], [13, -20, '#f59e0b'], [-6, -27, '#a855f7'], [9, -33, '#ec4899'], [-12, -40, '#22c55e'], [4, -46, '#ef4444']].map(([x, y, c], i) => (
        <rect key={i} x={x - 5} y={y - 5} width="10" height="10" rx="4" fill={c} />
      ))}
    </g>
  )
}

function Espejo() {
  return (
    <g>
      <Sombra w={22} />
      <rect x="-4" y="-34" width="8" height="34" rx="3" fill="#db2777" />
      <circle cx="0" cy="-58" r="24" fill="#fbcfe8" />
      <circle cx="0" cy="-58" r="18" fill="#e0f2fe" />
      <path d="M-9 -66 l8 -6" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path d="M14 -40 l6 6" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
    </g>
  )
}

function Ojo() {
  return (
    <g>
      <Sombra w={24} />
      <path d="M-18 0 h36 l-6 -14 h-24 z" fill="#0f766e" />
      <circle cx="0" cy="-42" r="28" fill="#ccfbf1" opacity=".9" stroke="#5eead4" strokeWidth="2" />
      <circle cx="0" cy="-42" r="13" fill="#0d9488" />
      <circle cx="0" cy="-42" r="6" fill="#042f2e" />
      <circle cx="-8" cy="-52" r="4" fill="#fff" opacity=".9" />
    </g>
  )
}

function Cristal() {
  return (
    <g>
      <Sombra w={22} />
      <path d="M-16 0 h32 l-4 -12 h-24 z" fill="#78716c" />
      <path d="M0 -76 L14 -46 L0 -14 L-14 -46 Z" fill="#fbbf24" />
      <path d="M0 -76 L14 -46 L0 -46 Z" fill="#fde68a" />
      <path d="M0 -14 L-14 -46 L0 -46 Z" fill="#d97706" />
    </g>
  )
}

/** Catálogo de objetos. */
export const OBJETOS = {
  piedras:   { nombre: 'Piedras zen',          Dibujo: Piedras },
  bonsai:    { nombre: 'Bonsái',               Dibujo: Bonsai },
  huella:    { nombre: 'Huella de piedra',     Dibujo: Huella },
  loto:      { nombre: 'Estanque con loto',    Dibujo: Loto },
  robot:     { nombre: 'Robotito asistente',   Dibujo: Robot },
  hamaca:    { nombre: 'Hamaca del robotito',  Dibujo: Hamaca },
  paleta:    { nombre: 'Caballete',            Dibujo: Paleta },
  globito:   { nombre: 'Globo de conversación', Dibujo: Globito },
  reloj:     { nombre: 'Reloj de arena',       Dibujo: Reloj },
  gomitas:   { nombre: 'Frasco de gomitas',    Dibujo: Gomitas },
  espejo:    { nombre: 'Espejo de tocador',    Dibujo: Espejo },
  ojo:       { nombre: 'Esfera del iris',      Dibujo: Ojo },
  cristal:   { nombre: 'Cristal Destello',     Dibujo: Cristal },
}

/**
 * Reglas en orden: gana la primera que coincide con el nombre del taller.
 * El orden importa ("Recupera tu Tiempo con IA" es reloj, no robot).
 */
const REGLAS = [
  [/piedra/i, 'piedras'],
  [/auriculo/i, 'bonsai'],
  [/reflexolog|podal/i, 'huella'],
  [/iridolog|iris/i, 'ojo'],
  [/masaje|relaj|electroest/i, 'loto'],
  [/tiempo/i, 'reloj'],
  [/canva|diseñ|dibuj|arte|pintur/i, 'paleta'],
  [/hablar|convers/i, 'globito'],
  [/perezos/i, 'hamaca'],
  [/gomita/i, 'gomitas'],
  [/maquill/i, 'espejo'],
  [/\bIA\b|inteligencia artificial/, 'robot'],
]

const POR_CATEGORIA = [
  [/bienestar|zen|salud/i, 'loto'],
  [/arte|creativ/i, 'paleta'],
  [/cocina|gastronom/i, 'gomitas'],
]

/** @param {{ nombre?: string, categoria?: string }} taller */
export function objetoDeTaller(taller = {}) {
  const nombre = String(taller.nombre ?? '')
  for (const [re, id] of REGLAS) if (re.test(nombre)) return id
  const cat = String(taller.categoria ?? '')
  for (const [re, id] of POR_CATEGORIA) if (re.test(cat)) return id
  return 'cristal'
}
