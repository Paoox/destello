/**
 * Destello Admin — AccesosPanel
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel unificado de Resplandores y Chispas.
 *
 * FLUJO CORRECTO:
 *   1. Usuario se inscribe a lista de espera
 *   2. Admin confirma cupo → correo con métodos de pago
 *   3. Usuario paga y manda comprobante por WA
 *   4. Admin verifica pago → genera y manda RESPLANDOR (WA + mail)
 *   5. Usuario usa Resplandor → crea cuenta → flag resplandor = "usado"
 *   6. Resplandor "usado" habilita crear CHISPA en el panel
 *   7. Admin manda Chispa por WA → usuario accede al taller y rooms del Habitat
 *
 * REGLAS:
 *   - Solo 1 Resplandor por usuario (código único de invitación)
 *   - Las Chispas pueden ser muchas (una por taller comprado)
 *   - Chispa vigente → rooms del Habitat activas
 *   - Chispa vencida → rooms bloqueadas automáticamente
 *
 * ESTADOS de usuarioStatus:
 *   - 'idle'      → sin búsqueda
 *   - 'searching' → buscando
 *   - 'found'     → tiene cuenta activa (estado = 'activo', pasó por Resplandor)
 *   - 'espera'    → registrado por el bot (estado = 'espera'), aún necesita Resplandor
 *   - 'not_found' → no existe en la tabla usuarios
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import {
    Sun, Sparkle, MagnifyingGlass, CheckCircle, WarningCircle,
    Copy, CheckFat, Envelope, XCircle, ArrowClockwise,
    WhatsappLogo, User, Lock, Info, Clock,
} from '@phosphor-icons/react'

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = (path, token, opts = {}) =>
    fetch(`/api/admin${path}`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        ...opts,
    }).then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.message ?? `Error ${r.status}`)
        return data
    })

const VIGENCIA_OPTS = [
    { label: '7 días',       value: 7    },
    { label: '15 días',      value: 15   },
    { label: '1 mes',        value: 30   },
    { label: 'Sin vigencia', value: null },
]

function ahora() { return new Date() }

function getEstadoResp(r) {
    if (r.revoked) return 'revocado'
    if (r.used)    return 'usado'
    if (r.expires_at && new Date(r.expires_at) < ahora()) return 'expirado'
    return 'activo'
}

function getEstadoChispa(c) {
    if (c.revoked)  return 'revocada'
    if (c.used)     return 'usada'
    if (c.expiresAt && new Date(c.expiresAt) < ahora()) return 'expirada'
    return 'activa'
}

function Pill({ estado }) {
    const map = {
        activa:   ['#22c55e', 'Activa'],
        activo:   ['#22c55e', 'Activo'],
        usada:    ['#3b82f6', 'Usada'],
        usado:    ['#3b82f6', 'Usado ✓'],
        expirada: ['#f59e0b', 'Expirada'],
        expirado: ['#f59e0b', 'Expirado'],
        revocada: ['#ef4444', 'Revocada'],
        revocado: ['#ef4444', 'Revocado'],
    }
    const [color, label] = map[estado] ?? ['var(--text-muted)', estado]
    return (
        <span style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: 999,
            background: color + '22', color, fontSize: 11, fontWeight: 700,
            whiteSpace: 'nowrap',
        }}>
            {label}
        </span>
    )
}

function CopyBtn({ text }) {
    const [copied, setCopied] = useState(false)
    return (
        <button
            onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center' }}
            title="Copiar"
        >
            {copied ? <CheckFat size={14} color="#22c55e" /> : <Copy size={14} />}
        </button>
    )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AccesosPanel({ adminToken }) {

    // ── Estado de búsqueda
    const [emailInput,    setEmailInput]    = useState('')
    const [usuario,       setUsuario]       = useState(null)
    const [usuarioStatus, setUsuarioStatus] = useState('idle') // idle|searching|found|espera|not_found
    const [usuarioResps,  setUsuarioResps]  = useState([])
    const debounceRef = useRef(null)

    // ── Estado de formularios
    const [chispaForm,  setChispaForm]  = useState({ tallerId: '', tallerNombre: '', expiresInDays: 30, isDemo: false })
    const [creating,    setCreating]    = useState(null)
    const [lastCode,    setLastCode]    = useState(null)
    const [createError, setCreateError] = useState(null)

    // ── Datos globales
    const [talleres,     setTalleres]     = useState([])
    const [allChispas,   setAllChispas]   = useState([])
    const [allResps,     setAllResps]     = useState([])
    const [loadingResps, setLoadingResps] = useState(false)

    // ── Tabs y filtros
    const [globalTab,    setGlobalTab]    = useState('chispas')
    const [userTab,      setUserTab]      = useState('resplandores')
    const [globalSearch, setGlobalSearch] = useState('')

    // ── Stats
    const [stats, setStats] = useState(null)

    // ── Carga inicial
    useEffect(() => {
        fetch('/api/tallers')
            .then(r => r.json())
            .then(d => setTalleres(d.tallers ?? []))
            .catch(() => {})

        API('/chispas', adminToken)
            .then(d => setAllChispas(d.chispas ?? []))
            .catch(() => {})

        API('/chispas/stats', adminToken)
            .then(d => setStats(d.stats ?? null))
            .catch(() => {})
    }, [adminToken])

    // ── Carga de todos los resplandores (lazy al abrir su tab)
    useEffect(() => {
        if (globalTab !== 'resplandores' || allResps.length > 0) return
        setLoadingResps(true)
        API('/resplandores/all', adminToken)
            .then(d => setAllResps(d.resplandores ?? []))
            .catch(() => {})
            .finally(() => setLoadingResps(false))
    }, [globalTab, adminToken])

    const refreshChispas = useCallback(() => {
        API('/chispas', adminToken).then(d => setAllChispas(d.chispas ?? [])).catch(() => {})
        API('/chispas/stats', adminToken).then(d => setStats(d.stats ?? null)).catch(() => {})
    }, [adminToken])

    const refreshAllResps = useCallback(() => { setAllResps([]) }, [])

    const [searchError, setSearchError] = useState(null)

    const recargarUsuario = useCallback(async (email) => {
        setSearchError(null)
        try {
            const data = await API(`/resplandores?email=${encodeURIComponent(email)}`, adminToken)
            setUsuarioResps(data.resplandores ?? [])
            if (data.usuario) {
                setUsuario(data.usuario)
                // 'found'  = cuenta activa (pasó por Resplandor → estado 'activo')
                // 'espera' = registrado por el bot, aún sin cuenta confirmada (estado 'espera')
                setUsuarioStatus(data.usuario.estado === 'activo' ? 'found' : 'espera')
            } else {
                setUsuario(null)
                setUsuarioStatus('not_found')
            }
        } catch (err) {
            setUsuarioStatus('idle')
            setSearchError(err.message ?? 'Error al buscar — revisa que el backend esté corriendo')
        }
    }, [adminToken])

    // ── Búsqueda por email (debounced)
    const handleEmailChange = (e) => {
        const val = e.target.value
        setEmailInput(val)
        setUsuario(null); setUsuarioStatus('idle')
        setUsuarioResps([]); setLastCode(null); setCreateError(null)

        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (!val.includes('@') || val.length < 5) return

        setUsuarioStatus('searching')
        debounceRef.current = setTimeout(() => recargarUsuario(val.trim()), 600)
    }

    // ── Derivaciones del estado del resplandor del usuario
    const respActivo    = usuarioResps.find(r => !r.revoked && !r.used && (!r.expires_at || new Date(r.expires_at) > ahora()))
    const respUsado     = usuarioResps.find(r => r.used)
    const respExpirado  = usuarioResps.find(r => !r.revoked && !r.used && r.expires_at && new Date(r.expires_at) <= ahora())
    const puedeCrearResp = !respActivo  // puede crear si no hay uno activo pendiente

    // ── Acciones: Resplandor
    const crearResplandor = async () => {
        setCreating('resplandor'); setCreateError(null); setLastCode(null)
        try {
            const data = await API('/resplandores', adminToken, {
                method: 'POST',
                body: JSON.stringify({ email: emailInput.trim() }),
            })
            setLastCode({ tipo: 'resplandor', code: data.code })
            await recargarUsuario(emailInput.trim())
            refreshAllResps()
        } catch (err) {
            setCreateError(err.message)
        } finally { setCreating(null) }
    }

    const reenviarResp = async (code) => {
        setCreating('reenvio'); setCreateError(null)
        try {
            await API(`/resplandores/${code}/reenviar`, adminToken, { method: 'POST' })
            setLastCode({ tipo: 'reenvio', code, para: usuario?.nombre ?? emailInput })
        } catch (err) { setCreateError(err.message) }
        finally { setCreating(null) }
    }

    const revocarResp = async (code) => {
        if (!confirm(`¿Revocar el resplandor ${code}?`)) return
        setCreating('revocando')
        try {
            await API(`/resplandores/${code}`, adminToken, { method: 'DELETE' })
            await recargarUsuario(emailInput.trim())
            refreshAllResps()
        } catch (err) { setCreateError(err.message) }
        finally { setCreating(null) }
    }

    // ── Acción: Chispa
    const crearChispa = async (e) => {
        e.preventDefault()
        if (!chispaForm.tallerId || !usuario) return
        setCreating('chispa'); setCreateError(null); setLastCode(null)
        try {
            const data = await API('/chispas', adminToken, {
                method: 'POST',
                body: JSON.stringify({
                    tallerId:      chispaForm.tallerId,
                    tallerNombre:  chispaForm.tallerNombre,
                    expiresInDays: chispaForm.expiresInDays,
                    isDemo:        chispaForm.isDemo,
                    usuarioNombre: usuario.nombre,
                    usuarioEmail:  usuario.email,
                    usuarioWa:     usuario.whatsapp ?? '',
                }),
            })
            setLastCode({ tipo: 'chispa', code: data.chispa.code })
            refreshChispas()
        } catch (err) { setCreateError(err.message) }
        finally { setCreating(null) }
    }

    const revocarChispa = async (code) => {
        if (!confirm(`¿Revocar la chispa ${code}?`)) return
        try {
            await API(`/chispas/${code}`, adminToken, { method: 'DELETE' })
            refreshChispas()
        } catch (err) { alert(err.message) }
    }

    // ── Chispas de este usuario
    const usuarioChispas = allChispas.filter(c =>
        c.usuarioEmail && usuario &&
        c.usuarioEmail.toLowerCase() === usuario.email.toLowerCase()
    )

    // ── Filtro global
    const q = globalSearch.toLowerCase()
    const chispasFiltered = allChispas.filter(c =>
        !q || [c.code, c.usuarioNombre, c.usuarioEmail, c.tallerNombre]
            .some(v => v?.toLowerCase().includes(q))
    )
    const respsFiltered = allResps.filter(r =>
        !q || [r.code, r.usuario_nombre, r.usuario_email]
            .some(v => v?.toLowerCase().includes(q))
    )

    // ── Mensaje WA
    const vigLabel = chispaForm.expiresInDays == null
        ? 'Sin vigencia'
        : VIGENCIA_OPTS.find(o => o.value === chispaForm.expiresInDays)?.label ?? `${chispaForm.expiresInDays} días`
    const waMsg = lastCode?.tipo === 'chispa' && usuario
        ? `¡Hola ${(usuario.nombre ?? '').split(' ')[0]}! ⚡\nAquí está tu Chispa de acceso:\n\n*${lastCode.code}*\n\nTaller: ${chispaForm.tallerNombre}\nVigencia: ${vigLabel}\n\nÚsala en: https://destello.courses/acceso`
        : ''
    const waNumber = (usuario?.whatsapp ?? '').replace(/\D/g, '').slice(-10)

    // searchActive = cualquier estado que ya tiene resultado
    const searchActive = usuarioStatus === 'found' || usuarioStatus === 'espera' || usuarioStatus === 'not_found'

    // Helpers semánticos para las cards
    const needsResplandor = usuarioStatus === 'not_found' || usuarioStatus === 'espera'
    const hasFullAccount  = usuarioStatus === 'found'

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

            {/* ══ STATS ═════════════════════════════════════════════════════ */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 'var(--space-3)' }}>
                    {[
                        { label: 'Total',     value: stats.total,   color: 'var(--text-primary)' },
                        { label: 'Activas',   value: stats.active,  color: '#22c55e' },
                        { label: 'Usadas',    value: stats.used,    color: '#3b82f6' },
                        { label: 'Expiradas', value: stats.expired, color: '#f59e0b' },
                        { label: 'Revocadas', value: stats.revoked, color: '#ef4444' },
                        { label: 'Demo',      value: stats.demo,    color: '#d97706' },
                    ].map(s => (
                        <div key={s.label} style={{ ...sCard, padding: 'var(--space-4)', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* ══ BUSCADOR ══════════════════════════════════════════════════ */}
            <div style={sCard}>
                <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MagnifyingGlass size={15} /> Buscar usuario por correo
                </p>
                <div style={{ position: 'relative' }}>
                    <input
                        type="email"
                        placeholder="correo@usuario.com"
                        value={emailInput}
                        onChange={handleEmailChange}
                        style={{ ...sInput, paddingLeft: 38 }}
                        autoComplete="off"
                    />
                    <MagnifyingGlass size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                </div>

                {usuarioStatus === 'searching' && <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '6px 0 0' }}>Buscando...</p>}
                {searchError && <p style={{ color: 'var(--color-error)', fontSize: 12, margin: '6px 0 0' }}>⚠ {searchError}</p>}

                {/* Usuario ENCONTRADO — cuenta activa */}
                {usuarioStatus === 'found' && usuario && (
                    <div style={{ ...sStatusBox('#16a34a'), marginTop: 10, gap: 10 }}>
                        <CheckCircle size={20} color="#16a34a" weight="fill" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                                {usuario.nombre || 'Sin nombre'}
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                                {usuario.email}
                                {usuario.whatsapp ? ` · WA: ${usuario.whatsapp}` : ''}
                            </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cuenta</span>
                            <Pill estado="activo" />
                            {respUsado && (
                                <>
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>Resplandor</span>
                                    <Pill estado="usado" />
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Usuario EN ESPERA — registrado por el bot, sin cuenta aún */}
                {usuarioStatus === 'espera' && usuario && (
                    <div style={{ ...sStatusBox('#8b5cf6'), marginTop: 10, gap: 10 }}>
                        <Clock size={20} color="#8b5cf6" weight="fill" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                                {usuario.nombre || 'Sin nombre'}
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                                {usuario.email}
                                {usuario.whatsapp ? ` · WA: ${usuario.whatsapp}` : ''}
                            </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>En espera</span>
                            <span style={{
                                display: 'inline-block', padding: '2px 10px', borderRadius: 999,
                                background: '#8b5cf622', color: '#8b5cf6', fontSize: 11, fontWeight: 700,
                            }}>Bot ✓</span>
                        </div>
                    </div>
                )}

                {/* Usuario NO encontrado — sin cuenta */}
                {usuarioStatus === 'not_found' && (
                    <div style={{ ...sStatusBox('#d97706'), marginTop: 10, gap: 10 }}>
                        <WarningCircle size={20} color="#d97706" weight="fill" style={{ flexShrink: 0 }} />
                        <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)', color: '#d97706' }}>
                                Sin cuenta en Destello
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                                {respActivo
                                    ? '☀ Ya tiene un Resplandor activo pendiente de usar.'
                                    : 'Necesita un Resplandor para poder registrarse primero.'
                                }
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* ══ CARDS DE ACCIÓN ═══════════════════════════════════════════ */}
            {searchActive && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', alignItems: 'start' }}>

                    {/* ── CARD RESPLANDOR (☀ ámbar) ──────────────────────── */}
                    <div style={{
                        ...sCard,
                        borderColor: needsResplandor ? '#d9770666' : 'var(--border-default)',
                        opacity:     hasFullAccount ? 0.4 : 1,
                        transition:  'opacity 0.2s, border-color 0.2s',
                    }}>
                        <h4 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                            <Sun size={17} weight="fill" color="#d97706" />
                            Resplandor
                        </h4>
                        <p style={{ margin: '0 0 var(--space-4)', fontSize: 11, color: 'var(--text-muted)' }}>
                            {hasFullAccount
                                ? 'Ya usó su Resplandor y tiene cuenta. Usa la Chispa →'
                                : usuarioStatus === 'espera'
                                    ? 'Se registró por el bot. Envíale un Resplandor para que cree su cuenta.'
                                    : 'Invitación única para crear cuenta en Destello.'
                            }
                        </p>

                        {needsResplandor && (
                            <>
                                {/* Historial de resplandores de este correo */}
                                {usuarioResps.length > 0 && (
                                    <div style={{ marginBottom: 'var(--space-3)' }}>
                                        <p style={{ ...sLabel, marginBottom: 6 }}>Historial</p>
                                        {usuarioResps.map(r => {
                                            const est = getEstadoResp(r)
                                            const canAct = est === 'activo' || est === 'expirado'
                                            return (
                                                <div key={r.code} style={sHistRow}>
                                                    <code style={{ fontWeight: 700, color: '#d97706', fontSize: 12, flex: 1 }}>{r.code}</code>
                                                    <Pill estado={est} />
                                                    {canAct && (
                                                        <>
                                                            <button onClick={() => reenviarResp(r.code)} disabled={!!creating} style={sBtnTiny('#0D7377')}>
                                                                <Envelope size={11} /> Reenviar
                                                            </button>
                                                            <button onClick={() => revocarResp(r.code)} disabled={!!creating} style={sBtnTiny('#ef4444')}>
                                                                <XCircle size={11} /> Revocar
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                <button
                                    onClick={crearResplandor}
                                    disabled={!!creating || !puedeCrearResp}
                                    style={{
                                        ...sBtnPrimary('#d97706'),
                                        opacity: puedeCrearResp && !creating ? 1 : 0.5,
                                        cursor:  puedeCrearResp && !creating ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                    {creating === 'resplandor' ? 'Creando...' :
                                        !puedeCrearResp ? '☀ Ya tiene Resplandor activo' :
                                            '☀ Crear y enviar Resplandor'}
                                </button>

                                {!puedeCrearResp && respActivo && (
                                    <p style={{ fontSize: 11, color: '#d97706', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Info size={12} /> Revócalo primero para crear uno nuevo.
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── CARD CHISPA (⚡ jade) ──────────────────────────── */}
                    <div style={{
                        ...sCard,
                        borderColor: hasFullAccount ? 'var(--color-jade-500)66' : 'var(--border-default)',
                        opacity:     needsResplandor ? 0.4 : 1,
                        transition:  'opacity 0.2s, border-color 0.2s',
                    }}>
                        <h4 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                            <Sparkle size={17} weight="fill" color="var(--color-jade-500)" />
                            Chispa
                        </h4>
                        <p style={{ margin: '0 0 var(--space-4)', fontSize: 11, color: 'var(--text-muted)' }}>
                            {needsResplandor
                                ? 'Primero necesita su Resplandor para crear cuenta ←'
                                : 'Llave de acceso a un taller específico.'
                            }
                        </p>

                        {hasFullAccount && (
                            <form onSubmit={crearChispa} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                {/* Taller */}
                                <div>
                                    <label style={sLabel}>Taller</label>
                                    <select
                                        value={chispaForm.tallerId}
                                        onChange={e => {
                                            const id = e.target.value
                                            const t  = talleres.find(t => String(t.id) === id)
                                            setChispaForm(f => ({ ...f, tallerId: id, tallerNombre: t?.nombre ?? '' }))
                                        }}
                                        style={sInput}
                                        required
                                    >
                                        <option value="">Seleccionar taller...</option>
                                        {talleres.map(t => (
                                            <option key={t.id} value={String(t.id)}>{t.nombre}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Vigencia + Demo */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
                                    <div>
                                        <label style={sLabel}>Vigencia</label>
                                        <select
                                            value={chispaForm.expiresInDays ?? 'null'}
                                            onChange={e => setChispaForm(f => ({ ...f, expiresInDays: e.target.value === 'null' ? null : Number(e.target.value) }))}
                                            style={sInput}
                                        >
                                            {VIGENCIA_OPTS.map(o => (
                                                <option key={String(o.value)} value={o.value ?? 'null'}>{o.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setChispaForm(f => ({ ...f, isDemo: !f.isDemo }))}
                                        style={{
                                            padding: '9px 10px',
                                            background: chispaForm.isDemo ? '#D9770622' : 'var(--bg-surface)',
                                            border: `1px solid ${chispaForm.isDemo ? '#D97706' : 'var(--border-default)'}`,
                                            borderRadius: 'var(--radius-lg)',
                                            color: chispaForm.isDemo ? '#D97706' : 'var(--text-muted)',
                                            fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11,
                                            cursor: 'pointer', whiteSpace: 'nowrap',
                                        }}
                                    >
                                        🎁 {chispaForm.isDemo ? 'Demo ✓' : 'Demo'}
                                    </button>
                                </div>

                                {createError && <p style={{ color: 'var(--color-error)', fontSize: 12, margin: 0 }}>{createError}</p>}

                                <button
                                    type="submit"
                                    disabled={!chispaForm.tallerId || !!creating}
                                    style={{
                                        ...sBtnPrimary('var(--color-jade-500)'),
                                        opacity: chispaForm.tallerId && !creating ? 1 : 0.5,
                                        cursor:  chispaForm.tallerId && !creating ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                    {creating === 'chispa' ? 'Generando...' : '⚡ Generar Chispa'}
                                </button>
                            </form>
                        )}

                        {needsResplandor && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12 }}>
                                <Lock size={14} /> Disponible cuando el usuario tenga cuenta.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══ CÓDIGO GENERADO ════════════════════════════════════════════ */}
            {lastCode && (
                <div style={{
                    ...sCard,
                    borderColor: lastCode.tipo === 'chispa' ? 'var(--color-jade-500)66' : lastCode.tipo === 'reenvio' ? '#3b82f666' : '#d9770666',
                }}>
                    {lastCode.tipo === 'reenvio' ? (
                        <p style={{ margin: 0, fontWeight: 600, color: '#3b82f6', fontSize: 'var(--text-sm)' }}>
                            📧 Resplandor reenviado correctamente al correo del usuario.
                        </p>
                    ) : (
                        <>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 6px' }}>
                                {lastCode.tipo === 'chispa' ? '⚡ Chispa generada' : '☀ Resplandor creado'} para <strong>{usuario?.nombre ?? emailInput}</strong>
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                <code style={{
                                    fontSize: 24, fontWeight: 800, letterSpacing: '0.08em', flex: 1,
                                    color: lastCode.tipo === 'chispa' ? 'var(--color-jade-500)' : '#d97706',
                                }}>
                                    {lastCode.code}
                                </code>
                                <CopyBtn text={lastCode.code} />
                            </div>
                            {/* Botón WA solo para Chispa si tiene número */}
                            {lastCode.tipo === 'chispa' && waNumber.length >= 10 && (
                                <a
                                    href={`https://wa.me/52${waNumber}?text=${encodeURIComponent(waMsg)}`}
                                    target="_blank" rel="noreferrer"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '8px 16px', background: '#25D366',
                                        borderRadius: 'var(--radius-lg)', color: '#fff',
                                        fontWeight: 700, fontSize: 13, textDecoration: 'none',
                                    }}
                                >
                                    <WhatsappLogo size={16} weight="fill" />
                                    Enviar por WhatsApp
                                </a>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ══ HISTORIAL DEL USUARIO ══════════════════════════════════════ */}
            {searchActive && (usuarioResps.length > 0 || usuarioChispas.length > 0 || hasFullAccount) && (
                <div style={sCard}>
                    <p style={{ margin: '0 0 var(--space-3)', fontWeight: 700, fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={15} color="var(--text-muted)" />
                        Historial — {usuario?.nombre ?? emailInput}
                    </p>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border-subtle)', marginBottom: 'var(--space-3)' }}>
                        {[
                            { id: 'resplandores', label: `Resplandores (${usuarioResps.length})` },
                            { id: 'chispas',      label: `Chispas (${usuarioChispas.length})` },
                        ].map(t => (
                            <button key={t.id} onClick={() => setUserTab(t.id)} style={sTabBtn(userTab === t.id)}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {userTab === 'resplandores' && (
                        usuarioResps.length === 0
                            ? <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Sin resplandores.</p>
                            : usuarioResps.map(r => {
                                const est = getEstadoResp(r)
                                const canAct = est === 'activo' || est === 'expirado'
                                return (
                                    <div key={r.code} style={sHistRow}>
                                        <code style={{ fontWeight: 700, color: '#d97706', fontSize: 12 }}>{r.code}</code>
                                        <Pill estado={est} />
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
                                            {r.created_at ? new Date(r.created_at).toLocaleDateString('es-MX') : ''}
                                        </span>
                                        {canAct && (
                                            <>
                                                <button onClick={() => reenviarResp(r.code)} disabled={!!creating} style={sBtnTiny('#0D7377')}>
                                                    <Envelope size={11} /> Reenviar
                                                </button>
                                                <button onClick={() => revocarResp(r.code)} disabled={!!creating} style={sBtnTiny('#ef4444')}>
                                                    <XCircle size={11} /> Revocar
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )
                            })
                    )}

                    {userTab === 'chispas' && (
                        usuarioChispas.length === 0
                            ? <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Sin chispas asignadas.</p>
                            : usuarioChispas.map(c => {
                                const est = getEstadoChispa(c)
                                return (
                                    <div key={c.code} style={sHistRow}>
                                        <code style={{ fontWeight: 700, color: 'var(--color-jade-500)', fontSize: 12 }}>{c.code}</code>
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
                                            {c.tallerNombre ?? c.tallerId ?? '—'}
                                        </span>
                                        <Pill estado={est} />
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {c.expiresAt ? `Vence: ${new Date(c.expiresAt).toLocaleDateString('es-MX')}` : 'Sin límite'}
                                        </span>
                                        {est === 'activa' && (
                                            <button onClick={() => revocarChispa(c.code)} style={sBtnTiny('#ef4444')}>
                                                <XCircle size={11} /> Revocar
                                            </button>
                                        )}
                                    </div>
                                )
                            })
                    )}
                </div>
            )}

            {/* ══ VISTA GLOBAL ═══════════════════════════════════════════════ */}
            <div style={sCard}>
                {/* Header con tabs + refresh */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border-subtle)' }}>
                        {[
                            { id: 'chispas',      label: `Todas las chispas (${allChispas.length})` },
                            { id: 'resplandores', label: 'Todos los resplandores' },
                        ].map(t => (
                            <button key={t.id} onClick={() => setGlobalTab(t.id)} style={sTabBtn(globalTab === t.id)}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => { refreshChispas(); refreshAllResps() }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}
                        title="Actualizar"
                    >
                        <ArrowClockwise size={16} />
                    </button>
                </div>

                {/* Buscador global */}
                <div style={{ position: 'relative', marginBottom: 'var(--space-3)' }}>
                    <MagnifyingGlass size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                        type="text"
                        placeholder="Buscar por código, usuario, taller..."
                        value={globalSearch}
                        onChange={e => setGlobalSearch(e.target.value)}
                        style={{ ...sInput, paddingLeft: 30, fontSize: 13 }}
                    />
                </div>

                {/* Tabla global — Chispas */}
                {globalTab === 'chispas' && (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                            <tr>
                                {['Código', 'Usuario', 'Taller', 'Vigencia', 'Estado', ''].map(h => (
                                    <th key={h} style={sTh}>{h}</th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {chispasFiltered.length === 0 && (
                                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados</td></tr>
                            )}
                            {chispasFiltered.map(c => {
                                const est = getEstadoChispa(c)
                                return (
                                    <tr key={c.code} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={sTd}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <code style={{ fontWeight: 700, color: 'var(--color-jade-500)', fontSize: 12 }}>{c.code}</code>
                                                    <CopyBtn text={c.code} />
                                                </span>
                                        </td>
                                        <td style={sTd}>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: 12 }}>{c.usuarioNombre ?? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Sin asignar</span>}</p>
                                            {c.usuarioEmail && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{c.usuarioEmail}</p>}
                                        </td>
                                        <td style={{ ...sTd, color: 'var(--text-muted)' }}>{c.tallerNombre ?? c.tallerId ?? '—'}</td>
                                        <td style={{ ...sTd, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('es-MX') : 'Sin límite'}</td>
                                        <td style={sTd}><Pill estado={est} /></td>
                                        <td style={sTd}>
                                            {est === 'activa' && (
                                                <button onClick={() => revocarChispa(c.code)} style={sBtnTiny('#ef4444')}>
                                                    <XCircle size={11} /> Revocar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tabla global — Resplandores */}
                {globalTab === 'resplandores' && (
                    loadingResps
                        ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cargando...</p>
                        : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                    <tr>
                                        {['Código', 'Usuario', 'Correo', 'Creado', 'Estado', ''].map(h => (
                                            <th key={h} style={sTh}>{h}</th>
                                        ))}
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {respsFiltered.length === 0 && (
                                        <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados</td></tr>
                                    )}
                                    {respsFiltered.map(r => {
                                        const est = getEstadoResp(r)
                                        const canAct = est === 'activo' || est === 'expirado'
                                        return (
                                            <tr key={r.code} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                                <td style={sTd}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <code style={{ fontWeight: 700, color: '#d97706', fontSize: 12 }}>{r.code}</code>
                                                            <CopyBtn text={r.code} />
                                                        </span>
                                                </td>
                                                <td style={{ ...sTd, fontWeight: 600, fontSize: 12 }}>{r.nombre ?? r.usuario_nombre ?? '—'}</td>
                                                <td style={{ ...sTd, color: 'var(--text-muted)', fontSize: 12 }}>{r.email}</td>
                                                <td style={{ ...sTd, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('es-MX') : '—'}</td>
                                                <td style={sTd}><Pill estado={est} /></td>
                                                <td style={sTd}>
                                                    {canAct && (
                                                        <span style={{ display: 'flex', gap: 4 }}>
                                                                <button onClick={() => reenviarResp(r.code)} style={sBtnTiny('#0D7377')}>
                                                                    <Envelope size={11} /> Reenviar
                                                                </button>
                                                                <button onClick={() => revocarResp(r.code)} style={sBtnTiny('#ef4444')}>
                                                                    <XCircle size={11} /> Revocar
                                                                </button>
                                                            </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        )
                )}
            </div>
        </div>
    )
}

// ── Estilos ────────────────────────────────────────────────────────────────────

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
    display: 'flex', alignItems: 'center',
})

const sBtnPrimary = (color) => ({
    padding: 'var(--space-3)', background: color, border: 'none',
    borderRadius: 'var(--radius-lg)', color: '#fff',
    fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13,
    cursor: 'pointer', width: '100%', transition: 'opacity 0.15s',
})

const sBtnTiny = (color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 3,
    padding: '3px 8px', background: color + '22',
    border: `1px solid ${color}`, borderRadius: 'var(--radius-md)',
    color, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
})

const sTabBtn = (active) => ({
    padding: 'var(--space-2) var(--space-3)',
    background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid var(--color-jade-500)' : '2px solid transparent',
    color: active ? 'var(--color-jade-500)' : 'var(--text-muted)',
    fontFamily: 'var(--font-sans)', fontWeight: active ? 700 : 400,
    fontSize: 13, cursor: 'pointer', marginBottom: -1,
})

const sHistRow = {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    padding: '8px var(--space-3)',
    background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)', marginBottom: 6,
}

const sTh = {
    padding: '6px 10px', textAlign: 'left', fontSize: 11,
    color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border-subtle)',
}

const sTd = { padding: '8px 10px', verticalAlign: 'middle' }