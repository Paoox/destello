/**
 * Destello Admin — ProfesoresPanel (T-05)
 *
 * Quién da qué taller. Antes de esto, "profe" era una lista fija de un
 * correo en el frontend (`ADMIN_EMAILS`) — la misma que decide quién ve
 * este panel. Aquí se asigna un profesor real, por taller, verificado por
 * el servidor (`taller_profesores`) — sin tocar código ni redesplegar.
 *
 * Los admins (`ADMIN_EMAILS`) siguen entrando como profe a CUALQUIER aula,
 * sin cambios — esto solo agrega la posibilidad de un profesor real que no
 * sea admin, limitado a los talleres que se le asignen aquí.
 *
 * T-40: si el correo no tiene cuenta, aquí mismo se le da de alta (nombre,
 * apellido, WhatsApp opcional, taller) — la cuenta queda activa y asignada en
 * un solo paso, sin pasar por el bot ni la lista de espera. Entra con Google
 * (su correo) o con su número + código si se capturó el WhatsApp.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { MagnifyingGlass, ChalkboardTeacher, X, CheckCircle, WarningCircle, Bank, Eye, EyeSlash, Copy, CalendarBlank } from '@phosphor-icons/react'
import { estimadoTalleres } from '@utils/estimadoTalleres.js'

const API = (path, token, opts = {}) =>
    fetch(`/api/admin${path}`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        ...opts,
    }).then(async r => {
        const crudo = await r.text()
        let data = null
        try {
            data = crudo ? JSON.parse(crudo) : null
        } catch {
            // No era JSON — casi siempre la API todavía no tiene esta ruta
            // (falta redesplegar) o el túnel/Vercel devolvió su página de
            // error. Sin esto, el panel mostraba el JSON.parse crudo
            // ("Unexpected token '<'...") en vez de decir qué pasó.
            throw new Error('El servidor no respondió con datos válidos — puede que la API no tenga esta función todavía (falta redesplegar).')
        }
        if (!r.ok) throw new Error(data?.message ?? `Error ${r.status}`)
        return data
    })

const sCard = {
    background:   'var(--bg-card)',
    border:       '1px solid var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    padding:      'var(--space-5)',
}

const sInput = {
    width: '100%', padding: 'var(--space-3)',
    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
    outline: 'none', boxSizing: 'border-box',
}

const sLabel = {
    display: 'block', fontSize: 11, color: 'var(--text-muted)',
    marginBottom: 4, fontWeight: 600,
}

const sStatusBox = (color) => ({
    padding: 'var(--space-3)',
    background: color + '12',
    border: `1px solid ${color}44`,
    borderRadius: 'var(--radius-lg)',
    display: 'flex', alignItems: 'center', gap: 10,
})

const sBtnPrimary = (color, disabled) => ({
    padding: 'var(--space-3)', background: color, border: 'none',
    borderRadius: 'var(--radius-lg)', color: '#fff',
    fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer', width: '100%',
    opacity: disabled ? 0.5 : 1, transition: 'opacity 0.15s',
})

/** Foto de la ficha: recorte cuadrado al centro, 400 px, JPEG (~50-120 KB). */
async function fotoCuadrada(archivo, lado = 400) {
    if (!archivo?.type?.startsWith('image/')) throw new Error('Elige una imagen')
    const url = URL.createObjectURL(archivo)
    try {
        const img = await new Promise((ok, mal) => {
            const i = new Image(); i.onload = () => ok(i); i.onerror = () => mal(new Error('No se pudo leer esa imagen')); i.src = url
        })
        const m = Math.min(img.naturalWidth, img.naturalHeight)
        const c = document.createElement('canvas'); c.width = c.height = lado
        c.getContext('2d').drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, lado, lado)
        return c.toDataURL('image/jpeg', 0.85)
    } finally { URL.revokeObjectURL(url) }
}

/**
 * Ficha pública de una profe ("Conoce a tus profes" en Novedades).
 * La llena Paola (decisión 19 nov 2026). Si no sube foto, se usa la de su
 * Perfil.
 */
