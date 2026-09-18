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

/** Lee de un `Participant` (local o remoto) lo que el aula necesita mostrar. */
function leerParticipante(p) {
    return {
        identity:     p.identity,
        nombre:       p.name || p.identity,
        camaraTrack:  p.getTrackPublication(Track.Source.Camera)?.videoTrack ?? null,
        microTrack:   p.getTrackPublication(Track.Source.Microphone)?.audioTrack ?? null,
        camaraActiva: p.isCameraEnabled,
        microActivo:  p.isMicrophoneEnabled,
    }
}

const CODIFICADOR = new TextEncoder()
const DECODIFICADOR = new TextDecoder()

export function useVideoAula(video) {
    const roomRef = useRef(null)
    const [conectado, setConectado] = useState(false)
    const [yo, setYo] = useState({ camaraActiva: false, microActivo: false, camaraTrack: null })
    const [remotos, setRemotos] = useState([]) // Participante[]
    // Último mensaje de control recibido por el canal de datos de LiveKit
    // (quién puede hablar, silenciar a todos...). Un objeto NUEVO en cada
    // mensaje (nunca el mismo por referencia) para que un `useEffect` que
    // dependa de esto se dispare aunque el contenido se repita.
    const [ultimoControl, setUltimoControl] = useState(null)

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
            .on(RoomEvent.ParticipantConnected, refrescarRemotos)
            .on(RoomEvent.ParticipantDisconnected, refrescarRemotos)
            .on(RoomEvent.TrackSubscribed, refrescarRemotos)
            .on(RoomEvent.TrackUnsubscribed, refrescarRemotos)
            .on(RoomEvent.TrackMuted, refrescarTodo)
            .on(RoomEvent.TrackUnmuted, refrescarTodo)
            .on(RoomEvent.LocalTrackPublished, refrescarYo)
            .on(RoomEvent.LocalTrackUnpublished, refrescarYo)
            .on(RoomEvent.Disconnected, () => { if (vivo) setConectado(false) })
            // Mensajes de control (dar la palabra / silenciar) — van por el
            // canal de datos de LiveKit, no por la API de Destello: es
            // mensajería directa entre navegadores, relevada por el mismo
            // servidor que ya reenvía cámara y micrófono.
            .on(RoomEvent.DataReceived, (payload, participante) => {
                if (!vivo) return
                try {
                    const mensaje = JSON.parse(DECODIFICADOR.decode(payload))
                    setUltimoControl({ ...mensaje, de: participante?.identity ?? null, ts: Date.now() })
                } catch (err) {
                    console.error('[aula-video] mensaje de control ilegible:', err.message)
                }
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
     * Manda un mensaje de control por el canal de datos de LiveKit.
     *
     * @param {'dar_palabra'|'silenciar'} tipo
     * @param {string|null} paraIdentity  `null` = todos en la sala (ej.
     *   "silenciar a todos"); una identity = solo esa persona.
     */
    const enviarControl = useCallback((tipo, paraIdentity = null) => {
        const room = roomRef.current
        if (!room) return
        const payload = CODIFICADOR.encode(JSON.stringify({ tipo, para: paraIdentity }))
        room.localParticipant.publishData(payload, {
            reliable: true,
            ...(paraIdentity ? { destinationIdentities: [paraIdentity] } : {}),
        })
    }, [])

    return {
        conectado,
        camaraActiva: yo.camaraActiva,
        microActivo:  yo.microActivo,
        camaraTrack:  yo.camaraTrack,
        remotos,
        ultimoControl,
        toggleMicro,
        toggleCamara,
        apagarMicro,
        enviarControl,
    }
}
