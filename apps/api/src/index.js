/**
 * Destello API — Entry Point
 */
import 'dotenv/config'
import express from 'express'
import cors    from 'cors'
import helmet  from 'helmet'
import { pool } from './db.js'

import authRouter    from './routes/auth.js'
import usersRouter   from './routes/users.js'
import tallersRouter from './routes/tallers.js'
import healthRouter  from './routes/health.js'
import chispasRouter from './routes/chispas.js'
import adminRouter   from './routes/admin.js'
import botRouter     from './routes/bot.js'

import { errorHandler }  from './middleware/errorHandler.js'
import { requestLogger } from './middleware/requestLogger.js'
import { authenticate }  from './middleware/authenticate.js'

const app  = express()
const PORT = process.env.PORT || 3001

app.use(helmet())
app.use(cors({
  origin: [
    process.env.WEB_URL || 'http://localhost:5173',
    'https://destello-web.vercel.app',
  ],
  credentials: true,
}))
app.use(express.json())
app.use(requestLogger)

// ── Rutas públicas ────────────────────────────────────────
app.use('/health',  healthRouter)
app.use('/auth',    authRouter)
app.use('/tallers', tallersRouter)   // público — bot y landing lo consumen
app.use('/bot',     botRouter)       // público — registro desde WhatsApp
app.use('/chispas', chispasRouter)

// ── Rutas protegidas ──────────────────────────────────────
app.use('/users',   authenticate, usersRouter)
app.use('/admin',   adminRouter)

app.use(errorHandler)

// ── Arrancar verificando la BD ────────────────────────────
async function start() {
  try {
    await pool.query('SELECT 1')
    console.log('✅ PostgreSQL conectado')
  } catch (err) {
    console.error('❌ No se pudo conectar a PostgreSQL:', err.message)
    process.exit(1)
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✦ Destello API corriendo en http://0.0.0.0:${PORT}`)
    console.log(`  Entorno: ${process.env.NODE_ENV || 'development'}`)
  })
}

start()
export default app