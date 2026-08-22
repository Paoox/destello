/**
 * Destello Admin — ReportesPanel
 *
 * Bandeja de lo que la gente reporta por el bot Faro:
 *   · Pagos que hay que cotejar contra el banco
 *   · Problemas de acceso (no puede entrar, no ve su taller)
 *
 * POR QUÉ EXISTE: antes los reportes solo llegaban como mensaje de WhatsApp.
 * Un mensaje perdido entre conversaciones era un pago perdido, y no había manera
 * de saber cuáles ya se habían atendido. Aquí quedan listados y se pueden cerrar.
 *
 * El bot NUNCA activa a nadie por un reporte de pago: eso se hace desde la
 * pestaña de Lista de espera, después de verificar que el dinero cayó.
 */
import { useState, useEffect, useCallback } from 'react'
import {
    ArrowClockwise, CheckCircle, CurrencyDollar,
    WarningCircle, WhatsappLogo, Envelope, UserCheck, UserPlus,
} from '@phosphor-icons/react'

/** Los motivos vienen de reporteService.MOTIVOS en la API. */
const MOTIVOS = {
    reporte_pago: {
        label: 'Reporta un pago',
        ayuda: 'Cotéjalo con el banco antes de activar',
        color: '#8b5cf6',
        Icon:  CurrencyDollar,
    },
    sin_acceso_plataforma: {
        label: 'No puede entrar',
        ayuda: 'Tiene permiso pero no logra entrar a la plataforma',
        color: '#f59e0b',
        Icon:  WarningCircle,
    },
    sin_acceso_taller: {
        label: 'No ve su taller',
        ayuda: 'Está activa y no le aparece el taller',
        color: '#f59e0b',
        Icon:  WarningCircle,
    },
}

const FILTROS = [
    { id: 'abiertos',  label: 'Por revisar' },
    { id: 'pagos',     label: 'Solo pagos' },
    { id: 'revisados', label: 'Revisados' },
    { id: 'todos',     label: 'Todos' },
]

/**
 * Filtros por fecha. `dias: null` = sin límite.
 *
 * Con 9 reportes no hacen falta, pero después de unos meses la bandeja se
 * vuelve inservible sin ellos: lo de esta semana quedaría enterrado bajo
 * cientos de reportes viejos.
 */
const RANGOS = [
    { id: '15d',  label: 'Últimos 15 días', dias: 15 },
    { id: '30d',  label: 'Último mes',      dias: 30 },
    { id: '90d',  label: 'Últimos 3 meses', dias: 90 },
    { id: 'todo', label: 'Desde siempre',   dias: null },
]

/** "hace 5 min" / "hace 3 h" / "hace 2 d" — más útil que una fecha exacta aquí. */
function haceCuanto(iso) {
    if (!iso) return ''
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (min < 1)    return 'ahorita'
    if (min < 60)   return `hace ${min} min`
    const h = Math.floor(min / 60)
    if (h < 24)     return `hace ${h} h`
    const d = Math.floor(h / 24)
    return d === 1 ? 'ayer' : `hace ${d} días`
}

