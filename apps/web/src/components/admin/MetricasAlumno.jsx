/**
 * Destello Admin — Ficha de un alumno
 *
 * Buscar a una persona y ver todo lo suyo en una pantalla: cuándo llegó, qué ha
 * comprado, a quién invitó, qué canjeó, cada cuánto vuelve y cómo se ha
 * comportado.
 *
 * ⚠️ La gráfica de actividad sale de `eventos`, que solo tiene historia desde
 * que se instrumentó la plataforma. Cuando la cuenta es más vieja que eso, se
 * dice en pantalla: **un hueco sin explicación se lee como inactividad**, y eso
 * sería mentir sobre una persona.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
    MagnifyingGlass, User, CurrencyDollar, UsersThree, Gift,
    ArrowsClockwise, Medal, CalendarCheck,
} from '@phosphor-icons/react'
import {
    SERIE, ESTADO, fmtMoneda, fmtNum, fmtFecha, fmtDia, fmtMetodo,
    Tile, Seccion, Vacio, Tabla, sInput, sSubtitulo, BotonPDF, EncabezadoImpresion,
} from './metricasUI.jsx'

/** Barras por día. Con pocos datos una línea mentiría sobre la continuidad. */
function ActividadDiaria({ datos, desde }) {
    if (!datos.length) {
        return <Vacio texto="No hay actividad registrada todavía." />
    }
    const max = Math.max(...datos.map(d => d.total))
    return (
        <>
            <div style={{
                display: 'flex', alignItems: 'flex-end', gap: 3,
                height: 90, overflowX: 'auto', paddingBottom: 4,
            }}>
                {datos.map(d => (
                    <div key={d.dia} title={`${fmtDia(d.dia)}: ${d.total} ${d.total === 1 ? 'acción' : 'acciones'}`}
                         style={{
                             minWidth: 10, flex: 1,
                             height: `${Math.max((d.total / max) * 100, 6)}%`,
                             background: SERIE.uno,
                             borderRadius: '3px 3px 0 0',
                             cursor: 'help',
                         }} />
                ))}
            </div>
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 10, color: 'var(--text-disabled)', marginTop: 4,
            }}>
                <span>{fmtDia(datos[0].dia)}</span>
                {datos.length > 1 && <span>{fmtDia(datos[datos.length - 1].dia)}</span>}
            </div>
            {desde && (
                <p style={{ fontSize: 10, color: 'var(--text-disabled)', marginTop: 8, marginBottom: 0 }}>
                    La plataforma empezó a registrar actividad el {fmtFecha(desde)}. Lo anterior
                    a esa fecha no existe como dato — no significa que no haya pasado nada.
                </p>
            )}
        </>
    )
}

