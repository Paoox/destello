/**
 * Destello API — Firebase Admin SDK
 * Verifica idTokens emitidos por el cliente Firebase.
 * Las credenciales vienen de variables de entorno (nunca hardcodeadas).
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth }                       from 'firebase-admin/auth'

// Inicializar solo una vez (hot reload safe)
if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId:   process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // Las variables de entorno escapan \n como literal — hay que restaurarlos
            privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    })
}

/**
 * Verifica un idToken de Firebase y devuelve el email y nombre del usuario.
 * Lanza error si el token es inválido, expirado o fue revocado.
 *
 * @param {string} idToken
 * @returns {{ uid: string, email: string, nombre: string }}
 */
export async function verifyFirebaseToken(idToken) {
    const decoded = await getAuth().verifyIdToken(idToken)
    return {
        uid:    decoded.uid,
        email:  decoded.email,
        nombre: decoded.name ?? '',
    }
}