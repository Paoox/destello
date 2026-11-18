/**
 * Destello — El aula: fondo virtual de la cámara (T-47)
 *
 * Un procesador de LiveKit propio (`TrackProcessor`): recibe la pista de la
 * cámara, separa a la persona del fondo con MediaPipe EN EL NAVEGADOR, le
 * pinta el fondo de la marca (o su cuarto desenfocado) y publica ESO. Lo que
 * hay atrás nunca sale de la compu de la profe.
 *
 * ── Por qué no usamos `@livekit/track-processors` ────────────────────────
 *
 * Se probó primero (18 nov 2026) y Paola vio manchas: bloques enteros del
 * cuarto que se asomaban a través de la persona. Esa librería usa una
 * máscara de "todo o nada" (persona sí/no, sin término medio) calculada
 * cuadro por cuadro sin memoria — donde el modelo duda, el pixel brinca de
 * persona a fondo y se abre un hoyo. Lo que hacen Meet/Zoom, y lo que se
 * hace aquí:
 *
 *   1. Máscara de CONFIANZA (0 a 1), no de categoría.
 *   2. Modelo multiclase (pelo, cara, piel, ropa por separado): recorta mejor
 *      el pelo y la ropa que el modelo básico de "selfie". Pesa ~16 MB, se
 *      baja una vez y el navegador lo guarda. Si no carga, se usa el básico.
 *   3. Memoria entre cuadros: una zona no cambia de golpe porque el modelo
 *      dudó en UN cuadro — solo si la duda se sostiene (o si de verdad hubo
 *      movimiento grande, que se sigue rápido para no dejar "fantasma").
 *   4. Relleno de huecos: un desenfoque chico de la máscara ANTES del corte
 *      cierra los agujeros pequeños dentro de la persona.
 *   5. Borde suave: la máscara se escala con suavizado y un poco de blur.
 *
 * La segmentación corre sobre una copia chica del cuadro (384×216): el modelo
 * trabaja en 256 px de todos modos, y así el trabajo en JS por cuadro es poco.
 */
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'

