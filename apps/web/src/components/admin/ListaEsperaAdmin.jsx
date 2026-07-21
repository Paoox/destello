/**
 * Destello Admin — ListaEsperaAdmin
 */
import { useState, useEffect, useCallback } from 'react'
import { WhatsappLogo, Envelope, ArrowClockwise, CheckCircle, WarningCircle, SealCheck, PaperPlaneTilt } from '@phosphor-icons/react'

const ESTADOS_OPTS = [
    { value: 'pendiente',        label: '⏳ Pendiente',         color: '#f59e0b' },
    { value: 'cupo_confirmado',  label: '✅ Lugar confirmado',  color: '#22c55e' },
    { value: 'pagado',           label: '💰 Pagado',            color: '#8b5cf6' },
    { value: 'rechazado',        label: '❌ Rechazado',          color: 'var(--color-error)' },
]

const SPEI_CLABE = '036180500687558754'
const CARD_NUM   = '4658 2850 1724 7424'

function EstadoSelect({ value, onChange, disabled }) {
    const opt = ESTADOS_OPTS.find(o => o.value === value)
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            style={{
                padding: '3px 8px',
                background: (opt?.color ?? 'var(--text-muted)') + '22',
                border: `1px solid ${opt?.color ?? 'var(--border-default)'}`,
                borderRadius: 999, color: opt?.color ?? 'var(--text-muted)',
                fontSize: 'var(--text-xs)', fontWeight: 600,
                cursor: disabled ? 'default' : 'pointer',
                fontFamily: 'var(--font-sans)', outline: 'none',
            }}
        >
            {ESTADOS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    )
}

