/**
 * Destello — El aula: conexión real de video (T-01)
 *
 * Envuelve LiveKit para que el resto de `src/aula/` no tenga que saber nada
 * de `Room`, eventos ni pistas — solo pide "prende mi cámara" o "quién está
 * en la sala" y le basta.
 *
 * ⚠️ Este hook NUNCA pide el token por su cuenta: lo recibe ya armado
 * (`sesion.video`, ver `contrato.js`). Pedirlo aquí sería una llamada directa
 * a la API de Destello, exactamente lo que el aula tiene prohibido — ver el
 * encabezado de `aula/contrato.js`.
 *
 * Si `video` es `null` (no hay servidor configurado, o el usuario no tiene
 * acceso) el hook no intenta conectar nada y devuelve el estado "apagado":
 * el aula sigue funcionando igual que antes de que existiera LiveKit.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { Room, RoomEvent, Track } from 'livekit-client'

/**
 * El rol que el SERVIDOR le puso a esta persona en su token (`metadata`, ver
 * `apps/api/src/services/videoService.js`). Una persona no puede cambiar su
 * propia metadata (LiveKit no lo permite sin un permiso que no damos), así que
 * esto sí sirve para decidir a quién hacerle caso — a diferencia de algo que
 * cada quien anuncie de sí misma por el canal de datos.
 *
 * `null` si el token no trae rol (tokens de antes de que existiera).
 */
function rolDe(p) {
    try {
        const rol = JSON.parse(p?.metadata || '{}').rol
        return rol === 'profe' || rol === 'alumno' ? rol : null
    } catch {
        return null
    }
}

/** Lee de un `Participant` (local o remoto) lo que el aula necesita mostrar. */
function leerParticipante(p) {
    return {
        identity:     p.identity,
        nombre:       p.name || p.identity,
        rol:          rolDe(p),
        camaraTrack:  p.getTrackPublication(Track.Source.Camera)?.videoTrack ?? null,
        microTrack:   p.getTrackPublication(Track.Source.Microphone)?.audioTrack ?? null,
        camaraActiva: p.isCameraEnabled,
        microActivo:  p.isMicrophoneEnabled,
    }
}

const CODIFICADOR = new TextEncoder()
const DECODIFICADOR = new TextDecoder()

/**
 * @param video       `sesion.video` — `{ serverUrl, token }` o `null`
 * @param alRecibir   `(mensaje, de: { identity, rol }) => void` — CADA mensaje
 *                    del canal de datos, uno por uno (ver abajo por qué no es
 *                    un estado).
 * @param alLlegar    `(identity, rol) => void` — alguien entró a la sala; es el
 *                    momento de ponerle al día (qué actividad va, sus sellos…).
 */