function FichaEditor({ usuarioId, ficha, adminToken, onGuardada }) {
    const [f, setF] = useState(() => ({
        especialidad: ficha?.especialidad ?? '', semblanza: ficha?.semblanza ?? '',
        aniosExperiencia: ficha?.anios_experiencia ?? '', formacion: ficha?.formacion ?? '',
        publicada: ficha?.ficha_publicada ?? true,
    }))
    const [foto, setFoto]         = useState(undefined)   // undefined = sin cambio · null = quitar
    const [guardando, setGuardando] = useState(false)
    const [msg, setMsg]           = useState(null)
    const input = useRef(null)
    const fotoVista = foto === undefined ? (ficha?.foto ?? ficha?.foto_perfil) : (foto ?? ficha?.foto_perfil)
    const esDePerfil = foto === undefined ? !ficha?.foto && !!ficha?.foto_perfil : foto === null && !!ficha?.foto_perfil

    const guardar = async () => {
        setGuardando(true); setMsg(null)
        try {
            await API(`/profesores/${usuarioId}/ficha`, adminToken, {
                method: 'PUT', body: JSON.stringify({ ...f, ...(foto !== undefined && { foto }) }),
            })
            setMsg({ ok: true, txt: 'Ficha guardada ✓' }); setFoto(undefined); onGuardada?.()
        } catch (e) { setMsg({ ok: false, txt: e.message }) }
        finally { setGuardando(false) }
    }
    const campo = (k) => ({ value: f[k], onChange: e => setF(x => ({ ...x, [k]: e.target.value })) })

    return (
        <div style={{ marginTop: 10, padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-default)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {fotoVista
                    ? <img src={fotoVista} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                    : <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-base)', border: '1px solid var(--border-default)', display: 'grid', placeItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>Sin foto</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async e => {
                        const a = e.target.files?.[0]; e.target.value = ''
                        if (a) try { setFoto(await fotoCuadrada(a)) } catch (err) { setMsg({ ok: false, txt: err.message }) }
                    }} />
                    <button type="button" onClick={() => input.current?.click()} style={{ ...sBtnPrimary('var(--color-jade-500)', false), width: 'auto', padding: '5px 12px', fontSize: 12 }}>
                        {fotoVista && !esDePerfil ? 'Cambiar foto' : 'Subir foto'}
                    </button>
                    {(ficha?.foto || foto) && (
                        <button type="button" onClick={() => setFoto(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', padding: 0, textAlign: 'left' }}>Quitar foto</button>
                    )}
                    {esDePerfil && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Se usa la foto de su Perfil</span>}
                </div>
            </div>
            <label style={sEtq}>Especialidad
                <input {...campo('especialidad')} maxLength={120} placeholder="Ej. Terapeuta en Medicina Tradicional China" style={sInput} />
            </label>
            <label style={sEtq}>Años de experiencia
                <input {...campo('aniosExperiencia')} type="number" min={0} max={80} style={{ ...sInput, width: 110 }} />
            </label>
            <label style={sEtq}>Semblanza ({String(f.semblanza).length}/600)
                <textarea {...campo('semblanza')} maxLength={600} rows={4} placeholder="Un párrafo sobre ella" style={{ ...sInput, resize: 'vertical' }} />
            </label>
            <label style={sEtq}>Formación / certificaciones (una por línea)
                <textarea {...campo('formacion')} rows={3} placeholder={'Lic. en Fisioterapia\nDiplomado en Auriculoterapia'} style={{ ...sInput, resize: 'vertical' }} />
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={f.publicada} onChange={e => setF(x => ({ ...x, publicada: e.target.checked }))} />
                Mostrarla en "Conoce a tus profes"
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button type="button" onClick={guardar} disabled={guardando} style={{ ...sBtnPrimary('var(--color-jade-500)', guardando), width: 'auto', padding: '6px 16px', fontSize: 12 }}>
                    {guardando ? 'Guardando…' : 'Guardar ficha'}
                </button>
                {msg && <span style={{ fontSize: 12, color: msg.ok ? 'var(--color-jade-500)' : 'var(--color-error)' }}>{msg.txt}</span>}
            </div>
        </div>
    )
}

const sEtq = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-muted)' }

