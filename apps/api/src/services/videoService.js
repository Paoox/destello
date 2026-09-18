/**
 * Destello API — Video del aula (T-01)
 *
 * Genera los tokens de conexión a LiveKit/OpenVidu para el aula en vivo.
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 *
 * El aula (`apps/web/src/aula/`) no puede llamar a ningún servidor de video
 * por su cuenta — ni al de Destello, ni al de LiveKit directo con sus propias
 * llaves, porque entonces cualquiera que abriera el inspector del navegador
 * vería el secreto y podría entrar a cualquier sala. El patrón correcto (el
 * mismo que usa cualquier integración de LiveKit) es que el SERVIDOR firme un
 * token de corta duración, scoped a una sala y una identidad, y se lo entregue
 * al frontend ya listo para conectar — igual que hace `PageAula.jsx` con el
 * resto del contrato (`sesion`).
 *
 * ── La sala ──────────────────────────────────────────────────────────────
 *
 * Una sala por taller (`taller-<id>`), no por sesión de clase — más simple
 * para esta primera integración, y LiveKit no cobra ni reserva nada por una
 * sala vacía. Si más adelante hace falta una sala nueva por cada fecha de
 * clase (para que el historial de una sesión no se mezcle con la siguiente),
 * este es el único lugar que cambia.
 */
import { AccessToken } from 'livekit-server-sdk'

/**
 * Nombre de la sala de LiveKit para un taller. Un solo lugar, para que nadie
 * la arme distinto en otro archivo y terminen buscando salas que no existen.
 *
 * `talleres.id` YA es un slug con su propio prefijo (`taller-auriculoterapia`
 * — ver `CLAUDE.md`), así que aquí se usa `sala-` y no `taller-`: evita el
 * doble prefijo `taller-taller-auriculoterapia`, que se ve como un bug para
 * quien lo lea después aunque funcione igual.
 */
export function nombreSala(tallerId) {
    return `sala-${tallerId}`
}

/**
 * Token de acceso a la sala de un taller.
 *
 * @param {Object} args
 * @param {string} args.tallerId
 * @param {string} args.identity  Id único y estable de la persona (el id de
 *   `usuarios`, como string) — LiveKit lo usa para saber quién es quién si se
 *   reconecta, y es lo que hace que "silenciar a Fulano" siga apuntando a la
 *   persona correcta aunque se le caiga el internet y regrese.
 * @param {string} args.nombre    Nombre a mostrar — viaja como el `name` del
 *   participante, lo lee cualquier cliente de LiveKit sin pedir nada aparte.
 * @returns {Promise<{ token: string, serverUrl: string } | null>}  `null` si
 *   el servidor de video no está configurado — el aula ya sabe mostrar
 *   "Sin video todavía" cuando `sesion.video` es `null`, así que no hace falta
 *   que este servicio invente un error.
 */
export async function crearTokenVideo({ tallerId, identity, nombre }) {
    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return null

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity,
        name: nombre,
        // 4 h: más que cualquier clase real, para que a nadie se le venza el
        // token a media sesión. LiveKit igual vuelve a pedir uno al reconectar
        // (el aula lo hace al recargar la página, vía PageAula.jsx).
        ttl: '4h',
    })
    at.addGrant({
        room:           nombreSala(tallerId),
        roomJoin:       true,
        canPublish:     true,
        canSubscribe:   true,
        canPublishData: true,
    })

    return { token: await at.toJwt(), serverUrl: LIVEKIT_URL }
}
