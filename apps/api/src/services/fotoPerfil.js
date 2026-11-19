/**
 * Destello API — validar la foto de perfil que sube la persona en /perfil.
 *
 * El navegador la recorta a 256×256 antes de mandarla (PagePerfil.jsx), así
 * que aquí solo se acepta una imagen chica, como data URL. Nada de URLs
 * externas: las fotos de Google entran solas al iniciar sesión.
 */
export const FOTO_MAX_BYTES = 300 * 1024

/** @returns {{ foto: string|null, error?: string }} — `null` = quitar la foto */
export function validarFoto(foto) {
    if (foto === null) return { foto: null }
    const s = String(foto ?? '')
    if (!/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(s)) {
        return { foto: null, error: 'La foto debe ser una imagen (jpg, png o webp)' }
    }
    if (s.length > FOTO_MAX_BYTES) return { foto: null, error: 'La foto es muy pesada (máx. 300 KB)' }
    return { foto: s }
}
