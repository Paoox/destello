/**
 * Destello Admin — MetricasPanel
 *
 * El dashboard de métricas. Lee `GET /admin/metricas`, que devuelve todo el
 * paquete en una sola llamada para que la pantalla se dibuje de golpe y cada
 * filtro no dispare cinco peticiones.
 *
 * ── Por qué no hay librería de gráficas ─────────────────────────────────────
 *
 * Las formas que se necesitan aquí son barras horizontales y una línea de dos
 * series. Eso es SVG y CSS — no vale meter ~100 KB de dependencia al bundle
 * para dibujarlo, y menos con la regla de mantener todo ligero.
 *
 * ── La paleta está validada, no elegida a ojo ───────────────────────────────
 *
 * Los cuatro colores de serie pasan las seis pruebas sobre el fondo oscuro de
 * Destello: banda de luminosidad, croma mínimo, separación para daltonismo
 * (protan/deutan/tritan), piso de visión normal y contraste contra la
 * superficie. No se cambian sin volver a validarlos.
 *
 * Reglas que se respetan a propósito:
 *   · un solo eje — nunca dos escalas en la misma gráfica
 *   · el color sigue a la entidad, no a su posición en el ranking
 *   · con dos o más series siempre hay leyenda, y además etiqueta directa
 *   · los colores de estado (bien/atención/urgente) no se reciclan como serie
 *   · los números y etiquetas van en color de texto, nunca en el de la serie
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    ArrowClockwise, TrendUp, Users, CurrencyDollar, Warning,
    ChartLineUp, Clock, Ticket,
} from '@phosphor-icons/react'

// ── Paleta de series (validada sobre superficie #0E1B18) ─────────────────────
const SERIE = {
    uno:    '#199e70',   // jade — la marca
    dos:    '#3987e5',   // azul
    tres:   '#c98500',   // ámbar
    cuatro: '#d55181',   // magenta
}

// Estados: reservados, nunca se usan como "serie 5". Siempre con texto al lado.
const ESTADO = {
    bien:    '#199e70',
    atencion:'#c98500',
    urgente: '#e66767',
}

const ALERTA_CFG = {
    pagado_sin_activar:  { color: ESTADO.urgente,  texto: 'Pagaron y su cuenta no está activa' },
    pagado_sin_taller:   { color: ESTADO.urgente,  texto: 'Pagaron y no ven su taller' },
    falta_recordatorio:  { color: ESTADO.atencion, texto: 'Se les venció el plazo y falta recordarles' },
    gracia_vencida:      { color: ESTADO.urgente,  texto: 'Ya se les recordó: puedes liberar su lugar' },
    activo_sin_entrar:   { color: ESTADO.atencion, texto: 'Activos que nunca han entrado' },
    taller_sobrevendido: { color: ESTADO.urgente,  texto: 'Talleres con más inscritos que cupo' },
}

const fmtMoneda = n => `$${Number(n ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
const fmtNum    = n => Number(n ?? 0).toLocaleString('es-MX')
const fmtDia    = d => new Date(`${d}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

/** Horas → "3 h" o "2.5 días", lo que se lea mejor. */
function fmtHoras(h) {
    if (h == null) return '—'
    const n = Number(h)
    if (Number.isNaN(n)) return '—'
    if (n < 48) return `${Math.round(n)} h`
    return `${(n / 24).toFixed(1)} días`
}

// ── Piezas ───────────────────────────────────────────────────────────────────

/**
 * Número protagonista. No lleva gráfica: cuando el dato es UNO, dibujarlo sería
 * decorar en vez de informar.
 */
function Tile({ icon: Icon, label, valor, sub, color = 'var(--text-primary)' }) {
    return (
        <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
            display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
        }}>
            <span style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600,
            }}>
                {Icon && <Icon size={13} />} {label}
            </span>
            <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, color }}>
                {valor}
            </span>
            {sub && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {sub}
                </span>
            )}
        </div>
    )
}

