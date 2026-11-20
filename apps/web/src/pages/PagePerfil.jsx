/**
 * PagePerfil — Perfil del usuario (datos reales, 18 nov 2026)
 *
 * Todo sale de la base (antes era una maqueta con datos inventados):
 *   · nombre, correo y foto        → GET  /users/me
 *   · editar nombre / apellido     → PUT  /users/me
 *   · subir / quitar foto          → PUT  /users/me/foto  (se recorta aquí a 256×256)
 *   · talleres (tomados e impartidos) → GET /users/me/talleres (`esProfe` por taller)
 *   · certificados                 → GET  /users/me/certificados
 *   · talleres sugeridos           → GET  /users/me/sugerencias
 *
 * Si la cuenta da algún taller (tabla `taller_profesores`), arriba aparece
 * "Talleres que impartes": fecha, horario y la entrada al aula de ensayo
 * (`/aula-nueva/:id`, con las actividades, sellos y reacciones del aula) y
 * al aula real.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PencilSimple, Trophy, Star, Fire, CheckCircle, Clock, Certificate, Camera,
  ChalkboardTeacher, Sparkle, CalendarBlank, ArrowRight, Trash, X, Check,
  CircleNotch, Broadcast, Student, Bank,
} from '@phosphor-icons/react'
import { useAuthStore } from '@store/useAuthStore.js'
import { fmtFechaCompleta, fmtFechaCorta } from '@utils/fecha.js'
import { estimadoTalleres } from '@utils/estimadoTalleres.js'

// ── Utilidades ────────────────────────────────────────────

/** Mantiene la sesión guardada al día (Navbar y Home leen `user` de aquí). */
function actualizarUsuarioGuardado(cambios) {
  const actual = useAuthStore.getState().user ?? {}
  const nuevo = { ...actual, ...cambios }
  useAuthStore.setState({ user: nuevo })
  try { sessionStorage.setItem('destello_user', JSON.stringify(nuevo)) } catch { /* sin storage */ }
}

/**
 * Recorta la imagen al centro, cuadrada, a 256×256 y la comprime. Así la foto
 * pesa ~20-60 KB sin importar si subieron una de 12 MB del celular.
 */
async function recortarFoto(archivo) {
  const bitmap = await createImageBitmap(archivo)
  const lado = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  canvas.getContext('2d').drawImage(
    bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado, lado, 0, 0, 256, 256,
  )
  bitmap.close?.()
  const webp = canvas.toDataURL('image/webp', 0.85)
  // Safari no sabe generar webp: devuelve png (pesado). Ahí, jpeg.
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85)
}

/** '17:00:00' → '5:00 PM' */
function fmtHora(hora) {
  if (!hora) return null
  const [h, m] = String(hora).split(':')
  const n = Number(h)
  if (Number.isNaN(n)) return null
  return `${n % 12 === 0 ? 12 : n % 12}:${m ?? '00'} ${n >= 12 ? 'PM' : 'AM'}`
}

/** "Lunes 30 de noviembre de 2026" */
const fechaBonita = (iso) => {
  const f = fmtFechaCompleta(iso)
  return f ? f.charAt(0).toUpperCase() + f.slice(1) : null
}

function horarioDe(t) {
  if (t.horario) return t.horario
  const ini = fmtHora(t.horaInicio), fin = fmtHora(t.horaFin)
  return ini ? (fin ? `${ini} – ${fin}` : ini) : null
}

function iniciales(nombre, apellido, email) {
  const n = [nombre, apellido].filter(Boolean).join(' ').trim() || email || '?'
  return n.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

/** La etiqueta de en qué va el taller. */
function Fase({ taller }) {
  const conf = taller.claseAccesibleHoy
    ? { txt: 'En vivo ahora', color: 'var(--color-success)' }
    : taller.fase === 'proximo'   ? { txt: 'Próximo',    color: 'var(--color-jade-400)' }
    : taller.fase === 'en_curso'  ? { txt: 'En curso',   color: 'var(--color-amber-500)' }
    : taller.fase === 'concluido' ? { txt: 'Concluido',  color: 'var(--text-muted)' }
    : { txt: 'Sin fecha', color: 'var(--text-muted)' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color: conf.color, whiteSpace: 'nowrap',
      border: `1px solid ${conf.color}`, borderRadius: 'var(--radius-full)', padding: '1px 9px',
    }}>{conf.txt}</span>
  )
}

