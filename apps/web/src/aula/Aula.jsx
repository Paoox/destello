/**
 * Destello — El aula
 *
 * La cáscara: las dos ventanas, la barra de arriba y los controles. Todavía sin
 * video real ni actividades — esos se enchufan aquí dentro sin mover esta
 * estructura.
 *
 * ⚠️ Este componente y todo lo que vive en `src/aula/` NO consulta la API de
 * Destello. Recibe una `sesion` (ver `contrato.js`) y con eso le basta. Es lo
 * que permite rentar el aula a otra escuela sin reescribirla.
 *
 * ── Por qué está armada así ──────────────────────────────────────────────
 *
 * Dos ventanas **lado a lado**, no una encima de otra: a la izquierda quien
 * habla, a la derecha en qué se trabaja. Es la decisión que separa esto de una
 * videollamada — el pizarrón no es un extra, es la mitad de la pantalla.
 *
 * La tira de personas va **debajo del video y con scroll propio**, para que la
 * lista pueda crecer sin encoger la ventana de quien está dando la clase.
 */
import { useState, useEffect, useRef } from 'react'
import {
    Microphone, MicrophoneSlash, VideoCamera, VideoCameraSlash, Hand,
    ChatCircleDots, Gear, Question, Lock, LockOpen, Stack, X, Sparkle,
} from '@phosphor-icons/react'
import Avatar from './Avatar.jsx'
import Sello from './Sello.jsx'
import BandejaSellos from './BandejaSellos.jsx'
import PistaVideo from './video/PistaVideo.jsx'
import { useVideoAula } from './video/useVideoAula.js'
import { MARCA_DESTELLO, MINUTOS_SIN_TOCAR } from './contrato.js'
import { SELLOS, REACCIONES, selloPorId, reaccionPorId, SELLOS_VISIBLES_EN_PIZARRON } from './catalogo.js'
import { tipoDe, resumenDe } from './actividades/registro.js'
import { ESTADO_INICIAL } from './actividades/contrato.js'

/* ══════════════════════════════════════════════════════════════════════════
   Barra de arriba
   ══════════════════════════════════════════════════════════════════════════ */

