/**
 * Achica una imagen en el navegador antes de subirla (capturas de Soporte).
 * Una captura de celular pesa 2–5 MB; así queda en ~150–400 KB y se sigue
 * leyendo bien. Conserva la proporción (no recorta como la foto de perfil).
 *
 * @param {File} archivo
 * @param {number} lado  lado mayor máximo en px
 * @returns {Promise<string>} data URL JPEG
 */
export async function achicarImagen(archivo, lado = 1600) {
  if (!archivo?.type?.startsWith('image/')) throw new Error('Elige una imagen (JPG, PNG o WEBP)')
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise((ok, mal) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => mal(new Error('No se pudo leer esa imagen'))
      i.src = url
    })
    const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(img.naturalWidth * escala)
    canvas.height = Math.round(img.naturalHeight * escala)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'                       // PNG con transparencia → fondo blanco
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    URL.revokeObjectURL(url)
  }
}
