/**
 * Destello Admin — ChispaCreator
 * Formulario para generar una chispa y copiarla / reenviarla al bot.
 * Carga los talleres desde la API en lugar de tener un array estático.
 */
import { useState, useEffect } from 'react'
import { Sparkle, Copy, CheckFat, WhatsappLogo } from '@phosphor-icons/react'

// Opciones de vigencia predefinidas
const VIGENCIA_OPTS = [
    { label: '7 días',       value: 7    },
    { label: '15 días',      value: 15   },
    { label: '1 mes',        value: 30   },
    { label: 'Sin vigencia', value: null },
]

export default function ChispaCreator({ adminToken, onCreated }) {
    const [talleres,      setTalleres]      = useState([])
    const [tallerId,      setTallerId]      = useState('')
    const [tallerNombre,  setTallerNombre]  = useState('')
    const [expiresInDays, setExpiresInDays] = useState(30)
    const [isDemo,        setIsDemo]        = useState(false)
    const [usuarioNombre, setUsuarioNombre] = useState('')
    const [usuarioEmail,  setUsuarioEmail]  = useState('')
    const [usuarioWa,     setUsuarioWa]     = useState('')
    const [isLoading,     setIsLoading]     = useState(false)
    const [error,         setError]         = useState(null)
    const [lastChispa,    setLastChispa]    = useState(null)
    const [copied,        setCopied]        = useState(false)

    // Cargar talleres desde la API al montar
    useEffect(() => {
        fetch('/api/tallers')
            .then(r => r.json())
            .then(data => setTalleres(data.tallers ?? []))
            .catch(() => setTalleres([]))
    }, [])

    const handleTallerChange = (e) => {
        const id = e.target.value
        setTallerId(id)
        const t = talleres.find(t => String(t.id) === id)
        setTallerNombre(t?.nombre ?? '')
    }

    const handleGenerate = async (e) => {
        e.preventDefault()
        if (!tallerId) return
        setIsLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/chispas', {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${adminToken}`,
                },
                body: JSON.stringify({
                    tallerId, tallerNombre,
                    expiresInDays, isDemo,
                    usuarioNombre, usuarioEmail, usuarioWa,
                }),
            })
            if (!res.ok) throw new Error('Error generando chispa')
            const data = await res.json()
            setLastChispa(data.chispa)
            onCreated?.()
        } catch (err) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(lastChispa.code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Mensaje listo para pegar en WhatsApp
    const vigenciaLabel = expiresInDays == null
        ? 'Sin vigencia'
        : VIGENCIA_OPTS.find(o => o.value === expiresInDays)?.label ?? `${expiresInDays} días`

    const waMessage = lastChispa
        ? `¡Hola${usuarioNombre ? ` ${usuarioNombre.split(' ')[0]}` : ''}! 🌟\nAquí está tu código de acceso a *Destello*:\n\n*${lastChispa.code}*\n\nTaller: ${tallerNombre || tallerId}\nVigencia: ${vigenciaLabel}\n\nÚsalo en: https://destello.mx/acceso`
        : ''

    return (
        <div style={{
            background:   'var(--bg-card)',
            border:       '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding:      'var(--space-6)',
        }}>
            <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkle size={20} weight="fill" color="var(--color-jade-500)" />
                Generar chispa
            </h3>

            <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

                {/* Taller — cargado desde la API */}
                <div>
                    <label style={labelStyle}>Taller</label>
                    <select value={tallerId} onChange={handleTallerChange} style={inputStyle} required>
                        <option value="">Seleccionar taller...</option>
                        {talleres.map(t => (
                            <option key={t.id} value={String(t.id)}>{t.nombre}</option>
                        ))}
                        {talleres.length === 0 && (
                            <option disabled value="">Cargando talleres...</option>
                        )}
                    </select>
                </div>

                {/* Vigencia + Demo en la misma fila */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-3)', alignItems: 'end' }}>
                    <div>
                        <label style={labelStyle}>Vigencia</label>
                        <select
                            value={expiresInDays ?? 'null'}
                            onChange={e => setExpiresInDays(e.target.value === 'null' ? null : Number(e.target.value))}
                            style={inputStyle}
                        >
                            {VIGENCIA_OPTS.map(o => (
                                <option key={String(o.value)} value={o.value ?? 'null'}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    {/* Toggle demo */}
                    <button
                        type="button"
                        onClick={() => setIsDemo(d => !d)}
                        title="Marcar como demo / cortesía"
                        style={{
                            padding:      'var(--space-3) var(--space-4)',
                            background:   isDemo ? '#D9770622' : 'var(--bg-surface)',
                            border:       `1px solid ${isDemo ? '#D97706' : 'var(--border-default)'}`,
                            borderRadius: 'var(--radius-lg)',
                            color:        isDemo ? '#D97706' : 'var(--text-muted)',
                            fontFamily:   'var(--font-sans)',
                            fontWeight:   600,
                            fontSize:     'var(--text-xs)',
                            cursor:       'pointer',
                            whiteSpace:   'nowrap',
                            transition:   'all 0.15s',
                        }}
                    >
                        🎁 {isDemo ? 'Demo ✓' : 'Demo'}
                    </button>
                </div>

                {/* Datos del usuario */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

                    {/* Nombre */}
                    <div>
                        <label style={labelStyle}>Nombre del usuario</label>
                        <input
                            type="text" placeholder="Ej: María García"
                            value={usuarioNombre}
                            onChange={e => setUsuarioNombre(e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    {/* Correo */}
                    <div>
                        <label style={labelStyle}>Correo electrónico</label>
                        <input
                            type="email" placeholder="Ej: maria@gmail.com"
                            value={usuarioEmail}
                            onChange={e => setUsuarioEmail(e.target.value)}
                            style={inputStyle}
                        />
                    </div>

                    {/* WhatsApp */}
                    <div>
                        <label style={labelStyle}>WhatsApp</label>
                        <div style={{ display: 'flex', alignItems: 'center', ...inputStyle, padding: 0, overflow: 'hidden' }}>
                            <span style={{
                                padding:     'var(--space-3)',
                                background:  'var(--bg-surface)',
                                borderRight: '1px solid var(--border-default)',
                                color:       'var(--text-muted)',
                                fontSize:    'var(--text-sm)',
                                fontWeight:  600,
                                whiteSpace:  'nowrap',
                                userSelect:  'none',
                            }}>
                                🇲🇽 +52
                            </span>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="1234567890"
                                maxLength={10}
                                value={usuarioWa}
                                onChange={e => {
                                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                                    setUsuarioWa(digits)
                                }}
                                style={{
                                    flex:       1,
                                    border:     'none',
                                    outline:    'none',
                                    background: 'transparent',
                                    padding:    'var(--space-3)',
                                    color:      'var(--text-primary)',
                                    fontSize:   'var(--text-sm)',
                                    fontFamily: 'var(--font-sans)',
                                    width:      '100%',
                                }}
                            />
                            <span style={{
                                padding:   '0 var(--space-3)',
                                fontSize:  'var(--text-xs)',
                                color:     usuarioWa.length === 10 ? '#22c55e' : 'var(--text-muted)',
                                fontWeight: 600,
                            }}>
                                {usuarioWa.length}/10
                            </span>
                        </div>
                    </div>
                </div>

                {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)' }}>{error}</p>}

                <button type="submit" disabled={!tallerId || isLoading} style={btnPrimaryStyle(!!tallerId && !isLoading)}>
                    {isLoading ? 'Generando...' : '✦ Generar chispa'}
                </button>
            </form>

            {/* Resultado */}
            {lastChispa && (
                <div style={{
                    marginTop:    'var(--space-5)',
                    padding:      'var(--space-5)',
                    background:   'var(--bg-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border:       '1px solid var(--color-jade-500)44',
                }}>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>Código generado</p>

                    {/* Código con botón copiar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                        <code style={{
                            fontSize:      'var(--text-xl)',
                            fontWeight:    700,
                            letterSpacing: '0.08em',
                            color:         'var(--color-jade-500)',
                            flex:          1,
                        }}>
                            {lastChispa.code}
                        </code>
                        <button onClick={handleCopy} style={btnIconStyle} title="Copiar código">
                            {copied ? <CheckFat size={18} color="#22c55e" /> : <Copy size={18} />}
                        </button>
                    </div>

                    {/* Botón abrir WhatsApp con mensaje prellenado */}
                    {usuarioWa.length === 10 && (
                        <a
                            href={`https://wa.me/52${usuarioWa}?text=${encodeURIComponent(waMessage)}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                display:        'flex',
                                alignItems:     'center',
                                justifyContent: 'center',
                                gap:            8,
                                padding:        'var(--space-3)',
                                background:     '#25D366',
                                borderRadius:   'var(--radius-lg)',
                                color:          '#fff',
                                fontWeight:     600,
                                fontSize:       'var(--text-sm)',
                                textDecoration: 'none',
                                marginBottom:   'var(--space-2)',
                            }}
                        >
                            <WhatsappLogo size={18} weight="fill" />
                            Enviar por WhatsApp
                        </a>
                    )}

                    {/* Botón copiar mensaje completo */}
                    <button
                        onClick={() => { navigator.clipboard.writeText(waMessage) }}
                        style={btnSecondaryStyle}
                    >
                        <Copy size={16} /> Copiar mensaje completo
                    </button>
                </div>
            )}
        </div>
    )
}

// ── Estilos reutilizables ─────────────────────────────────────────────────────
const labelStyle = {
    display:      'block',
    fontSize:     'var(--text-xs)',
    color:        'var(--text-muted)',
    marginBottom: 4,
    fontWeight:   500,
}

const inputStyle = {
    width:        '100%',
    padding:      'var(--space-3)',
    background:   'var(--bg-surface)',
    border:       '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    color:        'var(--text-primary)',
    fontSize:     'var(--text-sm)',
    fontFamily:   'var(--font-sans)',
    outline:      'none',
    boxSizing:    'border-box',
}

const btnPrimaryStyle = (active) => ({
    padding:      'var(--space-3)',
    background:   active ? 'var(--color-jade-500)' : 'var(--bg-surface)',
    border:       '1px solid transparent',
    borderRadius: 'var(--radius-lg)',
    color:        'var(--text-primary)',
    fontFamily:   'var(--font-sans)',
    fontWeight:   600,
    fontSize:     'var(--text-sm)',
    cursor:       active ? 'pointer' : 'not-allowed',
    transition:   'background 0.2s',
})

const btnIconStyle = {
    background:   'none',
    border:       'none',
    color:        'var(--text-muted)',
    cursor:       'pointer',
    padding:      'var(--space-1)',
    borderRadius: 'var(--radius-sm)',
}

const btnSecondaryStyle = {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
    padding:    'var(--space-2) var(--space-4)',
    background: 'var(--bg-surface)',
    border:     '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    color:      'var(--text-muted)',
    fontSize:   'var(--text-xs)',
    cursor:     'pointer',
    fontFamily: 'var(--font-sans)',
}