export function useVideoAula(video, { alRecibir, alLlegar } = {}) {
    const roomRef = useRef(null)
    // Los callbacks por ref: el aula los vuelve a crear en cada render, y no
    // queremos reconectar la sala por eso.
    const oyentes = useRef({ alRecibir, alLlegar })
    oyentes.current = { alRecibir, alLlegar }
    const [conectado, setConectado] = useState(false)
    const [yo, setYo] = useState({ camaraActiva: false, microActivo: false, camaraTrack: null })
    const [remotos, setRemotos] = useState([]) // Participante[]

    useEffect(() => {
        if (!video?.serverUrl || !video?.token) return

        const room = new Room()
        roomRef.current = room
        let vivo = true

        const refrescarRemotos = () => {
            if (!vivo) return
            setRemotos([...room.remoteParticipants.values()].map(leerParticipante))
        }
        const refrescarYo = () => {
            if (!vivo) return
            const p = leerParticipante(room.localParticipant)
            setYo({ camaraActiva: p.camaraActiva, microActivo: p.microActivo, camaraTrack: p.camaraTrack })
        }

        // `TrackMuted`/`TrackUnmuted` disparan para AMBOS — el propio y los
        // remotos (así lo documenta LiveKit) — por eso refrescan los dos acá.
        // Es el evento que de verdad importa: `setMicrophoneEnabled(false)`
        // normalmente no despublica la pista, solo la silencia — sin este
        // listener, `LocalTrackPublished`/`Unpublished` (que solo disparan la
        // primera vez que se publica algo) nunca se vuelven a disparar, y el
        // estado de encendido/apagado se queda pegado en el primer valor que
        // se alcanzó a capturar.
        const refrescarTodo = () => { refrescarYo(); refrescarRemotos() }

        room
            .on(RoomEvent.ParticipantConnected, (p) => {
                refrescarRemotos()
                oyentes.current.alLlegar?.(p.identity, rolDe(p))
            })
            .on(RoomEvent.ParticipantMetadataChanged, refrescarRemotos)
            .on(RoomEvent.ParticipantDisconnected, refrescarRemotos)
            .on(RoomEvent.TrackSubscribed, refrescarRemotos)
            .on(RoomEvent.TrackUnsubscribed, refrescarRemotos)
            .on(RoomEvent.TrackMuted, refrescarTodo)
            .on(RoomEvent.TrackUnmuted, refrescarTodo)
            .on(RoomEvent.LocalTrackPublished, refrescarYo)
            .on(RoomEvent.LocalTrackUnpublished, refrescarYo)
            .on(RoomEvent.Disconnected, () => { if (vivo) setConectado(false) })
            // Todo lo que no es audio/video (dar la palabra, sellos, mano,
            // chat, avance…) va por el canal de datos de LiveKit, no por la
            // API de Destello: mensajería directa entre navegadores, relevada
            // por el mismo servidor que ya reenvía cámara y micrófono.
            //
            // Se entrega mensaje por mensaje a un callback, NO se guarda en un
            // estado: si llegan dos en el mismo instante (un sello y un chat),
            // React junta los dos `setState` y solo sobreviviría el último.
            .on(RoomEvent.DataReceived, (payload, participante) => {
                if (!vivo || !participante) return
                let mensaje
                try {
                    mensaje = JSON.parse(DECODIFICADOR.decode(payload))
                } catch (err) {
                    console.error('[aula-video] mensaje ilegible:', err.message)
                    return
                }
                oyentes.current.alRecibir?.(mensaje, { identity: participante.identity, rol: rolDe(participante) })
            })

        room.connect(video.serverUrl, video.token)
            .then(() => {
                if (!vivo) return
                setConectado(true)
                refrescarRemotos()
                refrescarYo()
            })
            // Un fallo de conexión (servidor caído, token vencido) no debe
            // tumbar el aula: se queda como si no hubiera video, igual que
            // cuando `sesion.video` viene en `null`.
            .catch((err) => console.error('[aula-video] no se pudo conectar:', err.message))

        return () => {
            vivo = false
            room.disconnect()
            roomRef.current = null
        }
        // El token cambia si PageAula.jsx lo vuelve a pedir (ej. se venció);
        // ahí sí hay que reconectar con el nuevo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [video?.serverUrl, video?.token])

    const toggleMicro = useCallback(async () => {
        const room = roomRef.current
        if (!room) return
        await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled)
    }, [])

    const toggleCamara = useCallback(async () => {
        const room = roomRef.current
        if (!room) return
        await room.localParticipant.setCameraEnabled(!room.localParticipant.isCameraEnabled)
    }, [])

    /**
     * Apaga el micrófono de verdad (no solo bloquea el botón). Se usa cuando
     * llega un `silenciar` por el canal de datos — la profe silencia desde
     * SU pantalla, pero quien de verdad corta la pista es siempre el propio
     * navegador de la persona, nunca uno ajeno.
     */
    const apagarMicro = useCallback(async () => {
        const room = roomRef.current
        if (!room?.localParticipant.isMicrophoneEnabled) return
        await room.localParticipant.setMicrophoneEnabled(false)
    }, [])

    /**
     * Manda un mensaje por el canal de datos de LiveKit.
     *
     * @param {Object} mensaje  `{ tipo, ... }` — ver los tipos en `Aula.jsx`
     * @param {string|string[]|null} para  `null` = todos en la sala; una
     *   identity o una lista = solo esas personas (LiveKit filtra en el
     *   servidor: a las demás ni les llega).
     */
    const enviar = useCallback((mensaje, para = null) => {
        const room = roomRef.current
        if (!room || room.state !== 'connected') return
        const destinos = para == null ? null : [para].flat()
        if (destinos && !destinos.length) return
        const payload = CODIFICADOR.encode(JSON.stringify({ ...mensaje, para: destinos?.length === 1 ? destinos[0] : null }))
        room.localParticipant.publishData(payload, {
            reliable: true,
            ...(destinos ? { destinationIdentities: destinos } : {}),
        }).catch(err => console.error('[aula-video] no se pudo enviar:', err.message))
    }, [])

    return {
        conectado,
        camaraActiva: yo.camaraActiva,
        microActivo:  yo.microActivo,
        camaraTrack:  yo.camaraTrack,
        remotos,
        toggleMicro,
        toggleCamara,
        apagarMicro,
        enviar,
    }
}
