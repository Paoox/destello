/**
 * Destello API — Tallers Controller
 * Mock data por ahora. Reemplazar con queries a DB.
 */
import { AppError } from '../middleware/errorHandler.js'

const TALLERS_MOCK = [
  { id: '1', title: 'Auriculoterapia Nivel 1', category: 'Horizonte Zen',   duracion: '8h', activo: true },
  { id: '2', title: 'Automaquillaje Artístico', category: 'Estilo Personal', duracion: '6h', activo: true },
  { id: '3', title: 'Elaboración de Gomitas',  category: 'Gastronomía',     duracion: '4h', activo: true },
  { id: '4', title: 'Dibujo Expresivo',         category: 'Arte',            duracion: '10h', activo: true },
]

export async function listTallers(_req, res) {
  res.json({ status: 'ok', tallers: TALLERS_MOCK })
}

export async function getTaller(req, res, next) {
  const taller = TALLERS_MOCK.find(t => t.id === req.params.id)
  if (!taller) return next(new AppError('Taller no encontrado', 404, 'NOT_FOUND'))
  res.json({ status: 'ok', taller })
}

export async function joinTaller(req, res, next) {
  const taller = TALLERS_MOCK.find(t => t.id === req.params.id)
  if (!taller) return next(new AppError('Taller no encontrado', 404, 'NOT_FOUND'))
  // TODO: registrar inscripción en DB
  res.json({ status: 'ok', message: `Inscrito en ${taller.title}` })
}
