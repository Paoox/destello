/**
 * Destello — Visor 3D del aula
 *
 * Una pieza reutilizable: muestra un modelo .glb que se puede girar y acercar,
 * y le pone encima puntos (semillas, balines, marcas) y un aro de "aquí va".
 * No sabe de auriculoterapia ni de casos clínicos: quien lo usa le dice qué
 * modelo y qué puntos. Hoy lo usa la actividad `caso`; mañana lo puede usar
 * una actividad de "marca los puntos libremente" o el modelo de la profe.
 *
 * ── Cómo se ubican los puntos ────────────────────────────────────────────
 *
 * Cada punto viene como `{ x, y }` en PORCENTAJE del modelo visto de frente
 * (0,0 = esquina superior izquierda de la caja del modelo; 100,100 = inferior
 * derecha). El visor lanza un rayo de frente en esa posición y el punto se
 * pega a la superficie donde choca, orientado según la curvatura. Así quien
 * escribe el contenido no necesita saber de 3D: basta con `{ x: 46, y: 22 }`.
 * Para sacar esas coordenadas, el modo `calibrar` devuelve las del clic.
 *
 * ── Por qué no da lag ────────────────────────────────────────────────────
 *
 * 1. Dibuja SOLO cuando algo cambia (girar, acercar, un punto nuevo). Un
 *    visor 3D que redibuja 60 veces por segundo aunque nadie lo toque se come
 *    la batería y le roba procesador a la videollamada, que corre en la misma
 *    pestaña. El juego original hacía eso; aquí no.
 * 2. La resolución se topa en 1.5x: en pantallas de alta densidad se ve igual
 *    de bien y pinta hasta 45% menos pixeles.
 * 3. Los puntos son objetos 3D de verdad (no etiquetas HTML que se recalculan
 *    en cada cuadro), con geometrías y materiales compartidos.
 * 4. Al desmontarse libera TODO (geometrías, texturas, contexto WebGL). Los
 *    navegadores permiten pocos contextos WebGL a la vez; si no se liberan,
 *    a la tercera vez que se abre la actividad el navegador mata el más viejo.
 *
 * Regla del aula: este archivo no llama a la API de Destello. Solo carga el
 * modelo cuya URL le pasan (un archivo estático).
 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

/** Estilos de punto disponibles. El contenido elige por nombre. */
export const ESTILOS_DE_PUNTO = ['semilla', 'oro', 'plata', 'punto']

const TOPE_DE_RESOLUCION = 1.5

