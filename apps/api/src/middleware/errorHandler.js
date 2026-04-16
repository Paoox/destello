/**
 * Destello API — Error Handler Middleware
 * Centraliza todos los errores. Evita repetir try/catch en cada controller.
 * Uso: en controllers, throw new AppError(mensaje, statusCode)
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message)
    this.statusCode = statusCode
    this.code       = code
    this.isOperational = true
  }
}

export function errorHandler(err, _req, res, _next) {
  const isDev = process.env.NODE_ENV === 'development'

  // Errores operacionales (lanzados con AppError)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status:  'error',
      code:    err.code,
      message: err.message,
    })
  }

  // Errores inesperados (bugs)
  console.error('ERROR NO CONTROLADO:', err)

  res.status(500).json({
    status:  'error',
    code:    'INTERNAL_ERROR',
    message: isDev ? err.message : 'Error interno del servidor',
    ...(isDev && { stack: err.stack }),
  })
}
