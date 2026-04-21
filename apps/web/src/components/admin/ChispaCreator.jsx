/**
 * Destello Admin — ChispaCreator
 * Formulario para generar una chispa y copiarla / reenviarla al bot.
 */
import { useState } from 'react'
import { Sparkle, Copy, CheckFat, WhatsappLogo } from '@phosphor-icons/react'

const TALLERS = [
    { id: 'auriculoterapia-1', label: 'Auriculoterapia Nivel 1' },
    { id: 'automaquillaje',    label: 'Automaquillaje Artístico' },
    { id: 'gomitas',           label: 'Elaboración de Gomitas' },
    { id: 'dibujo-expresivo',  label: 'Dibujo Expresivo' },
]

export default function ChispaCreator({ adminToken, onCreated }) {
    const [tallerId,      setTallerId]      = useState('')
    const [expiresInDays, setExpiresInDays] = useState(30)
    const [usuarioNombre, setUsuarioNombre] = useState('')
    const [usuarioWa,     setUsuarioWa]     = useState('')
    const [isLoading,     setIsLoading]     = useState(false)
    const [error,         setError]         = useState(null)
    const [lastChispa,    setLastChispa]    = useState(null)
    const [copied,        setCopied]        = useState(false)

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
                body: JSON.stringify({ tallerId, expiresInDays, usuarioNombre, usuarioWa }),
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
    const waMessage = lastChispa
        ? `¡Hola${usuarioNombre ? ` ${usuarioNombre}` : ''}! 🌟\nAquí está tu código de acceso a Destello:\n\n*${lastChispa.code}*\n\nVigencia: ${expiresInDays} días.\nÚsalo en: https://app.destello.mx/login`
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
                {/* Taller */}
                <div>
                    <label style={labelStyle}>Taller</label>
                    <select value={tallerId} onChange={e => setTallerId(e.target.value)} style={inputStyle} required>
                        <option value="">Seleccionar taller...</option>
                        {TALLERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                </div>

                {/* Vigencia */}
                <div>
                    <label style={labelStyle}>Vigencia (días)</label>
                    <input
                        type="number" min={1} max={365}
                        value={expiresInDays}
                        onChange={e => setExpiresInDays(Number(e.target.value))}
                        style={inputStyle}
                    />
                </div>

                {/* Datos del usuario (del bot de WA) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <div>
                        <label style={labelStyle}>Nombre del usuario</label>
                        <input
                            type="text" placeholder="Ej: María García"
                            value={usuarioNombre}
                            onChange={e => setUsuarioNombre(e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>WhatsApp (+52...)</label>
                        <input
                            type="text" placeholder="+5215512345678"
                            value={usuarioWa}
                            onChange={e => setUsuarioWa(e.target.value)}
                            style={inputStyle}
                        />
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
                            fontSize:   'var(--text-xl)',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            color:      'var(--color-jade-500)',
                            flex:       1,
                        }}>
                            {lastChispa.code}
                        </code>
                        <button onClick={handleCopy} style={btnIconStyle} title="Copiar código">
                            {copied ? <CheckFat size={18} color="#22c55e" /> : <Copy size={18} />}
                        </button>
                    </div>

                    {/* Botón abrir WhatsApp con mensaje prellenado */}
                    {usuarioWa && (

                        <a
                        href={`https://wa.me/${usuarioWa.replace(/\D/g, '')}?text=${encodeURIComponent(waMessage)}`}
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
                    }}
                        >
                        <WhatsappLogo size={18} weight="fill" />
                        Enviar por WhatsApp
                        </a>
                        )}

                    {/* Copiar mensaje completo si no hay WA */}
                    {!usuarioWa && (
                        <button
                            onClick={() => { navigator.clipboard.writeText(waMessage) }}
                            style={btnSecondaryStyle}
                        >
                            <Copy size={16} /> Copiar mensaje completo
                        </button>
                    )}
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
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    padding:      'var(--space-2) var(--space-4)',
    background:   'var(--bg-surface)',
    border:       '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    color:        'var(--text-muted)',
    fontSize:     'var(--text-xs)',
    cursor:       'pointer',
    fontFamily:   'var(--font-sans)',
}