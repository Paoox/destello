/**
 * Destello Admin — RespladorAdmin
 * Gestión de resplandores con lógica completa:
 *  - Si el usuario tiene resplandor ACTIVO  → solo reenviar
 *  - Si el usuario tiene resplandor EXPIRADO → reenviar o crear nuevo
 *  - Si el usuario tiene resplandor REVOCADO → crear nuevo y vincular al mail
 *  - Si no tiene resplandor               → crear nuevo
 */
import { useState } from 'react'
import { Sun, Envelope, ArrowCounterClockwise, Plus, XCircle } from '@phosphor-icons/react'

const API = (path, token, opts = {}) =>
    fetch(`/api/admin${path}`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        ...opts,
    }).then(r => r.json())

function StatusPill({ estado }) {
    const map = {
        activo:   ['#22c55e', 'Activo'],
        expirado: ['#f59e0b', 'Expirado'],
        revocado: ['var(--color-error)', 'Revocado'],
        usado:    ['#3b82f6', 'Usado'],
    }
    const [color, label] = map[estado] ?? ['var(--text-muted)', estado]
    return (
        <span style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: 999,
            background: color + '22', color, fontSize: 'var(--text-xs)', fontWeight: 600,
        }}>{label}</span>
    )
}

export default function RespladorAdmin({ adminToken }) {
    const [email,       setEmail]       = useState('')
    const [resultado,   setResultado]   = useState(null)   // { usuario, resplandores }
    const [buscando,    setBuscando]    = useState(false)
    const [accion,      setAccion]      = useState(null)   // mensaje de la última acción
    const [procesando,  setProcesando]  = useState(false)
    const [error,       setError]       = useState(null)

    // Buscar resplandores de un usuario por correo
    const buscar = async () => {
        if (!email.trim()) return
        setBuscando(true)
        setResultado(null)
        setAccion(null)
        setError(null)
        try {
            const data = await API(`/resplandores?email=${encodeURIComponent(email.trim())}`, adminToken)
            if (data.status !== 'ok') throw new Error(data.message ?? 'Error al buscar')
            setResultado(data)
        } catch (err) { setError(err.message) } finally { setBuscando(false) }
    }

    // Crear nuevo resplandor para el usuario
    const crearNuevo = async () => {
        setProcesando(true)
        setError(null)
        try {
            const data = await API('/resplandores', adminToken, {
                method: 'POST',
                body:   JSON.stringify({ email: email.trim() }),
            })
            if (data.status !== 'ok') throw new Error(data.message ?? 'Error al crear')
            setAccion(`✅ Resplandor creado: ${data.code}`)
            await buscar()
        } catch (err) { setError(err.message) } finally { setProcesando(false) }
    }

    // Reenviar resplandor existente por correo
    const reenviar = async (code) => {
        setProcesando(true)
        setError(null)
        try {
            const data = await API(`/resplandores/${code}/reenviar`, adminToken, { method: 'POST' })
            if (data.status !== 'ok') throw new Error(data.message ?? 'Error al reenviar')
            setAccion(`📧 Resplandor reenviado a ${email}`)
        } catch (err) { setError(err.message) } finally { setProcesando(false) }
    }

    // Revocar resplandor
    const revocar = async (code) => {
        if (!confirm(`¿Revocar el resplandor ${code}? Se habilitará crear uno nuevo.`)) return
        setProcesando(true)
        setError(null)
        try {
            const data = await API(`/resplandores/${code}`, adminToken, { method: 'DELETE' })
            if (data.status !== 'ok') throw new Error(data.message ?? 'Error al revocar')
            setAccion(`🚫 Resplandor ${code} revocado. Puedes crear uno nuevo.`)
            await buscar()
        } catch (err) { setError(err.message) } finally { setProcesando(false) }
    }

    // Derivar estado: ¿puede crear nuevo resplandor?
    const ahora = new Date()
    const resps  = resultado?.resplandores ?? []
    const activo  = resps.find(r => !r.revoked && !r.used && (!r.expires_at || new Date(r.expires_at) > ahora))
    const expirado = resps.find(r => !r.revoked && !r.used && r.expires_at && new Date(r.expires_at) <= ahora)
    const todosRevocados = resps.length > 0 && resps.every(r => r.revoked)
    const puedeCrear = resps.length === 0 || todosRevocados

    return (
        <div style={{
            background:   'var(--bg-card)',
            border:       '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding:      'var(--space-6)',
        }}>
            <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sun size={20} weight="fill" color="var(--color-amber-600)" />
                Resplandores
            </h3>

            {/* Buscador por email */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
                <input
                    type="email"
                    placeholder="correo@usuario.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setResultado(null); setAccion(null) }}
                    onKeyDown={e => e.key === 'Enter' && buscar()}
                    style={{
                        flex: 1, padding: 'var(--space-3)',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
                        fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none',
                    }}
                />
                <button
                    onClick={buscar}
                    disabled={!email.trim() || buscando}
                    style={{
                        padding: 'var(--space-3) var(--space-4)',
                        background: 'var(--color-jade-500)', border: 'none',
                        borderRadius: 'var(--radius-lg)', color: '#fff',
                        fontWeight: 600, fontSize: 'var(--text-sm)',
                        cursor: email.trim() && !buscando ? 'pointer' : 'not-allowed',
                        fontFamily: 'var(--font-sans)', opacity: buscando ? 0.7 : 1,
                    }}
                >
                    {buscando ? '...' : 'Buscar'}
                </button>
            </div>

            {/* Error */}
            {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', marginBottom: 12 }}>{error}</p>}

            {/* Mensaje de acción exitosa */}
            {accion && <p style={{ color: '#22c55e', fontSize: 'var(--text-xs)', marginBottom: 12, fontWeight: 600 }}>{accion}</p>}

            {/* Resultado */}
            {resultado && (
                <div>
                    {/* Info del usuario */}
                    {resultado.usuario && (
                        <div style={{
                            padding: 'var(--space-3) var(--space-4)',
                            background: 'var(--bg-surface)',
                            borderRadius: 'var(--radius-lg)',
                            marginBottom: 'var(--space-4)',
                            fontSize: 'var(--text-sm)',
                        }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {resultado.usuario.nombre || 'Sin nombre'}
                            </span>
                            <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                                {resultado.usuario.email}
                            </span>
                        </div>
                    )}

                    {/* Lista de resplandores */}
                    {resps.length === 0 && (
                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                            No hay resplandores para este usuario.
                        </p>
                    )}

                    {resps.map(r => {
                        const estaActivo  = !r.revoked && !r.used && (!r.expires_at || new Date(r.expires_at) > ahora)
                        const estaExpir   = !r.revoked && !r.used && r.expires_at && new Date(r.expires_at) <= ahora
                        const estado      = r.revoked ? 'revocado' : r.used ? 'usado' : estaActivo ? 'activo' : 'expirado'

                        return (
                            <div key={r.code} style={{
                                padding:      'var(--space-4)',
                                background:   'var(--bg-surface)',
                                borderRadius: 'var(--radius-lg)',
                                border:       '1px solid var(--border-subtle)',
                                marginBottom: 'var(--space-3)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                    <div>
                                        <code style={{ fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-jade-500)', marginRight: 10 }}>
                                            {r.code}
                                        </code>
                                        <StatusPill estado={estado} />
                                    </div>
                                    {/* Acciones según estado */}
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {/* Reenviar: si activo o expirado */}
                                        {(estaActivo || estaExpir) && (
                                            <button
                                                onClick={() => reenviar(r.code)}
                                                disabled={procesando}
                                                title="Reenviar al correo del usuario"
                                                style={btnSmall('#0D7377')}
                                            >
                                                <Envelope size={12} /> Reenviar
                                            </button>
                                        )}
                                        {/* Revocar: si activo o expirado */}
                                        {(estaActivo || estaExpir) && (
                                            <button
                                                onClick={() => revocar(r.code)}
                                                disabled={procesando}
                                                title="Revocar resplandor"
                                                style={btnSmall('var(--color-error)')}
                                            >
                                                <XCircle size={12} /> Revocar
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {r.expires_at && (
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 6 }}>
                                        Vence: {new Date(r.expires_at).toLocaleDateString('es-MX')}
                                    </p>
                                )}
                            </div>
                        )
                    })}

                    {/* Botón crear nuevo */}
                    {puedeCrear && (
                        <button
                            onClick={crearNuevo}
                            disabled={procesando}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: 'var(--space-3) var(--space-5)',
                                background: 'var(--color-amber-600, #D97706)',
                                border: 'none', borderRadius: 'var(--radius-lg)',
                                color: '#fff', fontWeight: 700, fontSize: 'var(--text-sm)',
                                cursor: procesando ? 'wait' : 'pointer',
                                fontFamily: 'var(--font-sans)',
                                opacity: procesando ? 0.7 : 1,
                            }}
                        >
                            <Plus size={16} />
                            {procesando ? 'Creando...' : 'Crear resplandor y enviar'}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

const btnSmall = (color) => ({
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '4px 10px', background: color + '22',
    border: `1px solid ${color}`, borderRadius: 'var(--radius-md)',
    color, fontSize: 'var(--text-xs)', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
})