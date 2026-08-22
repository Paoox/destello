/**
 * Destello Admin — ListaEsperaAdmin
 */
import { useState, useEffect, useCallback } from 'react'
import { WhatsappLogo, Envelope, ArrowClockwise, CheckCircle, WarningCircle, SealCheck, PaperPlaneTilt, BellRinging, LockKeyOpen } from '@phosphor-icons/react'
import { fmtFechaCompleta } from '@utils/fecha.js'

const ESTADOS_OPTS = [
    { value: 'pendiente',        label: '⏳ Pendiente',         color: '#f59e0b' },
    { value: 'cupo_confirmado',  label: '✅ Lugar confirmado',  color: '#22c55e' },
    { value: 'pagado',           label: '💰 Pagado',            color: '#8b5cf6' },
    { value: 'rechazado',        label: '❌ Rechazado',          color: 'var(--color-error)' },
]

const SPEI_CLABE = '036180500687558754'
const CARD_NUM   = '4658 2850 1724 7424'

/** Plazo para reportar el pago antes de que el lugar se libere. */
const HORAS_PARA_PAGAR = 48

/**
 * Estado del reloj de pago de un registro.
 *
 * Solo aplica a quien tiene el lugar apartado (`cupo_confirmado`) pero aún no
 * paga. `apartado_at` viene de la fecha de su chispa — ver GET /admin/lista-espera.
 *
 * @returns {{ clave: 'na'|'en_plazo'|'por_vencer'|'vencido', horas: number|null }}
 */
function relojPago(r) {
    if (r.estado !== 'cupo_confirmado' || !r.apartado_at) return { clave: 'na', horas: null }

    const transcurridas = (Date.now() - new Date(r.apartado_at).getTime()) / 3_600_000
    const restantes     = HORAS_PARA_PAGAR - transcurridas

    if (restantes <= 0) return { clave: 'vencido',    horas: Math.round(-restantes) }
    if (restantes <= 12) return { clave: 'por_vencer', horas: Math.round(restantes) }
    return { clave: 'en_plazo', horas: Math.round(restantes) }
}

const RELOJ_CFG = {
    en_plazo:   { color: 'var(--text-muted)',        etiqueta: h => `${h} h para pagar` },
    por_vencer: { color: 'var(--color-amber-500)',   etiqueta: h => `⏳ vence en ${h} h` },
    vencido:    { color: 'var(--color-error)',       etiqueta: h => `⚠️ venció hace ${h} h` },
}

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
    // OJO: esta fecha se le manda a la alumna por WhatsApp. Con `new Date()`
    // directo se corría un día (medianoche UTC → día anterior en CDMX), o sea
    // le estábamos dando la fecha equivocada de su taller. Ver `@utils/fecha.js`.
    const fecha   = fmtFechaCompleta(r.taller_fecha)
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
        `⏳ Tienes *${HORAS_PARA_PAGAR} horas* para reportar tu pago. Pasado ese tiempo el lugar se libera para alguien más.`,
        '',
        '¿Tienes dudas? Con gusto te atendemos. 😊',
    ].filter(l => l !== null).join('\n')
}

/**
 * Recordatorio para quien ya se pasó de las 48 h sin reportar pago.
 *
 * Deliberadamente amable pero claro: la persona pudo haber pagado y olvidado
 * avisarnos, así que primero se le da esa salida antes de hablar de liberar
 * el lugar.
 */
function buildWaRecordatorio(r) {
    const nombre = r.nombre?.split(' ')[0] || 'alumno/a'
    const taller = r.taller_nombre || 'el taller'

    return [
        `¡Hola ${nombre}! ✦`,
        '',
        `Te escribo por tu lugar en *${taller}*.`,
        '',
        'Todavía no nos llega tu comprobante de pago y el plazo ya se cumplió. ' +
        'Si ya pagaste, mándame la foto por aquí y lo confirmo enseguida. 📸',
        '',
        'Si algo se te complicó, dime y vemos cómo te ayudo. ' +
        'Si no puedo confirmarlo pronto tendría que liberar tu lugar para alguien de la lista. 🙏',
        '',
        '¿Me confirmas?',
    ].join('\n')
}