/**
 * Barra horizontal para comparar magnitudes.
 *
 * Horizontal y no vertical porque las etiquetas son nombres largos de taller:
 * en vertical habría que girarlas y dejarían de leerse.
 */
function BarraH({ label, valor, max, sufijo = '', color = SERIE.uno, nota }) {
    const pct = max > 0 ? Math.max((valor / max) * 100, valor > 0 ? 1.5 : 0) : 0
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <span style={{
                    fontSize: 'var(--text-xs)', color: 'var(--text-secondary, var(--text-muted))',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {label}
                </span>
                {/* El número va en color de texto, no en el de la serie. */}
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {valor}{sufijo}
                </span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4 }}>
                <div style={{
                    width: `${pct}%`, height: '100%', background: color,
                    // Extremo redondeado solo del lado del dato; el otro queda
                    // anclado a la línea base.
                    borderRadius: '0 4px 4px 0',
                    transition: 'width .3s ease',
                }} />
            </div>
            {nota && (
                <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>{nota}</span>
            )}
        </div>
    )
}

/**
 * Embudo: cuánta gente sobrevive a cada etapa.
 *
 * Cada barra se mide contra la PRIMERA etapa, no contra la más grande de todas,
 * porque lo que importa es "de los que empezaron, cuántos llegaron hasta aquí".
 * El porcentaje entre etapas se pone a un lado: es la caída real.
 */
function Embudo({ etapas }) {
    const base = etapas[0]?.valor || 0
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {etapas.map((e, i) => {
                const anterior = i === 0 ? null : etapas[i - 1].valor
                const caida    = anterior > 0 ? Math.round((e.valor / anterior) * 100) : null
                return (
                    <div key={e.label}>
                        <BarraH
                            label={e.label}
                            valor={fmtNum(e.valor)}
                            max={base}
                            color={e.color ?? SERIE.uno}
                            nota={caida != null ? `${caida}% de "${etapas[i - 1].label}"` : null}
                        />
                    </div>
                )
            })}
        </div>
    )
}

/**
 * Altas por día — dos series, un solo eje.
 *
 * SVG a mano: dos polilíneas de 2 px, puntos de 8 px, rejilla discreta y una
 * capa de hover que muestra el día completo. Con dos series hay leyenda Y
 * etiqueta directa al final de cada línea, para que la identidad nunca dependa
 * solo del color.
 */