// ── Piezas ────────────────────────────────────────────────

const sTarjeta = {
  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: 'var(--space-6)',
}
const sBoton = (acento = 'var(--color-jade-500)', relleno = false) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px',
  background: relleno ? acento : 'transparent', color: relleno ? '#fff' : acento,
  border: `1px solid ${acento}`, borderRadius: 'var(--radius-lg)',
  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap',
})

function Encabezado({ icon: Icon, titulo, color = 'var(--color-jade-500)', extra }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
      padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)',
    }}>
      <Icon size={20} color={color} weight="fill" />
      <h2 style={{ fontWeight: 600, fontSize: 'var(--text-base)', flex: 1 }}>{titulo}</h2>
      {extra}
    </div>
  )
}

function StatCard({ icon: Icon, valor, label, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)',
      textAlign: 'center',
    }}>
      <Icon size={28} color={color} weight="fill" />
      <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{valor ?? 0}</span>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

function Vacio({ children }) {
  return (
    <p style={{ padding: 'var(--space-5)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
      {children}
    </p>
  )
}

/** Un taller que la persona IMPARTE: fecha, horario y accesos al aula. */
function TallerProfe({ taller, onEnsayo, onAula }) {
  const fecha = fechaBonita(taller.fechaInicio)
  const hasta = taller.fechaFin && String(taller.fechaFin).slice(0, 10) !== String(taller.fechaInicio).slice(0, 10)
    ? fmtFechaCorta(taller.fechaFin) : null
  const horario = horarioDe(taller)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap',
      padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <strong style={{ fontSize: 'var(--text-sm)' }}>{taller.nombre}</strong>
          <Fase taller={taller} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <CalendarBlank size={14} /> {fecha ? `${fecha}${hasta ? ` al ${hasta}` : ''}` : 'Fecha por definir'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Clock size={14} /> {horario ? `${horario} (CDMX)` : 'Horario por definir'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={onEnsayo} style={sBoton('var(--color-amber-500)')}
                title="Practica con las actividades, sellos y reacciones. Nadie más te ve.">
          <ChalkboardTeacher size={15} /> Aula de ensayo
        </button>
        <button onClick={onAula} style={sBoton('var(--color-jade-500)', taller.claseAccesibleHoy)}
                title={taller.claseAccesibleHoy ? 'Tu clase está en vivo' : 'El aula real del taller (cámara y fondo incluidos)'}>
          <Broadcast size={15} /> {taller.claseAccesibleHoy ? 'Entrar a dar clase' : 'Aula real'}
        </button>
      </div>
    </div>
  )
}

/** Un taller que la persona tomó (o va a tomar). */
function TallerAlumna({ taller, certificado, onAula, onCertificado }) {
  const terminado = taller.fase === 'concluido'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap',
      padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)',
    }}>
      {terminado
        ? <CheckCircle size={24} color="var(--color-success)" weight="fill" style={{ flexShrink: 0 }} />
        : <Clock size={24} color="var(--color-jade-500)" style={{ flexShrink: 0 }} />}
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', marginBottom: 4 }}>{taller.nombre}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          <Fase taller={taller} />
          {fmtFechaCorta(taller.fechaInicio) && <span>{fmtFechaCorta(taller.fechaInicio)}</span>}
          {taller.categoria && <span>· {taller.categoria}</span>}
        </div>
      </div>
      {certificado ? (
        <button onClick={onCertificado} style={sBoton('var(--color-amber-500)')}>
          <Certificate size={15} /> Ver certificado
        </button>
      ) : taller.claseAccesibleHoy ? (
        <button onClick={onAula} style={sBoton('var(--color-jade-500)', true)}>
          <Broadcast size={15} /> Entrar a clase
        </button>
      ) : null}
    </div>
  )
}

