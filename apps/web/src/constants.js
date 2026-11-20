/**
 * Destello — Constantes globales del frontend
 */

/**
 * Número de WhatsApp de soporte/ventas (bot Faro), en formato internacional
 * para wa.me: 52 (México) + 10 dígitos, sin + ni espacios. Sin el 52, wa.me lo
 * leía como número de Brasil (+55) — corregido el 19 nov 2026.
 */
export const WA_NUMBER = '525577888800'

/** URL completa de WhatsApp con mensaje de bienvenida */
export const WA_CHISPA_URL = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Hola! quiero mi Chispa de acceso a Destello 🌟')}`

/** URL de WhatsApp para inscribirse / entrar a la lista de espera */
export const WA_INSCRIBIRME_URL = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Hola ✦ Quiero inscribirme a un taller de Destello y conocer la disponibilidad')}`

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

/** /notifs lo dispara al marcar todo como leído → la campanita del menú se apaga. */
export const EVENTO_NOTIFS_LEIDAS = 'destello:notificaciones-leidas'