export default function MetricasAlumno({ adminToken }) {
    const [q,        setQ]        = useState('')
    const [sugeridos, setSugeridos] = useState([])
    const [email,    setEmail]    = useState(null)
    const [ficha,    setFicha]    = useState(null)
    const [loading,  setLoading]  = useState(false)
    const [error,    setError]    = useState(null)
    const debounce = useRef(null)

    // Buscador con retardo: no se dispara una consulta por cada tecla.
    useEffect(() => {
        clearTimeout(debounce.current)
        if (q.trim().length < 2) { setSugeridos([]); return }
        debounce.current = setTimeout(() => {
            fetch(`/api/admin/metricas/alumnos?q=${encodeURIComponent(q.trim())}`,
                { headers: { Authorization: `Bearer ${adminToken}` } })
                .then(r => r.json()).then(d => setSugeridos(d.alumnos ?? [])).catch(() => {})
        }, 280)
        return () => clearTimeout(debounce.current)
    }, [q, adminToken])

    const abrir = useCallback(async (mail) => {
        setEmail(mail); setSugeridos([]); setQ(''); setLoading(true); setError(null)
        try {
            const res  = await fetch(`/api/admin/metricas/alumno/${encodeURIComponent(mail)}`,
                { headers: { Authorization: `Bearer ${adminToken}` } })
            const json = await res.json()
            if (!res.ok) throw new Error(json.message ?? 'No se pudo cargar la ficha')
            setFicha(json)
        } catch (e) { setError(e.message); setFicha(null) }
        finally { setLoading(false) }
    }, [adminToken])

    const p = ficha?.perfil
    const r = ficha?.resumen

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

            {/* ── Buscador ── */}
            <div className="mx-no-print" style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', position: 'relative',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MagnifyingGlass size={16} color="var(--text-muted)" />
                    <input
                        value={q} onChange={e => setQ(e.target.value)}
                        placeholder="Buscar por nombre, correo o WhatsApp…"
                        style={{ ...sInput, flex: 1, fontSize: 'var(--text-sm)', padding: '8px 12px' }}
                    />
                </div>
                {sugeridos.length > 0 && (
                    <div style={{
                        position: 'absolute', top: '100%', left: 'var(--space-4)', right: 'var(--space-4)',
                        background: 'var(--bg-elevated, #14241f)', border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)', marginTop: 4, zIndex: 30,
                        maxHeight: 300, overflowY: 'auto', boxShadow: '0 12px 32px rgba(0,0,0,.45)',
                    }}>
                        {sugeridos.map(s => (
                            <button key={s.email} onClick={() => abrir(s.email)}
                                    style={{
                                        display: 'flex', width: '100%', gap: 10, alignItems: 'center',
                                        padding: '10px 12px', background: 'transparent', border: 'none',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        color: 'var(--text-primary)', cursor: 'pointer',
                                        fontFamily: 'var(--font-sans)', textAlign: 'left',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.05)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <User size={14} color="var(--text-muted)" />
                                <span style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                                        {[s.nombre, s.apellido].filter(Boolean).join(' ') || '(sin nombre)'}
                                    </span>
                                    <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                        {s.email}
                                    </span>
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    {s.compras} {s.compras === 1 ? 'compra' : 'compras'}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>}
            {loading && <Vacio texto="Cargando ficha…" />}
            {!ficha && !loading && !error && (
                <Vacio texto="Busca a una persona por su nombre, correo o número para ver todo lo suyo." />
            )}

            {ficha && (
                <>
                    <EncabezadoImpresion titulo={`Ficha de ${[p.nombre, p.apellido].filter(Boolean).join(' ')}`} />

                    {/* ── Encabezado de la persona ── */}
                    <Seccion
                        titulo={[p.nombre, p.apellido].filter(Boolean).join(' ') || p.email}
                        icon={User}
                        accion={<BotonPDF label="Descargar ficha" />}
                    >
                        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap',
                                      fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                            <span>{p.email}</span>
                            {p.whatsapp && <span>· WA {p.whatsapp}</span>}
                            <span>· <strong style={{
                                color: p.estado === 'activo' ? ESTADO.bien : ESTADO.atencion,
                            }}>{p.estado}</strong></span>
                            {p.origen && <span>· llegó por {p.origen}</span>}
                        </div>
                        {p.nombre_certificado && (
                            <p style={{ margin: '10px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                En su certificado aparece como: <strong>{p.nombre_certificado}</strong>
                            </p>
                        )}
                    </Seccion>

                    {/* ── Los números ── */}
                    <div className="mx-grid-tiles" style={{
                        display: 'grid', gap: 'var(--space-3)',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    }}>
                        <Tile icon={CurrencyDollar} label="Ha pagado" valor={fmtMoneda(r.total_pagado)}
                              sub={`${r.compras} ${r.compras === 1 ? 'compra' : 'compras'}${r.cortesias ? ` · ${r.cortesias} de cortesía` : ''}`}
                              color={SERIE.uno} />
                        <Tile icon={CalendarCheck} label="En la plataforma"
                              valor={`${fmtNum(p.dias_en_plataforma)} d`}
                              sub={`desde ${fmtFecha(p.created_at)}`} />
                        <Tile icon={ArrowsClockwise} label="Vuelve cada"
                              valor={r.dias_entre_compras ? `${r.dias_entre_compras} d` : '—'}
                              sub={r.dias_entre_compras ? 'entre una compra y otra' : 'necesita 2 compras para calcularse'} />
                        <Tile icon={UsersThree} label="Ha invitado" valor={fmtNum(r.referidos)}
                              sub={p.codigo_referido ? `código ${p.codigo_referido}` : 'sin código todavía'} />
                        <Tile label="Ha entrado" valor={fmtNum(p.total_logins)}
                              sub={p.ultimo_login_at ? `último: ${fmtFecha(p.ultimo_login_at)}` : 'nunca ha entrado'}
                              color={p.total_logins > 0 ? 'var(--text-primary)' : ESTADO.atencion} />
                        <Tile label="Estrellas" valor={fmtNum(p.estrellas)}
                              sub={`racha de ${fmtNum(p.racha)} días`} />
                    </div>

                    {/* ── Compras ── */}
                    <Seccion titulo={`Lo que ha comprado (${ficha.compras.length})`} icon={CurrencyDollar}>
                        {ficha.compras.length === 0
                            ? <Vacio texto="Todavía no tiene compras registradas." />
                            : (
                                <Tabla
                                    columnas={['Fecha', 'Taller', 'Método', 'Banco / Folio', 'Monto']}
                                    filas={ficha.compras}
                                    render={c => [
                                        fmtFecha(c.created_at),
                                        <>
                                            <div>{c.taller ?? '—'}</div>
                                            {c.categoria && (
                                                <div style={{ color: 'var(--text-muted)' }}>{c.categoria}</div>
                                            )}
                                        </>,
                                        c.metodo === 'cortesia'
                                            ? <span style={{ color: SERIE.tres, fontWeight: 700 }}>🎁 cortesía</span>
                                            : fmtMetodo(c.metodo),
                                        <>
                                            <div>{c.banco || '—'}</div>
                                            {c.folio && <div style={{ color: 'var(--text-muted)' }}>{c.folio}</div>}
                                        </>,
                                        <strong>{fmtMoneda(c.monto)}</strong>,
                                    ]}
                                />
                            )}
                    </Seccion>

                    {/* ── Talleres ── */}
                    <Seccion titulo={`Sus talleres (${ficha.inscripciones.length})`}>
                        {ficha.inscripciones.length === 0
                            ? <Vacio texto="No está inscrita en ningún taller." />
                            : (
                                <Tabla
                                    columnas={['Taller', 'Estado', 'Se inscribió', 'Pagó', 'Asistencia', 'Acceso']}
                                    filas={ficha.inscripciones}
                                    render={i => [
                                        <>
                                            <div>{i.taller ?? i.taller_id}</div>
                                            {i.fecha_inicio && (
                                                <div style={{ color: 'var(--text-muted)' }}>
                                                    imparte {fmtFecha(i.fecha_inicio)}
                                                </div>
                                            )}
                                        </>,
                                        <>
                                            {i.estado}
                                            {i.is_demo && (
                                                <span style={{ color: SERIE.tres, marginLeft: 6, fontWeight: 700 }}>🎁</span>
                                            )}
                                        </>,
                                        fmtFecha(i.created_at),
                                        i.pagado_at ? fmtFecha(i.pagado_at) : '—',
                                        i.asistencia_respuesta
                                            ? (i.asistencia_respuesta === 'si'
                                                ? <span style={{ color: ESTADO.bien }}>✓ confirmó</span>
                                                : <span style={{ color: ESTADO.atencion }}>no podía</span>)
                                            : <span style={{ color: 'var(--text-disabled)' }}>sin responder</span>,
                                        i.expires_at
                                            ? `vence ${fmtFecha(i.expires_at)}`
                                            : (i.chispa ? 'sin límite' : '—'),
                                    ]}
                                />
                            )}
                    </Seccion>

                    <div className="mx-grid" style={{
                        display: 'grid', gap: 'var(--space-5)',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    }}>
                        {/* ── Actividad ── */}
                        <Seccion titulo="Su actividad">
                            <ActividadDiaria datos={ficha.actividad} desde={ficha.actividadDesde} />
                        </Seccion>

                        {/* ── A quién invitó ── */}
                        <Seccion titulo={`A quién invitó (${ficha.referidos.length})`} icon={UsersThree}>
                            {ficha.referidos.length === 0
                                ? <Vacio texto="Todavía no ha invitado a nadie." />
                                : (
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {ficha.referidos.map(rf => (
                                            <div key={rf.referido_email} style={{
                                                display: 'flex', justifyContent: 'space-between',
                                                gap: 10, fontSize: 'var(--text-xs)',
                                                paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)',
                                            }}>
                                                <span>
                                                    <strong>{rf.nombre || rf.referido_email}</strong>
                                                    <span style={{ display: 'block', color: 'var(--text-muted)' }}>
                                                        {fmtFecha(rf.created_at)} · {rf.estado ?? 'sin cuenta'}
                                                    </span>
                                                </span>
                                                <span style={{ whiteSpace: 'nowrap', color: SERIE.tres }}>
                                                    +{rf.estrellas} ⭐
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                        </Seccion>

                        {/* ── Premios ── */}
                        <Seccion titulo={`Premios canjeados (${ficha.canjes.length})`} icon={Gift}>
                            {ficha.canjes.length === 0
                                ? <Vacio texto="No ha canjeado ningún premio." />
                                : (
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {ficha.canjes.map(c => (
                                            <div key={c.id} style={{
                                                display: 'flex', justifyContent: 'space-between',
                                                gap: 10, fontSize: 'var(--text-xs)',
                                            }}>
                                                <span>
                                                    <strong>{c.supernova ?? '(premio eliminado)'}</strong>
                                                    <span style={{ display: 'block', color: 'var(--text-muted)' }}>
                                                        {fmtFecha(c.created_at)} · {c.estado}
                                                    </span>
                                                </span>
                                                <span style={{ whiteSpace: 'nowrap', color: SERIE.tres }}>
                                                    −{c.estrellas_gastadas} ⭐
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                        </Seccion>

                        {/* ── Insignias ── */}
                        <Seccion titulo={`Insignias (${ficha.insignias.length})`} icon={Medal}>
                            {ficha.insignias.length === 0
                                ? <Vacio texto="Todavía no tiene insignias." />
                                : (
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {ficha.insignias.map((ins, i) => (
                                            <div key={i} style={{ fontSize: 'var(--text-xs)' }}>
                                                <strong>{ins.nombre}</strong>
                                                <span style={{ display: 'block', color: 'var(--text-muted)' }}>
                                                    {ins.descripcion} · {fmtFecha(ins.created_at)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                        </Seccion>
                    </div>

                    <p style={{ ...sSubtitulo, textAlign: 'center', margin: 0 }}>
                        Ficha de {p.email}
                    </p>
                </>
            )}
        </div>
    )
}