function TarjetaSugerencia({ taller, onVer }) {
  const precio = Number(taller.precio) > 0 ? `$${Number(taller.precio).toLocaleString('es-MX')} MXN` : 'Gratis'
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {taller.imagen_url
        ? <img src={taller.imagen_url} alt="" style={{ width: '100%', height: 110, objectFit: 'cover' }} />
        : <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,115,119,0.12)' }}>
            <Sparkle size={34} color="var(--color-jade-500)" weight="fill" />
          </div>}
      <div style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {taller.similar && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-amber-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Parecido a lo que tomaste
          </span>
        )}
        <strong style={{ fontSize: 'var(--text-sm)', lineHeight: 1.3 }}>{taller.nombre}</strong>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {[fmtFechaCorta(taller.fecha_inicio) ?? 'Próximamente', taller.categoria, precio].filter(Boolean).join(' · ')}
        </span>
        <button onClick={onVer} style={{ ...sBoton(), marginTop: 'auto', alignSelf: 'flex-start' }}>
          Ver taller <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}

/**
 * Datos de pago de la profe: a dónde le deposita Destello. Se guardan en la
 * base (`profesor_datos_pago`) y Paola los ve en Admin → Profesores. La API
 * valida el dígito de control de la CLABE y de la tarjeta.
 */
const BANCOS = ['BBVA', 'Santander', 'Banorte', 'Banamex', 'HSBC', 'Scotiabank', 'Inbursa',
                'Banco Azteca', 'BanCoppel', 'Banregio', 'Nu', 'Mercado Pago', 'Spin by OXXO', 'Hey Banco']

const agrupar = (v, cada) => String(v ?? '').replace(/\D/g, '').replace(new RegExp(`(\\d{${cada}})(?=\\d)`, 'g'), '$1 ')