export default function ListaEsperaAdmin({ adminToken }) {
    const [lista,        setLista]        = useState([])
    const [loading,      setLoading]      = useState(false)
    const [updating,     setUpdating]     = useState(null)
    const [enviandoMail, setEnviandoMail] = useState(null)
    const [enviandoWa,   setEnviandoWa]   = useState(null)
    const [confirmandoPago, setConfirmandoPago] = useState(null)
    const [liberando,    setLiberando]    = useState(null)
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

    /**
     * Envía un mensaje por el bot.
     * @param {'invitacion'|'recordatorio'} tipo
     */
    const enviarWa = async (r, tipo = 'invitacion') => {
        const numero = String(r.whatsapp || '').replace(/\D/g, '').slice(-10)
        if (!numero || numero.length !== 10) {
            showToast('Número de WhatsApp inválido', false)
            return
        }

        const esRecordatorio = tipo === 'recordatorio'
        const pregunta = esRecordatorio
            ? `¿Mandar recordatorio de pago a ${r.nombre || r.email}?\n\nSe le avisa que el plazo ya venció y que su lugar podría liberarse.`
            : `¿Enviar mensaje de confirmación por WhatsApp a ${r.nombre || r.email}?\n\nSe enviará desde el número del bot Faro.`
        if (!confirm(pregunta)) return

        setEnviandoWa(r.id)
        try {
            const mensaje = esRecordatorio ? buildWaRecordatorio(r) : buildWaMensaje(r)
            const res     = await fetch('/api/admin/send-wa', {
                method: 'POST', headers,
                body:   JSON.stringify({ numero, mensaje }),
            })
            const data = await res.json()
            if (res.ok) {
                showToast(`${esRecordatorio ? 'Recordatorio' : 'Mensaje'} WA enviado a ${r.nombre || numero} ✓`)
            } else {
                showToast(data.message || 'Error al enviar WA', false)
            }
        } catch { showToast('Error de conexión', false) }
        finally { setEnviandoWa(null) }
    }

    /**
     * Libera el lugar de quien no pagó.
     *
     * Además de marcar 'rechazado', el backend REVOCA su chispa: si no, la
     * persona conservaría la llave del taller que nunca pagó.
     */
    const liberarLugar = async (r) => {
        const quien = r.nombre || r.email
        if (!confirm(
            `¿Liberar el lugar de ${quien}?\n\n` +
            `· Su registro pasa a "rechazado"\n` +
            `· Se revoca su chispa (pierde el acceso al taller)\n` +
            `· El cupo queda libre para alguien más\n\n` +
            `Si después paga, tendrás que volver a apartarle el lugar.`
        )) return

        setLiberando(r.id)
        try {
            const res  = await fetch(`/api/admin/lista-espera/${r.id}/liberar`, { method: 'POST', headers })
            const data = await res.json()
            if (res.ok) {
                const n = data.revocadas?.length ?? 0
                showToast(`Lugar liberado${n ? ` · ${n} chispa${n > 1 ? 's' : ''} revocada${n > 1 ? 's' : ''}` : ''} ✓`)
                setLista(prev => prev.map(x => x.id === r.id ? { ...x, estado: 'rechazado' } : x))
            } else {
                showToast(data.message || 'No se pudo liberar', false)
            }
        } catch { showToast('Error de conexión', false) }
        finally { setLiberando(null) }
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
                // `avisoWa` llega cuando el número ya pertenecía a otra cuenta: la
                // cuenta se activa igual, pero el número NO se copia. Hay que
                // enseñarlo, si no el número "desaparece" sin explicación.
                if (data.avisoWa) showToast(`⚠️ ${data.avisoWa}`, false)
                else showToast(`${esReenvio ? 'Acceso reenviado' : 'Cuenta lista'}${canales ? ` · ${canales}` : ''} ✓`)
                setLista(prev => prev.map(x => x.id === r.id ? { ...x, estado: 'pagado' } : x))
            } else {
                showToast(data.message || 'Error al procesar', false)
            }
        } catch { showToast('Error de conexión', false) }
        finally { setConfirmandoPago(null) }
    }

    // `por_cobrar` no es un estado de la BD: es el reloj de 48 h ya vencido o
    // por vencer. Es la vista de trabajo — a quién hay que recordarle hoy.
    const filtered = lista.filter(r => {
        if (filterEstado === 'all') return true
        if (filterEstado === 'por_cobrar') {
            return ['vencido', 'por_vencer'].includes(relojPago(r).clave)
        }
        return r.estado === filterEstado
    })

    const porCobrar = lista.filter(r => ['vencido', 'por_vencer'].includes(relojPago(r).clave)).length

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
                        {['all', 'pendiente', 'cupo_confirmado', 'por_cobrar', 'pagado', 'rechazado'].map(f => {
                            const activo   = filterEstado === f
                            // "Por cobrar" se pinta en ámbar aunque no esté activo:
                            // es la única pestaña que representa trabajo urgente.
                            const urgente  = f === 'por_cobrar' && porCobrar > 0
                            const acento   = urgente ? 'var(--color-amber-500)' : 'var(--color-jade-500)'
                            return (
                                <button key={f} onClick={() => setFilterEstado(f)} style={{
                                    padding: '4px 12px', borderRadius: 999, border: '1px solid',
                                    borderColor: activo ? acento : (urgente ? acento : 'var(--border-default)'),
                                    background: activo ? `${acento}22` : 'transparent',
                                    color: activo || urgente ? acento : 'var(--text-muted)',
                                    fontSize: 'var(--text-xs)', fontWeight: activo || urgente ? 600 : 400,
                                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                                }}>
                                    {{
                                        all: 'Todos', pendiente: 'Pendientes', cupo_confirmado: 'Confirmados',
                                        por_cobrar: `Por cobrar${porCobrar ? ` (${porCobrar})` : ''}`,
                                        pagado: 'Pagados', rechazado: 'Rechazados',
                                    }[f]}
                                </button>
                            )
                        })}
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
                                    {/* Reloj de 48 h. Solo se ve mientras el pago está en juego:
                                        una vez pagado deja de importar cuánto tardó. */}
                                    {(() => {
                                        const reloj = relojPago(r)
                                        if (reloj.clave === 'na') return null
                                        const cfg = RELOJ_CFG[reloj.clave]
                                        return (
                                            <div style={{
                                                marginTop: 5, color: cfg.color,
                                                fontSize: 'var(--text-xs)',
                                                fontWeight: reloj.clave === 'en_plazo' ? 400 : 700,
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {cfg.etiqueta(reloj.horas)}
                                            </div>
                                        )
                                    })()}
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
                                        {/* Recordar pago — solo aparece cuando el reloj de 48 h
                                            ya venció o está por vencer. No tiene sentido ofrecerlo
                                            para alguien que apenas apartó su lugar hace una hora. */}
                                        {r.whatsapp && ['vencido', 'por_vencer'].includes(relojPago(r).clave) && (
                                            <button
                                                onClick={() => enviarWa(r, 'recordatorio')}
                                                disabled={enviandoWa === r.id}
                                                title="Recordarle que su lugar está por liberarse"
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                    padding: '4px 8px', height: 28,
                                                    background: 'rgba(217,119,6,0.12)',
                                                    border: '1px solid var(--color-amber-500)',
                                                    borderRadius: 'var(--radius-md)',
                                                    color: 'var(--color-amber-500)',
                                                    cursor: enviandoWa === r.id ? 'wait' : 'pointer',
                                                    fontFamily: 'var(--font-sans)',
                                                    fontSize: 'var(--text-xs)', fontWeight: 600,
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                <BellRinging size={13} weight="fill" /> Recordar
                                            </button>
                                        )}
                                        {/* Liberar lugar — solo cuando el plazo YA venció, nunca
                                            en "por vencer": mientras quede tiempo, la persona
                                            todavía está en su derecho de pagar. */}
                                        {relojPago(r).clave === 'vencido' && (
                                            <button
                                                onClick={() => liberarLugar(r)}
                                                disabled={liberando === r.id}
                                                title="Liberar el cupo y revocar su chispa"
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                    padding: '4px 8px', height: 28,
                                                    background: 'rgba(239,68,68,0.10)',
                                                    border: '1px solid var(--color-error)',
                                                    borderRadius: 'var(--radius-md)',
                                                    color: 'var(--color-error)',
                                                    cursor: liberando === r.id ? 'wait' : 'pointer',
                                                    fontFamily: 'var(--font-sans)',
                                                    fontSize: 'var(--text-xs)', fontWeight: 600,
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                <LockKeyOpen size={13} weight="fill" />
                                                {liberando === r.id ? 'Liberando…' : 'Liberar'}
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