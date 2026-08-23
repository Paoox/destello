/**
 * Destello — Certificados del alumno
 *
 * Va al final de Inicio, debajo de la constelación de amigos. Hace dos cosas:
 *
 *  1. Pregunta **una sola vez** cómo quiere que aparezca su nombre. Si ya lo
 *     dijo, el pop-up no vuelve a salir nunca.
 *  2. Muestra sus certificados, con el diseño completo, para verlos, guardarlos
 *     en PDF o compartirlos.
 *
 * ── Por qué el PDF es `window.print()` ──────────────────────────────────────
 * Es la misma decisión del panel de Métricas: cero dependencias, y el navegador
 * ya exporta a PDF con texto seleccionable. jsPDF produciría una imagen (un
 * certificado que no se puede copiar ni buscar) y puppeteer significaría un
 * Chromium entero corriendo en la Toshiba.
 *
 * La regla de impresión usa `visibility` y no `display:none` a propósito:
 * ocultar con display reflowa toda la página y el certificado sale movido.
 * Con visibility el diploma conserva su caja y se imprime tal cual se ve.
 */

import { useState, useEffect, useCallback } from 'react'
import {
    Certificate, CaretLeft, CaretRight, DownloadSimple,
    ShareNetwork, X, SealCheck,
} from '@phosphor-icons/react'

const POR_PAGINA = 3

const PRINT_CSS = `
@media print {
    body * { visibility: hidden !important; }
    .cert-hoja, .cert-hoja * { visibility: visible !important; }
    .cert-hoja {
        position: absolute !important; left: 0; top: 0;
        /* box-sizing explícito: sin él, el padding se suma al 100 % y el folio
           de la esquina se sale de la hoja al imprimir. */
        box-sizing: border-box !important;
        width: 100%; margin: 0;
        box-shadow: none !important; border-radius: 0 !important;
        background: #fff !important; color: #12211d !important;
    }
    .cert-no-print { display: none !important; }
    @page { size: landscape; margin: 12mm; }
}`

function fmtFecha(v) {
    if (!v) return ''
    const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : v)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ══════════════════════════════════════════════════════════════════════════
   El diploma
   ══════════════════════════════════════════════════════════════════════════
   Fondo claro incluso en modo oscuro: un certificado se imprime y se comparte,
   y en papel el fondo oscuro se convierte en un rectángulo de tinta. */

