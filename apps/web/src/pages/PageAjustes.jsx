/**
 * PageAjustes — /settings (T-45, 19 nov 2026)
 *
 *   · Apariencia: sistema / claro / oscuro (se guarda en este aparato, utils/tema.js)
 *   · Avisos: WhatsApp y correo (los respeta el revisor de notificaciones, T-44)
 *   · Cuenta: correo fijo; WhatsApp se cambia confirmando con código al número nuevo
 *   · Soporte: WhatsApp, correo, y "Reportar un problema" → panel, tab Reportes
 *   · Dar de baja la cuenta (regla en la migración 022)
 *
 * API: GET /users/me/ajustes · PUT /users/me/avisos · POST /users/me/whatsapp/{codigo,confirmar}
 *      POST /users/me/soporte · GET/POST /users/me/baja
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Gear, Palette, Bell, UserCircle, Lifebuoy, Warning, Monitor, Sun, Moon,
  WhatsappLogo, EnvelopeSimple, PaperPlaneTilt, CircleNotch, Check, Paperclip, X,
} from '@phosphor-icons/react'
import { useAuthStore } from '@store/useAuthStore.js'
import { WA_NUMBER } from '@/constants.js'
import { leerTema, guardarTema } from '@utils/tema.js'
import { achicarImagen } from '@utils/imagen.js'

const CORREO_SOPORTE = 'hola@destello.courses'

/**
 * "¿Qué pasó?" en Soporte. Las llaves deben coincidir con CATEGORIAS_SOPORTE
 * en apps/api/src/services/ajustesService.js. `taller`: pide elegir el taller.
 */
const OPCIONES_SOPORTE = [
  { id: 'acceso_taller',   txt: 'No puedo entrar a mi taller', taller: true,
    pista: '¿Qué ves cuando intentas entrar? Si sale algún mensaje, cópialo aquí.' },
  { id: 'material_30dias', txt: 'Dudas con los 30 días de material', taller: true,
    pista: 'Cuéntanos qué material buscas o qué duda tienes sobre el tiempo de acceso.' },
  { id: 'correo_perdido',  txt: 'Perdí el acceso a mi correo', taller: false,
    pista: 'Escríbenos un correo nuevo donde podamos contactarte y te ayudamos a pasar tu cuenta.' },
  { id: 'notificaciones',  txt: 'No me llegan las notificaciones', taller: false,
    pista: 'Revisa arriba que tus avisos estén prendidos. Dinos cuáles esperabas y no llegaron.' },
  { id: 'pago',            txt: 'Problema con mi pago', taller: true,
    pista: 'Dinos cuándo y cómo pagaste. Si tienes el comprobante, mándalo también por WhatsApp.' },
  { id: 'certificado',     txt: 'Problema con mi certificado', taller: true,
    pista: '¿No te aparece, o algún dato está mal? Cuéntanos qué hay que corregir.' },
  { id: 'clase_en_vivo',   txt: 'Problema con video o audio en clase', taller: true,
    pista: '¿No te veían, no te escuchaban o no veías a la profe? ¿Desde celular o computadora?' },
  { id: 'otro',            txt: 'Otro', taller: true,
    pista: 'Cuéntanos qué pasó.' },
]

/**
 * Clip 📎: adjuntar UNA imagen (captura). `valor` es la data URL ya achicada.
 */
function Clip({ valor, onChange, onError, disabled }) {
  const input = useRef(null)
  const [leyendo, setLeyendo] = useState(false)
  const elegir = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''            // permite volver a elegir la misma
    if (!f) return
    setLeyendo(true)
    try { onChange(await achicarImagen(f)) }
    catch (err) { onError?.(err.message) }
    finally { setLeyendo(false) }
  }
  return (
    <div className="aj-clip">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={elegir} />
      {valor ? (
        <span className="aj-clip-prev">
          <img src={valor} alt="Imagen adjunta" />
          <button type="button" aria-label="Quitar imagen" onClick={() => onChange(null)} disabled={disabled}><X size={12} weight="bold" /></button>
        </span>
      ) : (
        <button type="button" className="aj-clip-btn" onClick={() => input.current?.click()}
          disabled={disabled || leyendo} aria-label="Adjuntar una imagen" title="Adjuntar una captura o imagen">
          {leyendo ? <CircleNotch size={18} className="aj-giro" /> : <Paperclip size={18} />}
        </button>
      )}
    </div>
  )
}

/** Imagen dentro del hilo: miniatura que abre en grande. */
const ImagenHilo = ({ url }) => url ? (
  <a href={url} target="_blank" rel="noreferrer" className="aj-msg-img"><img src={url} alt="Imagen adjunta" loading="lazy" /></a>
) : null

