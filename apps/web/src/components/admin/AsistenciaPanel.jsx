/**
 * Destello Admin — Asistencia y certificados
 *
 * Regla de Paola: **certifica quien asistió, no quien pagó.** «Qué pasa con
 * las personas que por X no puedan acceder al taller — no tendrían por qué
 * tener un certificado.»
 *
 * Esta pantalla es lo que ve después de cada taller: quién entró al aula,
 * cuánto tiempo estuvo, y de ahí emite los certificados.
 *
 * ⚠️ El criterio es automático, **el disparo no**: nadie recibe certificado
 * hasta que Paola aprieta el botón. Y siempre es corregible — a alguien se le
 * va el internet, o entra desde el celular de su hermana, y eso no puede
 * costarle el certificado.
 *
 * ── Tres formas de emitir, en orden de uso ──────────────────────────────────
 *   1. **Todos los que califican** — el botón de siempre, sin seleccionar nada.
 *      Es lo normal después de un taller que salió bien.
 *   2. **Sólo los que palomeé** — se marcan renglones y el botón cambia solo.
 *      Para cuando la lista trae casos que hay que ver uno por uno.
 *   3. **Uno suelto** — el botón "emitir" de su renglón, que además pide el
 *      motivo. Para el caso raro que necesita explicación propia.
 *
 * Un certificado emitido nunca se borra: se anula y se guarda el porqué. Un
 * folio circulando sin nada que lo respalde es peor que uno anulado.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Certificate, UserCheck, Clock, ArrowClockwise, Warning, Check,
} from '@phosphor-icons/react'
import {
    SERIE, ESTADO, fmtNum, fmtFecha,
    Tile, Seccion, Vacio, Tabla, sInput, sSubtitulo,
} from './metricasUI.jsx'

function fmtMinutos(m) {
    const n = Number(m) || 0
    if (n < 60) return `${n} min`
    const h = Math.floor(n / 60)
    return `${h} h ${n % 60} min`
}

export default function AsistenciaPanel({ adminToken }) {
    const [talleres, setTalleres] = useState([])
    const [tallerId, setTallerId] = useState('')
    const [data,     setData]     = useState(null)
    const [cargando, setCargando] = useState(false)
    const [error,    setError]    = useState(null)
    const [aviso,    setAviso]    = useState(null)
    const [ocupado,  setOcupado]  = useState(null)  // email en proceso

    // Renglones palomeados. Se guarda el correo y no el índice: la lista se
    // recarga después de cada emisión y los índices se recorren.
    const [sel, setSel] = useState(() => new Set())

    const auth = { Authorization: `Bearer ${adminToken}` }

    useEffect(() => {
        fetch('/api/admin/talleres', { headers: auth })
            .then(r => r.ok ? r.json() : null)
            .then(j => {
                const lista = j?.talleres ?? []
                setTalleres(lista)
                // El taller más reciente es casi siempre el que se acaba de dar,
                // que es el que Paola viene a revisar.
                if (lista.length && !tallerId) setTallerId(lista[0].id)
            })
            .catch(() => {})
    }, [adminToken]) // eslint-disable-line react-hooks/exhaustive-deps

    const cargar = useCallback(async () => {
        if (!tallerId) return
        setCargando(true); setError(null)
        try {
            const res  = await fetch(`/api/admin/talleres/${encodeURIComponent(tallerId)}/asistencia`,
                { headers: auth })
            const json = await res.json()
            if (!res.ok) throw new Error(json.message ?? 'No se pudo cargar la asistencia')
            setData(json)
        } catch (e) { setError(e.message); setData(null) }
        finally { setCargando(false) }
    }, [tallerId, adminToken]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { cargar() }, [cargar])

    // Cambiar de taller borra lo palomeado: los correos de un taller no tienen
    // por qué seguir marcados en otro, y emitirle a alguien de la lista
    // anterior sería un error silencioso.
    useEffect(() => { setSel(new Set()) }, [tallerId])

    // ── Selección ────────────────────────────────────────────────────────────

    const lista = data?.asistencia ?? []
    const min   = data?.minMinutos ?? 20

    /** Quién puede palomearse: quien todavía no tiene certificado vigente. */
    const seleccionables = useMemo(
        () => lista.filter(p => !p.tiene_certificado).map(p => p.usuario_email),
        [lista])

    const califican = useMemo(
        () => lista.filter(p => !p.tiene_certificado && p.entro && Number(p.minutos) >= min)
                   .map(p => p.usuario_email),
        [lista, min])

    const alternar = (email) => setSel(prev => {
        const s = new Set(prev)
        s.has(email) ? s.delete(email) : s.add(email)
        return s
    })

    const marcar = (emails) => setSel(new Set(emails))

    // ── Emitir ───────────────────────────────────────────────────────────────

    /**
     * Un solo camino para las dos formas de emitir en bloque.
     * @param {string[]|null} emails  null = todos los que califican por asistencia
     */
    const emitirBloque = async (emails) => {
        // Palomear a alguien que no llegó a los minutos es una decisión, no un
        // descuido — pero conviene decirla en voz alta antes de firmarla.
        if (emails) {
            const flojos = lista.filter(p => emails.includes(p.usuario_email)
                                          && !(p.entro && Number(p.minutos) >= min))
            if (flojos.length && !window.confirm(
                `${flojos.length} de los que escogiste no llegó a los ${min} minutos `
                + `(o no entró al aula):\n\n`
                + flojos.map(p => `· ${p.usuario_email} — ${p.entro ? fmtMinutos(p.minutos) : 'no entró'}`).join('\n')
                + `\n\nSe les va a emitir igual y quedará anotado que fue a mano. ¿Continuamos?`
            )) return
        }

        setOcupado('__todos'); setAviso(null)
        try {
            const res  = await fetch(`/api/admin/talleres/${encodeURIComponent(tallerId)}/certificados`,
                { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
                  body: JSON.stringify(emails ? { emails } : {}) })
            const json = await res.json()
            if (!res.ok) throw new Error(json.message ?? 'No se pudieron emitir')
            // Se dice cuántos quedaron fuera, no solo cuántos salieron: una
            // emisión que deja gente afuera en silencio se lee como "ya está".
            const fuera = (json.omitidos ?? []).filter(o => o.motivo !== 'ya tenía').length
            setAviso({
                tipo: 'bien',
                texto: `${json.emitidos.length} ${json.emitidos.length === 1 ? 'certificado emitido' : 'certificados emitidos'}`
                     + (fuera ? ` · ${fuera} sin certificado (revisa la lista)` : ''),
            })
            setSel(new Set())
            await cargar()
        } catch (e) { setAviso({ tipo: 'mal', texto: e.message }) }
        finally { setOcupado(null) }
    }

    const emitirUno = async (email) => {
        const motivo = window.prompt(
            `¿Por qué le emites el certificado a ${email} a mano?\n` +
            'Queda guardado: dentro de tres meses esto explica por qué tiene ' +
            'certificado sin haber entrado al aula.',
            'Sí asistió; falló el registro')
        if (motivo === null) return   // canceló

        setOcupado(email); setAviso(null)
        try {
            const res = await fetch('/api/admin/certificados', {
                method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, tallerId, motivo }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.message ?? 'No se pudo emitir')
            setAviso({ tipo: 'bien', texto: `Certificado ${json.certificado.folio} para ${email}` })
            await cargar()
        } catch (e) { setAviso({ tipo: 'mal', texto: e.message }) }
        finally { setOcupado(null) }
    }

    const anular = async (folio, email) => {
        const motivo = window.prompt(`¿Por qué anulas el certificado de ${email}?`, '')
        if (motivo === null) return
        setOcupado(email); setAviso(null)
        try {
            const res = await fetch(`/api/admin/certificados/${encodeURIComponent(folio)}`, {
                method: 'DELETE', headers: { ...auth, 'Content-Type': 'application/json' },
                body: JSON.stringify({ motivo }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.message ?? 'No se pudo anular')
            setAviso({ tipo: 'bien', texto: `Certificado ${folio} anulado` })
            await cargar()
        } catch (e) { setAviso({ tipo: 'mal', texto: e.message }) }
        finally { setOcupado(null) }
    }

    const r = data?.resumen

    // El botón grande hace una cosa u otra según haya renglones palomeados.
    // Es el mismo botón a propósito: dos botones parecidos uno junto al otro
    // se aprietan mal, y aquí apretar el equivocado emite certificados.
    const haySeleccion = sel.size > 0
    const faltantes    = r ? Math.max(0, r.califican - r.certificados) : 0
    const btnBloqueado = ocupado === '__todos' || (!haySeleccion && faltantes === 0)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

            {/* ── Qué taller ── */}
            <div style={{
                display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap',
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
            }}>
                <label style={{ flex: 1, minWidth: 240 }}>
                    <span style={sSubtitulo}>Taller</span>
                    <select value={tallerId} onChange={e => setTallerId(e.target.value)}
                            style={{ ...sInput, width: '100%', marginTop: 4 }}>
                        {talleres.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.nombre}{t.fecha_inicio ? ` · ${fmtFecha(t.fecha_inicio)}` : ''}
                            </option>
                        ))}
                    </select>
                </label>
                <button onClick={cargar} disabled={cargando} style={sBtnFantasma}>
                    <ArrowClockwise size={14} weight="bold" />
                    {cargando ? 'Cargando…' : 'Actualizar'}
                </button>
            </div>

            {error && (
                <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>
            )}

            {aviso && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 'var(--text-sm)', padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    color:      aviso.tipo === 'bien' ? ESTADO.bien : 'var(--color-error)',
                    background: aviso.tipo === 'bien' ? 'rgba(25,158,112,.12)' : 'rgba(230,103,103,.12)',
                    border: `1px solid ${aviso.tipo === 'bien' ? ESTADO.bien : 'var(--color-error)'}`,
                }}>
                    {aviso.tipo === 'bien' ? <Check size={16} weight="bold" /> : <Warning size={16} weight="fill" />}
                    {aviso.texto}
                </div>
            )}

            {data && (
                <>
                    <div className="mx-grid-tiles" style={{
                        display: 'grid', gap: 'var(--space-3)',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    }}>
                        <Tile icon={UserCheck} label="En este taller" valor={fmtNum(r.inscritos)}
                              sub="inscritos, asistentes o certificados" />
                        <Tile icon={Clock} label="Entraron al aula" valor={fmtNum(r.entraron)}
                              sub={r.inscritos ? `${Math.round((r.entraron / r.inscritos) * 100)}% de los inscritos` : '—'}
                              color={SERIE.dos} />
                        <Tile icon={Certificate} label="Califican" valor={fmtNum(r.califican)}
                              sub={`estuvieron ${min} min o más`} color={SERIE.uno} />
                        <Tile label="Ya certificados" valor={fmtNum(r.certificados)}
                              sub={r.califican > r.certificados
                                    ? `faltan ${r.califican - r.certificados} por emitir`
                                    : 'al corriente'}
                              color={r.califican > r.certificados ? ESTADO.atencion : SERIE.uno} />
                    </div>

                    <Seccion
                        titulo="Quién estuvo en la clase"
                        icon={UserCheck}
                        nota={`Califica para certificado quien estuvo ${min} minutos o más con el aula abierta. `
                            + 'Palomea renglones para emitirle sólo a ésos; sin nada palomeado, el botón emite a todos los que califican. '
                            + 'Emitir NO le manda ningún correo: el certificado le aparece en su Inicio la próxima vez que entre.'}
                        accion={
                            <button onClick={() => emitirBloque(haySeleccion ? [...sel] : null)}
                                    disabled={btnBloqueado}
                                    style={{ ...sBtnPrimario, opacity: btnBloqueado ? .45 : 1 }}>
                                <Certificate size={15} weight="fill" />
                                {ocupado === '__todos'
                                    ? 'Emitiendo…'
                                    : haySeleccion
                                        ? `Emitir a ${sel.size} ${sel.size === 1 ? 'seleccionado' : 'seleccionados'}`
                                        : faltantes
                                            ? `Emitir a los ${faltantes} que califican`
                                            : 'Todos al corriente'}
                            </button>
                        }>
                        {data.asistencia.length === 0
                            ? <Vacio texto="Nadie está inscrito a este taller todavía." />
                            : (
                              <>
                                {/* Atajos de selección. Van fuera de la tabla porque una
                                    casilla en el encabezado no se ve en celular, que es
                                    donde Paola revisa esto después de un taller. */}
                                {seleccionables.length > 0 && (
                                    <div style={sBarraSel}>
                                        <span style={{ color: 'var(--text-muted)' }}>
                                            {haySeleccion
                                                ? `${sel.size} ${sel.size === 1 ? 'palomeado' : 'palomeados'}`
                                                : 'Seleccionar:'}
                                        </span>
                                        <button style={sEnlaceSel}
                                                onClick={() => marcar(califican)}
                                                disabled={califican.length === 0}>
                                            {califican.length === 1
                                                ? 'el 1 que califica'
                                                : `los ${califican.length} que califican`}
                                        </button>
                                        <span style={{ color: 'var(--text-disabled)' }}>·</span>
                                        <button style={sEnlaceSel}
                                                onClick={() => marcar(seleccionables)}>
                                            {seleccionables.length === 1
                                                ? 'el 1 sin certificado'
                                                : `los ${seleccionables.length} sin certificado`}
                                        </button>
                                        {haySeleccion && (
                                            <>
                                                <span style={{ color: 'var(--text-disabled)' }}>·</span>
                                                <button style={{ ...sEnlaceSel, color: 'var(--text-muted)' }}
                                                        onClick={() => setSel(new Set())}>
                                                    limpiar
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}

                                <Tabla
                                    columnas={['', 'Alumno', 'Entró', 'Tiempo', 'Entradas', 'Certificado', ' ']}
                                    filas={data.asistencia}
                                    render={p => {
                                        const califica = Number(p.minutos) >= min
                                        return [
                                            // La casilla desaparece —no se deshabilita— para
                                            // quien ya tiene certificado: no hay nada que
                                            // decidir ahí, y una casilla apagada invita a
                                            // intentar apretarla.
                                            p.tiene_certificado
                                                ? <span style={{ color: 'var(--text-disabled)' }}>—</span>
                                                : <input
                                                      type="checkbox"
                                                      checked={sel.has(p.usuario_email)}
                                                      onChange={() => alternar(p.usuario_email)}
                                                      disabled={ocupado != null}
                                                      aria-label={`Seleccionar a ${p.usuario_email}`}
                                                      style={{ width: 16, height: 16, cursor: 'pointer',
                                                               accentColor: 'var(--color-jade-500)' }} />,
                                            <>
                                                <div style={{ fontWeight: 600 }}>
                                                    {[p.nombre, p.apellido].filter(Boolean).join(' ') || '—'}
                                                    {p.es_demo && (
                                                        <span style={{ color: SERIE.tres, marginLeft: 6 }}>🎁</span>
                                                    )}
                                                </div>
                                                <div style={{ color: 'var(--text-muted)' }}>{p.usuario_email}</div>
                                                {/* Aparece aunque no esté en la lista de espera: si tiene
                                                    certificado o asistencia, tiene que poder verse y anularse. */}
                                                {!p.estado && (
                                                    <div style={{ color: 'var(--text-disabled)', fontSize: 10 }}>
                                                        sin inscripción registrada
                                                    </div>
                                                )}
                                                {!p.nombre_certificado && (
                                                    <div style={{ color: ESTADO.atencion, fontSize: 10 }}>
                                                        no ha dicho su nombre para el certificado
                                                    </div>
                                                )}
                                            </>,
                                            p.entro
                                                ? <span style={{ color: ESTADO.bien }}>
                                                      ✓ {fmtFecha(p.primera_entrada)}
                                                  </span>
                                                : <span style={{ color: 'var(--text-disabled)' }}>no entró</span>,
                                            <span style={{
                                                fontWeight: 700,
                                                color: califica ? ESTADO.bien
                                                     : p.entro ? ESTADO.atencion : 'var(--text-disabled)',
                                            }}>
                                                {p.entro ? fmtMinutos(p.minutos) : '—'}
                                            </span>,
                                            <>
                                                {p.entro ? fmtNum(p.entradas) : '—'}
                                                {p.asistencia_origen === 'admin' && (
                                                    <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                                                        agregada a mano
                                                    </div>
                                                )}
                                            </>,
                                            ocupado === p.usuario_email
                                                ? <span style={{ color: ESTADO.atencion }}>emitiendo…</span>
                                                : p.certificado_anulado
                                                ? <>
                                                      <div style={{ color: ESTADO.atencion, fontWeight: 700, fontSize: 11 }}>
                                                          ANULADO
                                                      </div>
                                                      <div style={{
                                                          fontFamily: 'ui-monospace, monospace',
                                                          fontSize: 11, color: 'var(--text-disabled)',
                                                          textDecoration: 'line-through',
                                                      }}>{p.certificado_folio}</div>
                                                  </>
                                                : p.tiene_certificado
                                                    ? <>
                                                          <div style={{
                                                              display: 'inline-flex', alignItems: 'center', gap: 5,
                                                              color: SERIE.uno, fontWeight: 700, fontSize: 11,
                                                          }}>
                                                              <Check size={12} weight="bold" /> EMITIDO
                                                          </div>
                                                          <div style={{
                                                              fontFamily: 'ui-monospace, monospace',
                                                              fontSize: 11, color: 'var(--text-muted)',
                                                          }}>{p.certificado_folio}</div>
                                                      </>
                                                    : <span style={{ color: 'var(--text-disabled)' }}>sin emitir</span>,
                                            p.tiene_certificado
                                                ? <button onClick={() => anular(p.certificado_folio, p.usuario_email)}
                                                          disabled={ocupado === p.usuario_email}
                                                          style={sBtnMini}>anular</button>
                                                : <button onClick={() => emitirUno(p.usuario_email)}
                                                          disabled={ocupado === p.usuario_email}
                                                          style={{ ...sBtnMini, color: SERIE.uno,
                                                                   borderColor: SERIE.uno }}>
                                                      {ocupado === p.usuario_email ? 'emitiendo…' : 'emitir'}
                                                  </button>,
                                        ]
                                    }}
                                />
                              </>
                            )}
                    </Seccion>
                </>
            )}
        </div>
    )
}

const sBtnPrimario = {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    background: 'var(--color-jade-500)', color: '#08130f',
    border: 'none', borderRadius: 'var(--radius-full)',
    padding: '8px 16px', fontWeight: 700, fontSize: 'var(--text-sm)',
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
}

const sBtnFantasma = {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)',
    padding: '8px 14px', fontWeight: 600, fontSize: 'var(--text-sm)',
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
}

const sBarraSel = {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    padding: '8px 10px', marginBottom: 6,
    fontSize: 'var(--text-xs)',
    borderBottom: '1px solid var(--border-subtle)',
}

const sEnlaceSel = {
    background: 'none', border: 'none', padding: 0,
    color: 'var(--color-jade-300)', fontWeight: 600,
    fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)',
    cursor: 'pointer', textDecoration: 'underline',
}

const sBtnMini = {
    background: 'transparent', color: 'var(--text-muted)',
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)',
    padding: '4px 12px', fontSize: 11, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
}
