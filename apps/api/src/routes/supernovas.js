/**
 * Destello API — Supernovas Routes (público)
 * GET /supernovas → catálogo de premios canjeables con Estrellas.
 */
import { Router } from 'express'
import { listSupernovas } from '../services/referralService.js'

const router = Router()

router.get('/', async (_req, res, next) => {
    try {
        const supernovas = await listSupernovas()
        res.json({ status: 'ok', supernovas })
    } catch (err) {
        next(err)
    }
})

export default router
