/**
 * Destello Admin — MetricasPanel
 *
 * Anfitrión de las tres vistas del tablero:
 *   Resumen     → el embudo, los tiempos, la actividad y el cupo por taller
 *   Financiero  → de dónde entra el dinero, con el detalle operación por operación
 *   Alumno      → todo lo de una persona en una pantalla
 *
 * Los filtros (fechas · taller · categoría) viven aquí arriba y se comparten
 * entre Resumen y Financiero: si cada vista tuviera los suyos, cambiar de
 * pestaña te haría volver a filtrar y los números no se podrían comparar.
 * La ficha de alumno no los usa — ahí el filtro es la persona.
 *
 * ── Por qué no hay librería de gráficas ─────────────────────────────────────
 *
 * Las formas necesarias son barras horizontales y una línea de dos series. Eso
 * es SVG y CSS. Meter ~100 KB de dependencia para dibujarlo iría contra la
 * regla de mantener todo ligero.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    ArrowClockwise, TrendUp, Users, CurrencyDollar, Warning,
    ChartLineUp, Clock, Ticket, ChartPieSlice, User,
} from '@phosphor-icons/react'
import {
    SERIE, ESTADO, fmtMoneda, fmtNum, fmtDia, fmtHoras,
    Tile, BarraH, Seccion, Vacio, Campo, Tabla,
    sInput, sBtnGhost, sSubtitulo, PRINT_CSS, BotonPDF, EncabezadoImpresion,
} from './metricasUI.jsx'
import MetricasFinanciero from './MetricasFinanciero.jsx'
import MetricasAlumno     from './MetricasAlumno.jsx'

const ALERTA_CFG = {
    pagado_sin_activar:  { color: ESTADO.urgente,  texto: 'Pagaron y su cuenta no está activa' },
    pagado_sin_taller:   { color: ESTADO.urgente,  texto: 'Pagaron y no ven su taller' },
    falta_recordatorio:  { color: ESTADO.atencion, texto: 'Se les venció el plazo y falta recordarles' },
    gracia_vencida:      { color: ESTADO.urgente,  texto: 'Ya se les recordó: puedes liberar su lugar' },
    activo_sin_entrar:   { color: ESTADO.atencion, texto: 'Activos que nunca han entrado' },
    taller_sobrevendido: { color: ESTADO.urgente,  texto: 'Talleres con más inscritos que cupo' },
}

const VISTAS = [
    { id: 'resumen',    label: 'Resumen',    Icon: ChartLineUp },
    { id: 'financiero', label: 'Financiero', Icon: ChartPieSlice },
    { id: 'alumno',     label: 'Ficha de alumno', Icon: User },
]

/**
 * Embudo: cuánta gente sobrevive a cada etapa.
 *
 * Cada barra se mide contra la PRIMERA etapa, no contra la más grande, porque
 * lo que importa es "de los que empezaron, cuántos llegaron hasta aquí". El
 * porcentaje al lado es la caída real entre una etapa y la siguiente.
 */
function Embudo({ etapas }) {
    const base = etapas[0]?.valor || 0
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {etapas.map((e, i) => {
                const anterior = i === 0 ? null : etapas[i - 1].valor
                const caida    = anterior > 0 ? Math.round((e.valor / anterior) * 100) : null
                return (
                    <BarraH key={e.label} label={e.label} valor={fmtNum(e.valor)} max={base}
                            color={SERIE.uno}
                            nota={caida != null ? `${caida}% de "${etapas[i - 1].label}"` : null} />
                )
            })}
        </div>
    )
}

/**
 * Altas por día — dos series, un solo eje.
 *
 * SVG a mano: polilíneas de 2 px, puntos de 8 px, rejilla discreta y una capa
 * de hover. Con dos series hay leyenda Y etiqueta directa al final de cada
 * línea, para que la identidad nunca dependa solo del color.
 */
