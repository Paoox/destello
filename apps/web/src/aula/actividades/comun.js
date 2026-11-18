/**
 * Destello — Utilidades compartidas por las actividades del aula
 *
 * Solo cosas que de verdad repiten varias actividades. Nada de aquí sabe de
 * un juego en particular.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { marcarCambio } from './contrato.js'

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

/**
 * Cambiar el estado compartido de la actividad: `cambiar({ fase: 'juego' })`.
 *
 * TODO lo que se ve en el pizarrón (la pantalla, la pregunta en que va, las
 * cartas destapadas…) va en `estado`, no en un `useState` del componente:
 * `estado` es lo único que viaja. Así lo que hace la profe en su pizarrón lo
 * ve el grupo, y lo que hace una alumna lo ve la profe al abrir su pizarrón.
 * (Excepción a propósito: lo que es SOLO de la profe, como "Ver soluciones",
 * se queda local — si viajara, el grupo vería las respuestas.)
 *
 * Siempre parte del último estado, aunque se llame dos veces antes de que
 * React vuelva a pintar, o desde un `setTimeout` (las cartas que se tapan
 * solas): sin esto el segundo cambio borraría el primero.
 *
 * Marca `ultimoCambio`, así que cuenta como interacción para el semáforo.
 */
export function useCambiar(estado, onCambio) {
    const ultimo = useRef(estado)
    const aviso = useRef(onCambio)
    ultimo.current = estado
    aviso.current = onCambio
    return useCallback((cambios = {}) => {
        // También acepta una función del último estado, para mezclar objetos
        // anidados sin pisar lo que otro cambio acaba de poner.
        const c = typeof cambios === 'function' ? cambios(ultimo.current ?? {}) : cambios
        const nuevo = marcarCambio(ultimo.current, c)
        ultimo.current = nuevo
        aviso.current?.(nuevo)
    }, [])
}

/**
 * Segundos que faltan para una hora guardada en el estado (`Date.now()` de
 * quien la puso). Se repinta solo cada segundo mientras falte algo. Se usa
 * para cuentas regresivas que tienen que verse igual en todas las pantallas
 * (el vistazo del memorama), sin mandar un mensaje por segundo.
 */
export function useFaltan(hasta) {
    const [, repintar] = useState(0)
    const faltan = hasta ? Math.max(0, Math.ceil((hasta - Date.now()) / 1000)) : 0
    useEffect(() => {
        if (faltan <= 0) return
        const t = setTimeout(() => repintar(n => n + 1), 250)
        return () => clearTimeout(t)
    })
    return faltan
}
