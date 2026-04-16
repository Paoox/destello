/**
 * Destello API — Health Check Route
 * GET /health → confirma que la API está viva (Cloudflare tunnel la verifica)
 */
import { Router } from 'express'
const router = Router()

router.get('/', (_req, res) => {
  res.json({
    status:  'ok',
    service: 'destello-api',
    version: process.env.npm_package_version || '1.0.0',
    env:     process.env.NODE_ENV || 'development',
    uptime:  Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  })
})

export default router
