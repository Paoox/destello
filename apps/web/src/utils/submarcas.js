/**
 * Submarcas de Destello (Novedades → "Explora por marca", 19 nov 2026).
 *
 * La submarca de un taller es su `categoria` (se edita en el panel →
 * Talleres). Aquí va cómo se presenta cada una. Para una submarca nueva basta
 * agregarla aquí; si no está, se muestra igual con un texto genérico.
 * Textos provisionales: Paola los ajusta.
 */
export const SUBMARCAS = [
  {
    id: 'Horizonte Zen',
    lema: 'Medicina Tradicional China y bienestar',
    descripcion: 'Auriculoterapia, masajes, reflexología y técnicas de la Medicina Tradicional China para cuidar tu cuerpo y tu energía.',
    color: '#0D7377',
    simbolo: '☯',
  },
  {
    id: 'IngenIA',
    lema: 'Inteligencia artificial para tu día a día',
    descripcion: 'Aprende a usar la IA sin complicarte: ahorra tiempo, crea contenido y trabaja más inteligente.',
    color: '#7C3AED',
    simbolo: '⚡',
  },
]

/** Presentación de una categoría (conocida o no). */
export function submarcaDe(categoria) {
  const conocida = SUBMARCAS.find(m => m.id.toLowerCase() === String(categoria ?? '').toLowerCase())
  return conocida ?? {
    id: categoria || 'Otros talleres',
    lema: 'Talleres Destello',
    descripcion: '',
    color: '#D97706',
    simbolo: '✦',
  }
}

/** Submarcas que tienen talleres, con su conteo (las conocidas primero, en su orden). */
export function marcasDe(talleres = []) {
  const cuenta = {}
  for (const t of talleres) { const id = submarcaDe(t.categoria).id; cuenta[id] = (cuenta[id] ?? 0) + 1 }
  const conocidas = SUBMARCAS.filter(m => cuenta[m.id]).map(m => ({ ...m, n: cuenta[m.id] }))
  const otras = Object.keys(cuenta).filter(id => !SUBMARCAS.some(m => m.id === id)).map(id => ({ ...submarcaDe(id), n: cuenta[id] }))
  return [...conocidas, ...otras]
}