export default function ProfesoresPanel({ adminToken }) {
    // ── Búsqueda de usuario ──────────────────────────────────────────────
    const [emailInput,    setEmailInput]    = useState('')
    const [usuario,       setUsuario]       = useState(null)
    const [usuarioStatus, setUsuarioStatus] = useState('idle') // idle|searching|found|not_found
    const [searchError,   setSearchError]   = useState(null)
    const debounceRef = useRef(null)

    // ── Formulario de asignación ─────────────────────────────────────────
    const [tallerId, setTallerId] = useState('')
    const [asignando, setAsignando] = useState(false)
    const [asignarError, setAsignarError] = useState(null)

    // ── Alta de un profesor sin cuenta (T-40) ────────────────────────────
    const [alta, setAlta]           = useState({ nombre: '', apellido: '', whatsapp: '' })
    const [aviso, setAviso]         = useState(null) // texto de éxito tras dar de alta/asignar

    // ── Datos globales ────────────────────────────────────────────────────
    const [talleres, setTalleres]         = useState([])
    const [asignaciones, setAsignaciones] = useState([])
    const [quitando, setQuitando]         = useState(null) // `${tallerId}:${usuarioId}` en curso
    // Sumar otro taller desde la tarjeta de cada profe: { [usuarioId]: tallerId elegido }
    const [extra, setExtra]               = useState({})
    const [sumando, setSumando]           = useState(null)   // usuarioId en curso
    const [errorTarjeta, setErrorTarjeta] = useState({})     // { [usuarioId]: mensaje }

    // Datos de pago (los captura cada profe en su Perfil): { [usuarioId]: datos }
    const [datosPago, setDatosPago] = useState({})
    const [verPago, setVerPago]     = useState({})   // { [usuarioId]: true } = números completos
    const [copiado, setCopiado]     = useState(null)

    // Ficha pública de cada profe (Novedades): { [usuarioId]: ficha }
    const [fichas, setFichas]       = useState({})
    const [verFicha, setVerFicha]   = useState({})   // { [usuarioId]: true } = editor abierto

    const cargarAsignaciones = useCallback(() => {
        API('/profesores', adminToken).then(d => setAsignaciones(d.asignaciones ?? [])).catch(() => {})
        API('/profesores/fichas', adminToken).then(d => setFichas(d.fichas ?? {})).catch(() => {})
        API('/profesores/datos-pago', adminToken)
            .then(d => setDatosPago(Object.fromEntries((d.datosPago ?? []).map(x => [x.usuario_id, x]))))
            .catch(() => {})
    }, [adminToken])

    const copiar = (texto, clave) => {
        navigator.clipboard?.writeText(texto).then(() => {
            setCopiado(clave); setTimeout(() => setCopiado(c => (c === clave ? null : c)), 1500)
        }).catch(() => {})
    }

    useEffect(() => {
        fetch('/api/tallers')
            .then(r => r.json())
            .then(d => setTalleres(d.tallers ?? []))
            .catch(() => {})
        cargarAsignaciones()
    }, [cargarAsignaciones])

    const handleEmailChange = (e) => {
        const val = e.target.value
        setEmailInput(val)
        setUsuario(null)
        setSearchError(null)
        setAviso(null)
        clearTimeout(debounceRef.current)

        if (!val.includes('@')) { setUsuarioStatus('idle'); return }

        setUsuarioStatus('searching')
        debounceRef.current = setTimeout(async () => {
            try {
                const data = await API(`/usuarios/buscar?email=${encodeURIComponent(val)}`, adminToken)
                if (data.usuario) { setUsuario(data.usuario); setUsuarioStatus('found') }
                else { setUsuario(null); setUsuarioStatus('not_found') }
            } catch (err) {
                setUsuarioStatus('idle')
                setSearchError(err.message ?? 'Error al buscar')
            }
        }, 400)
    }

    const asignar = async () => {
        if (!usuario || !tallerId) return
        setAsignando(true)
        setAsignarError(null)
        try {
            await API('/profesores', adminToken, {
                method: 'POST',
                body: JSON.stringify({ usuarioId: usuario.id, tallerId }),
            })
            const taller = talleres.find(t => t.id === tallerId)?.nombre ?? 'el taller'
            setAviso(`${[usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || usuario.email} quedó asignada a ${taller}.`)
            setTallerId('')
            cargarAsignaciones()
        } catch (err) {
            setAsignarError(err.message ?? 'No se pudo asignar')
        } finally {
            setAsignando(false)
        }
    }

    const darDeAlta = async () => {
        if (!alta.nombre.trim() || !tallerId) return
        setAsignando(true)
        setAsignarError(null)
        try {
            const d = await API('/profesores/alta', adminToken, {
                method: 'POST',
                body: JSON.stringify({ email: emailInput, ...alta, tallerId }),
            })
            const nombre = [d.usuario?.nombre, d.usuario?.apellido].filter(Boolean).join(' ')
            const taller = talleres.find(t => t.id === tallerId)?.nombre ?? 'el taller'
            setAviso(`${nombre} ya tiene su cuenta activa y quedó asignada a ${taller}. ` +
                (d.usuario?.whatsapp
                    ? 'Puede entrar con Google (su correo) o con su número y el código de WhatsApp.'
                    : 'Puede entrar con Google usando su correo.'))
            setEmailInput(''); setUsuario(null); setUsuarioStatus('idle')
            setAlta({ nombre: '', apellido: '', whatsapp: '' }); setTallerId('')
            cargarAsignaciones()
        } catch (err) {
            setAsignarError(err.message ?? 'No se pudo dar de alta')
        } finally {
            setAsignando(false)
        }
    }

    const sumarTaller = async (usuarioId) => {
        const tId = extra[usuarioId]
        if (!tId) return
        setSumando(usuarioId)
        setErrorTarjeta(e => ({ ...e, [usuarioId]: null }))
        try {
            await API('/profesores', adminToken, {
                method: 'POST',
                body: JSON.stringify({ usuarioId, tallerId: tId }),
            })
            setExtra(x => ({ ...x, [usuarioId]: '' }))
            cargarAsignaciones()
        } catch (err) {
            setErrorTarjeta(e => ({ ...e, [usuarioId]: err.message ?? 'No se pudo agregar' }))
        } finally {
            setSumando(null)
        }
    }

    const quitar = async (a) => {
        const clave = `${a.taller_id}:${a.usuario_id}`
        setQuitando(clave)
        try {
            await API(`/profesores/${encodeURIComponent(a.taller_id)}/${a.usuario_id}`, adminToken, { method: 'DELETE' })
            setAsignaciones(lista => lista.filter(x => !(x.taller_id === a.taller_id && x.usuario_id === a.usuario_id)))
        } catch {
            // Si falla, se recarga la lista real en vez de dejarla en un estado que no existe.
            cargarAsignaciones()
        } finally {
            setQuitando(null)
        }
    }

    // Agrupado por profesor, para que se lea "quién da qué" de un vistazo
    // en vez de una tabla plana repitiendo el nombre en cada renglón.
    // Un taller lo da UNA profesora (18 nov 2026): los que ya tienen a alguien
    // no se ofrecen en ningún selector hasta que se le quite. La API también
    // lo rechaza (409), esto es para que ni siquiera aparezca la opción.
    const ocupados = new Set(asignaciones.map(a => a.taller_id))
    const talleresLibres = talleres.filter(t => !ocupados.has(t.id))

    const porProfesor = asignaciones.reduce((acc, a) => {
        const key = a.usuario_id
        if (!acc[key]) acc[key] = { usuario_id: a.usuario_id, nombre: a.nombre, apellido: a.apellido, email: a.email, talleres: [] }
        acc[key].talleres.push({ taller_id: a.taller_id, taller_nombre: a.taller_nombre,
                                 fecha_inicio: a.fecha_inicio, fecha_fin: a.fecha_fin, horario: a.horario })
        return acc
    }, {})

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

            {/* ══ ASIGNAR ═══════════════════════════════════════════════════ */}
            <div style={sCard}>
                <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ChalkboardTeacher size={16} /> Asignar un profesor a un taller
                </p>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                    Escribe su correo. Si ya tiene cuenta, solo eliges el taller; si
                    no, aquí mismo le das de alta y su cuenta queda activa al momento.
                    No necesita chispa: dar la clase ya es su acceso.
                </p>

                {aviso && (
                    <div style={{ ...sStatusBox('#16a34a'), marginBottom: 12 }}>
                        <CheckCircle size={18} color="#16a34a" weight="fill" style={{ flexShrink: 0 }} />
                        <p style={{ margin: 0, fontSize: 12 }}>{aviso}</p>
                    </div>
                )}

                <label style={sLabel}>Correo del profesor</label>
                <div style={{ position: 'relative', marginBottom: 10 }}>
                    <input
                        type="email"
                        placeholder="correo@profesora.com"
                        value={emailInput}
                        onChange={handleEmailChange}
                        style={{ ...sInput, paddingLeft: 38 }}
                        autoComplete="off"
                    />
                    <MagnifyingGlass size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                </div>

                {usuarioStatus === 'searching' && <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 10px' }}>Buscando...</p>}
                {searchError && <p style={{ color: 'var(--color-error)', fontSize: 12, margin: '0 0 10px' }}>⚠ {searchError}</p>}

                {usuarioStatus === 'found' && usuario && (
                    <div style={{ ...sStatusBox('#16a34a'), marginBottom: 10 }}>
                        <CheckCircle size={18} color="#16a34a" weight="fill" style={{ flexShrink: 0 }} />
                        <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                                {[usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || 'Sin nombre'}
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{usuario.email}</p>
                        </div>
                    </div>
                )}

                {usuarioStatus === 'not_found' && (
                    <>
                        <div style={{ ...sStatusBox('#d97706'), marginBottom: 12 }}>
                            <WarningCircle size={18} color="#d97706" weight="fill" style={{ flexShrink: 0 }} />
                            <p style={{ margin: 0, fontSize: 12 }}>
                                Ese correo todavía no tiene cuenta. Completa sus datos y se la
                                creamos ya activa.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
                            <div>
                                <label style={sLabel}>Nombre *</label>
                                <input value={alta.nombre} onChange={e => setAlta(a => ({ ...a, nombre: e.target.value }))}
                                    placeholder="Ana" style={sInput} autoComplete="off" />
                            </div>
                            <div>
                                <label style={sLabel}>Apellido</label>
                                <input value={alta.apellido} onChange={e => setAlta(a => ({ ...a, apellido: e.target.value }))}
                                    placeholder="Ruiz García" style={sInput} autoComplete="off" />
                            </div>
                            <div>
                                <label style={sLabel}>WhatsApp (opcional)</label>
                                <input value={alta.whatsapp} onChange={e => setAlta(a => ({ ...a, whatsapp: e.target.value }))}
                                    placeholder="10 dígitos" inputMode="tel" style={sInput} autoComplete="off" />
                            </div>
                        </div>
                        <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--text-muted)' }}>
                            Sin WhatsApp solo podrá entrar con Google; con WhatsApp también por código.
                        </p>
                    </>
                )}

                {(usuario || usuarioStatus === 'not_found') && (
                    <>
                        <label style={sLabel}>Taller que va a dar</label>
                        <select
                            value={tallerId}
                            onChange={e => setTallerId(e.target.value)}
                            style={{ ...sInput, marginBottom: 12 }}
                        >
                            <option value="">{talleresLibres.length ? 'Elige un taller…' : 'Todos los talleres ya tienen profe'}</option>
                            {talleresLibres.map(t => (
                                <option key={t.id} value={t.id}>{t.nombre}</option>
                            ))}
                        </select>
                        <p style={{ margin: '-6px 0 12px', fontSize: 11, color: 'var(--text-muted)' }}>
                            Solo aparecen los talleres sin profe. Para cambiar la de un taller, primero quítala abajo.
                        </p>

                        {asignarError && <p style={{ color: 'var(--color-error)', fontSize: 12, margin: '0 0 10px' }}>⚠ {asignarError}</p>}

                        {usuario ? (
                            <button
                                onClick={asignar}
                                disabled={!tallerId || asignando}
                                style={sBtnPrimary('var(--color-jade-500)', !tallerId || asignando)}
                            >
                                {asignando ? 'Asignando...' : 'Asignar como profesora'}
                            </button>
                        ) : (
                            <button
                                onClick={darDeAlta}
                                disabled={!tallerId || !alta.nombre.trim() || asignando}
                                style={sBtnPrimary('var(--color-jade-500)', !tallerId || !alta.nombre.trim() || asignando)}
                            >
                                {asignando ? 'Dando de alta...' : 'Dar de alta y asignar'}
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* ══ ASIGNACIONES ACTUALES ════════════════════════════════════ */}
            <div style={sCard}>
                <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                    Profesores asignados ({Object.keys(porProfesor).length})
                </p>

                {Object.keys(porProfesor).length === 0 && (
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                        Todavía no hay ningún profesor asignado — hoy solo las cuentas
                        admin entran como profe, a cualquier taller.
                    </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {Object.values(porProfesor).map(p => (
                        <div key={p.usuario_id} style={{
                            padding: 'var(--space-3)', background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)',
                        }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                                {[p.nombre, p.apellido].filter(Boolean).join(' ') || p.email}
                            </p>
                            <p style={{ margin: '2px 0 8px', fontSize: 12, color: 'var(--text-muted)' }}>{p.email}</p>

                            {/* Estimado de carga: talleres que da esta semana y este mes
                                (según las fechas cargadas). Base para sus pagos. */}
                            {(() => {
                                const { semana, mes } = estimadoTalleres(p.talleres)
                                return (
                                    <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}
                                       title="Estimado según las fechas de sus talleres">
                                        <CalendarBlank size={13} />
                                        Esta semana <strong>{semana}</strong> {semana === 1 ? 'taller' : 'talleres'}
                                        {' · '}Este mes <strong>{mes}</strong> {mes === 1 ? 'taller' : 'talleres'}
                                    </p>
                                )
                            })()}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {p.talleres.map(t => {
                                    const clave = `${t.taller_id}:${p.usuario_id}`
                                    return (
                                        <span key={t.taller_id} style={{
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            padding: '3px 4px 3px 10px', borderRadius: 999,
                                            background: 'rgba(13,115,119,0.14)', color: 'var(--color-jade-400)',
                                            fontSize: 11, fontWeight: 600,
                                        }}>
                                            {t.taller_nombre}
                                            <button
                                                onClick={() => quitar({ taller_id: t.taller_id, usuario_id: p.usuario_id })}
                                                disabled={quitando === clave}
                                                title="Quitarla de este taller"
                                                style={{
                                                    display: 'flex', padding: 3, background: 'transparent',
                                                    border: 'none', borderRadius: '50%', color: 'inherit',
                                                    cursor: quitando === clave ? 'wait' : 'pointer',
                                                }}
                                            >
                                                <X size={11} weight="bold" />
                                            </button>
                                        </span>
                                    )
                                })}
                            </div>

                            {/* Datos de pago — los captura ella en su Perfil */}
                            {(() => {
                                const d = datosPago[p.usuario_id]
                                if (!d) {
                                    return (
                                        <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <Bank size={13} /> Sin datos de pago todavía — los agrega ella en su Perfil.
                                        </p>
                                    )
                                }
                                const ver = !!verPago[p.usuario_id]
                                const grupos = (s) => s.replace(/(\d{4})(?=\d)/g, '$1 ')
                                const fila = (etiqueta, valor, oculto) => valor && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                        <span style={{ color: 'var(--text-muted)', minWidth: 52 }}>{etiqueta}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)' }}>{ver ? grupos(valor) : oculto}</span>
                                        {ver && (
                                            <button onClick={() => copiar(valor, `${p.usuario_id}:${etiqueta}`)} title={`Copiar ${etiqueta}`}
                                                    style={{ display: 'flex', padding: 3, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                                {copiado === `${p.usuario_id}:${etiqueta}` ? <CheckCircle size={13} color="var(--color-success)" /> : <Copy size={13} />}
                                            </button>
                                        )}
                                    </div>
                                )
                                return (
                                    <div style={{
                                        marginTop: 10, padding: '8px 10px', borderRadius: 'var(--radius-md)',
                                        border: '1px dashed var(--border-default)', display: 'flex', flexDirection: 'column', gap: 4,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                                            <Bank size={14} /> Datos de pago
                                            <button onClick={() => setVerPago(v => ({ ...v, [p.usuario_id]: !ver }))}
                                                    style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'transparent', border: 'none', color: 'var(--color-jade-400)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-sans)' }}>
                                                {ver ? <><EyeSlash size={13} /> Ocultar</> : <><Eye size={13} /> Mostrar</>}
                                            </button>
                                        </div>
                                        <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)', display: 'inline-block', minWidth: 52 }}>Titular</span> {d.titular}</div>
                                        <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)', display: 'inline-block', minWidth: 52 }}>Banco</span> {d.banco}</div>
                                        {fila('CLABE', d.clabe, `•••• ${d.clabe?.slice(-4)}`)}
                                        {fila('Tarjeta', d.tarjeta, `•••• ${d.tarjeta?.slice(-4)}`)}
                                    </div>
                                )
                            })()}

                            {/* Sumarle otro taller sin volver a buscarla arriba */}
                            {(() => {
                                const libres = talleresLibres
                                if (!libres.length) return null
                                const elegido = extra[p.usuario_id] ?? ''
                                const ocupado = sumando === p.usuario_id
                                return (
                                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                                        <select
                                            value={elegido}
                                            onChange={e => setExtra(x => ({ ...x, [p.usuario_id]: e.target.value }))}
                                            style={{ ...sInput, flex: '1 1 180px', width: 'auto', padding: '6px 10px', fontSize: 12 }}
                                        >
                                            <option value="">Agregar otro taller…</option>
                                            {libres.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                        </select>
                                        <button
                                            onClick={() => sumarTaller(p.usuario_id)}
                                            disabled={!elegido || ocupado}
                                            style={{
                                                ...sBtnPrimary('var(--color-jade-500)', !elegido || ocupado),
                                                width: 'auto', padding: '6px 14px', fontSize: 12,
                                            }}
                                        >
                                            {ocupado ? 'Agregando…' : '+ Agregar'}
                                        </button>
                                    </div>
                                )
                            })()}
                            {errorTarjeta[p.usuario_id] && (
                                <p style={{ color: 'var(--color-error)', fontSize: 12, margin: '6px 0 0' }}>⚠ {errorTarjeta[p.usuario_id]}</p>
                            )}

                            {/* Ficha pública para "Conoce a tus profes" (Novedades) */}
                            <button type="button"
                                onClick={() => setVerFicha(v => ({ ...v, [p.usuario_id]: !v[p.usuario_id] }))}
                                style={{ marginTop: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                         color: 'var(--color-jade-500)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                                {verFicha[p.usuario_id] ? '▾' : '▸'} Ficha pública
                                {fichas[p.usuario_id] && !fichas[p.usuario_id].especialidad && !fichas[p.usuario_id].semblanza
                                    ? <span style={{ color: 'var(--color-amber-500)', fontWeight: 600 }}> · sin llenar</span> : null}
                            </button>
                            {verFicha[p.usuario_id] && (
                                <FichaEditor
                                    key={fichas[p.usuario_id]?.ficha_updated_at ?? 'nueva'}
                                    usuarioId={p.usuario_id}
                                    ficha={fichas[p.usuario_id]}
                                    adminToken={adminToken}
                                    onGuardada={cargarAsignaciones}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