function Diploma({ cert }) {
    return (
        <div className="cert-hoja" style={{
            background: '#fbf9f4',
            color: '#12211d',
            borderRadius: 14,
            padding: 'clamp(20px, 4vw, 44px)',
            boxSizing: 'border-box',
            border: '1px solid #e3ddd0',
            boxShadow: '0 18px 48px rgba(0,0,0,.35)',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}>
            {/* Marco doble: el interior es el que da el aire de diploma. */}
            <div style={{
                position: 'absolute', inset: 10,
                border: '1px solid #c9a227', borderRadius: 10, pointerEvents: 'none',
            }} />
            <div style={{
                position: 'absolute', inset: 16,
                border: '1px solid rgba(201,162,39,.35)', borderRadius: 7, pointerEvents: 'none',
            }} />

            <div style={{ position: 'relative', textAlign: 'center' }}>
                <p style={{
                    margin: 0, letterSpacing: '.28em', fontSize: 11,
                    textTransform: 'uppercase', color: '#8a7a4e', fontWeight: 700,
                }}>
                    Destello · InnovaSchools
                </p>

                <h2 style={{
                    margin: '14px 0 4px', fontSize: 'clamp(20px, 3.4vw, 30px)',
                    fontWeight: 800, letterSpacing: '.02em',
                }}>
                    Constancia de participación
                </h2>

                <p style={{ margin: '18px 0 6px', fontSize: 13, color: '#5d6b66' }}>
                    Se otorga a
                </p>

                {/* El nombre es lo más grande de la hoja: es de quien es el logro. */}
                <p style={{
                    margin: '0 auto 6px', fontSize: 'clamp(24px, 4.6vw, 40px)',
                    fontWeight: 700, lineHeight: 1.15, maxWidth: '90%',
                    borderBottom: '1px solid #d9d0bb', paddingBottom: 10,
                }}>
                    {cert.nombre}
                </p>

                <p style={{ margin: '18px auto 0', fontSize: 14, color: '#3c4b46', maxWidth: 620, lineHeight: 1.6 }}>
                    por haber concluido el taller
                    {' '}<strong style={{ color: '#12211d' }}>{cert.taller_nombre}</strong>
                    {cert.duracion_horas ? <>, con una duración de <strong>{Number(cert.duracion_horas)} horas</strong></> : null}
                    {cert.fecha_taller ? <>, impartido el {fmtFecha(cert.fecha_taller)}</> : null}.
                </p>

                {/* Firma + folio. El folio abajo a la derecha, como en un
                    documento real: es lo que permite comprobar que es auténtico. */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
                    gap: 24, marginTop: 'clamp(26px, 5vw, 52px)', flexWrap: 'wrap',
                }}>
                    <div style={{ textAlign: 'center', width: 240, maxWidth: '100%' }}>
                        {/* TODO(Paola): aquí va la imagen de la firma cuando la
                            mandes. Mientras, la línea sola no miente. */}
                        <div style={{ height: 34 }} />
                        <div style={{ borderTop: '1px solid #12211d', paddingTop: 6, fontSize: 12 }}>
                            <strong>{cert.instructor || 'Destello'}</strong>
                            <span style={{ display: 'block', color: '#5d6b66', fontSize: 11 }}>
                                Instructor
                            </span>
                        </div>
                    </div>

                    <div style={{ textAlign: 'right', fontSize: 10, color: '#5d6b66', lineHeight: 1.7 }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            color: '#8a7a4e', fontWeight: 700, letterSpacing: '.08em',
                        }}>
                            <SealCheck size={13} weight="fill" /> FOLIO
                        </div>
                        <div style={{
                            fontFamily: 'ui-monospace, monospace', fontSize: 13,
                            color: '#12211d', fontWeight: 700, letterSpacing: '.06em',
                        }}>
                            {cert.folio}
                        </div>
                        <div>Verifica en destello.courses/certificado</div>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   Pop-up del nombre
   ══════════════════════════════════════════════════════════════════════════ */

function ModalNombre({ token, sugerido, onListo, onCerrar }) {
    const [valor,    setValor]    = useState(sugerido ?? '')
    const [guardando, setGuardando] = useState(false)
    const [error,    setError]    = useState(null)

    const guardar = async () => {
        setGuardando(true); setError(null)
        try {
            const res = await fetch('/api/users/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ nombreCertificado: valor }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.message ?? 'No se pudo guardar')
            onListo(json.user?.nombre_certificado ?? valor.trim())
        } catch (e) { setError(e.message); setGuardando(false) }
    }

    return (
        <div className="cert-no-print" style={{
            position: 'fixed', inset: 0, zIndex: 90,
            background: 'rgba(6,14,12,.72)', backdropFilter: 'blur(4px)',
            display: 'grid', placeItems: 'center', padding: 'var(--space-4)',
        }}>
            <div style={{
                background: 'var(--bg-elevated, #14241f)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-6)', maxWidth: 460, width: '100%',
                boxShadow: '0 24px 64px rgba(0,0,0,.5)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <Certificate size={22} weight="fill" color="var(--color-amber-500)" />
                    <h3 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>Tu nombre en el certificado</h3>
                </div>

                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Cuando termines un taller te vamos a entregar tu constancia. Dinos
                    cómo quieres que aparezca tu nombre en ella — completo, con tus dos
                    apellidos, como tú prefieras.
                </p>

                <input
                    value={valor}
                    onChange={e => setValor(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && valor.trim().length > 2) guardar() }}
                    placeholder="Ej. Ana Ruiz Méndez"
                    autoFocus
                    style={{
                        width: '100%', boxSizing: 'border-box', marginTop: 6,
                        background: 'var(--bg-surface)', color: 'var(--text-primary)',
                        border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                        padding: '12px 14px', fontSize: 'var(--text-base)',
                        fontFamily: 'var(--font-sans)',
                    }}
                />

                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>
                    Lo puedes cambiar después desde tu perfil. Los certificados que ya
                    hayas descargado conservan el nombre con el que se emitieron.
                </p>

                {error && (
                    <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', marginBottom: 0 }}>
                        {error}
                    </p>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 'var(--space-5)', justifyContent: 'flex-end' }}>
                    {/* "Ahora no" existe a propósito: obligar a contestar para poder
                        usar la plataforma sería castigar a quien solo quería entrar. */}
                    <button onClick={onCerrar} style={sBtnFantasma}>Ahora no</button>
                    <button onClick={guardar} disabled={guardando || valor.trim().length < 3}
                            style={{ ...sBtnPrimario,
                                     opacity: guardando || valor.trim().length < 3 ? .5 : 1,
                                     cursor: valor.trim().length < 3 ? 'not-allowed' : 'pointer' }}>
                        {guardando ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   Vista completa de un certificado
   ══════════════════════════════════════════════════════════════════════════ */

function ModalCertificado({ cert, onCerrar }) {
    const [copiado, setCopiado] = useState(false)

    const compartir = async () => {
        const url   = `${window.location.origin}/certificado/${cert.folio}`
        const texto = `Terminé el taller "${cert.taller_nombre}" en Destello ✨`
        // El compartir nativo del celular es el que la gente ya conoce; en
        // escritorio casi nunca existe, y ahí copiar la liga es lo útil.
        if (navigator.share) {
            try { await navigator.share({ title: 'Mi certificado', text: texto, url }); return } catch { /* canceló */ }
        }
        try {
            await navigator.clipboard.writeText(`${texto}\n${url}`)
            setCopiado(true); setTimeout(() => setCopiado(false), 2200)
        } catch { /* sin portapapeles: no pasa nada */ }
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 80,
            background: 'rgba(6,14,12,.8)', backdropFilter: 'blur(4px)',
            display: 'grid', placeItems: 'center',
            padding: 'var(--space-4)', overflowY: 'auto',
        }}>
            <div style={{ width: '100%', maxWidth: 860 }}>
                <div className="cert-no-print" style={{
                    display: 'flex', gap: 8, justifyContent: 'flex-end',
                    marginBottom: 12, flexWrap: 'wrap',
                }}>
                    <button onClick={compartir} style={sBtnFantasma}>
                        <ShareNetwork size={15} weight="bold" />
                        {copiado ? '¡Liga copiada!' : 'Compartir'}
                    </button>
                    <button onClick={() => window.print()} style={sBtnPrimario}>
                        <DownloadSimple size={15} weight="bold" /> Descargar PDF
                    </button>
                    <button onClick={onCerrar} style={{ ...sBtnFantasma, padding: '9px 11px' }}
                            aria-label="Cerrar">
                        <X size={15} weight="bold" />
                    </button>
                </div>

                <Diploma cert={cert} />

                <p className="cert-no-print" style={{
                    textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 12,
                }}>
                    Al descargar, elige <strong>horizontal</strong> y activa
                    “Gráficos de fondo” para que salga con el marco dorado.
                </p>
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   La sección
   ══════════════════════════════════════════════════════════════════════════ */

export default function Certificados({ token, tieneTalleres = false, nombreCuenta }) {
    const [certs,   setCerts]   = useState([])
    const [nombre,  setNombre]  = useState(null)
    const [cargado, setCargado] = useState(false)
    const [pagina,  setPagina]  = useState(0)
    const [abierto, setAbierto] = useState(null)
    const [pospuesto, setPospuesto] = useState(false)

    const cargar = useCallback(async () => {
        if (!token) return
        try {
            const res  = await fetch('/api/users/me/certificados',
                { headers: { Authorization: `Bearer ${token}` } })
            const json = await res.json()
            if (res.ok) {
                setCerts(json.certificados ?? [])
                setNombre(json.nombreCertificado ?? null)
            }
        } catch { /* sin conexión: la sección simplemente no aparece */ }
        finally { setCargado(true) }
    }, [token])

    useEffect(() => { cargar() }, [cargar])

    // Se le pregunta el nombre solo a quien ya tiene un taller: alguien que
    // apenas está viendo la plataforma no tiene por qué recibir un pop-up
    // sobre un certificado que todavía no le toca.
    const preguntarNombre = cargado && !nombre && tieneTalleres && !pospuesto

    const paginas = Math.ceil(certs.length / POR_PAGINA)
    const visibles = certs.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA)

    // Sin certificados y sin nada que preguntar: no se dibuja nada. Un cajón
    // vacío que dice "aquí no tienes nada" no le sirve a nadie.
    if (cargado && !certs.length && !preguntarNombre) return null

    return (
        <>
            <style>{PRINT_CSS}</style>

            {preguntarNombre && (
                <ModalNombre token={token} sugerido={nombreCuenta}
                             onListo={n => { setNombre(n); cargar() }}
                             onCerrar={() => setPospuesto(true)} />
            )}

            {abierto && <ModalCertificado cert={abierto} onCerrar={() => setAbierto(null)} />}

            {certs.length > 0 && (
                <div className="cert-no-print" style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xl)',
                    padding: 'var(--space-5)',
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 12, marginBottom: 'var(--space-2)', flexWrap: 'wrap',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
                            <Certificate size={20} weight="fill" color="var(--color-amber-600)" />
                            Mis certificados
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 'var(--text-sm)' }}>
                                ({certs.length})
                            </span>
                        </div>

                        {paginas > 1 && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <button onClick={() => setPagina(p => Math.max(0, p - 1))}
                                        disabled={pagina === 0}
                                        style={{ ...sBtnFantasma, padding: '6px 9px', opacity: pagina === 0 ? .35 : 1 }}
                                        aria-label="Anteriores">
                                    <CaretLeft size={14} weight="bold" />
                                </button>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 34, textAlign: 'center' }}>
                                    {pagina + 1}/{paginas}
                                </span>
                                <button onClick={() => setPagina(p => Math.min(paginas - 1, p + 1))}
                                        disabled={pagina >= paginas - 1}
                                        style={{ ...sBtnFantasma, padding: '6px 9px', opacity: pagina >= paginas - 1 ? .35 : 1 }}
                                        aria-label="Siguientes">
                                    <CaretRight size={14} weight="bold" />
                                </button>
                            </div>
                        )}
                    </div>

                    <p style={{
                        fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
                        margin: '0 0 var(--space-4)',
                    }}>
                        Aquí quedan para siempre. Ábrelos para descargarlos en PDF o compartirlos.
                    </p>

                    <div style={{
                        display: 'grid', gap: 'var(--space-3)',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                    }}>
                        {visibles.map(c => (
                            <button key={c.folio} onClick={() => setAbierto(c)}
                                    style={sTarjeta}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = 'var(--color-amber-600)'
                                        e.currentTarget.style.transform   = 'translateY(-2px)'
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = 'var(--border-default)'
                                        e.currentTarget.style.transform   = 'none'
                                    }}>
                                <Certificate size={26} weight="duotone" color="var(--color-amber-500)" />
                                <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', lineHeight: 1.35 }}>
                                    {c.taller_nombre}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {fmtFecha(c.fecha_taller ?? c.created_at)}
                                    {c.duracion_horas ? ` · ${Number(c.duracion_horas)} h` : ''}
                                </span>
                                <span style={{
                                    fontFamily: 'ui-monospace, monospace', fontSize: 10,
                                    color: 'var(--text-disabled)', letterSpacing: '.05em',
                                }}>
                                    {c.folio}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </>
    )
}

/* ── Estilos compartidos ── */

const sBtnPrimario = {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    background: 'var(--color-jade-500)', color: '#08130f',
    border: 'none', borderRadius: 'var(--radius-full)',
    padding: '9px 18px', fontWeight: 700, fontSize: 'var(--text-sm)',
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
}

const sBtnFantasma = {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)',
    padding: '9px 16px', fontWeight: 600, fontSize: 'var(--text-sm)',
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
}

const sTarjeta = {
    display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-start',
    background: 'var(--bg-elevated, rgba(255,255,255,.03))',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
    color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left',
    fontFamily: 'var(--font-sans)',
    transition: 'border-color .18s ease, transform .18s ease',
}
