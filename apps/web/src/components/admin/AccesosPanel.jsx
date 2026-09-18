/**
 * Destello Admin — AccesosPanel
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel de Chispas: asigna acceso a un taller a un usuario que YA tiene cuenta.
 *
 * FLUJO REAL (actualizado 18 sep 2026 — ver docs/backlog-tickets.md T-14):
 *   1. Usuario escribe al bot Faro → se crea su cuenta (`usuarios`, estado
 *      'espera') y se anota en lista de espera. Esto pasa UNA vez, la
 *      primera vez que compra un taller.
 *   2. Admin confirma su lugar desde ListaEsperaAdmin → correo con métodos
 *      de pago.
 *   3. Usuario paga y reporta el pago por WhatsApp.
 *   4. Admin confirma el pago desde ListaEsperaAdmin → `activarAlumno()`
 *      activa la cuenta (estado 'activo') Y crea la Chispa del taller, todo
 *      junto, en una transacción. Ningún código pasa por el usuario.
 *   5. Aquí, en este panel, se pueden generar Chispas ADICIONALES para una
 *      cuenta ya activa — el caso principal es dar una demo/cortesía de un
 *      taller distinto.
 *
 * El "Resplandor" (RESP-XXXX-XXXX) era el mecanismo viejo, de antes de que
 * existiera el bot, para esto mismo — quedó huérfano (ninguna pantalla lo
 * dispara ya) y se quitó de este panel. La tabla y el backend siguen vivos
 * por ahora (T-14b/c en el backlog), pero esta UI ya no los usa.
 *
 * REGLAS:
 *   - Las Chispas pueden ser muchas (una por taller comprado o regalado)
 *   - Chispa vigente → rooms del Habitat activas
 *   - Chispa vencida → rooms bloqueadas automáticamente
 *   - El cupo máximo del taller se valida solo (`cupoService.hayCupo()`)
 *
 * ESTADOS de usuarioStatus:
 *   - 'idle'      → sin búsqueda
 *   - 'searching' → buscando
 *   - 'found'     → tiene cuenta activa (estado = 'activo') — se le puede
 *                   dar una Chispa aquí
 *   - 'espera'    → tiene cuenta pero aún no está activa — actívala primero
 *                   desde ListaEsperaAdmin (confirmar pago)
 *   - 'not_found' → no existe en la tabla usuarios — todavía no ha escrito
 *                   al bot
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import {
    Sparkle, MagnifyingGlass, CheckCircle, WarningCircle,
    Copy, CheckFat, XCircle, ArrowClockwise,
    WhatsappLogo, User, Lock, Clock,
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
    // 3 días es la ventana corta para cortesías: tiempo suficiente para que
    // entre y se registre, pero no tanto como para que el lugar se quede
    // apartado sin usarse. Una demo ocupa una silla igual que un pago.
    { label: '3 días',       value: 3    },
    { label: '7 días',       value: 7    },
    { label: '15 días',      value: 15   },
    { label: '1 mes',        value: 30   },
    { label: 'Sin vigencia', value: null },
]

function ahora() { return new Date() }

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

/**
 * Etiqueta para distinguir las chispas de cortesía en las listas.
 * Mismo naranja (#D97706) que el botón "Demo" del formulario y que la
 * tarjeta DEMO de las estadísticas, para que se lea como lo mismo.
 * Ojo: una demo SÍ ocupa un lugar del cupo del taller.
 */