// ⚠️ Debe coincidir EXACTO con la versión instalada (package.json la fija).
const VERSION_MEDIAPIPE = '0.10.17'
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION_MEDIAPIPE}/wasm`
const MODELOS = [
    // Multiclase: 0 = fondo, 1 pelo, 2 piel, 3 cara, 4 ropa, 5 accesorios.
    { url: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite', multiclase: true },
    // Básico, de respaldo (250 KB).
    { url: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite', multiclase: false },
]

const FPS = 30
const SEG_ANCHO = 384
const SEG_ALTO = 216

// ── El segmentador se crea UNA vez por página y se comparte ─────────────
let segmentadorPromesa = null
function obtenerSegmentador() {
    if (!segmentadorPromesa) {
        segmentadorPromesa = (async () => {
            const archivos = await FilesetResolver.forVisionTasks(WASM)
            let ultimoError
            for (const modelo of MODELOS) {
                for (const delegate of ['GPU', 'CPU']) {
                    try {
                        const seg = await ImageSegmenter.createFromOptions(archivos, {
                            baseOptions: { modelAssetPath: modelo.url, delegate },
                            runningMode: 'VIDEO',
                            outputConfidenceMasks: true,
                            outputCategoryMask: false,
                        })
                        return { seg, multiclase: modelo.multiclase }
                    } catch (err) { ultimoError = err }
                }
            }
            throw ultimoError ?? new Error('No se pudo cargar el segmentador')
        })()
        // Si falla, que el siguiente intento vuelva a probar (ej. volvió la red).
        segmentadorPromesa.catch(() => { segmentadorPromesa = null })
    }
    return segmentadorPromesa
}

/** Carga una imagen y espera a que esté lista para dibujarse. */
function cargarImagen(src) {
    return new Promise((ok, mal) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => ok(img)
        img.onerror = () => mal(new Error(`No cargó el fondo: ${src}`))
        img.src = src
    })
}

const lienzo = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h })

/** Desenfoque de caja (horizontal + vertical) sobre la máscara chica. */
function desenfocarCaja(src, tmp, w, h, r) {
    const n = 2 * r + 1
    for (let y = 0; y < h; y++) {
        let suma = 0
        const fila = y * w
        for (let x = -r; x <= r; x++) suma += src[fila + Math.min(w - 1, Math.max(0, x))]
        for (let x = 0; x < w; x++) {
            tmp[fila + x] = suma / n
            suma += src[fila + Math.min(w - 1, x + r + 1)] - src[fila + Math.max(0, x - r)]
        }
    }
    for (let x = 0; x < w; x++) {
        let suma = 0
        for (let y = -r; y <= r; y++) suma += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
        for (let y = 0; y < h; y++) {
            src[y * w + x] = suma / n
            suma += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
        }
    }
}

/**
 * Crea el procesador.
 * @param {{ modo: 'marca'|'desenfoque', imagen?: string }} config
 */
export function crearFondoVirtual(config) {
    let modo = config.modo
    let imagenSrc = config.imagen ?? null
    let imagen = null

    let video, salida, ctxSalida, chico, ctxChico, mascara, ctxMascara, persona, ctxPersona, fondoChico, ctxFondoChico
    let memoria = null, tmp = null, imgData = null
    let multiclase = true, invertirBasico = null
    let timer = null, vivo = false, ultimoTs = 0

    const procesador = {
        name: 'destello-fondo',
        processedTrack: undefined,

        async init({ track }) {
            const [{ seg, multiclase: mc }, img] = await Promise.all([
                obtenerSegmentador(),
                imagenSrc ? cargarImagen(imagenSrc).catch(() => null) : null,
            ])
            multiclase = mc
            imagen = img

            video = document.createElement('video')
            video.muted = true
            video.playsInline = true
            video.srcObject = new MediaStream([track])
            await video.play()

            const ajustes = track.getSettings?.() ?? {}
            const W = ajustes.width || video.videoWidth || 1280
            const H = ajustes.height || video.videoHeight || 720

            salida = lienzo(W, H);     ctxSalida = salida.getContext('2d')
            persona = lienzo(W, H);    ctxPersona = persona.getContext('2d')
            chico = lienzo(SEG_ANCHO, SEG_ALTO); ctxChico = chico.getContext('2d', { willReadFrequently: false })
            mascara = lienzo(SEG_ANCHO, SEG_ALTO); ctxMascara = mascara.getContext('2d')
            fondoChico = lienzo(Math.round(W / 10), Math.round(H / 10)); ctxFondoChico = fondoChico.getContext('2d')
            imgData = ctxMascara.createImageData(SEG_ANCHO, SEG_ALTO)
            memoria = null
            tmp = new Float32Array(SEG_ANCHO * SEG_ALTO)

            procesador.processedTrack = salida.captureStream(FPS).getVideoTracks()[0]
            vivo = true

            const cuadro = () => {
                if (!vivo) return
                const inicio = performance.now()
                try { pintar(seg, W, H) } catch (err) { console.error('[aula-fondo]', err.message) }
                // setTimeout y no requestAnimationFrame: rAF se detiene si la
                // profe cambia de pestaña, y su video se congelaría para todos.
                timer = setTimeout(cuadro, Math.max(0, 1000 / FPS - (performance.now() - inicio)))
            }
            cuadro()
        },

        async restart(opts) {
            await procesador.destroy()
            await procesador.init(opts)
        },

        async destroy() {
            vivo = false
            clearTimeout(timer)
            procesador.processedTrack?.stop()
            procesador.processedTrack = undefined
            if (video) { video.pause(); video.srcObject = null }
            // El segmentador NO se cierra: se comparte y se reusa al volver a prender.
        },

        /** Cambia entre marca y desenfoque sin reiniciar nada. */
        async cambiarModo(nuevo) {
            if (nuevo.imagen && nuevo.imagen !== imagenSrc) {
                imagenSrc = nuevo.imagen
                imagen = await cargarImagen(imagenSrc).catch(() => imagen)
            }
            modo = nuevo.modo
        },
    }

    function pintar(seg, W, H) {
        if (video.readyState < 2) return

        // 1. Segmentar una copia chica del cuadro.
        ctxChico.drawImage(video, 0, 0, SEG_ANCHO, SEG_ALTO)
        let ts = performance.now()
        if (ts <= ultimoTs) ts = ultimoTs + 1   // MediaPipe exige tiempos crecientes
        ultimoTs = ts
        const res = seg.segmentForVideo(chico, ts)
        const masks = res.confidenceMasks ?? []
        if (!masks.length) return
        const crudo = masks[0].getAsFloat32Array()
        const n = crudo.length

        // 2. Probabilidad de PERSONA por pixel.
        const p = new Float32Array(n)
        if (multiclase) {
            for (let i = 0; i < n; i++) p[i] = 1 - crudo[i]          // máscara 0 = fondo
        } else {
            // El modelo básico trae una sola máscara; su sentido se averigua
            // una vez: la persona suele estar al centro, el fondo en las esquinas.
            if (invertirBasico == null) {
                const c = crudo[(SEG_ALTO >> 1) * SEG_ANCHO + (SEG_ANCHO >> 1)]
                const esquinas = (crudo[0] + crudo[SEG_ANCHO - 1]) / 2
                invertirBasico = c < esquinas
            }
            for (let i = 0; i < n; i++) p[i] = invertirBasico ? 1 - crudo[i] : crudo[i]
        }
        masks.forEach(m => m.close())
        res.close?.()

        // 3. Memoria entre cuadros: cambio chico = probable duda del modelo
        //    → se suaviza mucho; cambio grande = movimiento real → se sigue.
        if (!memoria || memoria.length !== n) memoria = p
        else {
            for (let i = 0; i < n; i++) {
                const d = p[i] - memoria[i]
                const a = Math.abs(d) > 0.45 ? 0.75 : 0.3
                memoria[i] += d * a
            }
        }

        // 4. Rellenar huecos (desenfoque) y luego un corte suave.
        const m = Float32Array.from(memoria)
        desenfocarCaja(m, tmp, SEG_ANCHO, SEG_ALTO, 2)
        const px = imgData.data
        for (let i = 0; i < n; i++) {
            let v = (m[i] - 0.3) / 0.4                         // 0.3 → 0, 0.7 → 1
            v = v < 0 ? 0 : v > 1 ? 1 : v
            v = v * v * (3 - 2 * v)                             // smoothstep
            px[i * 4 + 3] = v * 255
        }
        ctxMascara.putImageData(imgData, 0, 0)

        // 5. La persona recortada (máscara escalada con suavizado = borde suave).
        ctxPersona.globalCompositeOperation = 'copy'
        ctxPersona.drawImage(video, 0, 0, W, H)
        ctxPersona.globalCompositeOperation = 'destination-in'
        ctxPersona.imageSmoothingEnabled = true
        ctxPersona.filter = 'blur(2px)'
        ctxPersona.drawImage(mascara, 0, 0, W, H)
        ctxPersona.filter = 'none'

        // 6. El fondo y, encima, la persona.
        if (modo === 'marca' && imagen) {
            // "cover": llena todo sin deformar el logo.
            const esc = Math.max(W / imagen.width, H / imagen.height)
            const iw = imagen.width * esc, ih = imagen.height * esc
            ctxSalida.drawImage(imagen, (W - iw) / 2, (H - ih) / 2, iw, ih)
        } else {
            // Desenfoque barato: el cuadro reducido a 1/10 y vuelto a estirar.
            ctxFondoChico.drawImage(video, 0, 0, fondoChico.width, fondoChico.height)
            ctxSalida.imageSmoothingEnabled = true
            ctxSalida.filter = 'blur(6px)'
            ctxSalida.drawImage(fondoChico, 0, 0, W, H)
            ctxSalida.filter = 'none'
        }
        ctxSalida.drawImage(persona, 0, 0)
    }

    return procesador
}

/** ¿Este navegador puede hacer fondo virtual? */
export const fondoVirtualSoportado = () =>
    typeof document !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    && typeof WebAssembly !== 'undefined'