export default function Visor3D({
    url,
    rotacion = [0, 0, 0],
    espejo = false,
    puntos = [],
    objetivo = null,
    bloqueado = false,
    calibrar = false,
    giroLibre = false,
    onCalibrar,
    onInteraccion,
}) {
    const caja = useRef(null)
    const motor = useRef(null)
    const [carga, setCarga] = useState({ estado: 'cargando', avance: 0 })

    // Los manejadores cambian en cada render; el motor los lee de aquí para
    // no tener que reconstruir la escena cada vez.
    const avisos = useRef({ onCalibrar, onInteraccion, calibrar })
    avisos.current = { onCalibrar, onInteraccion, calibrar }

    // ── La escena: se arma UNA vez por modelo ─────────────────────────────
    useEffect(() => {
        const contenedor = caja.current
        let renderer
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
        } catch {
            setCarga({ estado: 'sin-webgl', avance: 0 })
            return
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TOPE_DE_RESOLUCION))
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none'
        contenedor.appendChild(renderer.domElement)

        const escena = new THREE.Scene()
        const pmrem = new THREE.PMREMGenerator(renderer)
        const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
        escena.environment = entorno
        const luz = new THREE.DirectionalLight(0xffffff, 1.2)
        luz.position.set(2, 3, 4)
        escena.add(luz)

        const camara = new THREE.PerspectiveCamera(28, 1, 0.01, 100)
        const controles = new OrbitControls(camara, renderer.domElement)
        controles.enableDamping = true
        controles.dampingFactor = 0.12
        controles.enablePan = false
        // Giro limitado: se puede ver la oreja de lado, pero no perderla por detrás.
        controles.minAzimuthAngle = -Math.PI / 2.4
        controles.maxAzimuthAngle = Math.PI / 2.4
        controles.minPolarAngle = Math.PI / 2 - 0.8
        controles.maxPolarAngle = Math.PI / 2 + 0.8

        const capaPuntos = new THREE.Group()
        escena.add(capaPuntos)
        const recursos = crearRecursos()
        const aro = new THREE.Mesh(recursos.aroGeo, recursos.aroMat)
        aro.visible = false
        escena.add(aro)

        const m = {
            renderer, escena, camara, controles, capaPuntos, recursos, aro,
            pivote: null, cajaModelo: null, distanciaBase: 0,
            anclas: new Map(), rayo: new THREE.Raycaster(),
            pedido: false, vivo: true,
        }
        motor.current = m

        // ── Dibujar solo cuando hace falta ──
        const cuadro = (t) => {
            m.pedido = false
            if (!m.vivo) return
            const seMovio = controles.update()
            if (aro.visible) {
                const s = 1 + 0.18 * Math.sin(t / 180)
                aro.scale.setScalar(s)
            }
            renderer.render(escena, camara)
            // Sigue pidiendo cuadros solo mientras algo se mueve: la inercia
            // del giro, o el aro que late.
            if (seMovio || aro.visible) m.pedir()
        }
        m.pedir = () => {
            if (m.pedido || !m.vivo) return
            m.pedido = true
            requestAnimationFrame(cuadro)
        }
        controles.addEventListener('change', m.pedir)
        controles.addEventListener('start', () => avisos.current.onInteraccion?.())

        // ── Encuadre: el modelo cabe a cualquier tamaño de caja ──
        m.encuadrar = (reiniciar) => {
            const w = contenedor.clientWidth, h = contenedor.clientHeight
            if (!m.cajaModelo || !w || !h) return
            const tam = m.cajaModelo.getSize(new THREE.Vector3())
            const aspecto = w / h
            const tanMitad = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2))
            const dist = Math.max((tam.y / 2) / tanMitad, (tam.x / 2) / (tanMitad * aspecto)) * 2 + tam.z / 2
            const antes = m.distanciaBase
            m.distanciaBase = dist
            camara.aspect = aspecto
            camara.updateProjectionMatrix()
            controles.minDistance = dist * 0.4
            controles.maxDistance = dist * 1.8
            if (reiniciar || !antes) {
                camara.position.set(0, 0, dist)
                controles.target.set(0, 0, 0)
            } else {
                camara.position.sub(controles.target).multiplyScalar(dist / antes).add(controles.target)
            }
            controles.update()
            m.pedir()
        }

        const redimensionar = () => {
            const w = contenedor.clientWidth, h = contenedor.clientHeight
            if (!w || !h) return
            renderer.setSize(w, h, false)
            camara.aspect = w / h
            camara.updateProjectionMatrix()
            m.encuadrar(false)
            m.pedir()
        }
        const ro = new ResizeObserver(redimensionar)
        ro.observe(contenedor)

        // ── Calibrar: clic (sin arrastrar) sobre el modelo → sus coordenadas ──
        let abajo = null
        const alBajar = (e) => { abajo = { x: e.clientX, y: e.clientY } }
        const alSubir = (e) => {
            if (!abajo || !avisos.current.calibrar || !m.pivote) { abajo = null; return }
            const movio = Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y)
            abajo = null
            if (movio > 5) return
            const r = renderer.domElement.getBoundingClientRect()
            const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
            m.rayo.setFromCamera(ndc, camara)
            const golpe = m.rayo.intersectObject(m.pivote, true)[0]
            if (!golpe) return
            const tam = m.cajaModelo.getSize(new THREE.Vector3())
            avisos.current.onCalibrar?.({
                x: Math.round(((golpe.point.x - m.cajaModelo.min.x) / tam.x) * 100),
                y: Math.round(((m.cajaModelo.max.y - golpe.point.y) / tam.y) * 100),
            })
        }
        renderer.domElement.addEventListener('pointerdown', alBajar)
        renderer.domElement.addEventListener('pointerup', alSubir)

        // ── Cargar el modelo ──
        new GLTFLoader().load(
            url,
            (gltf) => {
                if (!m.vivo) { liberar(gltf.scene); return }
                const raiz = gltf.scene
                raiz.scale.set(espejo ? -1 : 1, 1, 1)
                const pivote = new THREE.Group()
                pivote.add(raiz)
                pivote.rotation.set(...rotacion.map(g => THREE.MathUtils.degToRad(g)))
                pivote.updateMatrixWorld(true)
                // Centrado y a tamaño 2 en su lado más largo, sea cual sea el modelo.
                const b = new THREE.Box3().setFromObject(pivote)
                const tam = b.getSize(new THREE.Vector3())
                const s = 2 / Math.max(tam.x, tam.y, tam.z)
                pivote.scale.setScalar(s)
                pivote.position.copy(b.getCenter(new THREE.Vector3())).multiplyScalar(-s)
                pivote.updateMatrixWorld(true)
                escena.add(pivote)
                m.pivote = pivote
                m.cajaModelo = new THREE.Box3().setFromObject(pivote)
                m.encuadrar(true)
                setCarga({ estado: 'listo', avance: 100 })
            },
            (e) => { if (e.total) setCarga({ estado: 'cargando', avance: Math.round((e.loaded / e.total) * 100) }) },
            (err) => {
                console.error('No se pudo cargar el modelo 3D:', err)
                if (m.vivo) setCarga({ estado: 'error', avance: 0 })
            },
        )

        return () => {
            m.vivo = false
            ro.disconnect()
            controles.dispose()
            renderer.domElement.removeEventListener('pointerdown', alBajar)
            renderer.domElement.removeEventListener('pointerup', alSubir)
            if (m.pivote) liberar(m.pivote)
            liberarRecursos(recursos)
            entorno.dispose()
            pmrem.dispose()
            renderer.dispose()
            renderer.forceContextLoss()
            renderer.domElement.remove()
            motor.current = null
        }
        // La escena depende solo del modelo; puntos y objetivo se sincronizan abajo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, espejo, rotacion.join(',')])

    // ── Puntos colocados ──────────────────────────────────────────────────
    const llavePuntos = puntos.map(p => `${p.id}:${p.x},${p.y}:${p.estilo}`).join('|')
    useEffect(() => {
        const m = motor.current
        if (!m || carga.estado !== 'listo') return
        m.capaPuntos.clear()
        const usados = []
        for (const p of puntos) {
            const ancla = anclaDe(m, p)
            const marca = crearMarca(m.recursos, p.estilo)
            // Si dos puntos caen casi en el mismo lugar, se separan un poquito
            // para que se vean los dos (un tratamiento puede repetir zona).
            let pos = ancla.p.clone()
            for (const u of usados) if (u.distanceTo(pos) < 0.05) pos.add(new THREE.Vector3(0.045, -0.03, 0))
            usados.push(pos.clone())
            colocar(marca, pos, ancla.n)
            m.capaPuntos.add(marca)
        }
        m.pedir()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [llavePuntos, carga.estado])

    // ── Aro de "aquí va" ──────────────────────────────────────────────────
    const llaveObjetivo = objetivo ? `${objetivo.x},${objetivo.y}` : ''
    useEffect(() => {
        const m = motor.current
        if (!m || carga.estado !== 'listo') return
        if (objetivo) {
            const ancla = anclaDe(m, objetivo)
            colocar(m.aro, ancla.p, ancla.n)
            m.aro.visible = true
        } else {
            m.aro.visible = false
        }
        m.pedir()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [llaveObjetivo, carga.estado])

    // ── Giro libre: darle la vuelta completa (para explorar el modelo solo).
    // En un caso se limita para que nadie pierda la cara de frente; explorando
    // sí tiene sentido verla por detrás.
    useEffect(() => {
        const c = motor.current?.controles
        if (!c) return
        c.minAzimuthAngle = giroLibre ? -Infinity : -Math.PI / 2.4
        c.maxAzimuthAngle = giroLibre ? Infinity : Math.PI / 2.4
        c.minPolarAngle = giroLibre ? 0.15 : Math.PI / 2 - 0.8
        c.maxPolarAngle = giroLibre ? Math.PI - 0.15 : Math.PI / 2 + 0.8
        c.update()
    }, [giroLibre, carga.estado])

    // ── Bloqueado: se ve, pero no se deja girar ───────────────────────────
    useEffect(() => {
        if (motor.current) motor.current.controles.enabled = !bloqueado
    }, [bloqueado, carga.estado])

    const vistaFrontal = () => {
        motor.current?.encuadrar(true)
        onInteraccion?.()
    }

    return (
        <div className="v3d">
            <style>{CSS}</style>
            <div ref={caja} className="v3d-lienzo" />
            {carga.estado === 'cargando' && (
                <div className="v3d-aviso">Cargando modelo 3D… {carga.avance ? `${carga.avance}%` : ''}</div>
            )}
            {carga.estado === 'error' && (
                <div className="v3d-aviso">No se pudo cargar el modelo 3D. Intenta recargar la página.</div>
            )}
            {carga.estado === 'sin-webgl' && (
                <div className="v3d-aviso">Este dispositivo no puede mostrar modelos 3D.</div>
            )}
            {carga.estado === 'listo' && (
                <>
                    <span className="v3d-pista">{bloqueado ? 'Espera a que tu profe libere el modelo' : 'Arrastra para girar · rueda o pellizca para acercar'}</span>
                    <button className="v3d-frontal" onClick={vistaFrontal} disabled={bloqueado}>Vista frontal</button>
                </>
            )}
        </div>
    )
}

/* ── Piezas del motor ─────────────────────────────────────────────────────── */

/** `{x, y}` en % → punto y normal sobre la superficie del modelo (con caché). */
function anclaDe(m, c) {
    const llave = `${c.x.toFixed(1)},${c.y.toFixed(1)}`
    if (m.anclas.has(llave)) return m.anclas.get(llave)
    const tam = m.cajaModelo.getSize(new THREE.Vector3())
    const X = m.cajaModelo.min.x + (c.x / 100) * tam.x
    const Y = m.cajaModelo.max.y - (c.y / 100) * tam.y
    m.rayo.set(new THREE.Vector3(X, Y, m.cajaModelo.max.z + 1), new THREE.Vector3(0, 0, -1))
    const golpe = m.rayo.intersectObject(m.pivote, true)[0]
    const ancla = golpe
        ? {
            p: golpe.point.clone(),
            n: golpe.face ? golpe.face.normal.clone().transformDirection(golpe.object.matrixWorld).normalize() : new THREE.Vector3(0, 0, 1),
        }
        : { p: new THREE.Vector3(X, Y, m.cajaModelo.max.z), n: new THREE.Vector3(0, 0, 1) }
    // La normal tiene que mirar hacia afuera (hacia la cámara de frente):
    // en mallas de doble cara a veces viene al revés.
    if (ancla.n.z < 0) ancla.n.negate()
    m.anclas.set(llave, ancla)
    return ancla
}

const Z = new THREE.Vector3(0, 0, 1)
function colocar(obj, p, n) {
    obj.position.copy(p).addScaledVector(n, 0.004)
    obj.quaternion.setFromUnitVectors(Z, n)
}

/** Geometrías y materiales compartidos por todas las marcas. */
function crearRecursos() {
    return {
        cintaGeo: new THREE.BoxGeometry(0.085, 0.085, 0.006),
        cintaMat: new THREE.MeshStandardMaterial({ color: 0xd8a882, roughness: 0.85 }),
        semillaGeo: new THREE.SphereGeometry(0.019, 16, 12),
        semillaMat: new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.45 }),
        bolaGeo: new THREE.SphereGeometry(0.03, 24, 16),
        oroMat: new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 1, roughness: 0.22 }),
        plataMat: new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.2 }),
        puntoMat: new THREE.MeshStandardMaterial({ color: 0x2dd4bf, emissive: 0x0d7377, emissiveIntensity: 0.6, roughness: 0.4 }),
        aroGeo: new THREE.TorusGeometry(0.07, 0.009, 10, 48),
        aroMat: new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.95, depthTest: false }),
    }
}

