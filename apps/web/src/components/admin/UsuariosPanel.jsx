/**
 * Destello Admin — UsuariosPanel
 *
 * Bloquear cuentas sin borrarlas. Dos interruptores independientes:
 *
 *   · Acceso  → no entra a la plataforma, ni por la web ni por el bot Faro.
 *   · Compras → entra y usa lo que ya pagó, pero no aparta lugar en nada nuevo.
 *
 * POR QUÉ ASÍ: la herramienta contra el fraude no puede ser borrar una cuenta.
 * Borrar se lleva por delante el historial, los certificados y las métricas, y
 * no se puede deshacer el día que resulte que el bloqueo estuvo mal. Aquí todo
 * es reversible y todo pide un motivo, que queda guardado.
 *
 * Bloquear compras NO revoca lo que la persona ya tenía. Si además hay que
 * quitárselo, se revoca desde la pestaña Accesos, a mano y a propósito.
 */
import { useState, useEffect, useCallback } from 'react'
import {
    ArrowClockwise, MagnifyingGlass, Prohibit, ShieldCheck,
    ShoppingCartSimple, ClockCounterClockwise, WhatsappLogo,
    Certificate, Sparkle, X, Warning,
} from '@phosphor-icons/react'

const FILTROS = [
    { id: 'todos',      label: 'Todos' },
    { id: 'bloqueados', label: 'Bloqueados' },
    { id: 'activos',    label: 'Sin bloqueo' },
]

const ROJO  = '#ef4444'
const AMBAR = '#f59e0b'

function fecha(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleString('es-MX', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    })
}

