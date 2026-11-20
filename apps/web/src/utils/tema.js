/**
 * Destello — Tema claro / oscuro (Ajustes, T-45, 19 nov 2026)
 *
 * Tres opciones: 'sistema' (default, sigue al teléfono/compu), 'claro', 'oscuro'.
 * Se guarda en el navegador (localStorage) — es una preferencia de este
 * aparato, no de la cuenta.
 *
 * Cómo se aplica: `<html data-theme="light|dark">`. Sin atributo = sistema.
 * Las hojas de estilo escriben el modo claro así (ver tokens.css):
 *
 *     @media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) … }
 *     :root[data-theme="light"] …
 *
 * ⚠️ PageLanding.jsx (congelada) sigue leyendo solo el sistema.
 */
const CLAVE = 'destello_tema'
export const OPCIONES_TEMA = ['sistema', 'claro', 'oscuro']

export function leerTema() {
  try {
    const t = localStorage.getItem(CLAVE)
    return OPCIONES_TEMA.includes(t) ? t : 'sistema'
  } catch { return 'sistema' }
}

/** Pone el atributo en <html>. Llamar al arrancar (main.jsx) y al cambiar. */
export function aplicarTema(tema = leerTema()) {
  const raiz = document.documentElement
  if (tema === 'claro') raiz.dataset.theme = 'light'
  else if (tema === 'oscuro') raiz.dataset.theme = 'dark'
  else delete raiz.dataset.theme
}

export function guardarTema(tema) {
  try { localStorage.setItem(CLAVE, tema) } catch { /* sin storage: solo esta visita */ }
  aplicarTema(tema)
}

/** ¿Se está viendo en oscuro ahora mismo? (para elegir imágenes, como el logo) */
export function esOscuro() {
  const t = leerTema()
  if (t === 'oscuro') return true
  if (t === 'claro') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
