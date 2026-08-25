/**
 * Destello — PageAula: el adaptador entre Destello y el aula
 *
 * ⚠️ ESTE ARCHIVO ES LA FRONTERA ⚠️
 *
 * El aula (`src/aula/`) es un producto aparte que un día se le va a rentar a
 * otras escuelas, y por eso **no consulta la API de Destello**. Este archivo es
 * el único que sí: pide los datos, arma el objeto `sesion` que describe
 * `aula/contrato.js`, y se lo pasa.
 *
 * Cuando otra escuela monte el aula, escribe su propia versión de ESTE archivo
 * y nada más. Todo lo de `src/aula/` le sirve tal cual.
 *
 * ── Lo que NO se puede perder de aquí ────────────────────────────────────
 *
 * Los **latidos de asistencia**. De ahí sale el certificado: certifica quien
 * asistió, no quien pagó. Ya funcionaban antes de que existiera el aula nueva y
 * siguen funcionando igual — el aula ni se entera de que existen.
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@store/useAuthStore.js'
import { isAdminEmail } from '@/constants.js'
import { ArrowLeft, LockSimple, CircleNotch } from '@phosphor-icons/react'
import Aula from '../aula/Aula.jsx'
import { MARCA_DESTELLO } from '../aula/contrato.js'

function AccesoGate({ estado, navigate }) {
  const verificando = estado === 'checking'
  return (
    <div style={{
      minHeight: '80vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)',
      background: 'transparent', padding: 'var(--space-6)', textAlign: 'center',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {verificando
          ? <CircleNotch size={30} color="var(--color-jade-500)" weight="bold" style={{ animation: 'ds-spin 0.8s linear infinite' }} />
          : <LockSimple size={30} color="var(--color-amber-600)" weight="fill" />}
      </div>
      <style>{`@keyframes ds-spin { to { transform: rotate(360deg); } }`}</style>
      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>
        {verificando ? 'Verificando tu acceso…' : 'Este taller está bloqueado'}
      </h1>
      {!verificando && (
        <>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', maxWidth: 360 }}>
            Necesitas una chispa canjeada para entrar a esta aula. Canjea tu chispa en el inicio para desbloquearla.
          </p>
          <button
            onClick={() => navigate('/home')}
            style={{
              background: 'var(--color-amber-600)', color: '#fff', border: 'none',
              borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-6)',
              fontFamily: 'var(--font-sans)', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Ir al inicio
          </button>
        </>
      )}
    </div>
  )
}

/**
 * Cuántos minutos faltan para que acabe la clase.
 *
 * Sale de `hora_fin` del taller. Si no está puesta, devuelve null y la barra
 * simplemente no muestra contador — mejor que inventar una hora.
 */
function minutosRestantes(taller) {
  const fin = taller?.hora_fin
  if (!fin) return null
  const [h, m] = String(fin).split(':').map(Number)
  if (Number.isNaN(h)) return null
  const ahora = new Date()
  const cierre = new Date(ahora)
  cierre.setHours(h, m || 0, 0, 0)
  const min = Math.round((cierre - ahora) / 60000)
  return min > 0 ? min : 0
}

