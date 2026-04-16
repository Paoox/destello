/**
 * Destello API — Request Logger Middleware
 * Log liviano de cada request. Solo activo en development.
 */
export function requestLogger(req, res, next) {
  if (process.env.NODE_ENV === 'production') return next()

  const start = Date.now()
  res.on('finish', () => {
    const ms     = Date.now() - start
    const status = res.statusCode
    const color  = status >= 500 ? '\x1b[31m'  // rojo
                 : status >= 400 ? '\x1b[33m'  // amarillo
                 : status >= 200 ? '\x1b[32m'  // verde
                 : '\x1b[0m'
    console.log(`${color}${req.method}\x1b[0m ${req.path} → ${status} (${ms}ms)`)
  })
  next()
}
