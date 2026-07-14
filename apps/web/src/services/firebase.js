/**
 * Destello — Firebase Web SDK
 * Solo autenticación con Google via popup.
 * El idToken resultante se manda al backend para emitir el JWT propio.
 */
import { initializeApp }                        from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'

const firebaseConfig = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// Init defensivo: si faltan las VITE_FIREBASE_* (típico en local sin .env),
// no tumbamos toda la página — el login con email sigue funcionando y solo
// el botón de Google queda deshabilitado.
let auth = null
let provider = null

if (firebaseConfig.apiKey) {
    const app = initializeApp(firebaseConfig)
    auth      = getAuth(app)
    provider  = new GoogleAuthProvider()
    // Pedir el email siempre (evita que Google elija automáticamente sin mostrar el selector)
    provider.setCustomParameters({ prompt: 'select_account' })
} else {
    console.warn('[firebase] Faltan las variables VITE_FIREBASE_* — login con Google deshabilitado en este entorno.')
}

/**
 * Abre el popup de Google, autentica al usuario y devuelve el idToken.
 * El idToken se manda a POST /api/auth/social para obtener el JWT de Destello.
 *
 * @returns {{ idToken: string, email: string, nombre: string }}
 * @throws  Si el usuario cierra el popup → err.code === 'auth/popup-closed-by-user'
 */
export async function signInWithGoogle() {
    if (!auth || !provider) {
        throw new Error('Login con Google no disponible: faltan las variables VITE_FIREBASE_* en este entorno.')
    }
    const result  = await signInWithPopup(auth, provider)
    const idToken = await result.user.getIdToken()
    return {
        idToken,
        email:  result.user.email,
        nombre: result.user.displayName ?? '',
    }
}