// ── Página principal ───────────────────────────────────────
export default function PageAula() {
  const { id } = useParams()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const user  = useAuthStore((s) => s.user)

  // Control de acceso: solo entra quien tiene chispa canjeada para este taller.
  const [acceso, setAcceso] = useState('checking') // checking | allowed | denied
  const [taller, setTaller] = useState(null)

  useEffect(() => {
    if (!token) { setAcceso('denied'); return }
    fetch('/api/users/me/talleres', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        const suyo = (res?.talleres || []).find((t) => t.tallerId === id)
        setTaller(suyo ?? null)
        setAcceso(suyo ? 'allowed' : 'denied')
      })
      .catch(() => setAcceso('denied'))
  }, [token, id])

  // ── Asistencia real ────────────────────────────────────────────────────
  // De esto sale el certificado: certifica quien asistió, no quien pagó.
  //
  // Se manda una entrada al abrir el aula y un latido cada pocos minutos
  // mientras siga abierta. NO se manda un evento de "salir": nadie cierra
  // sesión — cierran la pestaña, se les acaba la pila, se les cae el internet.
  // Con latidos, lo que ya se contó ya se contó, y si la persona desaparece
  // simplemente deja de sumar.
  //
  // El servidor decide cada cuánto latir (`cadaMinutos`) y vuelve a comprobar
  // el acceso en cada llamada: el gate de arriba es comodidad, no seguridad.
  useEffect(() => {
    if (acceso !== 'allowed' || !token || !id) return
    let vivo  = true
    let timer = null

    const latir = async (entrada = false) => {
      try {
        const res  = await fetch(`/api/users/me/aula/${encodeURIComponent(id)}/presencia`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ entrada }),
        })
        if (!vivo) return
        const json = await res.json().catch(() => ({}))
        const cada = Number(json?.cadaMinutos) || 2
        timer = setTimeout(() => latir(false), cada * 60_000)
      } catch {
        // Un fallo aquí no debe estorbarle la clase a nadie: se reintenta en
        // silencio, y si aun así no queda, Paola puede agregar la asistencia
        // a mano desde el panel.
        if (vivo) timer = setTimeout(() => latir(false), 120_000)
      }
    }

    latir(true)
    return () => { vivo = false; if (timer) clearTimeout(timer) }
  }, [acceso, token, id])

  if (acceso !== 'allowed') {
    return <AccesoGate estado={acceso} navigate={navigate} />
  }

  // ── Se arma la sesión que el aula va a recibir ─────────────────────────
  //
  // Quién es profe: por ahora, quien sea admin. Es un atajo consciente —
  // todavía no existe una tabla de profesores (hace falta también para el
  // nombre en los diplomas). Cuando exista, se cambia esta línea y nada más.
  const esProfe = isAdminEmail(user?.email)

  const sesion = {
    marca: MARCA_DESTELLO,
    taller: {
      nombre:     taller?.nombre ?? 'Tu taller',
      instructor: taller?.instructor ?? 'Destello',
      tema:       null,
      terminaEn:  minutosRestantes(taller),
    },
    rol: esProfe ? 'profe' : 'alumno',
    yo: {
      id:       user?.id ? String(user.id) : 'yo',
      nombre:   [user?.nombre, user?.apellido].filter(Boolean).join(' ') || user?.email || 'Tú',
      avatarUrl: null,
      camara: false,
      micro:  false,
      // Todos entran silenciados. Ver ENTRAN_SILENCIADOS en aula/contrato.js.
      silenciadoPorProfe: !esProfe,
      manoArriba: false,
      reaccion: null,
      interactuando: true,
      insignias: [],
      estadoActividad: null,
    },
    // ⚠️ Vacío a propósito: las demás personas de la clase salen del servidor
    // de video, que todavía no está conectado. Hasta entonces, cada quien se ve
    // a sí mismo. Es preferible a inventar compañeros que no existen.
    personas: [],
    pizarron: {
      // Igual: el material de la clase va a venir de la plantilla del taller.
      materiales:  [],
      actividadId: null,
      liberado:    false,
    },
  }

  return (
    <div style={{ position: 'relative' }}>
      <Aula sesion={sesion} />

      {/* Salir. Va encima porque el aula ocupa la pantalla completa y no
          conoce las rutas de Destello — ni tiene por qué. */}
      <button
        onClick={() => navigate('/home')}
        title="Salir del aula"
        style={{
          position: 'fixed', bottom: 14, left: 14, zIndex: 50,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-full)',
          color: 'var(--text-muted)', cursor: 'pointer',
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
        }}
      >
        <ArrowLeft size={14} /> Salir
      </button>
    </div>
  )
}