function DatosPago({ auth }) {
  const vacio = { titular: '', banco: '', clabe: '', tarjeta: '' }
  const [form, setForm]       = useState(vacio)
  const [guardado, setGuardado] = useState(null)
  const [editando, setEditando] = useState(false)
  const [estado, setEstado]   = useState('cargando') // cargando | listo | guardando
  const [msg, setMsg]         = useState(null)

  useEffect(() => {
    fetch('/api/users/me/datos-pago', { headers: auth })
      .then(r => (r.ok ? r.json() : null))
      .then(res => {
        const d = res?.datosPago ?? null
        setGuardado(d)
        setEditando(!d)
        if (d) setForm({ titular: d.titular, banco: d.banco, clabe: d.clabe ?? '', tarjeta: d.tarjeta ?? '' })
      })
      .finally(() => setEstado('listo'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const guardar = async () => {
    setEstado('guardando'); setMsg(null)
    try {
      const res = await fetch('/api/users/me/datos-pago', {
        method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ ok: false, txt: data.message || 'No se pudo guardar' }); return }
      setGuardado(data.datosPago); setEditando(false)
      setMsg({ ok: true, txt: 'Datos de pago guardados ✓' })
    } catch { setMsg({ ok: false, txt: 'Error de conexión' }) }
    finally { setEstado('listo') }
  }

  const sCampo = {
    width: '100%', padding: '9px 12px', background: 'var(--bg-surface)',
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', boxSizing: 'border-box',
  }
  const sEtiqueta = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }

  return (
    <div style={sTarjeta}>
      <Encabezado icon={Bank} titulo="Mis datos para pagos" extra={
        !editando && guardado && (
          <button onClick={() => setEditando(true)} style={sBoton('var(--text-muted)')}>
            <PencilSimple size={14} /> Editar
          </button>
        )} />
      <div style={{ padding: 'var(--space-5)' }}>
        {estado === 'cargando' ? <CircleNotch size={20} color="var(--color-jade-500)" /> : editando ? (
          <>
            <p style={{ margin: '0 0 14px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              A esta cuenta te depositamos lo de tus talleres. Pon la CLABE, el número de tarjeta o los dos.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <label><span style={sEtiqueta}>Titular de la cuenta</span>
                <input style={sCampo} value={form.titular} placeholder="Como aparece en el banco"
                       onChange={e => setForm(f => ({ ...f, titular: e.target.value }))} /></label>
              <label><span style={sEtiqueta}>Banco</span>
                <input style={sCampo} value={form.banco} list="destello-bancos" placeholder="Ej. BBVA"
                       onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} />
                <datalist id="destello-bancos">{BANCOS.map(b => <option key={b} value={b} />)}</datalist></label>
              <label><span style={sEtiqueta}>CLABE interbancaria (18 dígitos)</span>
                <input style={sCampo} value={agrupar(form.clabe, 4)} inputMode="numeric" placeholder="0000 0000 0000 0000 00"
                       onChange={e => setForm(f => ({ ...f, clabe: e.target.value.replace(/\D/g, '').slice(0, 18) }))} /></label>
              <label><span style={sEtiqueta}>Número de tarjeta (16 dígitos)</span>
                <input style={sCampo} value={agrupar(form.tarjeta, 4)} inputMode="numeric" placeholder="0000 0000 0000 0000"
                       onChange={e => setForm(f => ({ ...f, tarjeta: e.target.value.replace(/\D/g, '').slice(0, 16) }))} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button onClick={guardar} disabled={estado === 'guardando'} style={sBoton('var(--color-jade-500)', true)}>
                <Check size={15} /> {estado === 'guardando' ? 'Guardando…' : 'Guardar'}
              </button>
              {guardado && (
                <button onClick={() => { setEditando(false); setMsg(null)
                                         setForm({ titular: guardado.titular, banco: guardado.banco, clabe: guardado.clabe ?? '', tarjeta: guardado.tarjeta ?? '' }) }}
                        style={sBoton('var(--text-muted)')}><X size={15} /> Cancelar</button>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 'var(--text-sm)' }}>
            {[['Titular', guardado.titular], ['Banco', guardado.banco],
              ['CLABE', guardado.clabe ? agrupar(guardado.clabe, 4) : '—'],
              ['Tarjeta', guardado.tarjeta ? `•••• •••• •••• ${guardado.tarjeta.slice(-4)}` : '—']].map(([k, v]) => (
              <div key={k}><span style={sEtiqueta}>{k}</span><span style={{ fontFamily: k === 'CLABE' || k === 'Tarjeta' ? 'var(--font-mono)' : undefined }}>{v}</span></div>
            ))}
          </div>
        )}
        {msg && <p style={{ margin: '10px 0 0', fontSize: 'var(--text-xs)', color: msg.ok ? 'var(--color-success)' : 'var(--color-error)' }}>{msg.txt}</p>}
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────
export default function PagePerfil() {
  const navigate = useNavigate()
  const token = useAuthStore(s => s.token)
  const auth  = { Authorization: `Bearer ${token}` }

  const [perfil, setPerfil]             = useState(null)
  const [talleres, setTalleres]         = useState([])
  const [certificados, setCertificados] = useState([])
  const [sugerencias, setSugerencias]   = useState([])
  const [cargando, setCargando]         = useState(true)
  const [error, setError]               = useState(null)

  const [editando, setEditando] = useState(false)
  const [form, setForm]         = useState({ nombre: '', apellido: '' })
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [aviso, setAviso]       = useState(null)  // { ok, txt }
  const archivoRef = useRef(null)

  useEffect(() => {
    if (!token) return
    const pedir = (url) => fetch(url, { headers: auth }).then(r => (r.ok ? r.json() : Promise.reject(r)))
    Promise.allSettled([
      pedir('/api/users/me'),
      pedir('/api/users/me/talleres'),
      pedir('/api/users/me/certificados'),
      pedir('/api/users/me/sugerencias'),
    ]).then(([me, tal, cer, sug]) => {
      if (me.status === 'fulfilled') {
        setPerfil(me.value.user)
        setForm({ nombre: me.value.user?.nombre ?? '', apellido: me.value.user?.apellido ?? '' })
      } else setError('No pudimos cargar tu perfil. Intenta recargar la página.')
      if (tal.status === 'fulfilled') setTalleres(tal.value.talleres ?? [])
      if (cer.status === 'fulfilled') setCertificados(cer.value.certificados ?? [])
      if (sug.status === 'fulfilled') setSugerencias(sug.value.sugerencias ?? [])
      setCargando(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const avisar = (ok, txt) => { setAviso({ ok, txt }); setTimeout(() => setAviso(null), 3500) }

  const guardarNombre = async () => {
    if (!form.nombre.trim()) return avisar(false, 'Escribe tu nombre')
    setGuardando(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: form.nombre, apellido: form.apellido }),
      })
      const data = await res.json()
      if (!res.ok) return avisar(false, data.message || 'No se pudo guardar')
      setPerfil(p => ({ ...p, nombre: data.user.nombre, apellido: data.user.apellido }))
      actualizarUsuarioGuardado({ nombre: data.user.nombre, apellido: data.user.apellido })
      setEditando(false)
      avisar(true, 'Nombre actualizado ✓')
    } catch { avisar(false, 'Error de conexión') }
    finally { setGuardando(false) }
  }

  const guardarFoto = async (foto) => {
    setSubiendo(true)
    try {
      const res = await fetch('/api/users/me/foto', {
        method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ foto }),
      })
      const data = await res.json()
      if (!res.ok) return avisar(false, data.message || 'No se pudo guardar la foto')
      setPerfil(p => ({ ...p, foto: data.foto }))
      actualizarUsuarioGuardado({ foto: data.foto })
      avisar(true, foto ? 'Foto actualizada ✓' : 'Foto quitada')
    } catch { avisar(false, 'Error de conexión') }
    finally { setSubiendo(false) }
  }

  const elegirFoto = async (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''   // para poder elegir la misma otra vez
    if (!archivo) return
    if (!archivo.type.startsWith('image/')) return avisar(false, 'Elige una imagen')
    try { await guardarFoto(await recortarFoto(archivo)) }
    catch { avisar(false, 'No pudimos leer esa imagen. Prueba con otra (jpg o png).') }
  }

  if (cargando) {
    return (
      <div style={{ padding: 'var(--space-8)', display: 'flex', justifyContent: 'center' }}>
        <CircleNotch size={32} color="var(--color-jade-500)" style={{ animation: 'ds-giro .8s linear infinite' }} />
        <style>{'@keyframes ds-giro { to { transform: rotate(360deg) } }'}</style>
      </div>
    )
  }
  if (error) return <Vacio>{error}</Vacio>

  const imparte  = talleres.filter(t => t.esProfe)
  const tomados  = talleres.filter(t => !t.esProfe)
  const certDe   = new Map(certificados.map(c => [c.taller_id, c]))
  const nombreCompleto = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || perfil.email

  return (
    <div style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: 860, margin: '0 auto' }}>

      {/* ── Tarjeta de perfil ── */}
      <div style={{
        ...sTarjeta, borderRadius: 'var(--radius-2xl)', padding: 'var(--space-6)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap',
      }}>
        {/* Foto (o iniciales) + botón para cambiarla */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%', overflow: 'hidden',
            background: 'rgba(13,115,119,0.15)', border: '3px solid var(--color-jade-500)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(13,115,119,0.3)',
            fontSize: 32, fontWeight: 700, color: 'var(--color-jade-400)',
          }}>
            {perfil.foto
              ? <img src={perfil.foto} alt="Tu foto" referrerPolicy="no-referrer"
                     style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : iniciales(perfil.nombre, perfil.apellido, perfil.email)}
          </div>
          <button onClick={() => archivoRef.current?.click()} disabled={subiendo}
                  title={perfil.foto ? 'Cambiar foto' : 'Subir foto'}
                  style={{
                    position: 'absolute', right: -2, bottom: -2, width: 34, height: 34, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--color-jade-500)', color: '#fff', border: '3px solid var(--bg-card)',
                    cursor: subiendo ? 'wait' : 'pointer',
                  }}>
            {subiendo ? <CircleNotch size={16} /> : <Camera size={16} weight="fill" />}
          </button>
          <input ref={archivoRef} type="file" accept="image/*" onChange={elegirFoto} style={{ display: 'none' }} />
        </div>

        {/* Nombre, correo y rol */}
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          {editando ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {['nombre', 'apellido'].map(campo => (
                <input key={campo} value={form[campo]} placeholder={campo === 'nombre' ? 'Nombre' : 'Apellidos'}
                       onChange={e => setForm(f => ({ ...f, [campo]: e.target.value }))}
                       onKeyDown={e => e.key === 'Enter' && guardarNombre()}
                       style={{
                         flex: '1 1 140px', padding: '8px 12px', background: 'var(--bg-surface)',
                         border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                         color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                       }} />
              ))}
            </div>
          ) : (
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 4, overflowWrap: 'anywhere' }}>
              {nombreCompleto}
            </h1>
          )}
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 8, overflowWrap: 'anywhere' }}>
            {perfil.email}
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {imparte.length > 0 && (
              <span style={{ ...sBoton('var(--color-amber-500)'), cursor: 'default', padding: '2px 12px', borderRadius: 'var(--radius-full)' }}>
                <ChalkboardTeacher size={13} /> Profe
              </span>
            )}
            {(tomados.length > 0 || imparte.length === 0) && (
              <span style={{ ...sBoton(), cursor: 'default', padding: '2px 12px', borderRadius: 'var(--radius-full)' }}>
                <Student size={13} /> Estudiante
              </span>
            )}
          </div>
          {perfil.foto && (
            <button onClick={() => guardarFoto(null)} disabled={subiendo}
                    style={{ ...sBoton('var(--text-muted)'), border: 'none', padding: '6px 0', marginTop: 6 }}>
              <Trash size={13} /> Quitar foto
            </button>
          )}
        </div>

        {/* Editar nombre */}
        {editando ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={guardarNombre} disabled={guardando} style={sBoton('var(--color-jade-500)', true)}>
              <Check size={15} /> {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => { setEditando(false); setForm({ nombre: perfil.nombre ?? '', apellido: perfil.apellido ?? '' }) }}
                    style={sBoton('var(--text-muted)')}>
              <X size={15} /> Cancelar
            </button>
          </div>
        ) : (
          <button onClick={() => setEditando(true)} style={sBoton('var(--text-muted)')}>
            <PencilSimple size={15} /> Editar nombre
          </button>
        )}
      </div>

      {aviso && (
        <div role="status" style={{
          marginTop: 'calc(var(--space-6) * -0.5)', marginBottom: 'var(--space-6)',
          fontSize: 'var(--text-sm)', color: aviso.ok ? 'var(--color-success)' : 'var(--color-error)',
        }}>{aviso.txt}</div>
      )}

      {/* ── Stats reales ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <StatCard icon={Fire}   valor={perfil.racha}     label="Racha de días"  color="#F59E0B" />
        <StatCard icon={Star}   valor={perfil.estrellas} label="Estrellas"      color="var(--color-jade-500)" />
        <StatCard icon={Trophy} valor={perfil.logros}    label="Sellos ganados" color="#D97706" />
      </div>

      {/* ── Talleres que imparte (solo profes) ── */}
      {imparte.length > 0 && (
        <div style={sTarjeta}>
          <Encabezado icon={ChalkboardTeacher} titulo="Talleres que impartes" color="var(--color-amber-500)" extra={(() => {
            const { semana, mes } = estimadoTalleres(imparte)
            return (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                    title="Estimado según las fechas de tus talleres">
                Esta semana <strong style={{ color: 'var(--text-primary)' }}>{semana}</strong>
                {' · '}Este mes <strong style={{ color: 'var(--text-primary)' }}>{mes}</strong>
              </span>
            )
          })()} />
          {imparte.map(t => (
            <TallerProfe key={t.tallerId} taller={t}
                         onEnsayo={() => navigate(`/aula-nueva/${t.tallerId}`)}
                         onAula={() => navigate(`/aula/${t.tallerId}`)} />
          ))}
          <p style={{ padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            El <strong>aula de ensayo</strong> tiene las actividades, sellos y reacciones para practicar sin que nadie te vea.
            Para probar tu cámara y el fondo de Destello, entra al <strong>aula real</strong>.
          </p>
        </div>
      )}

      {/* ── Datos de pago (solo profes) ── */}
      {imparte.length > 0 && <DatosPago auth={auth} />}

      {/* ── Talleres que ha tomado ── */}
      <div style={sTarjeta}>
        <Encabezado icon={Certificate} titulo="Mis talleres" />
        {tomados.length === 0
          ? <Vacio>Todavía no tienes talleres. ¡Mira abajo cuáles te pueden gustar!</Vacio>
          : tomados.map(t => (
              <TallerAlumna key={t.tallerId} taller={t} certificado={certDe.get(t.tallerId)}
                            onAula={() => navigate(`/aula/${t.tallerId}`)}
                            onCertificado={() => navigate(`/certificado/${certDe.get(t.tallerId).folio}`)} />
            ))}
      </div>

      {/* ── Sugerencias ── */}
      {sugerencias.length > 0 && (
        <div style={sTarjeta}>
          <Encabezado icon={Sparkle} titulo="Te pueden gustar" color="var(--color-amber-500)" />
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 'var(--space-4)', padding: 'var(--space-5)',
          }}>
            {sugerencias.map(t => (
              <TarjetaSugerencia key={t.id} taller={t} onVer={() => navigate('/novedades')} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