export default function UsuariosPanel({ adminToken }) {
    const [usuarios, setUsuarios] = useState([])
    const [stats,    setStats]    = useState(null)
    const [cargando, setCargando] = useState(true)
    const [filtro,   setFiltro]   = useState('todos')
    const [busca,    setBusca]    = useState('')
    const [toast,    setToast]    = useState(null)
    // Confirmación de bloqueo: { usuario, tipo, bloquear }
    const [pidiendo, setPidiendo] = useState(null)
    const [motivo,   setMotivo]   = useState('')
    const [guardando, setGuardando] = useState(false)
    // Historial abierto: email → array de movimientos (null = cargando)
    const [historial, setHistorial] = useState({})

    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }

    const showToast = (msg, ok = true) => {
        setToast({ msg, ok })
        setTimeout(() => setToast(null), 4000)
    }

    const fetchUsuarios = useCallback(async () => {
        setCargando(true)
        try {
            const params = new URLSearchParams({ filtro, ...(busca.trim() ? { busca: busca.trim() } : {}) })
            const res  = await fetch(`/api/admin/usuarios?${params}`, { headers })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || 'No se pudo cargar')
            setUsuarios(data.usuarios || [])
            setStats(data.stats || null)
        } catch (e) {
            showToast(e.message || 'Error de conexión', false)
        } finally {
            setCargando(false)
        }
    }, [adminToken, filtro, busca])

    // La búsqueda espera 400 ms: sin eso, escribir "paola" dispararía seis
    // consultas a Supabase, una por letra.
    useEffect(() => {
        const t = setTimeout(fetchUsuarios, busca ? 400 : 0)
        return () => clearTimeout(t)
    }, [fetchUsuarios])

    const abrirConfirmacion = (usuario, tipo, bloquear) => {
        setMotivo('')
        setPidiendo({ usuario, tipo, bloquear })
    }

    const aplicar = async () => {
        if (!pidiendo) return
        const { usuario, tipo, bloquear } = pidiendo
        if (bloquear && motivo.trim().length < 3) {
            showToast('Escribe el motivo — es lo que vas a poder mostrar si reclaman', false)
            return
        }
        setGuardando(true)
        try {
            const res = await fetch(
                `/api/admin/usuarios/${encodeURIComponent(usuario.email)}/bloqueo`,
                { method: 'PATCH', headers, body: JSON.stringify({ tipo, bloquear, motivo: motivo.trim() }) },
            )
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || 'No se pudo aplicar')

            // Se actualiza la fila en pantalla sin recargar toda la lista: con
            // el filtro en "Bloqueados", recargar haría que la persona
            // desapareciera de golpe y Paola perdería de vista lo que acaba de
            // hacer.
            setUsuarios(prev => prev.map(u => u.email === usuario.email ? { ...u, ...data.usuario } : u))
            setHistorial(prev => ({ ...prev, [usuario.email]: undefined }))
            setPidiendo(null)
            showToast(
                bloquear
                    ? `${tipo === 'acceso' ? 'Acceso bloqueado' : 'Compras bloqueadas'} para ${usuario.nombre || usuario.email}`
                    : `${tipo === 'acceso' ? 'Acceso restablecido' : 'Compras restablecidas'} para ${usuario.nombre || usuario.email}`,
            )
            // Los contadores de arriba sí se refrescan.
            fetch(`/api/admin/usuarios?filtro=todos`, { headers })
                .then(r => r.json()).then(d => d.stats && setStats(d.stats)).catch(() => {})
        } catch (e) {
            showToast(e.message || 'Error de conexión', false)
        } finally {
            setGuardando(false)
        }
    }

    const verHistorial = async (email) => {
        if (historial[email]) { setHistorial(p => ({ ...p, [email]: undefined })); return }
        setHistorial(p => ({ ...p, [email]: null }))
        try {
            const res  = await fetch(`/api/admin/usuarios/${encodeURIComponent(email)}/historial`, { headers })
            const data = await res.json()
            setHistorial(p => ({ ...p, [email]: data.historial || [] }))
        } catch {
            setHistorial(p => ({ ...p, [email]: [] }))
            showToast('No se pudo cargar el historial', false)
        }
    }

    return (
        <div style={{ position: 'relative' }}>
            {toast && (
                <div style={{
                    position: 'fixed', bottom: 'var(--space-6)', right: 'var(--space-6)',
                    padding: 'var(--space-3) var(--space-4)', zIndex: 200,
                    background: 'var(--bg-surface)',
                    border: `1px solid ${toast.ok ? 'var(--color-jade-500)' : 'var(--color-error)'}`,
                    borderRadius: 'var(--radius-lg)',
                    color: toast.ok ? 'var(--color-jade-500)' : 'var(--color-error)',
                    fontSize: 'var(--text-sm)', fontWeight: 600, maxWidth: 420,
                }}>
                    {toast.msg}
                </div>
            )}

            {/* Encabezado */}
            <div style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)',
            }}>
                <div>
                    <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>
                        Usuarios
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4, maxWidth: 620 }}>
                        Aquí no se borra a nadie: se bloquea, y se puede desbloquear.
                    </p>
                    {stats && (
                        <p style={{ fontSize: 'var(--text-sm)', marginTop: 6, color: 'var(--text-muted)' }}>
                            <strong style={{ color: 'var(--text-default)' }}>{stats.total}</strong> cuentas
                            {stats.acceso_bloqueado > 0 && (
                                <span style={{ color: ROJO }}> · {stats.acceso_bloqueado} sin acceso</span>
                            )}
                            {stats.compras_bloqueadas > 0 && (
                                <span style={{ color: AMBAR }}> · {stats.compras_bloqueadas} sin compras</span>
                            )}
                            {!stats.acceso_bloqueado && !stats.compras_bloqueadas && ' · ninguna bloqueada ✓'}
                        </p>
                    )}
                </div>
                <button onClick={fetchUsuarios} style={btnIcon} title="Actualizar">
                    <ArrowClockwise size={16} />
                </button>
            </div>

            {/* Búsqueda + filtros */}
            <div style={{
                display: 'flex', gap: 'var(--space-2)', alignItems: 'center',
                flexWrap: 'wrap', marginBottom: 'var(--space-5)',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 260px', maxWidth: 380,
                    padding: '8px 12px', background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)',
                }}>
                    <MagnifyingGlass size={15} color="var(--text-muted)" />
                    <input
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        placeholder="Nombre, correo o WhatsApp"
                        style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none',
                            color: 'var(--text-default)', fontFamily: 'var(--font-sans)',
                            fontSize: 'var(--text-sm)',
                        }}
                    />
                    {busca && (
                        <button onClick={() => setBusca('')} style={{ ...btnIcon, padding: 2, border: 'none', background: 'transparent' }}>
                            <X size={13} />
                        </button>
                    )}
                </div>

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
            </div>

            {cargando && (
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Cargando…</p>
            )}

            {!cargando && usuarios.length === 0 && (
                <div style={{
                    padding: 'var(--space-8)', textAlign: 'center',
                    border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-lg)',
                    color: 'var(--text-muted)', fontSize: 'var(--text-sm)',
                }}>
                    {filtro === 'bloqueados'
                        ? '✓ No hay ninguna cuenta bloqueada.'
                        : busca ? 'Nadie coincide con esa búsqueda.' : 'Todavía no hay usuarios.'}
                </div>
            )}

            {/* Tarjetas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {usuarios.map(u => {
                    const sinAcceso  = u.acceso_bloqueado === true
                    const sinCompras = u.compras_bloqueadas === true
                    const marcado    = sinAcceso || sinCompras
                    const color      = sinAcceso ? ROJO : sinCompras ? AMBAR : 'var(--border-subtle)'
                    const hist       = historial[u.email]
                    const waLimpio   = String(u.whatsapp || '').replace(/\D/g, '').slice(-10)

                    return (
                        <div key={u.id} style={{
                            padding: 'var(--space-4)',
                            background: 'var(--bg-surface)',
                            border: `1px solid ${marcado ? color + '55' : 'var(--border-subtle)'}`,
                            borderLeft: `3px solid ${color}`,
                            borderRadius: 'var(--radius-lg)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                                {/* Quién es */}
                                <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <strong style={{ fontSize: 'var(--text-sm)' }}>
                                            {[u.nombre, u.apellido].filter(Boolean).join(' ') || 'Sin nombre'}
                                        </strong>
                                        {sinAcceso  && <Etiqueta color={ROJO}  Icon={Prohibit}           texto="Sin acceso" />}
                                        {sinCompras && <Etiqueta color={AMBAR} Icon={ShoppingCartSimple} texto="Sin compras" />}
                                    </div>

                                    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: 4 }}>
                                        {u.email}
                                        {waLimpio && (
                                            <a
                                                href={`https://wa.me/52${waLimpio}`}
                                                target="_blank" rel="noreferrer"
                                                style={{ marginLeft: 10, color: 'var(--color-jade-500)', textDecoration: 'none' }}
                                            >
                                                <WhatsappLogo size={12} style={{ verticalAlign: -1 }} /> {waLimpio}
                                            </a>
                                        )}
                                    </div>

                                    {/* Qué tan adentro está — antes de bloquear, conviene saberlo */}
                                    <div style={{
                                        display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8,
                                        color: 'var(--text-muted)', fontSize: 'var(--text-xs)',
                                    }}>
                                        <span><Sparkle size={12} style={{ verticalAlign: -1 }} /> {u.talleres_activos} taller{u.talleres_activos === 1 ? '' : 'es'}{u.cortesias > 0 ? ` (${u.cortesias} de cortesía)` : ''}</span>
                                        <span><Certificate size={12} style={{ verticalAlign: -1 }} /> {u.certificados} certificado{u.certificados === 1 ? '' : 's'}</span>
                                        {u.reportes_pago > 0 && <span>💸 {u.reportes_pago} pago{u.reportes_pago === 1 ? '' : 's'} reportado{u.reportes_pago === 1 ? '' : 's'}</span>}
                                        <span>Desde {fecha(u.created_at).split(',')[0]}</span>
                                    </div>

                                    {marcado && u.bloqueo_motivo && (
                                        <div style={{
                                            marginTop: 10, padding: '8px 10px',
                                            background: color + '15', border: `1px solid ${color}44`,
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--text-xs)', color: 'var(--text-default)',
                                        }}>
                                            <strong>Motivo:</strong> {u.bloqueo_motivo}
                                            <span style={{ color: 'var(--text-muted)' }}>
                                                {' '}· {fecha(u.bloqueo_at)}{u.bloqueo_por ? ` · ${u.bloqueo_por}` : ''}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Los dos interruptores */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                                    <Interruptor
                                        activo={sinAcceso}
                                        color={ROJO}
                                        IconOn={ShieldCheck}
                                        IconOff={Prohibit}
                                        textoOn="Devolver acceso"
                                        textoOff="Bloquear acceso"
                                        onClick={() => abrirConfirmacion(u, 'acceso', !sinAcceso)}
                                    />
                                    <Interruptor
                                        activo={sinCompras}
                                        color={AMBAR}
                                        IconOn={ShieldCheck}
                                        IconOff={ShoppingCartSimple}
                                        textoOn="Permitir compras"
                                        textoOff="Bloquear compras"
                                        onClick={() => abrirConfirmacion(u, 'compras', !sinCompras)}
                                    />
                                    <button onClick={() => verHistorial(u.email)} style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        padding: '5px 12px', background: 'transparent',
                                        border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)',
                                        color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
                                        fontSize: 'var(--text-xs)', cursor: 'pointer',
                                    }}>
                                        <ClockCounterClockwise size={13} />
                                        {hist !== undefined ? 'Ocultar historial' : 'Historial'}
                                    </button>
                                </div>
                            </div>

                            {/* Historial — la respuesta escrita a "¿por qué me bloquearon?" */}
                            {hist !== undefined && (
                                <div style={{
                                    marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)',
                                    borderTop: '1px solid var(--border-subtle)',
                                    fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
                                }}>
                                    {hist === null && 'Cargando historial…'}
                                    {Array.isArray(hist) && hist.length === 0 && 'Nunca se le ha bloqueado nada.'}
                                    {Array.isArray(hist) && hist.map(h => (
                                        <div key={h.id} style={{ display: 'flex', gap: 8, padding: '3px 0' }}>
                                            <span style={{ color: h.bloqueado ? ROJO : 'var(--color-jade-500)', fontWeight: 700, minWidth: 148 }}>
                                                {h.bloqueado ? 'Bloqueó' : 'Desbloqueó'} {h.tipo === 'acceso' ? 'el acceso' : 'las compras'}
                                            </span>
                                            <span style={{ flex: 1 }}>{h.motivo || '—'}</span>
                                            <span>{fecha(h.created_at)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Confirmación — bloquear pide motivo obligatorio */}
            {pidiendo && (
                <div
                    onClick={e => e.target === e.currentTarget && setPidiendo(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 300,
                        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 'var(--space-4)',
                    }}
                >
                    <div style={{
                        width: '100%', maxWidth: 460, padding: 'var(--space-5)',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-lg)',
                    }}>
                        <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700 }}>
                            {pidiendo.bloquear
                                ? (pidiendo.tipo === 'acceso' ? 'Bloquear el acceso' : 'Bloquear las compras')
                                : (pidiendo.tipo === 'acceso' ? 'Devolver el acceso' : 'Permitir compras otra vez')}
                        </h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 6 }}>
                            {pidiendo.usuario.nombre || pidiendo.usuario.email}
                        </p>

                        <div style={{
                            marginTop: 'var(--space-3)', padding: 'var(--space-3)',
                            background: pidiendo.bloquear ? (pidiendo.tipo === 'acceso' ? ROJO : AMBAR) + '15' : 'rgba(13,115,119,0.1)',
                            border: `1px solid ${pidiendo.bloquear ? (pidiendo.tipo === 'acceso' ? ROJO : AMBAR) + '44' : 'rgba(13,115,119,0.3)'}`,
                            borderRadius: 'var(--radius-md)',
                            fontSize: 'var(--text-xs)', lineHeight: 1.6,
                        }}>
                            {pidiendo.bloquear && pidiendo.tipo === 'acceso' && (
                                <>
                                    <Warning size={13} weight="fill" color={ROJO} style={{ verticalAlign: -2 }} />{' '}
                                    No podrá entrar a la plataforma <strong>ni por la web ni por el bot</strong>, y
                                    su sesión actual deja de servir en menos de un minuto. Verá:
                                    <em> «Tu cuenta está temporalmente suspendida. Escríbenos por WhatsApp para
                                    aclararlo.»</em> Nada se borra — sus talleres y certificados siguen ahí.
                                </>
                            )}
                            {pidiendo.bloquear && pidiendo.tipo === 'compras' && (
                                <>
                                    <Warning size={13} weight="fill" color={AMBAR} style={{ verticalAlign: -2 }} />{' '}
                                    Podrá entrar y tomar lo que ya pagó, pero <strong>no podrá apartar lugar en
                                    talleres nuevos</strong> (ni en la web ni por el bot). Lo que ya tenía apartado
                                    <strong> no se toca</strong>: si también hay que quitárselo, revócalo desde Accesos.
                                </>
                            )}
                            {!pidiendo.bloquear && (
                                <>
                                    Todo vuelve a la normalidad de inmediato. El bloqueo anterior y su motivo
                                    quedan guardados en el historial.
                                </>
                            )}
                        </div>

                        {pidiendo.bloquear && (
                            <>
                                <label style={{
                                    display: 'block', marginTop: 'var(--space-4)', marginBottom: 6,
                                    fontSize: 'var(--text-xs)', fontWeight: 700,
                                }}>
                                    ¿Por qué? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(queda guardado)</span>
                                </label>
                                <textarea
                                    value={motivo}
                                    onChange={e => setMotivo(e.target.value)}
                                    autoFocus
                                    rows={3}
                                    placeholder="Ej: comprobante alterado del 22 ago, dos transferencias que no aparecen en el banco"
                                    style={{
                                        width: '100%', padding: '10px 12px', resize: 'vertical',
                                        background: 'var(--bg-base)', border: '1px solid var(--border-default)',
                                        borderRadius: 'var(--radius-md)', color: 'var(--text-default)',
                                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', outline: 'none',
                                    }}
                                />
                                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginTop: 6 }}>
                                    Escríbelo como si lo fueras a leer dentro de tres meses, cuando esta persona
                                    reclame y ya no te acuerdes.
                                </p>
                            </>
                        )}

                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)', justifyContent: 'flex-end' }}>
                            <button onClick={() => setPidiendo(null)} style={{
                                padding: '8px 16px', background: 'transparent',
                                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)',
                                color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
                                fontSize: 'var(--text-sm)', cursor: 'pointer',
                            }}>
                                Cancelar
                            </button>
                            <button onClick={aplicar} disabled={guardando} style={{
                                padding: '8px 16px',
                                background: pidiendo.bloquear
                                    ? (pidiendo.tipo === 'acceso' ? ROJO : AMBAR) + '22'
                                    : 'rgba(13,115,119,0.15)',
                                border: `1px solid ${pidiendo.bloquear ? (pidiendo.tipo === 'acceso' ? ROJO : AMBAR) : 'var(--color-jade-500)'}`,
                                borderRadius: 'var(--radius-full)',
                                color: pidiendo.bloquear ? (pidiendo.tipo === 'acceso' ? ROJO : AMBAR) : 'var(--color-jade-500)',
                                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 700,
                                cursor: guardando ? 'wait' : 'pointer',
                            }}>
                                {guardando ? 'Guardando…' : pidiendo.bloquear ? 'Sí, bloquear' : 'Sí, desbloquear'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function Etiqueta({ color, Icon, texto }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 9px', background: color + '22',
            border: `1px solid ${color}`, borderRadius: 'var(--radius-full)',
            color, fontSize: 'var(--text-xs)', fontWeight: 700,
        }}>
            <Icon size={12} weight="fill" /> {texto}
        </span>
    )
}

/** Botón de dos estados. Verde = devolver; de color = bloquear. */
function Interruptor({ activo, color, IconOn, IconOff, textoOn, textoOff, onClick }) {
    const Icon = activo ? IconOn : IconOff
    return (
        <button onClick={onClick} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '6px 14px', whiteSpace: 'nowrap',
            background: activo ? 'rgba(13,115,119,0.12)' : color + '15',
            border: `1px solid ${activo ? 'var(--color-jade-500)' : color + '66'}`,
            borderRadius: 'var(--radius-full)',
            color: activo ? 'var(--color-jade-500)' : color,
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 700,
            cursor: 'pointer',
        }}>
            <Icon size={13} weight="fill" />
            {activo ? textoOn : textoOff}
        </button>
    )
}

const btnIcon = {
    display: 'flex', alignItems: 'center', padding: 'var(--space-2)',
    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)', cursor: 'pointer',
}
