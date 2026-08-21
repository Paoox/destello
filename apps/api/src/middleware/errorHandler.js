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

  // Violación de índice único de Postgres (23505).
  // Red de seguridad: si algún camino nuevo intenta guardar un WhatsApp repetido
  // sin pasar por asegurarWhatsappLibre(), la BD lo rechaza y aquí lo traducimos
  // a un mensaje entendible en vez de un 500 genérico.
  if (err.code === '23505') {
    const detalle    = `${err.constraint ?? ''} ${err.detail ?? ''}`.toLowerCase()
    const esWhatsapp = detalle.includes('whatsapp')
    return res.status(409).json({
      status:  'error',
      code:    esWhatsapp ? 'WA_EN_USO' : 'REGISTRO_DUPLICADO',
      message: esWhatsapp
        ? 'Ese número ya está ligado a otra cuenta. Si es tuya, entra con ese correo; ' +
          'si no, escríbenos por WhatsApp y lo resolvemos.'
        : 'Ese registro ya existe.',
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