function crearMarca(r, estilo) {
    const g = new THREE.Group()
    if (estilo === 'semilla') {
        // La semilla de vaccaria va pegada con un cuadrito de cinta
        const cinta = new THREE.Mesh(r.cintaGeo, r.cintaMat)
        cinta.rotation.z = 0.12
        const semilla = new THREE.Mesh(r.semillaGeo, r.semillaMat)
        semilla.position.z = 0.012
        g.add(cinta, semilla)
    } else if (estilo === 'oro' || estilo === 'plata') {
        const bola = new THREE.Mesh(r.bolaGeo, estilo === 'oro' ? r.oroMat : r.plataMat)
        bola.position.z = 0.018
        g.add(bola)
    } else {
        const bola = new THREE.Mesh(r.bolaGeo, r.puntoMat)
        bola.scale.setScalar(0.8)
        g.add(bola)
    }
    return g
}

function liberarRecursos(r) {
    Object.values(r).forEach(x => x?.dispose?.())
}

function liberar(obj) {
    obj.traverse(o => {
        o.geometry?.dispose()
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
        for (const mat of mats) {
            for (const v of Object.values(mat)) if (v?.isTexture) v.dispose()
            mat.dispose()
        }
    })
}

const CSS = `
.v3d {
    position: relative; width: 100%; height: 100%; min-height: 200px; overflow: hidden;
    border-radius: 16px; background: radial-gradient(circle at 50% 40%, #1e293b 0%, #080d1a 100%);
}
.v3d-lienzo { position: absolute; inset: 0; cursor: grab; }
.v3d-lienzo:active { cursor: grabbing; }
.v3d-aviso {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    padding: 20px; text-align: center; color: #cbd5e1; font-size: 13px;
}
.v3d-pista {
    position: absolute; left: 10px; bottom: 10px; right: 112px; width: fit-content; max-width: calc(100% - 122px);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 4px 9px; border-radius: 999px;
    font-size: 10.5px; color: #cbd5e1; background: rgba(15, 23, 42, .75); pointer-events: none;
}
.v3d-frontal {
    position: absolute; right: 10px; bottom: 10px; padding: 5px 11px; border-radius: 999px;
    font-size: 11px; font-weight: 600; color: #5eead4; cursor: pointer;
    background: rgba(15, 23, 42, .8); border: 1px solid rgba(45, 212, 191, .4);
}
.v3d-frontal:disabled { opacity: .4; cursor: not-allowed; }
`