/** Construye el texto del mensaje WA (sin URL, solo el texto plano) */
function buildWaMensaje(r) {
    const nombre  = r.nombre?.split(' ')[0] || 'alumno/a'
    const taller  = r.taller_nombre || 'el taller'
    const precio  = r.taller_precio && Number(r.taller_precio) > 0
        ? `$${Number(r.taller_precio).toLocaleString('es-MX')} MXN` : 'Gratuito'
    const fecha   = r.taller_fecha
        ? new Date(r.taller_fecha).toLocaleDateString('es-MX',
            { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : null
    const horario = r.taller_horario || null

    return [
        `¡Hola ${nombre}! ✦`,
        '',
        `¡Alcanzaste un lugar en Destello! 🎉`,
        '',
        `✦ *${taller}*`,
        fecha   ? `📅 Fecha: ${fecha}` : null,
        horario ? `🕐 Horario: ${horario} (CDMX)` : null,
        `💰 Inversión: ${precio}`,
        '',
        'Para confirmar tu lugar realiza tu pago:',
        '',
        '🏦 *SPEI — Inbursa*',
        'Titular: Paola Arreola',
        `CLABE: ${SPEI_CLABE}`,
        '',
        '💳 *Pago en efectivo*',
        `Tarjeta: ${CARD_NUM}`,
        'Titular: Paola Arreola',
        '(Walmart · OXXO · Sears · Sanborns · Bodega Aurrera)',
        '',
        'Una vez realizado tu pago, envíanos tu *comprobante por WhatsApp* a este mismo número. ✦',
        '',
        '¿Tienes dudas? Con gusto te atendemos. 😊',
    ].filter(l => l !== null).join('\n')
}

export default function ListaEsperaAdmin({ adminToken }) {
    const [lista,        setLista]        = useState([])
    const [loading,      setLoading]      = useState(false)
    const [updating,     setUpdating]     = useState(null)
    const [enviandoMail, setEnviandoMail] = useState(null)
    const [enviandoWa,   setEnviandoWa]   = useState(null)
    const [confirmandoPago, setConfirmandoPago] = useState(null)
    const [toast,        setToast]        = useState(null)
    const [filterEstado, setFilterEstado] = useState('all')

    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }

    const showToast = (msg, ok = true) => {
        setToast({ msg, ok })
        setTimeout(() => setToast(null), 3500)
    }

    const fetchLista = useCallback(async () => {
        setLoading(true)
        try {
            const res  = await fetch('/api/admin/lista-espera', { headers })
            const data = await res.json()
            setLista(data.lista ?? [])
        } catch { setLista([]) } finally { setLoading(false) }
    }, [adminToken])

    useEffect(() => { fetchLista() }, [fetchLista])

    const updateEstado = async (id, nuevoEstado) => {
        setUpdating(id)
        try {
            const res = await fetch(`/api/admin/lista-espera/${id}`, {
                method: 'PATCH', headers,
                body:   JSON.stringify({ estado: nuevoEstado }),
            })
            if (res.ok) {
                setLista(prev => prev.map(r => r.id === id ? { ...r, estado: nuevoEstado } : r))
                showToast('Estado guardado ✓')
            } else {
                showToast('Error al guardar estado', false)
            }
        } catch { showToast('Error de conexión', false) }
        finally { setUpdating(null) }
    }

    const enviarCorreo = async (r) => {
        if (!confirm(`¿Enviar correo de confirmación a ${r.nombre || r.email}?\n\nSe enviará con los detalles del taller y métodos de pago.`)) return
        setEnviandoMail(r.id)
        try {
            const res  = await fetch(`/api/admin/lista-espera/${r.id}/confirmar-lugar`, {
                method: 'POST', headers,
            })
            const data = await res.json()
            if (res.ok) {
                showToast(data.enviado ? `Correo enviado a ${r.email} ✓` : 'Lugar confirmado (sin correo)')
                setLista(prev => prev.map(x => x.id === r.id ? { ...x, estado: 'cupo_confirmado' } : x))
            } else {
                showToast(data.message || 'Error al enviar correo', false)
            }
        } catch { showToast('Error de conexión', false) }
        finally { setEnviandoMail(null) }
    }

    const enviarWa = async (r) => {
        const numero = String(r.whatsapp || '').replace(/\D/g, '').slice(-10)
        if (!numero || numero.length !== 10) {
            showToast('Número de WhatsApp inválido', false)
            return
        }
        if (!confirm(`¿Enviar mensaje de confirmación por WhatsApp a ${r.nombre || r.email}?\n\nSe enviará desde el número del bot Faro.`)) return

        setEnviandoWa(r.id)
        try {
            const mensaje = buildWaMensaje(r)
            const res     = await fetch('/api/admin/send-wa', {
                method: 'POST', headers,
                body:   JSON.stringify({ numero, mensaje }),
            })
            const data = await res.json()
            if (res.ok) {
                showToast(`Mensaje WA enviado a ${r.nombre || numero} ✓`)
            } else {
                showToast(data.message || 'Error al enviar WA', false)
            }
        } catch { showToast('Error de conexión', false) }
        finally { setEnviandoWa(null) }
    }

    const confirmarPago = async (r) => {
        const esReenvio = r.estado === 'pagado'
        const msg = esReenvio
            ? `¿Reenviar el acceso a ${r.nombre || r.email}?\n\n` +
              `Se volverá a enviar la bienvenida por WhatsApp y correo (con el enlace para crear su cuenta). ` +
              `La cuenta y el taller que ya existen se conservan.`
            : `¿Confirmar el pago de ${r.nombre || r.email}?\n\n` +
              `Se creará/activará su cuenta, se le asignará el taller y se le enviará ` +
              `la bienvenida por WhatsApp y correo (con el enlace para crear su cuenta).`
        if (!confirm(msg)) return

        setConfirmandoPago(r.id)
        try {
            const res  = await fetch(`/api/admin/lista-espera/${r.id}/confirmar-pago`, { method: 'POST', headers })
            const data = await res.json()
            if (res.ok) {
                const canales = [data.waEnviado && 'WhatsApp', data.mailEnviado && 'correo'].filter(Boolean).join(' y ')
                showToast(`${esReenvio ? 'Acceso reenviado' : 'Cuenta lista'}${canales ? ` · ${canales}` : ''} ✓`)
                setLista(prev => prev.map(x => x.id === r.id ? { ...x, estado: 'pagado' } : x))
            } else {
                showToast(data.message || 'Error al procesar', false)
            }
        } catch { showToast('Error de conexión', false) }
        finally { setConfirmandoPago(null) }
    }

    const filtered = lista.filter(r => filterEstado === 'all' || r.estado === filterEstado)

    return (
        <div style={{ position: 'relative' }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: 'var(--space-6)', right: 'var(--space-6)',
                    background: toast.ok ? '#22c55e22' : 'var(--color-error)22',
                    border: `1px solid ${toast.ok ? '#22c55e' : 'var(--color-error)'}`,
                    borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-5)',
                    display: 'flex', alignItems: 'center', gap: 8,
                    color: toast.ok ? '#22c55e' : 'var(--color-error)',
                    fontWeight: 600, fontSize: 'var(--text-sm)', zIndex: 1000,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                }}>
                    {toast.ok
                        ? <CheckCircle size={16} weight="fill" />
                        : <WarningCircle size={16} weight="fill" />
                    }
                    {toast.msg}
                </div>
            )}

            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xl)', overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 'var(--space-5) var(--space-6)',
                    borderBottom: '1px solid var(--border-subtle)',
                    gap: 'var(--space-3)', flexWrap: 'wrap',
                }}>
                    <h3 style={{ fontWeight: 700, margin: 0 }}>⏳ Lista de espera ({filtered.length})</h3>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                        {['all', 'pendiente', 'cupo_confirmado', 'pagado', 'rechazado'].map(f => (
                            <button key={f} onClick={() => setFilterEstado(f)} style={{
                                padding: '4px 12px', borderRadius: 999, border: '1px solid',
                                borderColor: filterEstado === f ? 'var(--color-jade-500)' : 'var(--border-default)',
                                background: filterEstado === f ? 'var(--color-jade-500)22' : 'transparent',
                                color: filterEstado === f ? 'var(--color-jade-500)' : 'var(--text-muted)',
                                fontSize: 'var(--text-xs)', fontWeight: filterEstado === f ? 600 : 400,
                                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                            }}>
                                {{ all: 'Todos', pendiente: 'Pendientes', cupo_confirmado: 'Confirmados', pagado: 'Pagados', rechazado: 'Rechazados' }[f]}
                            </button>
                        ))}
                        <button onClick={fetchLista} disabled={loading} style={{
                            display: 'flex', alignItems: 'center', padding: 'var(--space-2)',
                            background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)', cursor: 'pointer',
                        }}>
                            <ArrowClockwise size={14} />
                        </button>
                    </div>
                </div>

                {/* Tabla */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                        <thead>
                        <tr style={{ background: 'var(--bg-surface)' }}>
                            {['Nombre', 'Correo', 'Taller', 'Fecha', 'Estado', 'Contacto'].map(h => (
                                <th key={h} style={{
                                    padding: 'var(--space-3) var(--space-4)', textAlign: 'left',
                                    color: 'var(--text-muted)', fontWeight: 500,
                                    fontSize: 'var(--text-xs)', whiteSpace: 'nowrap',
                                }}>{h}</th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {loading && (
                            <tr><td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Cargando...
                            </td></tr>
                        )}
                        {!loading && filtered.length === 0 && (
                            <tr><td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No hay registros
                            </td></tr>
                        )}
                        {filtered.map(r => (
                            <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>
                                    {r.nombre || <span style={{ color: 'var(--text-disabled)', fontStyle: 'italic' }}>—</span>}
                                </td>
                                <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                    {r.email}
                                </td>
                                <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', maxWidth: 160 }}>
                                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {r.taller_nombre || r.taller_id}
                                    </span>
                                </td>
                                <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 'var(--text-xs)' }}>
                                    {r.created_at ? new Date(r.created_at).toLocaleDateString('es-MX') : '—'}
                                </td>
                                <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                    <EstadoSelect
                                        value={r.estado ?? 'pendiente'}
                                        onChange={val => updateEstado(r.id, val)}
                                        disabled={updating === r.id}
                                    />
                                </td>
                                <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        {/* Confirmar pago (cupo_confirmado) o Reenviar acceso (pagado) */}
                                        {(r.estado === 'cupo_confirmado' || r.estado === 'pagado') && (() => {
                                            const esReenvio = r.estado === 'pagado'
                                            const acento    = esReenvio ? 'var(--color-jade-500)' : '#8b5cf6'
                                            return (
                                                <button
                                                    onClick={() => confirmarPago(r)}
                                                    disabled={confirmandoPago === r.id}
                                                    title={esReenvio
                                                        ? 'Reenviar acceso (bienvenida por correo + WhatsApp)'
                                                        : 'Confirmar pago → crea la cuenta, asigna el taller y envía la bienvenida'}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 5,
                                                        height: 28, padding: '0 10px',
                                                        background: `${acento}22`, border: `1px solid ${acento}`,
                                                        borderRadius: 'var(--radius-md)',
                                                        color: confirmandoPago === r.id ? 'var(--text-muted)' : acento,
                                                        cursor: confirmandoPago === r.id ? 'wait' : 'pointer',
                                                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                                                        fontWeight: 600, whiteSpace: 'nowrap',
                                                    }}>
                                                    {esReenvio ? <PaperPlaneTilt size={14} weight="fill" /> : <SealCheck size={14} weight="fill" />}
                                                    {confirmandoPago === r.id
                                                        ? (esReenvio ? 'Reenviando...' : 'Confirmando...')
                                                        : (esReenvio ? 'Reenviar acceso' : 'Confirmar pago')}
                                                </button>
                                            )
                                        })()}
                                        {/* WA — envía directo desde el bot Faro */}
                                        {r.whatsapp && (
                                            <button
                                                onClick={() => enviarWa(r)}
                                                disabled={enviandoWa === r.id}
                                                title="Enviar confirmación por WhatsApp (bot Faro)"
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    width: 28, height: 28,
                                                    background: enviandoWa === r.id ? 'transparent' : '#25D36622',
                                                    border: '1px solid #25D366',
                                                    borderRadius: 'var(--radius-md)',
                                                    color: enviandoWa === r.id ? 'var(--text-muted)' : '#25D366',
                                                    cursor: enviandoWa === r.id ? 'wait' : 'pointer',
                                                    fontFamily: 'var(--font-sans)',
                                                }}>
                                                <WhatsappLogo size={14} weight="fill" />
                                            </button>
                                        )}
                                        {/* Correo — envía via Resend con template completo */}
                                        {r.email && (
                                            <button
                                                onClick={() => enviarCorreo(r)}
                                                disabled={enviandoMail === r.id}
                                                title="Enviar correo de confirmación (con detalles + pagos)"
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    width: 28, height: 28,
                                                    background: 'var(--color-jade-500)22',
                                                    border: '1px solid var(--color-jade-500)',
                                                    borderRadius: 'var(--radius-md)',
                                                    color: enviandoMail === r.id ? 'var(--text-muted)' : 'var(--color-jade-500)',
                                                    cursor: enviandoMail === r.id ? 'wait' : 'pointer',
                                                    fontFamily: 'var(--font-sans)',
                                                }}>
                                                <Envelope size={14} weight="fill" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}