function LineasDiarias({ datos }) {
    const [hover, setHover] = useState(null)

    const W = 640, H = 200, PAD = { t: 16, r: 56, b: 26, l: 34 }
    const iw = W - PAD.l - PAD.r
    const ih = H - PAD.t - PAD.b

    if (!datos.length) {
        return <Vacio texto="Todavía no hay inscripciones en este rango." />
    }

    const maxY = Math.max(1, ...datos.map(d => Math.max(Number(d.altas), Number(d.pagados))))
    const x = i => PAD.l + (datos.length === 1 ? iw / 2 : (i / (datos.length - 1)) * iw)
    const y = v => PAD.t + ih - (v / maxY) * ih

    const linea = campo => datos.map((d, i) => `${x(i)},${y(Number(d[campo]))}`).join(' ')
    const ticksY = [0, Math.round(maxY / 2), maxY].filter((v, i, a) => a.indexOf(v) === i)

    return (
        <div style={{ position: 'relative' }}>
            {/* Leyenda: obligatoria con dos o más series */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 8, flexWrap: 'wrap' }}>
                {[['Altas', SERIE.uno], ['Pagados', SERIE.dos]].map(([t, c]) => (
                    <span key={t} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
                    }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                        {t}
                    </span>
                ))}
            </div>

            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}
                 onMouseLeave={() => setHover(null)}>
                {/* Rejilla discreta: guía, no protagonista */}
                {ticksY.map(v => (
                    <g key={v}>
                        <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)}
                              stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                        <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end"
                              fontSize="10" fill="var(--text-disabled)">{v}</text>
                    </g>
                ))}

                {[['altas', SERIE.uno], ['pagados', SERIE.dos]].map(([campo, color]) => (
                    <polyline key={campo} points={linea(campo)} fill="none"
                              stroke={color} strokeWidth="2"
                              strokeLinecap="round" strokeLinejoin="round" />
                ))}

                {datos.map((d, i) => (
                    <g key={d.dia}>
                        {[['altas', SERIE.uno], ['pagados', SERIE.dos]].map(([campo, color]) => (
                            <circle key={campo} cx={x(i)} cy={y(Number(d[campo]))} r="4"
                                    fill={color} stroke="var(--bg-base, #0E1B18)" strokeWidth="2" />
                        ))}
                        {/* Zona de hover más ancha que el punto: apuntarle a 8 px
                            con el mouse es una lucha innecesaria. */}
                        <rect x={x(i) - iw / (datos.length * 2 || 1) / 2 - 6} y={PAD.t}
                              width={Math.max(14, iw / (datos.length || 1))} height={ih}
                              fill="transparent" style={{ cursor: 'crosshair' }}
                              onMouseEnter={() => setHover({ i, d })} />
                    </g>
                ))}

                {hover && (
                    <line x1={x(hover.i)} x2={x(hover.i)} y1={PAD.t} y2={PAD.t + ih}
                          stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
                )}

                {/* Etiqueta directa al final: identidad sin depender del color */}
                {datos.length > 1 && [['altas', SERIE.uno, 'Altas'], ['pagados', SERIE.dos, 'Pagados']].map(([campo, color, txt]) => (
                    <text key={campo} x={W - PAD.r + 8} y={y(Number(datos[datos.length - 1][campo])) + 3}
                          fontSize="10" fill={color} fontWeight="600">{txt}</text>
                ))}

                {/* Solo primera y última fecha: una etiqueta por punto sería ruido */}
                <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--text-disabled)">{fmtDia(datos[0].dia)}</text>
                {datos.length > 1 && (
                    <text x={W - PAD.r} y={H - 6} fontSize="10" textAnchor="end"
                          fill="var(--text-disabled)">{fmtDia(datos[datos.length - 1].dia)}</text>
                )}
            </svg>

            {hover && (
                <div style={{
                    position: 'absolute', top: 0, right: 0,
                    background: 'var(--bg-elevated, #14241f)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)', padding: '8px 12px',
                    fontSize: 'var(--text-xs)', pointerEvents: 'none', zIndex: 5,
                    boxShadow: '0 8px 24px rgba(0,0,0,.4)',
                }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{fmtDia(hover.d.dia)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: SERIE.uno }} />
                        Altas: <strong>{hover.d.altas}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: SERIE.dos }} />
                        Pagados: <strong>{hover.d.pagados}</strong>
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                        bot {hover.d.por_bot} · web {hover.d.por_web}
                    </div>
                </div>
            )}
        </div>
    )
}

function Vacio({ texto }) {
    return (
        <p style={{
            color: 'var(--text-muted)', fontSize: 'var(--text-sm)',
            textAlign: 'center', padding: 'var(--space-6) 0', margin: 0,
        }}>
            {texto}
        </p>
    )
}

function Seccion({ titulo, icon: Icon, children, accion }) {
    return (
        <section style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl, 16px)', padding: 'var(--space-5)',
        }}>
            <header style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 12, marginBottom: 'var(--space-4)', flexWrap: 'wrap',
            }}>
                <h3 style={{
                    margin: 0, fontWeight: 700, fontSize: 'var(--text-base)',
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    {Icon && <Icon size={16} />} {titulo}
                </h3>
                {accion}
            </header>
            {children}
        </section>
    )
}

// ── Panel ────────────────────────────────────────────────────────────────────

