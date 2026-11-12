/**
 * Destello — Utilidades compartidas por las actividades del aula
 *
 * Solo cosas que de verdad repiten varias actividades. Nada de aquí sabe de
 * un juego en particular.
 */
import { useEffect, useState } from 'react'

/**
 * El alto del hueco que el aula le dio a la actividad (el pizarrón).
 *
 * Las actividades que tienen que verse completas sin scroll de página (el
 * caso con su modelo 3D, la trivia, la sopa, el crucigrama) se ponen ese alto
 * y hacen scroll POR DENTRO si algo no cabe. Sin medirlo, `height: 100%` no
 * siempre resuelve dentro del pizarrón (es un flex con alto calculado).
 *
 * @param {React.RefObject<HTMLElement>} raiz  el elemento raíz de la actividad
 * @param {number} minimo  alto mínimo, para pantallas muy bajitas
 */
export function useAltoDelPizarron(raiz, minimo = 380) {
    const [alto, setAlto] = useState(null)
    useEffect(() => {
        const padre = raiz.current?.parentElement
        if (!padre) return
        const medir = () => setAlto(Math.max(minimo, padre.clientHeight))
        medir()
        const ro = new ResizeObserver(medir)
        ro.observe(padre)
        return () => ro.disconnect()
    }, [raiz, minimo])
    return alto
}

/** Copia barajada (Fisher–Yates). No toca la lista original. */
export function barajar(lista) {
    const a = [...lista]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

/**
 * Normaliza una palabra para comparar en sopas y crucigramas: mayúsculas y
 * sin acentos, pero conservando la Ñ (en español es otra letra, no una N).
 */
export function normalizarPalabra(texto) {
    return String(texto ?? '')
        .toUpperCase()
        .replace(/Ñ/g, '\u0001')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\u0001/g, 'Ñ')
        .replace(/[^A-ZÑ]/g, '')
}

/**
 * Ancho y alto de un elemento, al vuelo. Para que los tableros (sopa,
 * crucigrama) calculen el tamaño de su casilla según el hueco que les toca.
 */
export function useTamano(ref) {
    const [tam, setTam] = useState({ w: 0, h: 0 })
    useEffect(() => {
        const el = ref.current
        if (!el) return
        const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight })
        medir()
        const ro = new ResizeObserver(medir)
        ro.observe(el)
        return () => ro.disconnect()
    }, [ref])
    return tam
}

/** Colores vivos para marcar lo que ya se resolvió (palabras, renglones). */
export const COLORES_VIVOS = ['#ec4899', '#10b981', '#8b5cf6', '#f97316', '#06b6d4', '#f43f5e', '#eab308', '#3b82f6', '#14b8a6', '#c026d3']