/** "1:47" — el contador de cuánto falta. En rojo cuando quedan 10 min o menos. */
function formatoRestante(min) {
    if (min == null) return null
    if (min <= 0) return 'Terminando'
    const h = Math.floor(min / 60)
    const m = min % 60
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m} min`
}

function BarraSuperior({ sesion }) {
    const { marca, taller, yo } = sesion
    const restante = formatoRestante(taller.terminaEn)
    // Los últimos 10 minutos se marcan en ámbar. La profe necesita saber que
    // va a tener que cerrar, y el alumno agradece no perder la noción del tiempo.
    const porTerminar = taller.terminaEn != null && taller.terminaEn <= 10

    return (
        <header style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
            padding: '10px var(--space-4)', flexWrap: 'wrap',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
        }}>
            {/* Marca — de quien renta el aula, no necesariamente Destello */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
                {marca.logoUrl
                    ? <img src={marca.logoUrl} alt={marca.nombre} style={{ height: 24 }} />
                    : <span style={{ fontSize: 18, color: marca.colorPrimario }}>✦</span>}
                <strong style={{ fontSize: 'var(--text-sm)' }}>{marca.nombre}</strong>
            </div>

            {/* Qué clase es y quién la da */}
            <div style={{ minWidth: 0, flex: '1 1 200px', lineHeight: 1.25 }}>
                <div style={{
                    fontSize: 'var(--text-sm)', fontWeight: 600,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                    {taller.nombre}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {taller.instructor}
                </div>
            </div>

            {restante && (
                <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
                    fontWeight: 700, flex: 'none',
                    color: porTerminar ? 'var(--color-amber-500)' : 'var(--color-jade-400)',
                }} title="Tiempo que falta para que termine la clase">
                    {restante}
                </span>
            )}

            {taller.tema && (
                <span style={{
                    fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', flex: 'none',
                }}>
                    {taller.tema}
                </span>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flex: 'none' }}>
                <BotonIcono titulo="Ajustes"><Gear size={17} /></BotonIcono>
                <Avatar persona={yo} size={28} />
            </div>
        </header>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   Piezas chicas
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * `estado`: para micro/cámara, donde "apagado" es un estado normal y visible,
 * no un error — necesita su propio color (rojo), distinto de "peligro"
 * (que es para acciones destructivas: silenciar a todos, bloqueada por la
 * profe). `'on'` → verde, `'off'` → rojo, `null` → el estilo de siempre
 * (gris/jade), para no afectar los demás botones (chat, ajustes, mano...).
 */
function BotonIcono({ children, titulo, activo = false, peligro = false, estado = null, onClick, disabled = false }) {
    const [hover, setHover] = useState(false)
    const colorEstado = estado === 'on' ? 'var(--color-success)' : estado === 'off' ? 'var(--color-error)' : null
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={titulo}
            aria-label={titulo}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, padding: 0,
                background: peligro ? 'rgba(220,38,38,0.15)'
                          : colorEstado ? `${colorEstado}22`
                          : activo  ? 'rgba(13,115,119,0.18)'
                          : hover   ? 'var(--bg-card)' : 'transparent',
                border: `1px solid ${peligro ? 'var(--color-error)'
                                   : colorEstado ?? (activo ? 'var(--color-jade-500)' : 'var(--border-subtle)')}`,
                borderRadius: 'var(--radius-full)',
                color: peligro ? 'var(--color-error)'
                     : colorEstado ?? (activo ? 'var(--color-jade-400)' : 'var(--text-secondary)'),
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.45 : 1,
                transition: 'all .15s',
            }}
        >
            {children}
        </button>
    )
}

/** El puntito del semáforo. Verde = tocó el pizarrón hace poco. */
function Semaforo({ activo, size = 8 }) {
    return (
        <span
            title={activo ? 'Está trabajando' : 'No ha tocado el pizarrón'}
            style={{
                width: size, height: size, borderRadius: '50%', flex: 'none',
                display: 'inline-block',
                background: activo ? 'var(--color-success)' : 'var(--color-error)',
            }}
        />
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   Ventana izquierda — el video
   ══════════════════════════════════════════════════════════════════════════ */

function VentanaVideo({ sesion, video, pistasCamara, onAbrirChat, chatAbierto, chatNuevos, onMicro, onMano, onReaccionar, onSilenciarATodos }) {
    const { rol, taller, personas, yo } = sesion
    const esProfe = rol === 'profe'

    // ── Quién se ve en grande ──────────────────────────────────────────
    //
    // La profe se ve a sí misma (así sabe qué está transmitiendo). El
    // alumno ve a LA PROFE: el rol viene del token que firmó el servidor
    // (`persona.rol`). Si nadie trae rol (tokens viejos), el primer remoto
    // con cámara prendida, como antes.
    const laProfe = personas.find(p => p.rol === 'profe' && p.camara)
        ?? personas.find(p => p.camara)
    const pistaGrande = esProfe
        ? pistasCamara?.[yo.id]
        : pistasCamara?.[laProfe?.id]

    return (
        <section className="aula-ventana" style={{
            // `flex: 1` + `minHeight: 0`: sin los dos, la ventana se queda del
            // tamaño de su contenido y deja un hueco muerto abajo. El `minHeight`
            // es el que permite que se encoja cuando se abre el chat.
            flex: '1 1 auto', minHeight: 0,
            display: 'flex', flexDirection: 'column', minWidth: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
        }}>
            {/* Quien está dando la clase */}
            <div style={{
                flex: '1 1 auto', minHeight: 150,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
                background: 'var(--bg-dark)',
                position: 'relative',
            }}>
                {pistaGrande ? (
                    <PistaVideo track={pistaGrande} style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                    }} />
                ) : (
                    <>
                        <div style={{ fontSize: 44, opacity: .5 }}>🎥</div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                            {taller.instructor}
                        </div>
                    </>
                )}
                <span style={{
                    position: 'absolute', top: 10, left: 12,
                    fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
                    background: 'rgba(0,0,0,0.35)', padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                }}>
                    {video?.conectado
                        ? (pistaGrande ? 'En vivo' : 'Conectado · cámara apagada')
                        : 'Sin video todavía'}
                </span>
            </div>

            {/* La tira de personas. Scroll propio: la lista crece sin robarle
                altura a la ventana de arriba. La profe las ve en dos filas
                porque necesita a todas de un vistazo. */}
            <div style={{
                display: esProfe ? 'grid' : 'flex',
                gridTemplateColumns: esProfe ? 'repeat(auto-fill, minmax(52px, 1fr))' : undefined,
                gap: 8,
                padding: 'var(--space-3)',
                flex: 'none',
                // La ficha mide 40 del avatar + 3 de hueco + el nombre. Estos
                // topes se calcularon para que NO se corte el nombre de abajo:
                // si se tocan, hay que volver a mirarlo en pantalla.
                maxHeight: esProfe ? 158 : 90,
                overflowX: esProfe ? 'hidden' : 'auto',
                overflowY: esProfe ? 'auto' : 'hidden',
                borderTop: '1px solid var(--border-subtle)',
            }}>
                {[yo, ...personas].map(p => (
                    <FichaPersona
                        key={p.id}
                        persona={p}
                        pista={pistasCamara?.[p.id]}
                        esProfe={esProfe}
                        soyYo={p.id === yo.id}
                        onMicro={onMicro}
                    />
                ))}
            </div>

            {/* Controles */}
            <BarraControles
                sesion={sesion}
                video={video}
                onAbrirChat={onAbrirChat}
                chatAbierto={chatAbierto}
                chatNuevos={chatNuevos}
                onMano={onMano}
                onReaccionar={onReaccionar}
                onSilenciarATodos={onSilenciarATodos}
            />
        </section>
    )
}

/**
 * Una persona en la tira: avatar, nombre, y sus señales encima.
 *
 * Para la profe, además, es un botón: picarle **abre o cierra el micrófono de
 * esa persona en particular**. Es lo que pidió Paola y es lo que de verdad pasa
 * en una clase — alguien levanta la mano, le abres solo a ella, contesta, y se
 * lo vuelves a cerrar. Silenciar a todos es el martillo; esto es la pinza.
 */
function FichaPersona({ persona, pista, esProfe, soyYo, onMicro }) {
    const { nombre, manoArriba, reaccion, micro, silenciadoPorProfe } = persona
    const puedeAbrirMicro = esProfe && !soyYo
    const tienePalabra = !silenciadoPorProfe
    const abierto = micro && tienePalabra

    const senales = (
        <>
            <Avatar persona={persona} pista={pista} size={40} />

            {/* La mano y la reacción van ENCIMA del avatar: son cosas que la
                profe tiene que cachar de reojo, sin ponerse a leer. */}
            {manoArriba && (
                <span style={{ position: 'absolute', top: -4, right: 2, fontSize: 15 }}
                      title="Levantó la mano">✋</span>
            )}
            {reaccion && !manoArriba && (
                <span style={{ position: 'absolute', top: -4, right: 2 }}>
                    <Sello sello={reaccionPorId(reaccion)} size={16} />
                </span>
            )}

            {/* Tres estados, siempre visibles (antes se ocultaba a quien
                estaba silenciada — útil en clase real con 20+ personas, pero
                mientras se prueba conexión real es más útil ver el estado de
                cada quien sin excepción):
                  🔴 rojo   → sin permiso (silenciada por la profe)
                  🟡 ámbar  → CON permiso, pero todavía no prende su micro
                  🟢 verde  → de verdad hablando (pista de LiveKit activa) */}
            <span style={{
                position: 'absolute', bottom: 16, right: 0,
                color: !tienePalabra ? 'var(--color-error)'
                     : abierto       ? 'var(--color-success)'
                     :                 'var(--color-amber-500)',
                background: 'var(--bg-dark)',
                borderRadius: '50%', display: 'flex', padding: 1,
            }} title={
                !tienePalabra ? 'Silenciada por la profe'
                : abierto     ? 'Está hablando'
                :               'Tiene la palabra, aún no prende'
            }>
                {abierto
                    ? <Microphone size={11} weight="fill" />
                    : <MicrophoneSlash size={11} weight="fill" />}
            </span>

            <span style={{
                fontSize: 10, color: soyYo ? 'var(--color-jade-400)' : 'var(--text-muted)',
                maxWidth: 52, whiteSpace: 'nowrap', overflow: 'hidden',
                textOverflow: 'ellipsis', textAlign: 'center',
            }}>
                {soyYo ? 'Tú' : nombre.split(' ')[0]}
            </span>
        </>
    )

    const caja = {
        position: 'relative', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 3, flex: 'none', width: 52,
        padding: 0, background: 'transparent', border: 'none',
        fontFamily: 'var(--font-sans)',
    }

    // Para el alumno es solo información. Para la profe es un botón.
    if (!puedeAbrirMicro) return <div style={caja}>{senales}</div>

    return (
        <button
            onClick={() => onMicro?.(persona.id)}
            title={silenciadoPorProfe
                ? `Darle la palabra a ${nombre.split(' ')[0]}`
                : `Silenciar a ${nombre.split(' ')[0]}`}
            style={{ ...caja, cursor: 'pointer' }}
        >
            {senales}
        </button>
    )
}

/**
 * Los botones de abajo. Cambian según de qué lado estés.
 *
 * Micro y cámara ya son reales: pican directo al `Room` de LiveKit vía
 * `video` (`useVideoAula`, ver `video/useVideoAula.js`). Si no hay servidor
 * configurado (`video` viene `null` o desconectado), los botones simplemente
 * no hacen nada — el hook ya se encarga de que `toggleMicro`/`toggleCamara`
 * sean no-ops seguros en ese caso.
 */
function BarraControles({ sesion, video, onAbrirChat, chatAbierto, chatNuevos = 0, onMano, onReaccionar, onSilenciarATodos }) {
    const { rol, yo } = sesion
    const esProfe = rol === 'profe'
    const mano = yo.manoArriba === true
    const micro  = video?.microActivo  ?? false
    const camara = video?.camaraActiva ?? false

    // El silencio de la profe gana. Se comprueba también aquí, en la interfaz,
    // para que el botón se vea claramente bloqueado — pero la comprobación de
    // verdad la hace el servidor: esto es cortesía, no seguridad.
    const bloqueada = yo.silenciadoPorProfe === true

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            padding: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)',
        }}>
            <BotonIcono
                titulo={bloqueada ? 'La profe te tiene silenciada' : micro ? 'Cerrar micrófono' : 'Abrir micrófono'}
                estado={bloqueada ? null : (micro ? 'on' : 'off')}
                peligro={bloqueada}
                disabled={bloqueada}
                onClick={() => video?.toggleMicro()}
            >
                {micro && !bloqueada ? <Microphone size={17} /> : <MicrophoneSlash size={17} />}
            </BotonIcono>

            <BotonIcono
                titulo={camara ? 'Apagar cámara' : 'Prender cámara'}
                estado={camara ? 'on' : 'off'}
                onClick={() => video?.toggleCamara()}
            >
                {camara ? <VideoCamera size={17} /> : <VideoCameraSlash size={17} />}
            </BotonIcono>

            {!esProfe && (
                <BotonIcono titulo={mano ? 'Bajar la mano' : 'Levantar la mano'} activo={mano} onClick={onMano}>
                    <Hand size={17} />
                </BotonIcono>
            )}

            {!esProfe && (
                <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
                    {/* Ojo: las reacciones son OBJETOS del catálogo, no
                        emojis sueltos. Pintarlas con {r} en vez de <Sello>
                        tumba la pantalla entera con "Objects are not valid as
                        a React child". Pasó el 25 ago 2026. */}
                    {REACCIONES.map(r => (
                        <button
                            key={r.id}
                            title={r.nombre}
                            onClick={() => onReaccionar?.(r.id)}
                            style={{
                                display: 'flex', alignItems: 'center',
                                background: 'transparent', border: 'none',
                                cursor: 'pointer', padding: '2px 3px', lineHeight: 1,
                            }}
                        >
                            <Sello sello={r} size={22} />
                        </button>
                    ))}
                </div>
            )}

            {esProfe && (
                <button onClick={onSilenciarATodos} style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4,
                    padding: '6px 12px', background: 'rgba(220,38,38,0.12)',
                    border: '1px solid var(--color-error)', borderRadius: 'var(--radius-full)',
                    color: 'var(--color-error)', fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer',
                }}>
                    <MicrophoneSlash size={13} /> Silenciar a todos
                </button>
            )}

            <div style={{ marginLeft: 'auto', position: 'relative' }}>
                <BotonIcono titulo={chatNuevos ? `Chat de la clase (${chatNuevos} nuevos)` : 'Chat de la clase'} activo={chatAbierto} onClick={onAbrirChat}>
                    <ChatCircleDots size={17} />
                </BotonIcono>
                {/* Mensajes que llegaron con el chat cerrado */}
                {chatNuevos > 0 && !chatAbierto && (
                    <span style={{
                        position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16,
                        padding: '0 4px', borderRadius: 99, background: 'var(--color-amber-500, #D97706)',
                        color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
                        pointerEvents: 'none',
                    }}>{chatNuevos > 9 ? '9+' : chatNuevos}</span>
                )}
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   Ventana derecha — el pizarrón
   ══════════════════════════════════════════════════════════════════════════ */

function VentanaPizarron({ sesion, onSellar, onSellarATodos, onElegirActividad, onLiberar, onAvanzar }) {
    const { rol, personas, yo, pizarron } = sesion
    const esProfe = rol === 'profe'
    // El candado lo guarda el aula (no esta ventana) porque viaja a todas.
    const liberado = pizarron.liberado === true
    const [soloLosQueNecesitan, setSoloLosQueNecesitan] = useState(false)
    const [abierta, setAbierta] = useState(null)   // pizarrón de quién estoy viendo
    const [bandeja, setBandeja] = useState(false)  // ¿está abierta la bandeja de sellos?
    const [cargado, setCargado] = useState(null)   // el sello que trae en la mano
    const [menu, setMenu] = useState(false)        // el menú de qué se muestra

    // ── Qué actividad se monta y con el estado de quién ──────────────────
    //
    // Normalmente cada quien ve su propio avance. Pero cuando la profe abre el
    // pizarrón de una alumna, monta la MISMA actividad con el estado de ELLA —
    // por eso puede interactuar con su modelo, que es justo lo que pidió Paola.
    const actividadActiva = sesion.pizarron.actividad ?? null
    const tipo = tipoDe(actividadActiva)
    const Actividad = tipo?.Componente ?? null
    const quienTrabaja = abierta?.id ?? yo.id
    const estadoVisible = (abierta ?? yo).estadoActividad ?? ESTADO_INICIAL

    // Al plantar un sello, la persona se ve actualizada al instante. Si además
    // estaba abierto su pizarrón en grande, se refresca ahí también.
    const plantar = (personaId) => {
        if (!cargado) return
        onSellar?.(personaId, cargado.id)
    }

    // El filtro que hace que esto sirva igual con 20 que con 40: no se trata de
    // vigilar a todas, se trata de encontrar rápido a quien no le está saliendo.
    const visibles = soloLosQueNecesitan
        ? personas.filter(p => !p.interactuando || p.manoArriba)
        : personas

    return (
        <section className="aula-ventana" style={{
            display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            position: 'relative',
        }}>
            {/* Lo que se está trabajando */}
            <div style={{
                flex: '1 1 auto', minHeight: 170, position: 'relative',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'var(--bg-dark)', overflowY: 'auto',
            }}>
                {/* ── Aquí vive la actividad ──────────────────────────────
                    El pizarrón NO sabe si es un quiz, un memorama o un modelo
                    3D: pregunta al registro cuál componente toca y lo monta.
                    Agregar una actividad nueva no cambia una línea de aquí. */}
                {Actividad ? (
                    <Actividad
                        key={actividadActiva.id}
                        contenido={actividadActiva.contenido}
                        estado={estadoVisible}
                        onCambio={(nuevo) => onAvanzar?.(quienTrabaja, nuevo)}
                        liberado={esProfe ? true : liberado}
                        esProfe={esProfe}
                    />
                ) : actividadActiva ? (
                    // Sí eligió algo (existe en `materiales`), pero su tipo
                    // todavía no está en el registro (memorama, armar, modelo3d).
                    // Distinto de "nada elegido": ahí "elige una actividad" sería
                    // mentira — ya lo hizo, solo que ese tipo no existe todavía.
                    <>
                        <div style={{ fontSize: 44, opacity: .5 }}>🚧</div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                            {esProfe
                                ? `"${actividadActiva.nombre}" todavía no está listo — elige otra`
                                : 'Tu profe está preparando esta actividad'}
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: 44, opacity: .5 }}>🧩</div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                            {esProfe
                                ? 'Elige una actividad para empezar'
                                : 'Espera, ya viene la actividad'}
                        </div>
                    </>
                )}

                {abierta && (
                    <div style={{
                        position: 'absolute', top: 10, left: 44,
                        fontSize: 'var(--text-xs)', color: 'var(--color-jade-400)',
                        fontWeight: 600,
                    }}>
                        Pizarrón de {abierta.nombre}
                    </div>
                )}

                {!liberado && !esProfe && (
                    <div style={{
                        position: 'absolute', bottom: 10, left: 12,
                        fontSize: 'var(--text-xs)', color: 'var(--color-amber-500)',
                        display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                        <Lock size={13} weight="fill" /> La profe está explicando
                    </div>
                )}

                {/* Las insignias viven arriba a la derecha y NO se van cuando
                    cambia el material: son de la persona, no del ejercicio. */}
                {!esProfe && yo.insignias?.length > 0 && (
                    <div style={{
                        position: 'absolute', top: 10, right: 12,
                        display: 'flex', gap: 4, flexWrap: 'wrap',
                        justifyContent: 'flex-end', maxWidth: 160,
                    }}>
                        {/* Solo los últimos: el pizarrón es para trabajar. Los
                            demás siguen contando en su perfil y en el Habitat,
                            que es donde se van a ver bonitos de verdad. */}
                        {yo.insignias.slice(-SELLOS_VISIBLES_EN_PIZARRON).map((id, i) => {
                            const sello = selloPorId(id)
                            return sello && (
                                <Sello key={i} sello={sello} size={26} conFondo
                                       title={`${sello.nombre} — ${sello.mensaje}`} />
                            )
                        })}
                    </div>
                )}

                {/* Cerrar el pizarrón de una alumna devuelve a la profe al suyo */}
                {abierta && (
                    <button onClick={() => setAbierta(null)} title="Volver a mi pizarrón" style={{
                        position: 'absolute', top: 8, left: 8, display: 'flex',
                        padding: 5, background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                    }}>
                        <X size={14} />
                    </button>
                )}

                {/* Controles de la profe, pegados al borde derecho como en el prototipo */}
                {esProfe && (
                    <div style={{
                        position: 'absolute', top: 10, right: 10,
                        display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                        <BotonIcono
                            titulo={liberado ? 'Bloquear: que solo vean mi modelo' : 'Liberar: que cada quien tome el suyo'}
                            activo={liberado}
                            onClick={() => onLiberar?.(!liberado)}
                        >
                            {liberado ? <LockOpen size={16} /> : <Lock size={16} />}
                        </BotonIcono>
                        <BotonIcono
                            titulo="Elegir qué se muestra"
                            activo={menu}
                            onClick={() => setMenu(m => !m)}
                        >
                            <Stack size={16} />
                        </BotonIcono>
                        <BotonIcono
                            titulo="Sellos"
                            activo={bandeja}
                            onClick={() => { setBandeja(b => !b); if (bandeja) setCargado(null) }}
                        >
                            <Sparkle size={16} weight={bandeja ? 'fill' : 'regular'} />
                        </BotonIcono>
                    </div>
                )}

                {/* El menú de materiales precargados del taller.
                    Salen de la PLANTILLA, no están escritos aquí. */}
                {esProfe && menu && (
                    <div style={{
                        position: 'absolute', top: 52, right: 52, zIndex: 5,
                        width: 230, padding: 'var(--space-2)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: 'var(--shadow-lg)',
                    }}>
                        <p style={{
                            margin: '2px 6px 6px', fontSize: 10,
                            letterSpacing: '.08em', textTransform: 'uppercase',
                            color: 'var(--text-muted)',
                        }}>
                            Material de esta clase
                        </p>
                        {(sesion.pizarron.materiales ?? []).map(m => {
                            const puesta = actividadActiva?.id === m.id
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => { onElegirActividad?.(m.id); setMenu(false) }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        width: '100%', padding: '8px 10px', textAlign: 'left',
                                        background: puesta ? 'rgba(13,115,119,0.14)' : 'transparent',
                                        border: 'none', borderRadius: 'var(--radius-md)',
                                        color: puesta ? 'var(--color-jade-400)' : 'var(--text-secondary)',
                                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                                        fontWeight: puesta ? 700 : 400, cursor: 'pointer',
                                    }}
                                >
                                    <Stack size={13} />
                                    <span style={{ flex: 1 }}>{m.nombre}</span>
                                    {puesta && <span style={{ fontSize: 9 }}>en el pizarrón</span>}
                                </button>
                            )
                        })}
                        {!(sesion.pizarron.materiales ?? []).length && (
                            <p style={{ margin: 6, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                Este taller todavía no tiene material cargado.
                            </p>
                        )}
                    </div>
                )}

                {/* El bot de dudas, abajo a la derecha */}
                {!esProfe && (
                    <button title="¿Tienes una duda?" style={{
                        position: 'absolute', bottom: 10, right: 12, display: 'flex',
                        padding: 7, background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)',
                        color: 'var(--color-jade-400)', cursor: 'pointer',
                    }}>
                        <Question size={16} weight="fill" />
                    </button>
                )}
            </div>

            {/* La rejilla — solo la ve la profe */}
            {esProfe && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 'var(--space-3)' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        marginBottom: 8, flexWrap: 'wrap',
                    }}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                            {visibles.length} de {personas.length}
                        </span>
                        <button
                            onClick={() => setSoloLosQueNecesitan(v => !v)}
                            style={{
                                marginLeft: 'auto', padding: '4px 11px',
                                background: soloLosQueNecesitan ? 'rgba(220,38,38,0.14)' : 'transparent',
                                border: `1px solid ${soloLosQueNecesitan ? 'var(--color-error)' : 'var(--border-subtle)'}`,
                                borderRadius: 'var(--radius-full)',
                                color: soloLosQueNecesitan ? 'var(--color-error)' : 'var(--text-muted)',
                                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                                fontWeight: soloLosQueNecesitan ? 700 : 400, cursor: 'pointer',
                            }}
                        >
                            Solo los que me necesitan
                        </button>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
                        gap: 6, maxHeight: 168, overflowY: 'auto',
                    }}>
                        {visibles.map(p => (
                            <MiniPizarron
                                key={p.id}
                                persona={p}
                                sellando={cargado}
                                resumen={resumenDe(actividadActiva, p.estadoActividad)}
                                onClick={() => cargado ? plantar(p.id) : setAbierta(p)}
                            />
                        ))}
                        {visibles.length === 0 && (
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', gridColumn: '1/-1' }}>
                                ✓ Todas están trabajando.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {esProfe && (
                <BandejaSellos
                    abierta={bandeja}
                    cargado={cargado}
                    onCargar={setCargado}
                    onSoltar={() => setCargado(null)}
                    onATodos={() => { onSellarATodos?.(cargado.id); setCargado(null) }}
                    onCerrar={() => { setBandeja(false); setCargado(null) }}
                />
            )}
        </section>
    )
}

/**
 * La miniatura del pizarrón de una alumna.
 *
 * DECISIÓN (Paola, 25 ago 2026): muestra **estado, no detalle**. Cuando la
 * profe barre la rejilla no necesita ver el modelo de cada quien — necesita ver
 * quién va bien, quién no ha tocado nada y quién se atoró. El modelo completo
 * se abre al picarle.
 *
 * Es lo que hace que 30 o 40 personas se sigan viendo. Con miniaturas-imagen el
 * techo eran unas 14.
 */
function MiniPizarron({ persona, onClick, sellando = null, resumen = null }) {
    const { nombre, interactuando, manoArriba, insignias = [] } = persona
    // El avance sale de la actividad de verdad, no de un número inventado.
    const avance = resumen?.avance ?? 0
    const necesitaAyuda = !interactuando || manoArriba

    // Con un sello en la mano, TODA la rejilla cambia de significado: deja de
    // ser "ábreme" y pasa a ser "plántamelo". Se marca con el color del sello
    // para que no quede duda de qué va a pasar al picarle.
    const borde = sellando ? sellando.color
                : necesitaAyuda ? 'var(--color-error)'
                : 'var(--border-subtle)'

    return (
        <button
            onClick={onClick}
            title={sellando
                ? `Ponerle ${sellando.nombre} a ${nombre.split(' ')[0]}`
                : `Abrir el pizarrón de ${nombre}`}
            style={{
                display: 'flex', flexDirection: 'column', gap: 4,
                padding: '7px 8px', textAlign: 'left',
                background: sellando ? `${sellando.color}12` : 'var(--bg-surface)',
                border: `1px solid ${borde}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                transition: 'background .12s, border-color .12s',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%' }}>
                <Semaforo activo={interactuando} />
                <span style={{
                    fontSize: 10, color: 'var(--text-secondary)', flex: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                    {nombre.split(' ')[0]}
                </span>
                {resumen?.terminado && <span style={{ fontSize: 10 }} title="Ya terminó">✓</span>}
                {manoArriba && <span style={{ fontSize: 11 }}>✋</span>}
            </div>

            {/* Qué tan avanzada va — una barra basta, un número sería ruido */}
            <div style={{
                height: 4, width: '100%', borderRadius: 2,
                background: 'var(--border-subtle)', overflow: 'hidden',
            }}>
                <div style={{
                    height: '100%', width: `${Math.min(100, Math.max(0, avance))}%`,
                    background: interactuando ? 'var(--color-jade-400)' : 'var(--color-error)',
                }} />
            </div>

            {insignias.length > 0 && (
                <div style={{ display: 'flex', gap: 1, minHeight: 14 }}>
                    {insignias.slice(-4).map((id, i) => {
                        const sello = selloPorId(id)
                        return sello && <Sello key={i} sello={sello} size={14} />
                    })}
                    {insignias.length > 4 && (
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', alignSelf: 'center' }}>
                            +{insignias.length - 4}
                        </span>
                    )}
                </div>
            )}
        </button>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   El chat
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Chat de la clase. **No guarda historial visible** — es para compartir un dato
 * suelto, no para una conversación paralela que compita con la clase.
 *
 * Ocupa el ancho de la ventana de video y empuja lo demás, como pidió Paola.
 */
function Chat({ mensajes, onEnviar, onCerrar }) {
    const [texto, setTexto] = useState('')
    const finRef = useRef(null)

    useEffect(() => { finRef.current?.scrollIntoView({ block: 'nearest' }) }, [mensajes])

    const enviar = (e) => {
        e.preventDefault()
        const t = texto.trim()
        if (!t) return
        onEnviar?.(t)
        setTexto('')
    }

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: 150, flex: 'none',
            background: 'var(--bg-card)', border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px var(--space-3)', borderBottom: '1px solid var(--border-subtle)',
            }}>
                <ChatCircleDots size={14} color="var(--color-jade-400)" />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Chat de la clase</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· no se guarda</span>
                <button onClick={onCerrar} style={{
                    marginLeft: 'auto', display: 'flex', background: 'transparent',
                    border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
                }}><X size={13} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
                {mensajes.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                        Por si necesitas compartir algo con el grupo.
                    </p>
                )}
                {mensajes.map(m => (
                    <p key={m.id} style={{ margin: '0 0 4px', color: 'var(--text-secondary)' }}>
                        <strong style={{ color: 'var(--color-jade-400)' }}>{m.de}: </strong>{m.texto}
                    </p>
                ))}
                <div ref={finRef} />
            </div>

            <form onSubmit={enviar} style={{ display: 'flex', gap: 6, padding: 'var(--space-2) var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
                <input maxLength={LARGO_CHAT}
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    placeholder="Escribe algo…"
                    style={{
                        flex: 1, padding: '6px 10px', background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-full)',
                        color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-xs)', outline: 'none',
                    }}
                />
            </form>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   El aula completa
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Lo que viaja por el canal de datos de LiveKit ──────────────────────────
 *
 *   De la profe (solo se les hace caso si el token dice rol 'profe'):
 *     dar_palabra / silenciar   { para }            — ya existían (T-01)
 *     pizarron   { actividadId, liberado }          — qué se ve y si se puede tocar
 *     sello      { persona|null, sello }            — null = a todo el grupo
 *     sellos     { porPersona: { id: [sellos] } }   — al que llega, para ponerlo al día
 *     tu_estado  { actividadId, estado }            — su avance de vuelta (si recargó,
 *                                                     o si la profe trabajó en su pizarrón)
 *   De cualquiera:
 *     mano       { arriba }
 *     reaccion   { reaccion }
 *     chat       { texto }
 *     avance     { actividadId, estado }            — de alumno a profe(s), para la rejilla
 *
 * Nada de esto pasa por la API de Destello ni se guarda en la base: vive lo
 * que dura la clase. El nombre de quien manda SIEMPRE se toma de LiveKit (lo
 * firmó el servidor), nunca de lo que diga el mensaje.
 */
