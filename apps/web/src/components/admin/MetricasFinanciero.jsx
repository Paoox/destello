/**
 * Destello Admin — Estado financiero
 *
 * De dónde entra el dinero, por qué método, en qué taller y en qué mes, más el
 * detalle operación por operación.
 *
 * ⚠️ **Las cortesías nunca cuentan como ingreso.** Son `monto = 0`, y se
 * reportan aparte con su *valor equivalente* — cuánto habrías cobrado si no las
 * hubieras regalado. Ese número es el que sirve para decidir cuántas más puedes
 * dar; meterlas en el total inflaría los ingresos con dinero que nunca entró.
 */

import { useState, useEffect, useCallback } from 'react'
import { CurrencyDollar, Bank, Calendar, Receipt, Gift } from '@phosphor-icons/react'
import {
    SERIE, ESTADO, fmtMoneda, fmtNum, fmtMes, fmtFecha, fmtMetodo,
    Tile, BarraH, Seccion, Vacio, Tabla, sSubtitulo, BotonPDF, EncabezadoImpresion,
} from './metricasUI.jsx'

export default function MetricasFinanciero({ adminToken, filtros, tallerNombre }) {
    const [data,    setData]    = useState(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState(null)

    const cargar = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const qs = new URLSearchParams(
                Object.entries(filtros).filter(([, v]) => v)).toString()
            const res  = await fetch(`/api/admin/metricas/financiero${qs ? `?${qs}` : ''}`,
                { headers: { Authorization: `Bearer ${adminToken}` } })
            const json = await res.json()
            if (!res.ok) throw new Error(json.message ?? 'No se pudo cargar el financiero')
            setData(json)
        } catch (e) { setError(e.message) }
        finally { setLoading(false) }
    }, [adminToken, filtros])

    useEffect(() => { cargar() }, [cargar])

    if (loading && !data) return <Vacio texto="Cargando estado financiero…" />
    if (error) return <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>
    if (!data) return null

    const r = data.resumen
    const maxMetodo = Math.max(1, ...data.porMetodo.map(m => Number(m.monto)))
    const maxTaller = Math.max(1, ...data.porTaller.map(t => Number(t.monto)))
    const maxBanco  = Math.max(1, ...data.porBanco.map(b => Number(b.monto)))
    const maxMes    = Math.max(1, ...data.porMes.map(m => Number(m.monto)))

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <EncabezadoImpresion titulo="Estado financiero"
                                 filtros={{ ...filtros, tallerNombre }} />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }} className="mx-no-print">
                <BotonPDF label="Descargar corte" />
            </div>

            {/* ── Los números de arriba ── */}
            <div className="mx-grid-tiles" style={{
                display: 'grid', gap: 'var(--space-3)',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            }}>
                <Tile icon={CurrencyDollar} label="Ingresos" valor={fmtMoneda(r.ingresos)}
                      sub={`${fmtNum(r.operaciones)} ${r.operaciones === 1 ? 'operación' : 'operaciones'}`}
                      color={SERIE.uno} />
                <Tile icon={Receipt} label="Ticket promedio" valor={fmtMoneda(r.ticket_promedio)}
                      sub="por operación cobrada" />
                <Tile icon={Gift} label="Cortesías" valor={fmtNum(r.cortesias)}
                      sub={`equivalen a ${fmtMoneda(r.valor_cortesias)} no cobrados`}
                      color={ESTADO.atencion} />
                <Tile label="Total de lugares" valor={fmtNum(Number(r.operaciones) + Number(r.cortesias))}
                      sub="pagados + cortesías" />
            </div>

            <div className="mx-grid" style={{
                display: 'grid', gap: 'var(--space-5)',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            }}>
                {/* ── Mes contra mes ── */}
                <Seccion titulo="Mes contra mes" icon={Calendar}>
                    {data.porMes.length === 0
                        ? <Vacio texto="Sin pagos en este rango." />
                        : (
                            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                {data.porMes.map((m, i) => {
                                    const previo = i > 0 ? Number(data.porMes[i - 1].monto) : null
                                    const actual = Number(m.monto)
                                    const delta  = previo > 0
                                        ? Math.round(((actual - previo) / previo) * 100) : null
                                    return (
                                        <BarraH key={m.mes} label={fmtMes(m.mes)}
                                                valor={fmtMoneda(m.monto)} max={maxMes}
                                                color={SERIE.uno}
                                                nota={delta == null
                                                    ? `${m.operaciones} ${m.operaciones === 1 ? 'operación' : 'operaciones'}`
                                                    : `${m.operaciones} ops · ${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs mes anterior`} />
                                    )
                                })}
                            </div>
                        )}
                </Seccion>

                {/* ── Método de pago ── */}
                <Seccion titulo="Cómo te pagan" icon={CurrencyDollar}
                         nota="Las cortesías aparecen con monto cero: ocupan lugar, no son ingreso.">
                    {data.porMetodo.length === 0
                        ? <Vacio texto="Sin pagos en este rango." />
                        : (
                            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                {data.porMetodo.map(m => (
                                    <BarraH key={m.metodo} label={fmtMetodo(m.metodo)} valor={fmtMoneda(m.monto)}
                                            max={maxMetodo}
                                            color={m.metodo === 'cortesia' ? SERIE.tres : SERIE.dos}
                                            nota={`${m.operaciones} ${m.operaciones === 1 ? 'operación' : 'operaciones'}`} />
                                ))}
                            </div>
                        )}
                </Seccion>

                {/* ── Por taller ── */}
                <Seccion titulo="Por taller">
                    {data.porTaller.length === 0
                        ? <Vacio texto="Sin pagos en este rango." />
                        : (
                            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                {data.porTaller.map(t => (
                                    <BarraH key={t.taller} label={t.taller} valor={fmtMoneda(t.monto)}
                                            max={maxTaller} color={SERIE.uno}
                                            nota={[
                                                t.categoria,
                                                `${t.operaciones} pagados`,
                                                t.cortesias > 0 ? `${t.cortesias} de cortesía` : null,
                                            ].filter(Boolean).join(' · ')} />
                                ))}
                            </div>
                        )}
                </Seccion>

                {/* ── Por banco ── */}
                <Seccion titulo="Por banco" icon={Bank}
                         nota="De dónde llegó cada transferencia. Sirve para cotejar contra tu estado de cuenta.">
                    {data.porBanco.length === 0
                        ? <Vacio texto="Sin transferencias en este rango." />
                        : (
                            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                                {data.porBanco.map(b => (
                                    <BarraH key={b.banco} label={b.banco} valor={fmtMoneda(b.monto)}
                                            max={maxBanco} color={SERIE.dos}
                                            nota={`${b.operaciones} ${b.operaciones === 1 ? 'operación' : 'operaciones'}`} />
                                ))}
                            </div>
                        )}
                </Seccion>
            </div>

            {/* ── El detalle ── */}
            <Seccion titulo={`Detalle de operaciones (${data.operaciones.length})`} icon={Receipt}
                     nota={data.operaciones.length >= 300
                        ? 'Se muestran las 300 más recientes. Filtra por fechas para ver un periodo específico.'
                        : null}>
                {data.operaciones.length === 0
                    ? <Vacio texto="No hay operaciones en este rango." />
                    : (
                        <Tabla
                            columnas={['Fecha', 'Alumno', 'Taller', 'Método', 'Banco / Folio', 'Verificó', 'Monto']}
                            filas={data.operaciones}
                            render={o => [
                                fmtFecha(o.created_at),
                                <>
                                    <div style={{ fontWeight: 600 }}>{o.nombre?.trim() || '—'}</div>
                                    <div style={{ color: 'var(--text-muted)' }}>{o.usuario_email}</div>
                                </>,
                                o.taller ?? '—',
                                <span style={{
                                    color: o.metodo === 'cortesia' ? SERIE.tres : 'var(--text-primary)',
                                    fontWeight: o.metodo === 'cortesia' ? 700 : 400,
                                }}>
                                    {o.metodo === 'cortesia' ? '🎁 cortesía' : fmtMetodo(o.metodo)}
                                </span>,
                                <>
                                    <div>{o.banco || '—'}</div>
                                    {o.folio && <div style={{ color: 'var(--text-muted)' }}>{o.folio}</div>}
                                    {o.tiene_comprobante && (
                                        <div style={{ color: SERIE.uno, fontSize: 10 }}>📎 con comprobante</div>
                                    )}
                                </>,
                                <>
                                    <div>{o.verificado_por ?? '—'}</div>
                                    {/* El porqué de la decisión, no solo el resultado. */}
                                    {o.nota && (
                                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{o.nota}</div>
                                    )}
                                </>,
                                <strong style={{ whiteSpace: 'nowrap' }}>{fmtMoneda(o.monto)}</strong>,
                            ]}
                        />
                    )}
            </Seccion>

            <p style={{ ...sSubtitulo, textAlign: 'center', margin: 0 }}>
                Los comprobantes se abren desde la pestaña Reportes
            </p>
        </div>
    )
}
