/**
 * Destello — El aula: una pista de video/audio de LiveKit
 *
 * `attach`/`detach` son los que LiveKit da para enchufar una pista a un
 * elemento del DOM — no hay que armar el `MediaStream` a mano. El `useEffect`
 * es el que evita el bug clásico: si no se llama a `detach()` al desmontar o
 * al cambiar de pista, la cámara/micrófono se queda "prendida" para el
 * navegador aunque en pantalla ya no se vea nada.
 */
import { useEffect, useRef } from 'react'

export default function PistaVideo({ track, ...props }) {
    const ref = useRef(null)

    useEffect(() => {
        const el = ref.current
        if (!track || !el) return
        track.attach(el)
        return () => track.detach(el)
    }, [track])

    if (!track) return null
    return track.kind === 'audio'
        ? <audio ref={ref} autoPlay {...props} />
        : <video ref={ref} autoPlay playsInline muted {...props} />
}