export default function MetricasPanel({ adminToken }) {
    const [data,     setData]     = useState(null)
    const [loading,  setLoading]  = useState(true)
    const [error,    setError]    = useState(null)
    const [talleres, setTalleres] = useState([])
    const [verTabla, setVerTabla] = useState(false)

    const [filtros, setFiltros] = useState({ desde: '', hasta: '', tallerId: '' })

    const cargar = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const qs = new URLSearchParams(
                Object.entries(filtros).filter(([, v]) => v)
            ).toString()
            const res  = await fetch(`/api/admin/metricas${qs ? `?${qs}` : ''}`, {
                headers: { Authorization: `Bearer ${adminToken}` },
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.message ?? 'No se pudieron cargar las métricas')
            setData(json)
        } catch (e) { setError(e.message) }
        finally { setLoading(false) }
    }, [adminToken, filtros])

    useEffect(() => { cargar() }, [cargar])

    useEffect(() => {
        fetch('/api/admin/talleres', { headers: { Authorization: `Bearer ${adminToken}` } })
            .then(r => r.json()).then(d => setTalleres(d.talleres ?? [])).catch(() => {})
    }, [adminToken])

    const etapas = useMemo(() => {
        if (!data) return []
        const e = data.embudo
        return [
            { label: 'Se inscribieron',   valor: Number(e.inscripciones ?? 0) },
            { label: 'Lugar confirmado',  valor: Number(e.cupos_confirmados ?? 0) },
            { label: 'Pagaron',           valor: Number(e.pagados ?? 0) },
            { label: 'Entraron alguna vez', valor: Number(e.usuarios?.entraron ?? 0) },
        ]
    }, [data])

    const ingresoTotal = useMemo(
        () => (data?.ingresos ?? []).reduce((s, r) => s + Number(r.monto), 0), [data])

    const maxIngreso = useMemo(
        () => Math.max(1, ...(data?.talleres ?? []).map(t => Number(t.ingresos))), [data])

    const set = (k, v) => setFiltros(f => ({ ...f, [k]: v }))

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

            {/* ── Filtros: una sola fila, arriba de todo ── */}
            <div style={{
                display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end',
                flexWrap: 'wrap',
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
            }}>
                <Campo label="Desde">
                    <input type="date" value={filtros.desde} onChange={e => set('desde', e.target.value)} style={sInput} />
                </Campo>
                <Campo label="Hasta">
                    <input type="date" value={filtros.hasta} onChange={e => set('hasta', e.target.value)} style={sInput} />
                </Campo>
                <Campo label="Taller">
                    <select value={filtros.tallerId} onChange={e => set('tallerId', e.target.value)}
                            style={{ ...sInput, maxWidth: 260 }}>
                        <option value="">Todos los talleres</option>
                        {talleres.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                </Campo>

                {(filtros.desde || filtros.hasta || filtros.tallerId) && (
                    <button onClick={() => setFiltros({ desde: '', hasta: '', tallerId: '' })}
                            style={sBtnGhost}>
                        Limpiar
                    </button>
                )}
                <button onClick={cargar} disabled={loading} style={{ ...sBtnGhost, marginLeft: 'auto' }}>
                    <ArrowClockwise size={14} /> {loading ? 'Cargando…' : 'Actualizar'}
                </button>
            </div>

            {error && (
                <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>
            )}

            {!data && loading && <Vacio texto="Cargando métricas…" />}

            {data && (
                <>
                    {/* ── Los cuatro números que importan ── */}
                    <div style={{
                        display: 'grid', gap: 'var(--space-3)',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    }}>
                        <Tile icon={CurrencyDollar} label="Ingresos" valor={fmtMoneda(ingresoTotal)}
                              sub={`${data.ingresos.reduce((s, r) => s + r.operaciones, 0)} pagos verificados`}
                              color={SERIE.uno} />
                        <Tile icon={Users} label="Cuentas activas" valor={fmtNum(data.embudo.usuarios?.activos)}
                              sub={`${fmtNum(data.embudo.usuarios?.en_espera)} en espera`} />
                        <Tile icon={TrendUp} label="Conversión" valor={
                            data.embudo.inscripciones > 0
                                ? `${Math.round((data.embudo.pagados / data.embudo.inscripciones) * 100)}%`
                                : '—'
                        } sub="de inscritos a pagados" />
                        <Tile
                            icon={Warning}
                            label="Pagaron y no entraron"
                            valor={fmtNum(Math.max(
                                Number(data.embudo.usuarios?.activos ?? 0) -
                                Number(data.embudo.usuarios?.entraron ?? 0), 0))}
                            sub="cuentas activas sin un solo acceso"
                            color={ESTADO.atencion}
                        />
                    </div>

                    {/* ── Lo que necesita atención hoy ── */}
                    {data.alertas.length > 0 && (
                        <Seccion titulo="Necesita tu atención" icon={Warning}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {data.alertas.map(a => {
                                    const cfg = ALERTA_CFG[a.tipo] ?? { color: ESTADO.atencion, texto: a.tipo }
                                    return (
                                        <div key={a.tipo} style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                            background: `${cfg.color}14`,
                                            border: `1px solid ${cfg.color}55`,
                                        }}>
                                            {/* Icono + texto: el estado nunca se comunica solo con color */}
                                            <Warning size={15} color={cfg.color} weight="fill" />
                                            <span style={{ fontSize: 'var(--text-sm)', flex: 1 }}>{cfg.texto}</span>
                                            <strong style={{ fontSize: 'var(--text-sm)' }}>{a.total}</strong>
                                        </div>
                                    )
                                })}
                            </div>
                        </Seccion>
                    )}

                    <div style={{
                        display: 'grid', gap: 'var(--space-5)',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    }}>
                        {/* ── Embudo ── */}
                        <Seccion titulo="Embudo" icon={TrendUp}>
                            <Embudo etapas={etapas} />
                            <p style={{
                                marginTop: 'var(--space-4)', marginBottom: 0,
                                fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5,
                            }}>
                                La caída entre <strong>Pagaron</strong> y <strong>Entraron</strong> es
                                gente que ya te pagó y nunca usó la plataforma.
                            </p>
                        </Seccion>

                        {/* ── Tiempos ── */}
                        <Seccion titulo="Cuánto tarda la gente" icon={Clock}>
                            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                <Tile label="De inscribirse a que le confirmes"
                                      valor={fmtHoras(data.tiempos?.horas_alta_a_cupo)} />
                                <Tile label="De confirmarle a que pague"
                                      valor={fmtHoras(data.tiempos?.horas_cupo_a_pago)}
                                      sub="el plazo es de 48 h" />
                                <Tile label="Del primer contacto al pago"
                                      valor={fmtHoras(data.tiempos?.horas_alta_a_pago)} />
                            </div>
                        </Seccion>
                    </div>

                    {/* ── Actividad diaria ── */}
                    <Seccion titulo="Altas y pagos por día" icon={ChartLineUp}>
                        <LineasDiarias datos={data.actividad} />
                    </Seccion>

                    {/* ── Por taller ── */}
                    <Seccion
                        titulo="Por taller" icon={Ticket}
                        accion={
                            <button onClick={() => setVerTabla(v => !v)} style={sBtnGhost}>
                                {verTabla ? 'Ver gráfica' : 'Ver tabla'}
                            </button>
                        }
                    >
                        {data.talleres.length === 0 ? (
                            <Vacio texto="No hay talleres que mostrar." />
                        ) : verTabla ? (
                            /* La vista de tabla no es un extra: es lo que hace que
                               estos datos se puedan leer sin depender del color. */
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                                            {['Taller', 'Cupo', 'En lista', 'Pagados', 'Conversión', 'Ingresos'].map(h => (
                                                <th key={h} style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.talleres.map(t => (
                                            <tr key={t.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                                <td style={{ padding: '8px 10px' }}>
                                                    {t.nombre}
                                                    {t.agotado && (
                                                        <span style={{ marginLeft: 6, color: ESTADO.urgente, fontWeight: 700 }}>
                                                            AGOTADO
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                                    {t.cupo_ocupado}/{t.cupo_maximo}
                                                </td>
                                                <td style={{ padding: '8px 10px' }}>{t.en_lista}</td>
                                                <td style={{ padding: '8px 10px' }}>{t.pagados}</td>
                                                <td style={{ padding: '8px 10px' }}>{t.tasa_conversion ?? 0}%</td>
                                                <td style={{ padding: '8px 10px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                    {fmtMoneda(t.ingresos)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                                <div>
                                    <p style={sSubtitulo}>Ingresos</p>
                                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                        {data.talleres.map(t => (
                                            <BarraH key={t.id} label={t.nombre} valor={fmtMoneda(t.ingresos)}
                                                    max={maxIngreso}
                                                    color={SERIE.uno} />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p style={sSubtitulo}>Cupo ocupado</p>
                                    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                        {data.talleres.map(t => (
                                            <BarraH key={t.id} label={t.nombre}
                                                    valor={`${t.cupo_ocupado}/${t.cupo_maximo}`}
                                                    max={Number(t.cupo_maximo) || 1}
                                                    color={t.agotado ? ESTADO.urgente : SERIE.tres}
                                                    nota={t.agotado ? 'AGOTADO' : `${t.lugares_libres} libres`} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </Seccion>

                    {/* ── Bot ── */}
                    <div style={{
                        display: 'grid', gap: 'var(--space-5)',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    }}>
                        <Seccion titulo="Bot de WhatsApp">
                            <div style={{ display: 'grid', gap: 'var(--space-3)',
                                          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                                <Tile label="Conversaciones" valor={fmtNum(data.embudo.conversaciones)} />
                                <Tile label="Terminaron inscritas" valor={fmtNum(data.embudo.completadas)}
                                      color={SERIE.uno} />
                                <Tile label="Se quedaron a medias" valor={fmtNum(data.embudo.abandonadas)}
                                      color={ESTADO.atencion} />
                            </div>
                            {data.abandonos.length > 0 && (
                                <>
                                    <p style={{ ...sSubtitulo, marginTop: 'var(--space-4)' }}>
                                        ¿En qué paso se caen?
                                    </p>
                                    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                                        {data.abandonos.map(a => (
                                            <BarraH key={a.paso} label={a.paso} valor={a.total}
                                                    max={Math.max(...data.abandonos.map(x => x.total))}
                                                    color={SERIE.cuatro} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </Seccion>

                        <Seccion titulo="Cómo te pagan" icon={CurrencyDollar}>
                            {data.ingresos.length === 0 ? (
                                <Vacio texto="Todavía no hay pagos registrados en este rango." />
                            ) : (
                                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                    {data.ingresos.map(p => (
                                        <BarraH key={p.metodo} label={p.metodo}
                                                valor={fmtMoneda(p.monto)}
                                                max={Math.max(...data.ingresos.map(x => Number(x.monto)), 1)}
                                                color={p.metodo === 'cortesia' ? SERIE.tres : SERIE.dos}
                                                nota={`${p.operaciones} ${p.operaciones === 1 ? 'operación' : 'operaciones'}`} />
                                    ))}
                                </div>
                            )}
                        </Seccion>
                    </div>
                </>
            )}
        </div>
    )
}

// ── Estilos sueltos ──────────────────────────────────────────────────────────

function Campo({ label, children }) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase',
                           letterSpacing: '.04em', fontWeight: 600 }}>
                {label}
            </span>
            {children}
        </label>
    )
}

const sInput = {
    padding: '6px 10px', background: 'var(--bg-base, #0E1B18)',
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-xs)', outline: 'none',
}

const sBtnGhost = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', height: 30,
    background: 'transparent', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-muted)',
    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 600,
    cursor: 'pointer',
}

const sSubtitulo = {
    fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '.04em', fontWeight: 700, margin: '0 0 10px',
}