const LARGO_CHAT = 500
const MAX_MENSAJES_CHAT = 200

export default function Aula({ sesion }) {
    const [chatAbierto, setChatAbierto] = useState(false)
    const [chat, setChat] = useState([])          // { id, de, texto, mio }
    const [chatNuevos, setChatNuevos] = useState(0)

    // ── La conexión real de video (T-01) ──────────────────────────────────
    //
    // `sesion.video` ya viene armado por `PageAula.jsx` (el token, no se pide
    // aquí — ver la regla del contrato). Si viene `null` (sin servidor
    // configurado, o sin acceso) el hook no conecta nada y todo sigue como
    // antes: "Sin video todavía".
    const video = useVideoAula(sesion.video, {
        alRecibir: (m, de) => recibir(m, de),
        alLlegar:  (identity, rol) => ponerAlDia(identity, rol),
    })
    const esProfe = sesion.rol === 'profe'

    // ── El estado vivo de la clase ────────────────────────────────────────
    //
    // Vive aquí y no en cada pieza porque los sellos y los micrófonos los
    // cambia la profe desde el pizarrón y se ven en la tira de video: si cada
    // ventana guardara su propia copia, se desincronizarían.
    //
    // `personas` viene de LiveKit (ver el `useEffect` de abajo). Sellos, mano,
    // reacciones, chat, la actividad elegida, el candado y el avance viajan
    // por el canal de datos (ver `recibir` y los tipos de mensaje arriba de
    // este componente) — cada pantalla aplica lo que le llega a su copia.
    const [personas, setPersonas] = useState(sesion.personas)
    const [yo, setYo] = useState(sesion.yo)
    const [actividadId, setActividadId] = useState(sesion.pizarron.actividadId ?? null)
    const [liberado, setLiberado] = useState(sesion.pizarron.liberado ?? false)
    // La misma actividad, pero leída al instante: dos mensajes seguidos (el
    // pizarrón y luego "tu estado") llegan antes de que React vuelva a pintar,
    // y el segundo tiene que compararse contra la actividad que trajo el primero.
    const actividadRef = useRef(actividadId)

    // Memoria de la clase por persona: si alguien se cae y vuelve a entrar,
    // LiveKit la saca y la vuelve a meter a la lista — sin esto perdería sus
    // sellos y su avance. Solo la profe la llena (es quien pone al día).
    const memoria = useRef({ insignias: {}, estados: {} })

    // Quién está de verdad en la sala, según LiveKit. Se conserva el estado
    // social (sellos, mano arriba, avance) de quien ya estaba; a quien llega
    // nuevo se le da uno en blanco, y a quien LiveKit deja de listar se le
    // deja de mostrar — LiveKit es la fuente de verdad de "quién está aquí".
    useEffect(() => {
        setPersonas(actuales => {
            const porId = new Map(actuales.map(p => [p.id, p]))
            return video.remotos
                .filter(r => r.identity !== yo.id)
                .map(r => ({
                    id:                 r.identity,
                    nombre:             r.nombre,
                    avatarUrl:          porId.get(r.identity)?.avatarUrl ?? null,
                    manoArriba:         porId.get(r.identity)?.manoArriba ?? false,
                    reaccion:           porId.get(r.identity)?.reaccion ?? null,
                    silenciadoPorProfe: porId.get(r.identity)?.silenciadoPorProfe ?? false,
                    interactuando:      porId.get(r.identity)?.interactuando ?? false,
                    insignias:          porId.get(r.identity)?.insignias ?? memoria.current.insignias[r.identity] ?? [],
                    estadoActividad:    porId.get(r.identity)?.estadoActividad ?? memoria.current.estados[r.identity] ?? null,
                    rol:                r.rol,
                    // Cámara/micrófono SIEMPRE vienen de LiveKit, nunca se
                    // conserva el valor viejo — es justo el dato que cambió.
                    camara: r.camaraActiva,
                    micro:  r.microActivo,
                }))
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [video.remotos, yo.id])

    // Un mapa id → pista de video, para que la tira de personas y la ventana
    // grande sepan qué pintar sin que cada componente tenga que ir a buscarlo
    // en `video.remotos` por su cuenta.
    const pistasCamara = {
        [yo.id]: video.camaraTrack,
        ...Object.fromEntries(video.remotos.map(r => [r.identity, r.camaraTrack])),
    }

    // El audio de los DEMÁS. Sin dueño visual propio (no hay "ventana" para el
    // sonido) — por eso se renderiza aparte, no dentro de un avatar. El propio
    // audio NUNCA se reproduce local: eso sería oírse a sí misma, puro eco.
    // `identity` como key (no el índice): si alguien se va y otro llega, no
    // queremos que React reuse el <audio> de uno para la pista del otro.
    const pistasMicroRemoto = video.remotos.filter(r => r.microTrack)

    /**
     * Pone un sello (sin repetir el mismo dos veces). `personaId` null = a
     * todo el grupo. Es lo mismo si lo puso yo o si me llegó de la profe.
     */
    const aplicarSello = (personaId, selloId) => {
        const agregar = (p) => {
            if (p.insignias?.includes(selloId)) return p
            const insignias = [...(p.insignias ?? []), selloId]
            memoria.current.insignias[p.id] = insignias
            return { ...p, insignias }
        }
        setPersonas(lista => lista.map(p => personaId == null || p.id === personaId ? agregar(p) : p))
        // "A todos" es a los alumnos: la profe no se sella a sí misma.
        setYo(actual => (personaId == null ? !esProfe : actual.id === personaId) ? agregar(actual) : actual)
    }

    /** Le pone un sello a una persona — y le llega a todas. */
    const sellar = (personaId, selloId) => {
        aplicarSello(personaId, selloId)
        video.enviar({ tipo: 'sello', persona: personaId, sello: selloId })
    }

    /** El mismo sello para todo el grupo. */
    const sellarATodos = (selloId) => {
        aplicarSello(null, selloId)
        video.enviar({ tipo: 'sello', persona: null, sello: selloId })
    }

    /**
     * La profe elige qué se muestra. Se actualiza para ella y para todos —
     * es lo que hace que sea un pizarrón compartido y no una pantalla suelta.
     */
    const elegirActividad = (id) => {
        if (id === actividadId) return
        cambiarActividad(id)
        memoria.current.estados = {}
        video.enviar({ tipo: 'pizarron', actividadId: id, liberado })
    }

    /** El candado: liberado = cada quien trabaja en lo suyo. Viaja a todas. */
    const cambiarLiberado = (valor) => {
        setLiberado(valor)
        video.enviar({ tipo: 'pizarron', actividadId, liberado: valor })
    }

    const cambiarActividad = (id) => {
        actividadRef.current = id
        setActividadId(id)
        // Actividad nueva = hoja en blanco para todas. El estado guardado es de
        // la actividad anterior (su tablero, sus respuestas): si se quedara,
        // una sopa nueva mostraría la sopa vieja y un crucigrama intentaría
        // leer un tablero de sopa. Solo se conserva `ultimoCambio`, que es del
        // semáforo y no de la actividad.
        const limpiar = (p) => ({
            ...p,
            estadoActividad: { pasos: {}, ultimoCambio: p.estadoActividad?.ultimoCambio ?? null },
        })
        setPersonas(lista => lista.map(limpiar))
        setYo(limpiar)
    }

    /**
     * Alguien avanzó en la actividad.
     *
     * Aquí se guarda su estado Y **se recalcula el semáforo**: si su último
     * movimiento fue hace menos de MINUTOS_SIN_TOCAR, está trabajando.
     *
     * Los dos juntos, en la misma función, a propósito: son lo mismo visto de
     * dos maneras, y separarlos es garantizar que un día alguien guarde el
     * avance y se le olvide el semáforo.
     */
    const avanzar = (personaId, estadoNuevo) => {
        aplicarAvance(personaId, estadoNuevo)
        if (personaId === yo.id) {
            // Mi propio avance: a la(s) profe(s), para su rejilla y semáforo.
            if (!esProfe) video.enviar({ tipo: 'avance', actividadId, estado: estadoNuevo }, profesEnSala())
        } else if (esProfe) {
            // La profe movió el pizarrón de una alumna: que ella lo vea también.
            video.enviar({ tipo: 'tu_estado', actividadId, estado: estadoNuevo }, personaId)
        }
    }

    const aplicarAvance = (personaId, estadoNuevo) => {
        const aplicar = (p) => ({ ...p, estadoActividad: estadoNuevo, interactuando: true })
        if (personaId !== yo.id) memoria.current.estados[personaId] = estadoNuevo
        setPersonas(lista => lista.map(p => p.id === personaId ? aplicar(p) : p))
        setYo(a => a.id === personaId ? aplicar(a) : a)
    }

    /** A quién mandarle lo que es solo para la profe. Tokens sin rol: a todos. */
    const profesEnSala = () => video.remotos.filter(r => r.rol !== 'alumno').map(r => r.identity)

    /**
     * El alumno manda una reacción. Se borra sola a los 4 segundos.
     *
     * Que se borre importa: una carita pegada al avatar toda la clase deja de
     * ser una reacción y se vuelve un adorno que la profe aprende a ignorar.
     */
    const reaccionar = (reaccionId) => {
        setYo(a => ({ ...a, reaccion: reaccionId }))
        setTimeout(() => setYo(a => a.reaccion === reaccionId ? { ...a, reaccion: null } : a), 4000)
        video.enviar({ tipo: 'reaccion', reaccion: reaccionId })
    }

    /** Lo mismo, cuando la reacción es de alguien más. */
    const verReaccion = (personaId, reaccionId) => {
        setPersonas(lista => lista.map(p => p.id === personaId ? { ...p, reaccion: reaccionId } : p))
        setTimeout(() => setPersonas(lista => lista.map(p =>
            p.id === personaId && p.reaccion === reaccionId ? { ...p, reaccion: null } : p)), 4000)
    }

    /** Levantar / bajar la mano. */
    const ponerMano = (arriba) => {
        setYo(a => ({ ...a, manoArriba: arriba }))
        video.enviar({ tipo: 'mano', arriba })
    }

    /** Un mensaje al chat de la clase. */
    const enviarChat = (texto) => {
        const t = String(texto).slice(0, LARGO_CHAT)
        agregarAlChat({ de: 'Tú', texto: t, mio: true })
        video.enviar({ tipo: 'chat', texto: t })
    }

    const agregarAlChat = (m) => {
        setChat(lista => [...lista, { ...m, id: `${Date.now()}-${Math.random()}` }].slice(-MAX_MENSAJES_CHAT))
        if (!m.mio && !chatAbierto) setChatNuevos(n => n + 1)
    }

    /**
     * Silenciar a una persona, o devolverle la palabra.
     *
     * ⚠️ LÍMITE QUE NO ES NUESTRO, ES DEL NAVEGADOR ⚠️
     *
     * Silenciar a alguien a distancia **sí se puede**: el servidor le apaga la
     * pista y se acabó. Pero **prenderle el micrófono a distancia NO se puede**,
     * y no es cosa de LiveKit ni de cómo lo programemos: ningún navegador deja
     * que un servidor abra tu micrófono sin que tú lo confirmes. Lo más que se
     * puede hacer es *invitarla* a hablar, y ella acepta.
     *
     * Y está bien que sea así. "Le abro el micro cuando lo crea prudente"
     * suena inocente en un salón, pero en la práctica es encender el audio de
     * la casa de alguien sin avisarle.
     *
     * Así que esto es un interruptor de **permiso**, no de micrófono:
     *   · silenciar   → se le apaga el micro y no lo puede volver a abrir
     *   · dar palabra → recupera el control y ella prende cuando quiera
     *
     * Con la mano levantada el flujo queda natural: levanta la mano, le das la
     * palabra, prende, habla, y se la vuelves a quitar.
     */
    const alternarMicro = (personaId) => {
        const objetivo = personas.find(p => p.id === personaId)
        if (!objetivo) return
        const leDabaLaPalabra = objetivo.silenciadoPorProfe === true

        setPersonas(lista => lista.map(p => {
            if (p.id !== personaId) return p
            return leDabaLaPalabra
                ? { ...p, silenciadoPorProfe: false }              // le das la palabra
                : { ...p, silenciadoPorProfe: true, micro: false } // la silencias
        }))

        // Esto es lo que de verdad viaja a la otra persona — lo de arriba
        // solo actualiza lo que TÚ ves en tu propia pantalla.
        video.enviar({ tipo: leDabaLaPalabra ? 'dar_palabra' : 'silenciar' }, personaId)
    }

    /** El botón "Silenciar a todos": mismo mecanismo, sin destinatario único. */
    const silenciarMicrosATodos = () => {
        setPersonas(lista => lista.map(p => ({ ...p, silenciadoPorProfe: true, micro: false })))
        video.enviar({ tipo: 'silenciar' })
    }

    /**
     * Todo lo que llega por el canal de datos (`useVideoAula.js`), mensaje
     * por mensaje. Lo que manda la profe solo se acepta si el token de quien
     * lo manda dice rol 'profe' — un alumno con las herramientas del
     * navegador abiertas puede mandar lo que quiera, pero no puede cambiar el
     * rol que le firmó el servidor. (Tokens sin rol, de antes de este cambio:
     * se acepta, para no romper lo que ya funcionaba.)
     */
    const recibir = (m, de) => {
        if (!m || typeof m.tipo !== 'string') return
        const deLaProfe = de.rol !== 'alumno'
        if (m.para && m.para !== yo.id) return

        switch (m.tipo) {
            case 'dar_palabra':
                if (!deLaProfe) return
                // Ya tiene la palabra: la mano se baja sola.
                setYo(a => ({ ...a, silenciadoPorProfe: false }))
                if (yo.manoArriba) ponerMano(false)
                return
            case 'silenciar':
                if (!deLaProfe) return
                setYo(a => ({ ...a, silenciadoPorProfe: true }))
                video.apagarMicro()
                return
            case 'pizarron':
                if (!deLaProfe || esProfe) return
                if ((m.actividadId ?? null) !== actividadRef.current) cambiarActividad(m.actividadId ?? null)
                setLiberado(m.liberado === true)
                return
            case 'sello':
                if (!deLaProfe || !selloPorId(m.sello)) return
                aplicarSello(m.persona ?? null, m.sello)
                return
            case 'sellos':
                if (!deLaProfe || esProfe || typeof m.porPersona !== 'object') return
                for (const [id, lista] of Object.entries(m.porPersona ?? {})) {
                    for (const sello of [].concat(lista ?? [])) if (selloPorId(sello)) aplicarSello(id, sello)
                }
                return
            case 'tu_estado':
                if (!deLaProfe || esProfe || m.actividadId !== actividadRef.current || !m.estado) return
                setYo(a => ({ ...a, estadoActividad: m.estado }))
                return
            case 'avance':
                if (!esProfe || m.actividadId !== actividadRef.current || !m.estado || typeof m.estado !== 'object') return
                // La hora la pone quien recibe: el reloj de cada compu es distinto.
                aplicarAvance(de.identity, { ...m.estado, ultimoCambio: Date.now() })
                return
            case 'mano':
                setPersonas(lista => lista.map(p => p.id === de.identity ? { ...p, manoArriba: m.arriba === true } : p))
                return
            case 'reaccion':
                if (!reaccionPorId(m.reaccion)) return
                verReaccion(de.identity, m.reaccion)
                return
            case 'chat': {
                const texto = String(m.texto ?? '').slice(0, LARGO_CHAT).trim()
                if (!texto) return
                const nombre = video.remotos.find(r => r.identity === de.identity)?.nombre ?? 'Alguien'
                agregarAlChat({ de: nombre, texto })
                return
            }
            default:
        }
    }

    /**
     * Alguien acaba de entrar (o volvió tras recargar): se le pone al día con
     * lo que la sala ya sabe y que a él no le tocó oír.
     */
    const ponerAlDia = (identity, rol) => {
        if (esProfe) {
            video.enviar({ tipo: 'pizarron', actividadId, liberado }, identity)
            // De la memoria, no de `personas`: quien recargó todavía no está
            // en la lista en este instante (LiveKit avisa antes de que se pinte).
            const porPersona = Object.fromEntries(
                Object.entries(memoria.current.insignias).filter(([, l]) => l?.length))
            if (Object.keys(porPersona).length) video.enviar({ tipo: 'sellos', porPersona }, identity)
            const suEstado = memoria.current.estados[identity]
            if (suEstado) video.enviar({ tipo: 'tu_estado', actividadId, estado: suEstado }, identity)
        } else {
            if (yo.manoArriba) video.enviar({ tipo: 'mano', arriba: true }, identity)
            // Si la que llega es la profe (o recargó), que vea por dónde voy.
            if (rol !== 'alumno' && yo.estadoActividad?.ultimoCambio) {
                video.enviar({ tipo: 'avance', actividadId, estado: yo.estadoActividad }, identity)
            }
        }
    }

    // ── El semáforo se apaga solo ─────────────────────────────────────────
    //
    // Cada 20 s se revisa quién no ha tocado nada en los últimos
    // MINUTOS_SIN_TOCAR y se pinta de rojo. Si el rojo solo se pusiera al
    // recibir un evento, nunca se pondría: quien se distrajo justamente dejó de
    // mandar eventos. El paso del tiempo tiene que revisarse aparte.
    useEffect(() => {
        const tope = MINUTOS_SIN_TOCAR * 60 * 1000
        const reloj = setInterval(() => {
            const ahora = Date.now()
            const evaluar = (p) => {
                const ultimo = p.estadoActividad?.ultimoCambio
                if (!ultimo) return p
                const activo = ahora - ultimo < tope
                return p.interactuando === activo ? p : { ...p, interactuando: activo }
            }
            setPersonas(lista => lista.map(evaluar))
        }, 20_000)
        return () => clearInterval(reloj)
    }, [])

    const actividad = (sesion.pizarron.materiales ?? []).find(m => m.id === actividadId) ?? null
    const s = {
        ...sesion,
        marca: sesion.marca ?? MARCA_DESTELLO,
        personas,
        // Cámara/micrófono de "yo" salen de LiveKit, no del estado que se usa
        // para sellos/insignias — mismo criterio que `personas` arriba.
        yo: { ...yo, camara: video.camaraActiva, micro: video.microActivo },
        pizarron: { ...sesion.pizarron, actividadId, actividad, liberado },
    }

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            height: '100dvh', background: 'var(--bg-dark)',
        }}>
            <BarraSuperior sesion={s} />

            {/* Audio de los demás — sin marcación visual, un <audio> sin
                `controls` no ocupa espacio. Aparte de la tira/ventana porque
                el sonido no tiene "dueño visual": se oye a todos a la vez. */}
            {pistasMicroRemoto.map(r => <PistaVideo key={r.identity} track={r.microTrack} />)}

            <main style={{
                flex: 1, minHeight: 0, display: 'grid', gap: 'var(--space-3)',
                padding: 'var(--space-3)',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minHeight: 0 }}>
                    <VentanaVideo
                        sesion={s}
                        video={video}
                        pistasCamara={pistasCamara}
                        chatAbierto={chatAbierto}
                        chatNuevos={chatNuevos}
                        onAbrirChat={() => { setChatAbierto(v => !v); setChatNuevos(0) }}
                        onMano={() => ponerMano(!yo.manoArriba)}
                        onMicro={alternarMicro}
                        onReaccionar={reaccionar}
                        onSilenciarATodos={silenciarMicrosATodos}
                    />
                    {/* El chat empuja hacia arriba en lugar de taparlo todo */}
                    {chatAbierto && <Chat mensajes={chat} onEnviar={enviarChat} onCerrar={() => setChatAbierto(false)} />}
                </div>

                <VentanaPizarron
                    sesion={s}
                    onSellar={sellar}
                    onSellarATodos={sellarATodos}
                    onElegirActividad={elegirActividad}
                    onLiberar={cambiarLiberado}
                    onAvanzar={avanzar}
                />
            </main>

            {/* En celular las dos ventanas se apilan y la pantalla hace scroll:
                una al lado de la otra en pantalla chica dejaría las dos
                inservibles.
                ⚠️ PENDIENTE: en celular las ventanas quedan del tamaño de su
                contenido y sobra hueco abajo. Se intentó forzarles altura
                mínima y salió peor (el contenido se descuadraba dentro). El
                celular necesita su propio diseño, no un ajuste: probablemente
                pestañas para alternar entre video y pizarrón, en vez de
                apilarlos. No es urgente — una clase de 4 h con modelos 3D no se
                toma en el teléfono. */}
            <style>{`
                @media (max-width: 860px) {
                    main {
                        grid-template-columns: 1fr !important;
                        overflow-y: auto;
                        align-content: start;
                    }
                }
            `}</style>
        </div>
    )
}