/** Estado de un reporte, como lo ve la persona. */
function estadoReporte(r) {
  if (r.estado === 'resuelto') return { txt: 'Resuelto', clase: 'aj-est--ok' }
  const ultimo = r.mensajes?.[r.mensajes.length - 1]
  if (ultimo && !ultimo.de_persona) return { txt: 'Respondido', clase: 'aj-est--resp' }
  return { txt: 'Recibido', clase: 'aj-est--rec' }
}

const fechaCorta = (iso) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/**
 * "Mis reportes": folio, estado y la conversación con soporte. Puede agregar
 * mensajes; eso reabre el reporte y le avisa a Paola.
 */
function MisReportes({ auth, json, version, foco }) {
  const [lista, setLista]       = useState(null)
  const [abierto, setAbierto]   = useState(foco)
  const [texto, setTexto]       = useState('')
  const [imagen, setImagen]     = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError]       = useState(null)
  const focoRef = useRef(null)

  useEffect(() => {
    fetch('/api/users/me/reportes', { headers: auth })
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setLista(d.reportes ?? []))
      .catch(() => {})
  }, [auth, version])

  // Si llegó desde la notificación, se abre ese reporte y se lleva la vista ahí.
  useEffect(() => { if (foco) setAbierto(foco) }, [foco])
  useEffect(() => {
    if (lista && foco && focoRef.current) focoRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [lista, foco])

  const enviar = async (id) => {
    setEnviando(true); setError(null)
    try {
      const res = await fetch(`/api/users/me/reportes/${id}/mensaje`, { method: 'POST', headers: json, body: JSON.stringify({ texto, imagen }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'No se pudo enviar')
      setLista(l => l.map(r => r.id !== id ? r : { ...r, estado: 'abierto', mensajes: [...r.mensajes, d.mensaje] }))
      setTexto(''); setImagen(null)
    } catch (e) { setError(e.message) }
    finally { setEnviando(false) }
  }

  const cerrar = async (id) => {
    setEnviando(true); setError(null)
    try {
      const res = await fetch(`/api/users/me/reportes/${id}/cerrar`, { method: 'POST', headers: json })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'No se pudo cerrar')
      setLista(l => l.map(r => r.id !== id ? r : { ...r, estado: 'resuelto', cerrado_por_persona: true }))
    } catch (e) { setError(e.message) }
    finally { setEnviando(false) }
  }

  if (!lista?.length) return null

  return (
    <div className="aj-form">
      <span className="aj-etiqueta">Mis reportes</span>
      <ul className="aj-reportes">
        {lista.map(r => {
          const est = estadoReporte(r)
          const esteAbierto = abierto === r.id
          return (
            <li key={r.id} ref={r.id === foco ? focoRef : null} className={esteAbierto ? 'aj-rep--on' : ''}>
              <button type="button" className="aj-rep-cab" aria-expanded={esteAbierto}
                onClick={() => { setAbierto(esteAbierto ? null : r.id); setTexto(''); setImagen(null); setError(null) }}>
                <span className="aj-rep-folio">{r.folio}</span>
                <span className="aj-rep-asunto">{r.asunto ?? 'Reporte'}</span>
                <span className={`aj-est ${est.clase}`}>{est.txt}</span>
              </button>
              {esteAbierto && (
                <div className="aj-rep-hilo">
                  <div className="aj-msg aj-msg--tu">
                    <span className="aj-msg-quien">Tú · {fechaCorta(r.created_at)}</span>
                    {r.detalle || '—'}
                    <ImagenHilo url={r.imagen_url} />
                  </div>
                  {r.mensajes.map(m => (
                    <div key={m.id} className={`aj-msg ${m.de_persona ? 'aj-msg--tu' : 'aj-msg--sop'}`}>
                      <span className="aj-msg-quien">{m.de_persona ? 'Tú' : 'Soporte Destello'} · {fechaCorta(m.created_at)}</span>
                      {m.texto}
                      <ImagenHilo url={m.imagen_url} />
                    </div>
                  ))}
                  {r.estado === 'resuelto' && (
                    <p className="aj-cerrado">
                      <Check size={14} weight="bold" />
                      {r.cerrado_por_persona ? 'Lo diste por resuelto. ¡Gracias!' : 'Marcamos este reporte como resuelto.'}
                    </p>
                  )}
                  <textarea rows={2} maxLength={2000} value={texto} onChange={e => setTexto(e.target.value)}
                    placeholder={r.estado === 'resuelto'
                      ? '¿Algo más? Escríbelo y reabrimos tu reporte.'
                      : '¿Quieres agregar algo? Escríbelo aquí.'} />
                  <div className="aj-acciones">
                    <Clip valor={imagen} onChange={setImagen} onError={setError} disabled={enviando} />
                    {r.estado !== 'resuelto' && r.mensajes.some(m => !m.de_persona) && (
                      <button type="button" className="aj-btn aj-btn--sec" disabled={enviando} onClick={() => cerrar(r.id)}>
                        <Check size={16} weight="bold" /> Ya se resolvió, gracias
                      </button>
                    )}
                    <button type="button" className="aj-btn" disabled={enviando || (texto.trim().length < 2 && !imagen)} onClick={() => enviar(r.id)}>
                      {enviando ? <CircleNotch size={16} className="aj-giro" /> : <PaperPlaneTilt size={16} weight="fill" />}
                      Enviar
                    </button>
                  </div>
                  {error && <p className="aj-error">{error}</p>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Seccion({ icon: Icon, titulo, color = 'var(--color-jade-500)', children }) {
  return (
    <section className="aj-card">
      <h2 className="aj-titulo"><Icon size={20} weight="fill" color={color} />{titulo}</h2>
      <div className="aj-cuerpo">{children}</div>
    </section>
  )
}

function Interruptor({ activo, onChange, etiqueta, ayuda, deshabilitado }) {
  return (
    <label className="aj-fila aj-fila--switch">
      <span>
        <span className="aj-etiqueta">{etiqueta}</span>
        {ayuda && <span className="aj-ayuda">{ayuda}</span>}
      </span>
      <button type="button" role="switch" aria-checked={activo} disabled={deshabilitado}
        className={`aj-switch${activo ? ' aj-switch--on' : ''}`} onClick={() => onChange(!activo)}>
        <span />
      </button>
    </label>
  )
}

export default function PageAjustes() {
  const navigate = useNavigate()
  const token  = useAuthStore(s => s.token)
  const logout = useAuthStore(s => s.logout)
  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])
  const json = useMemo(() => ({ ...auth, 'Content-Type': 'application/json' }), [auth])

  const [datos, setDatos]       = useState(null)
  const [talleres, setTalleres] = useState([])
  const [error, setError]       = useState(null)
  const [aviso, setAviso]       = useState(null)   // { ok, txt }
  const [tema, setTema]         = useState(leerTema())

  const avisar = (ok, txt) => { setAviso({ ok, txt }); setTimeout(() => setAviso(null), 4000) }

  useEffect(() => {
    if (!token) return
    fetch('/api/users/me/ajustes', { headers: auth })
      .then(r => (r.ok ? r.json() : Promise.reject(r)))
      .then(d => setDatos(d.ajustes))
      .catch(() => setError('No pudimos cargar tus ajustes. Intenta recargar la página.'))
    fetch('/api/users/me/talleres', { headers: auth })
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setTalleres((d.talleres ?? []).filter(t => !t.esProfe)))
      .catch(() => {})
  }, [token, auth])

  // ── Apariencia ──
  const elegirTema = (t) => { setTema(t); guardarTema(t) }

  // ── Avisos ──
  const cambiarAviso = async (campo, valor) => {
    setDatos(d => ({ ...d, [campo === 'avisosWhatsapp' ? 'avisos_whatsapp' : 'avisos_correo']: valor }))
    try {
      const res = await fetch('/api/users/me/avisos', { method: 'PUT', headers: json, body: JSON.stringify({ [campo]: valor }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setDatos(x => ({ ...x, ...d.avisos }))
      avisar(true, 'Guardado ✓')
    } catch {
      setDatos(d => ({ ...d, [campo === 'avisosWhatsapp' ? 'avisos_whatsapp' : 'avisos_correo']: !valor }))
      avisar(false, 'No se pudo guardar')
    }
  }

  // ── WhatsApp ──
  const [wa, setWa] = useState({ paso: 'ver', numero: '', codigo: '', cargando: false, error: null })
  const pedirCodigo = async () => {
    setWa(w => ({ ...w, cargando: true, error: null }))
    try {
      const res = await fetch('/api/users/me/whatsapp/codigo', { method: 'POST', headers: json, body: JSON.stringify({ whatsapp: wa.numero }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'No se pudo enviar el código')
      setWa(w => ({ ...w, paso: 'codigo', cargando: false }))
    } catch (e) { setWa(w => ({ ...w, cargando: false, error: e.message })) }
  }
  const confirmarCodigo = async () => {
    setWa(w => ({ ...w, cargando: true, error: null }))
    try {
      const res = await fetch('/api/users/me/whatsapp/confirmar', { method: 'POST', headers: json, body: JSON.stringify({ whatsapp: wa.numero, codigo: wa.codigo }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'No se pudo confirmar')
      setDatos(x => ({ ...x, whatsapp: d.whatsapp }))
      setWa({ paso: 'ver', numero: '', codigo: '', cargando: false, error: null })
      avisar(true, 'Tu WhatsApp quedó actualizado ✓')
    } catch (e) { setWa(w => ({ ...w, cargando: false, error: e.message })) }
  }

  // ── Soporte ──
  const REP_VACIO = { categoria: '', detalle: '', tallerId: '', imagen: null, enviando: false, enviado: false, error: null }
  const [rep, setRep] = useState(REP_VACIO)
  const opcion = OPCIONES_SOPORTE.find(o => o.id === rep.categoria)
  const enviarReporte = async () => {
    setRep(r => ({ ...r, enviando: true, error: null }))
    try {
      const res = await fetch('/api/users/me/soporte', { method: 'POST', headers: json,
        body: JSON.stringify({
          categoria: rep.categoria, detalle: rep.detalle,
          tallerId: opcion?.taller ? (rep.tallerId || null) : null,
          imagen: rep.imagen,
        }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'No se pudo enviar')
      setRep({ ...REP_VACIO, enviado: true, folio: d.folio })
      setVersionReportes(v => v + 1)   // que aparezca en "Mis reportes"
    } catch (e) { setRep(r => ({ ...r, enviando: false, error: e.message })) }
  }
  const [versionReportes, setVersionReportes] = useState(0)
  const [params] = useSearchParams()
  const reporteFoco = Number(params.get('reporte')) || null   // viene de la notificación
  // "Necesito ayuda" es la palabra que el bot Faro reconoce para abrir el
  // flujo de soporte (pregunta qué pasó y levanta el reporte con folio).
  // El correo va para que no tenga que preguntárselo.
  const waSoporte = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    `Necesito ayuda ✦${datos?.email ? ` (${datos.email})` : ''}`)}`

  // ── Baja ──
  const [baja, setBaja] = useState({ abierta: false, previa: null, palabra: '', motivo: '', enviando: false, error: null })
  const abrirBaja = async () => {
    setBaja(b => ({ ...b, abierta: true, error: null }))
    try {
      const res = await fetch('/api/users/me/baja', { headers: auth })
      const d = await res.json()
      if (res.ok) setBaja(b => ({ ...b, previa: d }))
    } catch { /* la confirmación igual se valida en el servidor */ }
  }
  const confirmarBaja = async () => {
    setBaja(b => ({ ...b, enviando: true, error: null }))
    try {
      const res = await fetch('/api/users/me/baja', { method: 'POST', headers: json,
        body: JSON.stringify({ confirmacion: baja.palabra, motivo: baja.motivo }) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'No se pudo completar la baja')
      setBaja(b => ({ ...b, enviando: false, hecha: true }))
    } catch (e) { setBaja(b => ({ ...b, enviando: false, error: e.message })) }
  }
  const salir = () => { logout(); navigate('/login', { replace: true }) }
  // Tras la baja, su acceso ya está cerrado: se muestra el aviso y se sale solo.
  useEffect(() => {
    if (!baja.hecha) return
    const t = setTimeout(salir, 8000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baja.hecha])

  if (baja.hecha) {
    return (
      <div className="aj-pagina"><style>{CSS}</style>
        <section className="aj-card"><div className="aj-cuerpo" style={{ textAlign: 'center', alignItems: 'center' }}>
          <h2 className="aj-titulo" style={{ border: 'none', padding: 0 }}>Tu cuenta quedó dada de baja</h2>
          <p className="aj-ayuda">
            Gracias por haber sido parte de Destello ✦ Si fue un error o cambias de opinión,
            escríbenos a {CORREO_SOPORTE} y la reactivamos.
          </p>
          <button type="button" className="aj-btn" onClick={salir}>Salir</button>
        </div></section>
      </div>
    )
  }

  if (error) return <div className="aj-pagina"><style>{CSS}</style><p className="aj-error">{error}</p></div>
  if (!datos) {
    return (
      <div className="aj-pagina aj-centro"><style>{CSS}</style>
        <CircleNotch size={32} color="var(--color-jade-500)" className="aj-giro" />
      </div>
    )
  }

  return (
    <div className="aj-pagina">
      <style>{CSS}</style>
      <h1 className="aj-h1"><Gear size={26} weight="fill" color="var(--color-jade-500)" />Ajustes</h1>

      {aviso && <div className={`aj-toast${aviso.ok ? '' : ' aj-toast--mal'}`}>{aviso.txt}</div>}

      {/* ── Apariencia ── */}
      <Seccion icon={Palette} titulo="Apariencia">
        <div className="aj-temas" role="radiogroup" aria-label="Tema">
          {[
            { id: 'sistema', txt: 'Como mi equipo', Icon: Monitor },
            { id: 'claro',   txt: 'Claro',          Icon: Sun },
            { id: 'oscuro',  txt: 'Oscuro',         Icon: Moon },
          ].map(({ id, txt, Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={tema === id}
              className={`aj-tema${tema === id ? ' aj-tema--on' : ''}`} onClick={() => elegirTema(id)}>
              <Icon size={22} weight={tema === id ? 'fill' : 'regular'} />{txt}
            </button>
          ))}
        </div>
        <p className="aj-ayuda">Se guarda en este dispositivo.</p>
      </Seccion>

      {/* ── Avisos ── */}
      <Seccion icon={Bell} titulo="Avisos">
        <Interruptor
          etiqueta="Recordatorios por WhatsApp"
          ayuda={datos.whatsapp
            ? 'Un día antes y una hora antes de tu taller.'
            : 'Agrega tu WhatsApp abajo para recibirlos.'}
          activo={!!datos.avisos_whatsapp && !!datos.whatsapp}
          deshabilitado={!datos.whatsapp}
          onChange={v => cambiarAviso('avisosWhatsapp', v)} />
        <Interruptor
          etiqueta="Talleres nuevos por correo"
          ayuda="Te escribimos cuando abrimos un taller."
          activo={!!datos.avisos_correo}
          onChange={v => cambiarAviso('avisosCorreo', v)} />
        <p className="aj-ayuda">En la campanita de la app siempre verás tus avisos.</p>
      </Seccion>

      {/* ── Cuenta ── */}
      <Seccion icon={UserCircle} titulo="Tu cuenta">
        <div className="aj-fila">
          <span>
            <span className="aj-etiqueta">Correo</span>
            <span className="aj-valor">{datos.email}</span>
            <span className="aj-ayuda">Es la llave de tu cuenta; no se puede cambiar.</span>
          </span>
        </div>
        <div className="aj-fila aj-fila--col">
          <span>
            <span className="aj-etiqueta">WhatsApp</span>
            <span className="aj-valor">{datos.whatsapp || 'Sin número'}</span>
          </span>
          {wa.paso === 'ver' && (
            <button type="button" className="aj-btn aj-btn--ghost" onClick={() => setWa(w => ({ ...w, paso: 'numero' }))}>
              {datos.whatsapp ? 'Cambiar número' : 'Agregar número'}
            </button>
          )}
          {wa.paso === 'numero' && (
            <div className="aj-form">
              <label className="aj-etiqueta" htmlFor="aj-wa">Número nuevo (10 dígitos)</label>
              <input id="aj-wa" inputMode="numeric" autoComplete="tel-national" maxLength={14}
                value={wa.numero} onChange={e => setWa(w => ({ ...w, numero: e.target.value }))} placeholder="55 1234 5678" />
              <div className="aj-acciones">
                <button type="button" className="aj-btn aj-btn--ghost" onClick={() => setWa({ paso: 'ver', numero: '', codigo: '', cargando: false, error: null })}>Cancelar</button>
                <button type="button" className="aj-btn" disabled={wa.cargando || wa.numero.replace(/\D/g, '').length < 10} onClick={pedirCodigo}>
                  {wa.cargando ? <CircleNotch size={16} className="aj-giro" /> : <WhatsappLogo size={16} weight="fill" />}
                  Enviar código
                </button>
              </div>
            </div>
          )}
          {wa.paso === 'codigo' && (
            <div className="aj-form">
              <label className="aj-etiqueta" htmlFor="aj-cod">Escribe el código que te llegó por WhatsApp al número nuevo</label>
              <input id="aj-cod" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={wa.codigo} onChange={e => setWa(w => ({ ...w, codigo: e.target.value.replace(/\D/g, '') }))} placeholder="123456" />
              <div className="aj-acciones">
                <button type="button" className="aj-btn aj-btn--ghost" onClick={() => setWa(w => ({ ...w, paso: 'numero', codigo: '' }))}>Cambiar número</button>
                <button type="button" className="aj-btn" disabled={wa.cargando || wa.codigo.length !== 6} onClick={confirmarCodigo}>
                  {wa.cargando ? <CircleNotch size={16} className="aj-giro" /> : <Check size={16} weight="bold" />}
                  Confirmar
                </button>
              </div>
            </div>
          )}
          {wa.error && <p className="aj-error">{wa.error}</p>}
        </div>
      </Seccion>

      {/* ── Soporte ── */}
      <Seccion icon={Lifebuoy} titulo="Soporte">
        <div className="aj-contacto">
          <a className="aj-btn aj-btn--wa" href={waSoporte} target="_blank" rel="noreferrer">
            <WhatsappLogo size={18} weight="fill" />Escríbenos por WhatsApp
          </a>
          <a className="aj-btn aj-btn--ghost" href={`mailto:${CORREO_SOPORTE}?subject=${encodeURIComponent('Ayuda con Destello')}`}>
            <EnvelopeSimple size={18} />{CORREO_SOPORTE}
          </a>
        </div>
        <div className="aj-form">
          <span className="aj-etiqueta">Reportar un problema</span>
          {rep.enviado ? (
            <div className="aj-folio">
              <Check size={18} weight="bold" />
              <span>
                Recibimos tu reporte{rep.folio ? <> — tu folio es <strong>{rep.folio}</strong></> : ''}.
                Te respondemos en tus notificaciones y aquí abajo, en <em>Mis reportes</em>,
                donde también puedes agregar lo que necesites.{' '}
                <button type="button" className="aj-link" onClick={() => setRep(REP_VACIO)}>Enviar otro</button>
              </span>
            </div>
          ) : (
            <>
              <span className="aj-ayuda">¿Qué pasó?</span>
              <div className="aj-opciones" role="radiogroup" aria-label="¿Qué pasó?">
                {OPCIONES_SOPORTE.map(o => (
                  <button key={o.id} type="button" role="radio" aria-checked={rep.categoria === o.id}
                    className={`aj-opcion${rep.categoria === o.id ? ' aj-opcion--on' : ''}`}
                    onClick={() => setRep(r => ({ ...r, categoria: o.id, error: null }))}>
                    {o.txt}
                  </button>
                ))}
              </div>
              {opcion && (
                <>
                  {opcion.taller && talleres.length > 0 && (
                    <select value={rep.tallerId} onChange={e => setRep(r => ({ ...r, tallerId: e.target.value }))} aria-label="¿Con qué taller?">
                      <option value="">¿Con qué taller? (opcional)</option>
                      {talleres.map(t => <option key={t.tallerId} value={t.tallerId}>{t.nombre}</option>)}
                    </select>
                  )}
                  <textarea rows={4} maxLength={2000} placeholder={opcion.pista}
                    value={rep.detalle} onChange={e => setRep(r => ({ ...r, detalle: e.target.value }))} />
                </>
              )}
              <div className="aj-acciones">
                {opcion && (
                  <Clip valor={rep.imagen} disabled={rep.enviando}
                    onChange={img => setRep(r => ({ ...r, imagen: img }))}
                    onError={msg => setRep(r => ({ ...r, error: msg }))} />
                )}
                <button type="button" className="aj-btn" disabled={rep.enviando || !opcion || rep.detalle.trim().length < 5} onClick={enviarReporte}>
                  {rep.enviando ? <CircleNotch size={16} className="aj-giro" /> : <PaperPlaneTilt size={16} weight="fill" />}
                  Enviar reporte
                </button>
              </div>
              {rep.error && <p className="aj-error">{rep.error}</p>}
            </>
          )}
        </div>
        <MisReportes auth={auth} json={json} version={versionReportes} foco={reporteFoco} />
      </Seccion>

      {/* ── Baja ── */}
      <Seccion icon={Warning} titulo="Dar de baja mi cuenta" color="var(--color-amber-600)">
        {!baja.abierta ? (
          <>
            <p className="aj-ayuda">
              Tu acceso se cierra en ese momento. Tus datos personales se borran cuando pasen 6 meses sin talleres;
              mientras tanto, si cambias de opinión, escríbenos y la reactivamos.
            </p>
            <button type="button" className="aj-btn aj-btn--peligro-ghost" onClick={abrirBaja}>Quiero dar de baja mi cuenta</button>
          </>
        ) : baja.previa?.esProfe ? (
          <p className="aj-ayuda">
            Tienes talleres asignados como profesora. Para dar de baja tu cuenta escríbenos por WhatsApp o correo
            y lo vemos juntas.
          </p>
        ) : (
          <div className="aj-form">
            {baja.previa?.talleresPagadosProximos?.length > 0 && (
              <div className="aj-alerta">
                <strong>Tienes talleres pagados que aún no pasan:</strong>
                <ul>{baja.previa.talleresPagadosProximos.map(t => <li key={t.id}>{t.nombre}</li>)}</ul>
                Al darte de baja pierdes el acceso a ellos.
              </div>
            )}
            <label className="aj-etiqueta" htmlFor="aj-motivo">¿Nos cuentas por qué? (opcional)</label>
            <textarea id="aj-motivo" rows={2} maxLength={500} value={baja.motivo}
              onChange={e => setBaja(b => ({ ...b, motivo: e.target.value }))} />
            <label className="aj-etiqueta" htmlFor="aj-palabra">Escribe <strong>ELIMINAR</strong> para confirmar</label>
            <input id="aj-palabra" autoComplete="off" value={baja.palabra}
              onChange={e => setBaja(b => ({ ...b, palabra: e.target.value }))} />
            <div className="aj-acciones">
              <button type="button" className="aj-btn aj-btn--ghost" onClick={() => setBaja({ abierta: false, previa: null, palabra: '', motivo: '', enviando: false, error: null })}>Cancelar</button>
              <button type="button" className="aj-btn aj-btn--peligro"
                disabled={baja.enviando || baja.palabra.trim().toUpperCase() !== 'ELIMINAR'} onClick={confirmarBaja}>
                {baja.enviando && <CircleNotch size={16} className="aj-giro" />}
                Dar de baja
              </button>
            </div>
            {baja.error && <p className="aj-error">{baja.error}</p>}
          </div>
        )}
      </Seccion>
    </div>
  )
}

const CSS = `
.aj-pagina { padding: var(--space-8) var(--space-4); max-width: 720px; margin: 0 auto; }
.aj-centro { display: flex; justify-content: center; }
.aj-h1 { display: flex; align-items: center; gap: 10px; margin: 0 0 var(--space-6); font-size: var(--text-2xl); font-weight: 700; }
.aj-card {
  background: var(--bg-card); border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl); margin-bottom: var(--space-5); overflow: hidden;
}
.aj-titulo {
  display: flex; align-items: center; gap: 8px; margin: 0;
  padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--border-subtle);
  font-size: var(--text-base); font-weight: 600;
}
.aj-cuerpo { padding: var(--space-4) var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); }
.aj-fila { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
.aj-fila > span { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.aj-fila--col { flex-direction: column; align-items: stretch; }
.aj-fila--col > .aj-btn { align-self: flex-start; }
.aj-fila--switch { cursor: pointer; }
.aj-etiqueta { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
.aj-valor { font-size: var(--text-sm); color: var(--text-secondary); word-break: break-all; }
.aj-ayuda { font-size: var(--text-xs); color: var(--text-muted); line-height: 1.5; margin: 0; }
.aj-error { color: var(--color-amber-600); font-size: var(--text-sm); margin: 0; }
.aj-ok { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; color: var(--color-jade-500); font-size: var(--text-sm); margin: 0; }
.aj-link { background: none; border: none; color: var(--color-jade-500); text-decoration: underline; cursor: pointer; font: inherit; padding: 0; }
.aj-switch {
  flex-shrink: 0; width: 46px; height: 26px; border-radius: 13px; border: none; padding: 3px;
  background: var(--border-default); cursor: pointer; transition: background .2s ease;
}
.aj-switch span {
  display: block; width: 20px; height: 20px; border-radius: 50%; background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .2s ease;
}
.aj-switch--on { background: var(--color-jade-500); }
.aj-switch--on span { transform: translateX(20px); }
.aj-switch:disabled { opacity: .5; cursor: default; }
.aj-temas { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
.aj-tema {
  display: flex; flex-direction: column; align-items: center; gap: 6px; padding: var(--space-3);
  border-radius: var(--radius-lg); border: 1px solid var(--border-default); background: var(--bg-surface);
  color: var(--text-muted); font-family: var(--font-sans); font-size: var(--text-sm); cursor: pointer;
}
.aj-tema--on { border-color: var(--color-jade-500); color: var(--color-jade-500); background: rgba(13,115,119,.10); font-weight: 600; }
.aj-form { display: flex; flex-direction: column; gap: var(--space-2); }
.aj-folio {
  display: flex; gap: 8px; align-items: flex-start; padding: var(--space-3);
  border-radius: var(--radius-lg); background: rgba(13,115,119,.10); border: 1px solid rgba(13,115,119,.35);
  color: var(--text-primary); font-size: var(--text-sm); line-height: 1.55;
}
.aj-folio > svg { color: var(--color-jade-500); flex-shrink: 0; margin-top: 2px; }
.aj-reportes { list-style: none; margin: 0; padding: 0; border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); overflow: hidden; }
.aj-reportes li + li { border-top: 1px solid var(--border-subtle); }
.aj-rep-cab {
  width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  background: none; border: none; cursor: pointer; text-align: left; color: inherit; font-family: var(--font-sans);
}
.aj-rep-cab:hover, .aj-rep--on .aj-rep-cab { background: rgba(13,115,119,.06); }
.aj-rep-folio { font-family: monospace; font-size: var(--text-xs); color: var(--text-muted); flex-shrink: 0; }
.aj-rep-asunto { flex: 1; min-width: 0; font-size: var(--text-sm); color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aj-est { flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 1px 9px; border-radius: var(--radius-full); border: 1px solid currentColor; }
.aj-est--rec  { color: var(--text-muted); }
.aj-est--resp { color: var(--color-amber-600); }
.aj-est--ok   { color: var(--color-jade-500); }
.aj-rep-hilo { display: flex; flex-direction: column; gap: 8px; padding: 4px 12px 12px; }
.aj-msg {
  max-width: 88%; padding: 8px 12px; border-radius: 12px; font-size: var(--text-sm); line-height: 1.5;
  white-space: pre-wrap; word-break: break-word;
}
.aj-msg-quien { display: block; font-size: 11px; font-weight: 600; opacity: .75; margin-bottom: 2px; white-space: normal; }
.aj-msg--tu  { align-self: flex-end; background: var(--bg-surface); border: 1px solid var(--border-default); }
.aj-msg--sop { align-self: flex-start; background: rgba(13,115,119,.12); border: 1px solid rgba(13,115,119,.3); }
.aj-btn--sec { background: transparent !important; color: var(--color-jade-500) !important; border: 1px solid var(--color-jade-500) !important; }
.aj-clip { margin-right: auto; display: flex; align-items: center; }
.aj-clip-btn {
  width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%;
  border: 1px solid var(--border-default); background: var(--bg-surface); color: var(--text-secondary); cursor: pointer;
}
.aj-clip-btn:hover:not(:disabled) { color: var(--color-jade-500); border-color: var(--color-jade-500); }
.aj-clip-prev { position: relative; display: inline-block; }
.aj-clip-prev img { width: 52px; height: 52px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-default); display: block; }
.aj-clip-prev button {
  position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%;
  display: grid; place-items: center; border: none; cursor: pointer; background: var(--text-primary); color: var(--bg-base);
}
.aj-msg-img { display: block; margin-top: 6px; }
.aj-msg-img img { max-width: 100%; max-height: 220px; border-radius: 8px; display: block; }
.aj-cerrado { display: flex; align-items: center; gap: 6px; margin: 0; font-size: var(--text-xs); color: var(--color-jade-500); font-weight: 600; }
.aj-opciones { display: flex; flex-wrap: wrap; gap: 6px; }
.aj-opcion {
  padding: 7px 12px; border-radius: var(--radius-full); border: 1px solid var(--border-default);
  background: var(--bg-surface); color: var(--text-secondary); font-family: var(--font-sans);
  font-size: var(--text-xs); cursor: pointer; text-align: left; transition: all .15s ease;
}
.aj-opcion:hover { border-color: var(--color-jade-500); }
.aj-opcion--on { border-color: var(--color-jade-500); background: rgba(13,115,119,.12); color: var(--color-jade-500); font-weight: 600; }
.aj-form input, .aj-form textarea, .aj-form select {
  padding: 10px 12px; border-radius: var(--radius-lg); border: 1px solid var(--border-default);
  background: var(--bg-surface); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm);
  width: 100%; box-sizing: border-box; resize: vertical;
}
.aj-acciones { display: flex; gap: var(--space-2); justify-content: flex-end; flex-wrap: wrap; }
.aj-contacto { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.aj-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 16px;
  border-radius: var(--radius-lg); border: 1px solid var(--color-jade-500); background: var(--color-jade-500);
  color: #fff; font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 600;
  cursor: pointer; text-decoration: none; white-space: nowrap;
}
.aj-btn:disabled { opacity: .5; cursor: default; }
.aj-btn--ghost { background: transparent; color: var(--text-secondary); border-color: var(--border-default); }
.aj-btn--wa { background: #1FA855; border-color: #1FA855; }
.aj-btn--peligro { background: #B33A3A; border-color: #B33A3A; }
.aj-btn--peligro-ghost { background: transparent; color: #B33A3A; border-color: #B33A3A; align-self: flex-start; }
.aj-alerta {
  border: 1px solid var(--color-amber-600); background: rgba(217,119,6,.08); color: var(--text-primary);
  border-radius: var(--radius-lg); padding: var(--space-3); font-size: var(--text-sm);
}
.aj-alerta ul { margin: 6px 0; padding-left: 18px; }
.aj-toast {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 400;
  background: var(--color-jade-500); color: #fff; padding: 10px 18px; border-radius: var(--radius-full);
  font-size: var(--text-sm); font-weight: 600; box-shadow: var(--shadow-md);
}
.aj-toast--mal { background: var(--color-amber-600); }
.aj-giro { animation: aj-giro .8s linear infinite; }
@keyframes aj-giro { to { transform: rotate(360deg) } }
@media (max-width: 480px) {
  .aj-cuerpo, .aj-titulo { padding-left: var(--space-4); padding-right: var(--space-4); }
  .aj-contacto .aj-btn { flex: 1 1 100%; }
  .aj-acciones .aj-btn { flex: 1; }
}
`