function fechaExacta(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleString('es-MX', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
}

export default function ReportesPanel({ adminToken }) {
    const [reportes,  setReportes]  = useState([])
    const [cargando,  setCargando]  = useState(true)
    const [cerrando,  setCerrando]  = useState(null)
    const [filtro,    setFiltro]    = useState('abiertos')
    const [rango,     setRango]     = useState('30d')
    const [toast,     setToast]     = useState(null)

    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }

    const showToast = (msg, ok = true) => {
        setToast({ msg, ok })
        setTimeout(() => setToast(null), 3500)
    }

    const fetchReportes = useCallback(async () => {
        setCargando(true)
        try {
            // Siempre se piden todos y se filtra en el cliente: son pocos y así
            // cambiar de filtro es instantáneo, sin ir al servidor otra vez.
            const res  = await fetch('/api/admin/reportes', { headers })
            const data = await res.json()
            setReportes(res.ok ? (data.reportes || []) : [])
            if (!res.ok) showToast(data.message || 'Error al cargar reportes', false)
        } catch {
            showToast('Error de conexión', false)
        } finally {
            setCargando(false)
        }
    }, [adminToken])

    useEffect(() => { fetchReportes() }, [fetchReportes])

    const marcarResuelto = async (r) => {
        const quien = r.nombre || r.email
        if (!confirm(`¿Marcar como revisado el reporte de ${quien}?\n\nDesaparece de "Por revisar". Si era un pago, acuérdate de activarla desde Lista de espera.`)) return

        setCerrando(r.id)
        try {
            const res  = await fetch(`/api/admin/reportes/${r.id}/resolver`, {
                method: 'PATCH', headers, body: JSON.stringify({}),
            })
            const data = await res.json()
            if (res.ok) {
                setReportes(prev => prev.map(x =>
                    x.id === r.id ? { ...x, estado: 'resuelto', resuelto_at: new Date().toISOString() } : x
                ))
                showToast('Reporte cerrado ✓')
            } else {
                showToast(data.message || 'No se pudo cerrar', false)
            }
        } catch {
            showToast('Error de conexión', false)
        } finally {
            setCerrando(null)
        }
    }

    // El rango se aplica SIEMPRE, también a "Por revisar": un reporte de hace
    // cuatro meses que sigue abierto ya no es trabajo del día, es arqueología.
    const diasRango = RANGOS.find(r => r.id === rango)?.dias ?? null
    const desde     = diasRango ? Date.now() - diasRango * 86_400_000 : null

    const enRango = r => !desde || new Date(r.created_at).getTime() >= desde

    const visibles = reportes.filter(r => {
        if (!enRango(r)) return false
        if (filtro === 'abiertos')  return r.estado === 'abierto'
        if (filtro === 'pagos')     return r.motivo === 'reporte_pago'
        if (filtro === 'revisados') return r.estado === 'resuelto'
        return true
    })

    // Los contadores del encabezado ignoran el rango a propósito: si tienes algo
    // pendiente de hace meses, tienes que enterarte aunque el filtro lo esconda.
    const abiertos    = reportes.filter(r => r.estado === 'abierto').length
    const pagosAbiert = reportes.filter(r => r.estado === 'abierto' && r.motivo === 'reporte_pago').length
    const ocultosPorRango = reportes.filter(r => r.estado === 'abierto' && !enRango(r)).length

    return (
        <div style={{ position: 'relative' }}>
            {toast && (
                <div style={{
                    position: 'fixed', bottom: 'var(--space-6)', right: 'var(--space-6)',
                    padding: 'var(--space-3) var(--space-4)', zIndex: 100,
                    background: 'var(--bg-surface)',
                    border: `1px solid ${toast.ok ? 'var(--color-jade-500)' : 'var(--color-error)'}`,
                    borderRadius: 'var(--radius-lg)',
                    color: toast.ok ? 'var(--color-jade-500)' : 'var(--color-error)',
                    fontSize: 'var(--text-sm)', fontWeight: 600, maxWidth: 420,
                }}>
                    {toast.msg}
                </div>
            )}

            {/* Resumen + filtros */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-5)',
            }}>
                <div>
                    <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>
                        Reportes del bot
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
                        {abiertos === 0
                            ? 'Nada pendiente por revisar ✓'
                            : `${abiertos} por revisar${pagosAbiert ? ` · ${pagosAbiert} son pagos` : ''}`}
                        {ocultosPorRango > 0 && (
                            <span style={{ color: 'var(--color-amber-500)' }}>
                                {' '}· {ocultosPorRango} más antiguo{ocultosPorRango > 1 ? 's' : ''} fuera de este rango
                            </span>
                        )}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        value={rango}
                        onChange={e => setRango(e.target.value)}
                        style={{
                            padding: '6px 10px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-full)',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                            cursor: 'pointer', outline: 'none',
                        }}
                    >
                        {RANGOS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>

                    {FILTROS.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFiltro(f.id)}
                            style={{
                                padding: '6px 12px',
                                background: filtro === f.id ? 'rgba(13,115,119,0.12)' : 'transparent',
                                border: `1px solid ${filtro === f.id ? 'var(--color-jade-500)' : 'var(--border-default)'}`,
                                borderRadius: 'var(--radius-full)',
                                color: filtro === f.id ? 'var(--color-jade-500)' : 'var(--text-muted)',
                                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                                fontWeight: filtro === f.id ? 700 : 500, cursor: 'pointer',
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                    <button onClick={fetchReportes} style={btnIcon} title="Actualizar">
                        <ArrowClockwise size={16} />
                    </button>
                </div>
            </div>

            {cargando && (
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Cargando…</p>
            )}

            {!cargando && visibles.length === 0 && (
                <div style={{
                    padding: 'var(--space-8)', textAlign: 'center',
                    border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-lg)',
                    color: 'var(--text-muted)', fontSize: 'var(--text-sm)',
                }}>
                    {filtro === 'abiertos'
                        ? '✓ No hay reportes pendientes.'
                        : 'No hay reportes que mostrar con este filtro.'}
                </div>
            )}

            {/* Tarjetas — se leen mejor que una tabla porque el detalle es texto largo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {visibles.map(r => {
                    const m         = MOTIVOS[r.motivo] || { label: r.motivo, color: 'var(--text-muted)', Icon: WarningCircle }
                    const Icon      = m.Icon
                    const resuelto  = r.estado === 'resuelto'
                    const waLimpio  = String(r.whatsapp || '').replace(/\D/g, '').slice(-10)

                    return (
                        <div
                            key={r.id}
                            style={{
                                padding: 'var(--space-4)',
                                background: 'var(--bg-surface)',
                                border: `1px solid ${resuelto ? 'var(--border-subtle)' : m.color + '55'}`,
                                borderLeft: `3px solid ${resuelto ? 'var(--border-subtle)' : m.color}`,
                                borderRadius: 'var(--radius-lg)',
                                opacity: resuelto ? 0.55 : 1,
                            }}
                        >
                            <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                gap: 'var(--space-3)', flexWrap: 'wrap',
                            }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    {/* Motivo */}
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '3px 10px', marginBottom: 8,
                                        background: m.color + '22',
                                        border: `1px solid ${m.color}`,
                                        borderRadius: 'var(--radius-full)',
                                        color: m.color, fontSize: 'var(--text-xs)', fontWeight: 700,
                                    }}>
                                        <Icon size={13} weight="fill" />
                                        {m.label}
                                    </div>

                                    {/* Estado de su cuenta.
                                        Importa porque cambia lo que tienes que hacer: a alguien
                                        SIN cuenta, además de confirmarle el pago, hay que dejarla
                                        entrar por primera vez. Si ya tiene cuenta activa, con
                                        confirmar el pago basta. */}
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                        padding: '3px 10px', marginLeft: 8, marginBottom: 8,
                                        background: r.cuenta_activa ? 'rgba(13,115,119,0.12)' : 'rgba(217,119,6,0.12)',
                                        border: `1px solid ${r.cuenta_activa ? 'var(--color-jade-500)' : 'var(--color-amber-500)'}`,
                                        borderRadius: 'var(--radius-full)',
                                        color: r.cuenta_activa ? 'var(--color-jade-500)' : 'var(--color-amber-500)',
                                        fontSize: 'var(--text-xs)', fontWeight: 700,
                                    }}>
                                        {r.cuenta_activa
                                            ? <><UserCheck size={13} weight="fill" /> Ya tiene cuenta</>
                                            : r.tiene_cuenta
                                                ? <><UserPlus size={13} weight="fill" /> Cuenta sin activar</>
                                                : <><UserPlus size={13} weight="fill" /> Alumna nueva</>}
                                    </span>

                                    <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>
                                        {r.nombre || 'Sin nombre'}
                                    </div>

                                    <div style={{
                                        display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap',
                                        color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4,
                                    }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                            <Envelope size={13} /> {r.email}
                                        </span>
                                        {waLimpio && (
                                            <a
                                                href={`https://wa.me/52${waLimpio}`}
                                                target="_blank" rel="noreferrer"
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                    color: '#25D366', textDecoration: 'none',
                                                }}
                                            >
                                                <WhatsappLogo size={13} weight="fill" /> {waLimpio}
                                            </a>
                                        )}
                                    </div>

                                    {/* Detalle: los datos del pago o la descripción del problema */}
                                    {r.detalle && (
                                        <div style={{
                                            marginTop: 10, padding: 'var(--space-3)',
                                            background: 'var(--bg-base)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--text-sm)', lineHeight: 1.6,
                                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                        }}>
                                            {r.detalle}
                                        </div>
                                    )}

                                    {/* Comprobante: se ve aquí mismo, sin ir a WhatsApp.
                                        La URL viene firmada por la API y caduca en 1 h,
                                        así que se abre en pestaña nueva para verla grande. */}
                                    {r.comprobante_url && (
                                        <a
                                            href={r.comprobante_url}
                                            target="_blank" rel="noreferrer"
                                            title="Abrir el comprobante en grande"
                                            style={{ display: 'inline-block', marginTop: 10 }}
                                        >
                                            <img
                                                src={r.comprobante_url}
                                                alt="Comprobante de pago"
                                                loading="lazy"
                                                style={{
                                                    maxWidth: 260, maxHeight: 200,
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--border-default)',
                                                    display: 'block', objectFit: 'cover',
                                                }}
                                            />
                                        </a>
                                    )}

                                    {/* Mandó foto pero no se pudo guardar (storage sin
                                        configurar, o la URL ya caducó y no se recargó). */}
                                    {!r.comprobante_url && r.detalle?.includes('FOTO') && (
                                        <p style={{
                                            marginTop: 8, marginBottom: 0,
                                            color: 'var(--text-muted)', fontSize: 'var(--text-xs)',
                                        }}>
                                            📸 La foto llegó a tu WhatsApp — no quedó guardada aquí.
                                        </p>
                                    )}

                                    {r.motivo === 'reporte_pago' && !resuelto && (
                                        <p style={{
                                            marginTop: 8, marginBottom: 0,
                                            color: 'var(--text-muted)', fontSize: 'var(--text-xs)', fontStyle: 'italic',
                                        }}>
                                            Si el pago cayó, actívala desde <strong>Lista de espera</strong> → confirmar pago.
                                        </p>
                                    )}
                                </div>

                                {/* Tiempo + acción */}
                                <div style={{
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'flex-end', gap: 'var(--space-2)', flexShrink: 0,
                                }}>
                                    <span
                                        title={fechaExacta(r.created_at)}
                                        style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}
                                    >
                                        {haceCuanto(r.created_at)}
                                    </span>

                                    {resuelto ? (
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 5,
                                            color: 'var(--color-jade-500)', fontSize: 'var(--text-xs)', fontWeight: 600,
                                        }}>
                                            <CheckCircle size={14} weight="fill" /> Revisado
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => marcarResuelto(r)}
                                            disabled={cerrando === r.id}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                padding: '6px 12px',
                                                background: 'rgba(13,115,119,0.12)',
                                                border: '1px solid var(--color-jade-500)',
                                                borderRadius: 'var(--radius-full)',
                                                color: 'var(--color-jade-500)',
                                                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 700,
                                                cursor: cerrando === r.id ? 'wait' : 'pointer',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            <CheckCircle size={14} />
                                            {cerrando === r.id ? 'Cerrando…' : 'Ya lo revisé'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

const btnIcon = {
    display: 'flex', alignItems: 'center', padding: 'var(--space-2)',
    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)', cursor: 'pointer',
}