function LineasDiarias({ datos }) {
    const [hover, setHover] = useState(null)
    const W = 640, H = 200, PAD = { t: 16, r: 56, b: 26, l: 34 }
    const iw = W - PAD.l - PAD.r
    const ih = H - PAD.t - PAD.b

    if (!datos.length) return <Vacio texto="Todavía no hay inscripciones en este rango." />

    const maxY = Math.max(1, ...datos.map(d => Math.max(Number(d.altas), Number(d.pagados))))
    const x = i => PAD.l + (datos.length === 1 ? iw / 2 : (i / (datos.length - 1)) * iw)
    const y = v => PAD.t + ih - (v / maxY) * ih
    const linea = campo => datos.map((d, i) => `${x(i)},${y(Number(d[campo]))}`).join(' ')
    const ticksY = [0, Math.round(maxY / 2), maxY].filter((v, i, a) => a.indexOf(v) === i)
    const series = [['altas', SERIE.uno, 'Altas'], ['pagados', SERIE.dos, 'Pagados']]

    return (
        <div style={{ position: 'relative' }}>
            {/* Leyenda: obligatoria con dos o más series */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 8, flexWrap: 'wrap' }}>
                {series.map(([, c, t]) => (
                    <span key={t} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
                    }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} /> {t}
                    </span>
                ))}
            </div>

            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}
                 onMouseLeave={() => setHover(null)}>
                {ticksY.map(v => (
                    <g key={v}>
                        <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)}
                              stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                        <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end"
                              fontSize="10" fill="var(--text-disabled)">{v}</text>
                    </g>
                ))}

                {series.map(([campo, color]) => (
                    <polyline key={campo} points={linea(campo)} fill="none" stroke={color}
                              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                ))}

                {datos.map((d, i) => (
                    <g key={d.dia}>
                        {series.map(([campo, color]) => (
                            <circle key={campo} cx={x(i)} cy={y(Number(d[campo]))} r="4"
                                    fill={color} stroke="var(--bg-base, #0E1B18)" strokeWidth="2" />
                        ))}
                        {/* Zona de hover más ancha que el punto: apuntarle a 8 px
                            con el mouse es una lucha innecesaria. */}
                        <rect x={x(i) - Math.max(7, iw / (datos.length * 2 || 1))} y={PAD.t}
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
                {datos.length > 1 && series.map(([campo, color, txt]) => (
                    <text key={campo} x={W - PAD.r + 8} y={y(Number(datos[datos.length - 1][campo])) + 3}
                          fontSize="10" fill={color} fontWeight="600">{txt}</text>
                ))}

                <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--text-disabled)">{fmtDia(datos[0].dia)}</text>
                {datos.length > 1 && (
                    <text x={W - PAD.r} y={H - 6} fontSize="10" textAnchor="end"
                          fill="var(--text-disabled)">{fmtDia(datos[datos.length - 1].dia)}</text>
                )}
            </svg>

            {hover && (
                <div style={{
                    position: 'absolute', top: 0, right: 0,
                    background: 'var(--bg-elevated, #14241f)', border: '1px solid var(--border-default)',
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

// ── Panel ────────────────────────────────────────────────────────────────────

export default function MetricasPanel({ adminToken }) {
    const [vista,      setVista]      = useState('resumen')
    const [data,       setData]       = useState(null)
    const [loading,    setLoading]    = useState(true)
    const [error,      setError]      = useState(null)
    const [talleres,   setTalleres]   = useState([])
    const [categorias, setCategorias] = useState([])
    const [verTabla,   setVerTabla]   = useState(false)

    const [filtros, setFiltros] = useState({ desde: '', hasta: '', tallerId: '', categoria: '' })

    const cargar = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const qs = new URLSearchParams(
                Object.entries(filtros).filter(([, v]) => v)).toString()
            const res  = await fetch(`/api/admin/metricas${qs ? `?${qs}` : ''}`,
                { headers: { Authorization: `Bearer ${adminToken}` } })
            const json = await res.json()
            if (!res.ok) throw new Error(json.message ?? 'No se pudieron cargar las métricas')
            setData(json)
        } catch (e) { setError(e.message) }
        finally { setLoading(false) }
    }, [adminToken, filtros])

    // Solo el Resumen necesita este paquete; la ficha de alumno trae el suyo.
    useEffect(() => { if (vista !== 'alumno') cargar() }, [cargar, vista])

    useEffect(() => {
        const auth = { headers: { Authorization: `Bearer ${adminToken}` } }
        fetch('/api/admin/talleres', auth).then(r => r.json())
            .then(d => setTalleres(d.talleres ?? [])).catch(() => {})
        fetch('/api/admin/metricas/categorias', auth).then(r => r.json())
            .then(d => setCategorias(d.categorias ?? [])).catch(() => {})
    }, [adminToken])

    const etapas = useMemo(() => {
        if (!data) return []
        const e = data.embudo
        return [
            { label: 'Se inscribieron',     valor: Number(e.inscripciones ?? 0) },
            { label: 'Lugar confirmado',    valor: Number(e.cupos_confirmados ?? 0) },
            { label: 'Pagaron',             valor: Number(e.pagados ?? 0) },
            { label: 'Entraron alguna vez', valor: Number(e.usuarios?.entraron ?? 0) },
        ]
    }, [data])

    const ingresoTotal = useMemo(
        () => (data?.ingresos ?? [])
            .filter(r => r.metodo !== 'cortesia')
            .reduce((s, r) => s + Number(r.monto), 0), [data])

    const maxIngreso = useMemo(
        () => Math.max(1, ...(data?.talleres ?? []).map(t => Number(t.ingresos))), [data])

    const set = (k, v) => setFiltros(f => ({ ...f, [k]: v }))
    const hayFiltro = filtros.desde || filtros.hasta || filtros.tallerId || filtros.categoria
    const tallerNombre = talleres.find(t => t.id === filtros.tallerId)?.nombre ?? null

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <style>{PRINT_CSS}</style>

            {/* ── Sub-pestañas ── */}
            <div className="mx-no-print" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {VISTAS.map(({ id, label, Icon }) => {
                    const activa = vista === id
                    return (
                        <button key={id} onClick={() => setVista(id)} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '7px 14px', borderRadius: 999,
                            border: `1px solid ${activa ? 'var(--color-jade-500)' : 'var(--border-default)'}`,
                            background: activa ? 'rgba(25,158,112,0.14)' : 'transparent',
                            color: activa ? 'var(--color-jade-500)' : 'var(--text-muted)',
                            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                            fontWeight: activa ? 700 : 500, cursor: 'pointer',
                        }}>
                            <Icon size={14} /> {label}
                        </button>
                    )
                })}
            </div>

            {/* ── Filtros: compartidos entre Resumen y Financiero ── */}
            {vista !== 'alumno' && (
                <div className="mx-no-print" style={{
                    display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
                }}>
                    <Campo label="Desde">
                        <input type="date" value={filtros.desde}
                               onChange={e => set('desde', e.target.value)} style={sInput} />
                    </Campo>
                    <Campo label="Hasta">
                        <input type="date" value={filtros.hasta}
                               onChange={e => set('hasta', e.target.value)} style={sInput} />
                    </Campo>
                    <Campo label="Categoría">
                        <select value={filtros.categoria} onChange={e => set('categoria', e.target.value)}
                                style={{ ...sInput, maxWidth: 180 }}>
                            <option value="">Todas</option>
                            {categorias.map(c => (
                                <option key={c.categoria} value={c.categoria}>
                                    {c.categoria} ({c.talleres})
                                </option>
                            ))}
                        </select>
                    </Campo>
                    <Campo label="Taller">
                        <select value={filtros.tallerId} onChange={e => set('tallerId', e.target.value)}
                                style={{ ...sInput, maxWidth: 260 }}>
                            <option value="">Todos los talleres</option>
                            {talleres.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                        </select>
                    </Campo>

                    {hayFiltro && (
                        <button onClick={() => setFiltros({ desde: '', hasta: '', tallerId: '', categoria: '' })}
                                style={sBtnGhost}>Limpiar</button>
                    )}
                    <button onClick={cargar} disabled={loading} style={{ ...sBtnGhost, marginLeft: 'auto' }}>
                        <ArrowClockwise size={14} /> {loading ? 'Cargando…' : 'Actualizar'}
                    </button>
                </div>
            )}

            {/* ══ FINANCIERO ══ */}
            {vista === 'financiero' && (
                <MetricasFinanciero adminToken={adminToken} filtros={filtros} tallerNombre={tallerNombre} />
            )}

            {/* ══ FICHA DE ALUMNO ══ */}
            {vista === 'alumno' && <MetricasAlumno adminToken={adminToken} />}

            {/* ══ RESUMEN ══ */}
            {vista === 'resumen' && (
                <>
                    {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>}
                    {!data && loading && <Vacio texto="Cargando métricas…" />}

                    {data && (
                        <>
                            <EncabezadoImpresion titulo="Resumen"
                                                 filtros={{ ...filtros, tallerNombre }} />

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }} className="mx-no-print">
                                <BotonPDF label="Descargar resumen" />
                            </div>

                            {/* ── Los cuatro números que importan ── */}
                            <div className="mx-grid-tiles" style={{
                                display: 'grid', gap: 'var(--space-3)',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            }}>
                                <Tile icon={CurrencyDollar} label="Ingresos" valor={fmtMoneda(ingresoTotal)}
                                      sub={`${data.ingresos.filter(r => r.metodo !== 'cortesia')
                                          .reduce((s, r) => s + r.operaciones, 0)} pagos verificados`}
                                      color={SERIE.uno} />
                                <Tile icon={Users} label="Cuentas activas"
                                      valor={fmtNum(data.embudo.usuarios?.activos)}
                                      sub={`${fmtNum(data.embudo.usuarios?.en_espera)} en espera`} />
                                <Tile icon={TrendUp} label="Conversión" valor={
                                    data.embudo.inscripciones > 0
                                        ? `${Math.round((data.embudo.pagados / data.embudo.inscripciones) * 100)}%`
                                        : '—'
                                } sub="de inscritos a pagados" />
                                <Tile icon={Warning} label="Pagaron y no entraron"
                                      valor={fmtNum(Math.max(
                                          Number(data.embudo.usuarios?.activos ?? 0) -
                                          Number(data.embudo.usuarios?.entraron ?? 0), 0))}
                                      sub="cuentas activas sin un solo acceso"
                                      color={ESTADO.atencion} />
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
                                                    background: `${cfg.color}14`, border: `1px solid ${cfg.color}55`,
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

                            <div className="mx-grid" style={{
                                display: 'grid', gap: 'var(--space-5)',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                            }}>
                                <Seccion titulo="Embudo" icon={TrendUp}
                                         nota="La caída entre Pagaron y Entraron es gente que ya te pagó y nunca usó la plataforma.">
                                    <Embudo etapas={etapas} />
                                </Seccion>

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

                            <Seccion titulo="Altas y pagos por día" icon={ChartLineUp}>
                                <LineasDiarias datos={data.actividad} />
                            </Seccion>

                            {/* ── Por taller ── */}
                            <Seccion titulo="Por taller" icon={Ticket}
                                     accion={
                                         <button onClick={() => setVerTabla(v => !v)} style={sBtnGhost}>
                                             {verTabla ? 'Ver gráfica' : 'Ver tabla'}
                                         </button>
                                     }>
                                {data.talleres.length === 0 ? (
                                    <Vacio texto="No hay talleres que mostrar." />
                                ) : verTabla ? (
                                    /* La vista de tabla no es un extra: es lo que hace que
                                       estos datos se puedan leer sin depender del color. */
                                    <Tabla
                                        columnas={['Taller', 'Categoría', 'Cupo', 'En lista', 'Pagados',
                                                   'Cortesías', 'Tardó en llenarse', 'Conversión', 'Ingresos']}
                                        filas={data.talleres}
                                        render={t => [
                                            <>
                                                {t.nombre}
                                                {t.agotado && (
                                                    <span style={{ marginLeft: 6, color: ESTADO.urgente, fontWeight: 700 }}>
                                                        AGOTADO
                                                    </span>
                                                )}
                                            </>,
                                            t.categoria ?? '—',
                                            `${t.cupo_ocupado}/${t.cupo_maximo}`,
                                            t.en_lista,
                                            t.pagados,
                                            t.cortesias ?? 0,
                                            fmtHoras(t.horas_en_llenarse),
                                            `${t.tasa_conversion ?? 0}%`,
                                            <strong>{fmtMoneda(t.ingresos)}</strong>,
                                        ]}
                                    />
                                ) : (
                                    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                                        <div>
                                            <p style={sSubtitulo}>Ingresos</p>
                                            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                                {data.talleres.map(t => (
                                                    <BarraH key={t.id} label={t.nombre} valor={fmtMoneda(t.ingresos)}
                                                            max={maxIngreso} color={SERIE.uno}
                                                            nota={t.categoria} />
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
                                                            nota={[
                                                                t.agotado ? 'AGOTADO' : `${t.lugares_libres} libres`,
                                                                t.cortesias > 0 ? `${t.cortesias} de cortesía` : null,
                                                                t.horas_en_llenarse ? `tardó ${fmtHoras(t.horas_en_llenarse)}` : null,
                                                            ].filter(Boolean).join(' · ')} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Seccion>

                            {/* ── Bot ── */}
                            <Seccion titulo="Bot de WhatsApp">
                                <div className="mx-grid-tiles" style={{
                                    display: 'grid', gap: 'var(--space-3)',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                                }}>
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
                        </>
                    )}
                </>
            )}
        </div>
    )
}
