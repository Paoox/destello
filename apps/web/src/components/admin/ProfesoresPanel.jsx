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
import { MagnifyingGlass, ChalkboardTeacher, X, CheckCircle, WarningCircle } from '@phosphor-icons/react'

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

    const cargarAsignaciones = useCallback(() => {
        API('/profesores', adminToken).then(d => setAsignaciones(d.asignaciones ?? [])).catch(() => {})
    }, [adminToken])

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
    const porProfesor = asignaciones.reduce((acc, a) => {
        const key = a.usuario_id
        if (!acc[key]) acc[key] = { usuario_id: a.usuario_id, nombre: a.nombre, apellido: a.apellido, email: a.email, talleres: [] }
        acc[key].talleres.push({ taller_id: a.taller_id, taller_nombre: a.taller_nombre })
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
                            <option value="">Elige un taller…</option>
                            {talleres
                                .filter(t => !usuario || !asignaciones.some(a => a.usuario_id === usuario.id && a.taller_id === t.id))
                                .map(t => (
                                    <option key={t.id} value={t.id}>{t.nombre}</option>
                                ))}
                        </select>

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

                            {/* Sumarle otro taller sin volver a buscarla arriba */}
                            {(() => {
                                const libres = talleres.filter(t => !p.talleres.some(x => x.taller_id === t.id))
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
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