function DemoTag() {
    return (
        <span
            title="Chispa de cortesía — ocupa un lugar del cupo"
            style={{
                display: 'inline-block', padding: '1px 7px', borderRadius: 999,
                background: '#D9770622', color: '#D97706',
                border: '1px solid #D97706',
                fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
                letterSpacing: '.02em',
            }}
        >
            🎁 demo
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
    const debounceRef = useRef(null)

    // ── Estado de formularios
    const [chispaForm,  setChispaForm]  = useState({ tallerId: '', tallerNombre: '', expiresInDays: 30, isDemo: false })
    const [creating,    setCreating]    = useState(null)
    const [lastCode,    setLastCode]    = useState(null)
    const [createError, setCreateError] = useState(null)

    // ── Datos globales
    const [talleres,     setTalleres]     = useState([])
    const [allChispas,   setAllChispas]   = useState([])

    // ── Filtro
    const [globalSearch, setGlobalSearch] = useState('')

    // ── Stats
    const [stats, setStats] = useState(null)

    // ── Envío WA desde el bot
    const [sendingWA, setSendingWA] = useState(null) // key del botón enviando

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

    const refreshChispas = useCallback(() => {
        API('/chispas', adminToken).then(d => setAllChispas(d.chispas ?? [])).catch(() => {})
        API('/chispas/stats', adminToken).then(d => setStats(d.stats ?? null)).catch(() => {})
    }, [adminToken])

    const [searchError, setSearchError] = useState(null)

    const recargarUsuario = useCallback(async (email) => {
        setSearchError(null)
        try {
            const data = await API(`/usuarios/buscar?email=${encodeURIComponent(email)}`, adminToken)
            if (data.usuario) {
                setUsuario(data.usuario)
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
        setLastCode(null); setCreateError(null)

        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (!val.includes('@') || val.length < 5) return

        setUsuarioStatus('searching')
        debounceRef.current = setTimeout(() => recargarUsuario(val.trim()), 600)
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

    // ── Acción: Enviar WA desde el bot ────────────────────────────────────────
    const sendWA = async (numero, mensaje, key = 'default') => {
        const numeroLimpio = String(numero ?? '').replace(/\D/g, '').slice(-10)
        if (!numeroLimpio || numeroLimpio.length < 10) {
            alert('Este usuario no tiene número de WhatsApp registrado.')
            return
        }
        setSendingWA(key)
        try {
            await API('/send-wa', adminToken, {
                method: 'POST',
                body: JSON.stringify({ numero: numeroLimpio, mensaje }),
            })
            setTimeout(() => setSendingWA(prev => prev === key ? null : prev), 1500)
        } catch (err) {
            setSendingWA(null)
            alert('Error al enviar por WhatsApp: ' + err.message)
        }
    }

    // ── Mensajes WA predefinidos
    const primerNombre = (nombre) => (nombre ?? '').split(' ')[0]

    /**
     * Aviso de lugar apartado.
     *
     * ⚠️ NO lleva el código de la chispa. El código es un identificador INTERNO
     * de la BD; la alumna nunca lo necesita y mandárselo solo la confunde
     * ("¿dónde lo pongo?"). Entra con Google o con su número.
     *
     * El mensaje tiene un solo trabajo: que entienda que su lugar está apartado
     * pero NO confirmado, y que el siguiente paso es suyo — reportar el pago.
     */
    const waMsgChispa = (code, tallerNombre, vigLabel, nombre) =>
        `¡Hola ${primerNombre(nombre)}! ✦\n\n` +
        `Ya tienes *apartado tu lugar* en:\n` +
        `📚 *${tallerNombre}*\n\n` +
        `Para confirmarlo solo falta tu pago. Tienes *48 horas* para reportarlo; ` +
        `después de ese tiempo el lugar se libera para alguien más.\n\n` +
        `Cuando lo hagas, escríbeme por aquí y elige la opción *5* ` +
        `(_Ya pagué, quiero reportarlo_). Puedes mandarme la foto de tu comprobante. 📸\n\n` +
        `¡Nos vemos dentro! 🌟`

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
    // ── Datos de WA del usuario activo
    const waNumber = (usuario?.whatsapp ?? '').replace(/\D/g, '').slice(-10)
    const vigLabel = chispaForm.expiresInDays == null
        ? 'Sin vigencia'
        : VIGENCIA_OPTS.find(o => o.value === chispaForm.expiresInDays)?.label ?? `${chispaForm.expiresInDays} días`

    const searchActive    = usuarioStatus === 'found' || usuarioStatus === 'espera' || usuarioStatus === 'not_found'
    // Sin cuenta activa todavía no se le puede dar una Chispa aquí — o no
    // existe (nunca escribió al bot) o existe pero sigue sin pagar/activar
    // (eso se hace en ListaEsperaAdmin, no en este panel).
    const sinCuentaActiva = usuarioStatus === 'not_found' || usuarioStatus === 'espera'
    const hasFullAccount  = usuarioStatus === 'found'

    // ── Botón WA compacto reutilizable
    const WaBtnSm = ({ onClick, waKey, disabled }) => (
        <button
            onClick={onClick}
            disabled={disabled || sendingWA === waKey}
            style={{
                ...sBtnTiny('#25D366'),
                opacity: (disabled || sendingWA === waKey) ? 0.6 : 1,
                cursor:  (disabled || sendingWA === waKey) ? 'not-allowed' : 'pointer',
            }}
            title="Enviar por WhatsApp desde el bot"
        >
            <WhatsappLogo size={11} weight="fill" />
            {sendingWA === waKey ? '...' : 'WA'}
        </button>
    )

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
                        </div>
                    </div>
                )}

                {/* Usuario EN ESPERA */}
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

                {/* Usuario NO encontrado */}
                {usuarioStatus === 'not_found' && (
                    <div style={{ ...sStatusBox('#d97706'), marginTop: 10, gap: 10 }}>
                        <WarningCircle size={20} color="#d97706" weight="fill" style={{ flexShrink: 0 }} />
                        <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)', color: '#d97706' }}>
                                Sin cuenta en Destello
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                                Todavía no le ha escrito al bot Faro — ahí es donde se crea la cuenta.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* ══ CARDS DE ACCIÓN ═══════════════════════════════════════════ */}
            {searchActive && (
                <div style={{ maxWidth: 420 }}>

                    {/* ── CARD CHISPA ──────────────────────────────────── */}
                    <div style={{
                        ...sCard,
                        borderColor: hasFullAccount ? 'var(--color-jade-500)66' : 'var(--border-default)',
                        opacity:     sinCuentaActiva ? 0.5 : 1,
                        transition:  'opacity 0.2s, border-color 0.2s',
                    }}>
                        <h4 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                            <Sparkle size={17} weight="fill" color="var(--color-jade-500)" />
                            Chispa
                        </h4>
                        <p style={{ margin: '0 0 var(--space-4)', fontSize: 11, color: 'var(--text-muted)' }}>
                            {usuarioStatus === 'espera'
                                ? 'Todavía no tiene cuenta activa — actívala desde Lista de espera (confirmar pago).'
                                : sinCuentaActiva
                                    ? 'Necesita cuenta en Destello primero.'
                                    : 'Llave de acceso a un taller específico.'
                            }
                        </p>

                        {hasFullAccount && (
                            <form onSubmit={crearChispa} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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

                        {sinCuentaActiva && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12 }}>
                                <Lock size={14} /> Disponible cuando el usuario tenga cuenta activa.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══ CÓDIGO GENERADO ════════════════════════════════════════════ */}
            {lastCode && (
                <div style={{ ...sCard, borderColor: 'var(--color-jade-500)66' }}>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 6px' }}>
                            ⚡ Chispa generada para <strong>{usuario?.nombre ?? emailInput}</strong>
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <code style={{
                                fontSize: 24, fontWeight: 800, letterSpacing: '0.08em', flex: 1,
                                color: 'var(--color-jade-500)',
                            }}>
                                {lastCode.code}
                            </code>
                            <CopyBtn text={lastCode.code} />
                        </div>

                        {/* Botón WA — envía desde el bot */}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                            {waNumber.length >= 10 && (
                                <button
                                    onClick={() => sendWA(
                                        waNumber,
                                        waMsgChispa(lastCode.code, chispaForm.tallerNombre, vigLabel, usuario?.nombre),
                                        'lastChispa'
                                    )}
                                    disabled={sendingWA === 'lastChispa'}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '8px 16px',
                                        background: sendingWA === 'lastChispa' ? '#128C7E' : '#25D366',
                                        borderRadius: 'var(--radius-lg)', color: '#fff',
                                        fontWeight: 700, fontSize: 13, border: 'none',
                                        cursor: sendingWA === 'lastChispa' ? 'not-allowed' : 'pointer',
                                        transition: 'background 0.2s',
                                    }}
                                >
                                    <WhatsappLogo size={16} weight="fill" />
                                    {sendingWA === 'lastChispa' ? 'Enviando...' : 'Enviar por WhatsApp'}
                                </button>
                            )}

                            {!waNumber && (
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                                    Sin número WA — copia el código manualmente.
                                </p>
                            )}
                        </div>
                </div>
            )}

            {/* ══ HISTORIAL DEL USUARIO ══════════════════════════════════════ */}
            {searchActive && (usuarioChispas.length > 0 || hasFullAccount) && (
                <div style={sCard}>
                    <p style={{ margin: '0 0 var(--space-3)', fontWeight: 700, fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={15} color="var(--text-muted)" />
                        Chispas de {usuario?.nombre ?? emailInput}
                    </p>

                    {(
                        usuarioChispas.length === 0
                            ? <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Sin chispas asignadas.</p>
                            : usuarioChispas.map(c => {
                                const est = getEstadoChispa(c)
                                return (
                                    <div key={c.code} style={sHistRow}>
                                        <code style={{ fontWeight: 700, color: 'var(--color-jade-500)', fontSize: 12 }}>{c.code}</code>
                                        {c.isDemo && <DemoTag />}
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
                                            {c.tallerNombre ?? c.tallerId ?? '—'}
                                        </span>
                                        <Pill estado={est} />
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {c.expiresAt ? `Vence: ${new Date(c.expiresAt).toLocaleDateString('es-MX')}` : 'Sin límite'}
                                        </span>
                                        {est === 'activa' && (
                                            <>
                                                <WaBtnSm
                                                    waKey={`hist-chispa-${c.code}`}
                                                    onClick={() => sendWA(
                                                        waNumber,
                                                        waMsgChispa(c.code, c.tallerNombre ?? '—', c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('es-MX') : 'Sin límite', usuario?.nombre),
                                                        `hist-chispa-${c.code}`
                                                    )}
                                                    disabled={!waNumber}
                                                />
                                                <button onClick={() => revocarChispa(c.code)} style={sBtnTiny('#ef4444')}>
                                                    <XCircle size={11} /> Revocar
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )
                            })
                    )}
                </div>
            )}

            {/* ══ VISTA GLOBAL — todas las chispas ═════════════════════════ */}
            <div style={sCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 8 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                        Todas las chispas ({allChispas.length})
                    </p>
                    <button
                        onClick={refreshChispas}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}
                        title="Actualizar"
                    >
                        <ArrowClockwise size={16} />
                    </button>
                </div>

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
                            const est  = getEstadoChispa(c)
                            const cWa  = (c.usuarioWa ?? '').replace(/\D/g, '').slice(-10)
                            return (
                                <tr key={c.code} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={sTd}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                            <code style={{ fontWeight: 700, color: 'var(--color-jade-500)', fontSize: 12 }}>{c.code}</code>
                                            <CopyBtn text={c.code} />
                                            {c.isDemo && <DemoTag />}
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
                                        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {est === 'activa' && cWa.length >= 10 && (
                                                <WaBtnSm
                                                    waKey={`global-chispa-${c.code}`}
                                                    onClick={() => sendWA(
                                                        cWa,
                                                        waMsgChispa(c.code, c.tallerNombre ?? '—', c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('es-MX') : 'Sin límite', c.usuarioNombre),
                                                        `global-chispa-${c.code}`
                                                    )}
                                                />
                                            )}
                                            {est === 'activa' && (
                                                <button onClick={() => revocarChispa(c.code)} style={sBtnTiny('#ef4444')}>
                                                    <XCircle size={11} /> Revocar
                                                </button>
                                            )}
                                        </span>
                                    </td>
                                </tr>
                            )
                        })}
                        </tbody>
                    </table>
                </div>
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