/**
 * Destello API — Entry Point
 */
import 'dotenv/config'
import express from 'express'
import cors    from 'cors'
import helmet  from 'helmet'
import { pool } from './db/db.js'

import authRouter    from './routes/auth.js'
import usersRouter   from './routes/users.js'
import tallersRouter from './routes/tallers.js'
import healthRouter  from './routes/health.js'
import chispasRouter from './routes/chispas.js'
import adminRouter   from './routes/admin.js'
import botRouter     from './routes/bot.js'
import supernovasRouter from './routes/supernovas.js'
import certificadosRouter from './routes/certificados.js'

import { errorHandler }  from './middleware/errorHandler.js'
import { requestLogger } from './middleware/requestLogger.js'
import { authenticate }  from './middleware/authenticate.js'
import { enviarRecordatoriosAutomaticos } from './services/recordatorioAutoService.js'

const app  = express()
const PORT = process.env.PORT || 3001

// Recordatorio automático de pago (T-36) — cada cuánto se revisa quién ya
// venció su plazo de 48 h sin recordatorio. En memoria, sin librería externa
// (mismo criterio que otpService/rateLimit): el contenedor de Docker corre
// un solo proceso permanente (systemd lo mantiene arriba), así que un
// setInterval de toda la vida del proceso es suficiente — no hace falta cron
// del sistema operativo.
const INTERVALO_RECORDATORIOS_MS = 30 * 60 * 1000

app.use(helmet())
app.use(cors({
  origin: [
    process.env.WEB_URL || 'http://localhost:5173',
    'https://destello-web.vercel.app',
    'https://destello.courses',
  ],
  credentials: true,
}))
// 12 MB: los comprobantes de pago viajan en base64 dentro del JSON que manda el
// bot, y base64 infla ~33%. Con el default de 100 KB toda foto era rechazada con
// un 413 silencioso. El tope real de la imagen lo pone storageService (8 MB).
app.use(express.json({ limit: '12mb' }))
app.use(requestLogger)

// Rutas públicas
app.use('/health',  healthRouter)
app.use('/auth',    authRouter)
app.use('/tallers', tallersRouter)
app.use('/chispas', chispasRouter)
app.use('/bot',     botRouter)
app.use('/supernovas', supernovasRouter)
// Pública a propósito: verificar un certificado no debe exigir cuenta.
app.use('/certificados', certificadosRouter)

// Rutas protegidas
app.use('/users',  authenticate, usersRouter)
app.use('/admin',  adminRouter)

app.use(errorHandler)

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

  // Primera corrida a los 2 min (deja que el bot Faro también esté arriba —
  // systemd levanta destello-api y destello-bot por separado, sin orden
  // garantizado), y de ahí en adelante cada INTERVALO_RECORDATORIOS_MS.
  setTimeout(() => {
    const correr = () => {
      enviarRecordatoriosAutomaticos().catch(err =>
        console.error('[recordatorio-auto] error en la corrida:', err.message))
    }
    correr()
    setInterval(correr, INTERVALO_RECORDATORIOS_MS)
  }, 2 * 60 * 1000)
}

start()
export default app