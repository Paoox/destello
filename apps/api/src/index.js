/**
 * Destello API — Entry Point
 * Servidor Express modular. Cada dominio tiene su propio router.
 * Variables de entorno desde .env (nunca hardcodear valores sensibles).
 */
import 'dotenv/config'
import express from 'express'
import cors    from 'cors'
import helmet  from 'helmet'

// ── Importar routers (cada módulo independiente) ──────────
import authRouter    from './routes/auth.js'
import usersRouter   from './routes/users.js'
import tallersRouter from './routes/tallers.js'
import healthRouter  from './routes/health.js'
import chispasRouter from './routes/chispas.js'

// ── Importar middleware ───────────────────────────────────
import { errorHandler }   from './middleware/errorHandler.js'
import { requestLogger }  from './middleware/requestLogger.js'
import { authenticate }   from './middleware/authenticate.js'

const app  = express()
const PORT = process.env.PORT || 3001

// ── Middleware global ─────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: [
    process.env.WEB_URL || 'http://localhost:5173',
    'https://app.tudominio.com',
  ],
  credentials: true,
}))
app.use(express.json())
app.use(requestLogger)

// ── Rutas públicas ────────────────────────────────────────
app.use('/health',  healthRouter)
app.use('/auth',    authRouter)

// ── Módulo chispas (mezcla de pública + admin — el router gestiona internamente)
app.use('/chispas', chispasRouter)

// ── Rutas protegidas (requieren JWT) ─────────────────────
app.use('/users',   authenticate, usersRouter)
app.use('/tallers', authenticate, tallersRouter)

// ── Manejo de errores (siempre al final) ──────────────────
app.use(errorHandler)

// ── Arrancar ──────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✦ Destello API corriendo en http://0.0.0.0:${PORT}`)
  console.log(`  Entorno: ${process.env.NODE_ENV || 'development'}`)
})

export default app