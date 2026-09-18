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
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { MagnifyingGlass, ChalkboardTeacher, X, CheckCircle, WarningCircle } from '@phosphor-icons/react'

const API = (path, token, opts = {}) =>
    fetch(`/api/admin${path}`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        ...opts,
    }).then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.message ?? `Error ${r.status}`)
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

    // ── Datos globales ────────────────────────────────────────────────────
    const [talleres, setTalleres]         = useState([])
    const [asignaciones, setAsignaciones] = useState([])
    const [quitando, setQuitando]         = useState(null) // `${tallerId}:${usuarioId}` en curso

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
            setTallerId('')
            cargarAsignaciones()
        } catch (err) {
            setAsignarError(err.message ?? 'No se pudo asignar')
        } finally {
            setAsignando(false)
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
                    La cuenta debe ya existir (nombre, correo, WhatsApp) — busca por
                    correo, igual que en Accesos. No hace falta que tenga chispa del
                    taller: dar la clase ya es su acceso.
                </p>

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
                    <div style={{ ...sStatusBox('#d97706'), marginBottom: 10 }}>
                        <WarningCircle size={18} color="#d97706" weight="fill" style={{ flexShrink: 0 }} />
                        <p style={{ margin: 0, fontSize: 12 }}>
                            No existe ninguna cuenta con ese correo todavía — tiene que
                            registrarse primero (por el bot o con Google) antes de poder
                            asignarla como profesora.
                        </p>
                    </div>
                )}

                {usuario && (
                    <>
                        <label style={sLabel}>Taller que va a dar</label>
                        <select
                            value={tallerId}
                            onChange={e => setTallerId(e.target.value)}
                            style={{ ...sInput, marginBottom: 12 }}
                        >
                            <option value="">Elige un taller…</option>
                            {talleres.map(t => (
                                <option key={t.id} value={t.id}>{t.nombre}</option>
                            ))}
                        </select>

                        {asignarError && <p style={{ color: 'var(--color-error)', fontSize: 12, margin: '0 0 10px' }}>⚠ {asignarError}</p>}

                        <button
                            onClick={asignar}
                            disabled={!tallerId || asignando}
                            style={sBtnPrimary('var(--color-jade-500)', !tallerId || asignando)}
                        >
                            {asignando ? 'Asignando...' : 'Asignar como profesora'}
                        </button>
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
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
