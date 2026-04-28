/**
 * Destello API — Firebase Admin SDK (lazy init)
 */
import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getAuth }                       from 'firebase-admin/auth'

function ensureApp() {
    if (getApps().length) return
    initializeApp({
        credential: cert({
            projectId:   process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    })
}

export async function verifyFirebaseToken(idToken) {
    ensureApp()
    const decoded = await getAuth().verifyIdToken(idToken)
    return {
        uid:    decoded.uid,
        email:  decoded.email,
        nombre: decoded.name ?? '',
    }
}