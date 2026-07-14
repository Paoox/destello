/**
 * Destello — Constantes globales del frontend
 */

/** Número de WhatsApp de soporte/ventas (sin +, sin espacios) */
export const WA_NUMBER = '5577888800'

/** URL completa de WhatsApp con mensaje de bienvenida */
export const WA_CHISPA_URL = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Hola! quiero mi Chispa de acceso a Destello 🌟')}`

/** URL base del sitio */
export const SITE_URL = 'https://destello.courses'

/**
 * Correos con acceso al panel de administración desde el sidebar.
 * Solo estos usuarios ven la pestaña "Admin" en su navegación.
 * (El panel además sigue protegido por su propia contraseña.)
 */
export const ADMIN_EMAILS = ['pao.arreola.g@gmail.com']

/** ¿Este correo tiene acceso admin? */
export function isAdminEmail(email) {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase().trim())
}