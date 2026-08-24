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
 * Misma decisión que el panel de Métricas: cero dependencias, y el navegador ya
 * exporta a PDF con texto seleccionable. jsPDF daría una imagen (un certificado
 * que no se puede copiar ni buscar) y puppeteer sería un Chromium entero en la
 * Toshiba.
 *
 * La regla de impresión usa `visibility` y no `display:none` a propósito:
 * ocultar con display reflowa toda la página y el diploma sale movido.
 *
 * ⚠️ **Nada en el diploma hereda estilos de la app.** Cada texto lleva escritos
 * su color y su tipografía. El CSS global de Destello le pone un degradado a
 * los `<h2>`, y por eso el título salía fantasma sobre el papel; aquí no se usa
 * ninguna etiqueta de encabezado.
 */

import { useState, useEffect, useCallback } from 'react'
import {
    Certificate, CaretLeft, CaretRight, DownloadSimple, ShareNetwork, X,
} from '@phosphor-icons/react'
import logoDestello from '../Images/destello-logo-512.png'

const POR_PAGINA = 3

/* ── Tinta del certificado ────────────────────────────────────────────────── */
const TINTA = '#13221e'   // casi negro, tirando a verde
const VERDE = '#0f6b57'   // el teal de la marca
const ORO   = '#b98b1d'
const PAPEL = '#fdfbf5'
const GRIS  = '#6b7a74'
const SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", serif'

const PRINT_CSS = `
@media print {
    body * { visibility: hidden !important; }
    .cert-hoja, .cert-hoja * { visibility: visible !important; }
    .cert-hoja {
        position: absolute !important; left: 0; top: 0;
        /* box-sizing explícito: sin él el padding se suma al 100 % y el folio
           de la esquina se sale de la hoja. */
        box-sizing: border-box !important;
        width: 100%; margin: 0;
        box-shadow: none !important;
    }
    .cert-no-print { display: none !important; }
    @page { size: landscape; margin: 10mm; }
}`

function fmtFecha(v) {
    if (!v) return ''
    const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : v)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

/* ══════════════════════════════════════════════════════════════════════════
   Piezas del diploma
   ══════════════════════════════════════════════════════════════════════════ */

/** Rombo de las esquinas y de los separadores. */
function Rombo({ tam = 7, color = ORO }) {
    return (
        <span style={{
            display: 'inline-block', width: tam, height: tam,
            background: color, transform: 'rotate(45deg)', flexShrink: 0,
        }} />
    )
}

/** Regla con un rombo al centro: separa sin cortar. */
function Filete({ ancho = 240 }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, margin: '14px auto 0', width: ancho, maxWidth: '80%',
        }}>
            <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${ORO})` }} />
            <Rombo tam={6} />
            <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${ORO}, transparent)` }} />
        </div>
    )
}

/**
 * Sello circular con el texto curvado.
 *
 * Va en SVG y no en imagen para que imprima nítido a cualquier tamaño y no
 * dependa de que el navegador tenga activados los gráficos de fondo.
 */
function Sello({ tam = 92 }) {
    return (
        <svg width={tam} height={tam} viewBox="0 0 100 100" aria-hidden="true"
             style={{ flexShrink: 0 }}>
            <defs>
                {/* Dos arcos en vez de un aro completo: en un círculo cerrado
                    la mitad de abajo sale de cabeza y a este tamaño no se lee. */}
                <path id="cert-arco-sup" d="M 14,50 A 36,36 0 0 1 86,50" />
                <path id="cert-arco-inf" d="M 18,50 A 32,32 0 0 0 82,50" />
            </defs>
            <circle cx="50" cy="50" r="47" fill="none" stroke={ORO} strokeWidth="1.6" />
            <circle cx="50" cy="50" r="42.5" fill="none" stroke={ORO} strokeWidth="0.7" opacity=".7" />
            <circle cx="50" cy="50" r="28" fill="none" stroke={ORO} strokeWidth="0.7" opacity=".45" />
            <text fill={ORO} fontSize="8.4" letterSpacing="1.9"
                  fontFamily={SERIF} fontWeight="700">
                <textPath href="#cert-arco-sup" startOffset="50%" textAnchor="middle">
                    DESTELLO
                </textPath>
            </text>
            <text fill={ORO} fontSize="6.6" letterSpacing="1.5"
                  fontFamily={SERIF} fontWeight="700">
                <textPath href="#cert-arco-inf" startOffset="50%" textAnchor="middle">
                    CONSTANCIA
                </textPath>
            </text>
            {/* La chispa de la marca, dibujada: no depende de ninguna fuente. */}
            <g stroke={VERDE} strokeLinecap="round">
                <line x1="50" y1="38" x2="50" y2="62" strokeWidth="2.1" />
                <line x1="38" y1="50" x2="62" y2="50" strokeWidth="2.1" />
                <line x1="41.5" y1="41.5" x2="58.5" y2="58.5" strokeWidth="1.3" />
                <line x1="58.5" y1="41.5" x2="41.5" y2="58.5" strokeWidth="1.3" />
            </g>
            <circle cx="50" cy="50" r="4.6" fill={ORO} />
        </svg>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   El diploma
   ══════════════════════════════════════════════════════════════════════════
   Papel claro incluso en modo oscuro: un certificado se imprime y se comparte,
   y en papel un fondo oscuro se vuelve un rectángulo de tinta. */

function Diploma({ cert }) {
    const esquina = (pos) => (
        <span style={{ position: 'absolute', ...pos, lineHeight: 0 }}>
            <Rombo tam={9} />
        </span>
    )

    return (
        <div className="cert-hoja" style={{
            position: 'relative',
            boxSizing: 'border-box',
            // Un degradado muy suave: el papel plano se ve barato.
            background: `radial-gradient(120% 90% at 50% 0%, #ffffff 0%, ${PAPEL} 55%, #f5efe1 100%)`,
            color: TINTA,
            fontFamily: SERIF,
            borderRadius: 6,
            padding: 'clamp(26px, 4.2vw, 52px)',
            // Marco exterior grueso en oro: es lo que lo hace leer como diploma.
            border: `3px solid ${ORO}`,
            boxShadow: '0 22px 60px rgba(0,0,0,.42)',
            overflow: 'hidden',
        }}>
            {/* Marco interior fino. El aire entre las dos líneas es lo que da
                el aire formal; pegarlas lo arruina. */}
            <div style={{
                position: 'absolute', inset: 9,
                border: `1px solid ${ORO}`, opacity: .5,
                borderRadius: 3, pointerEvents: 'none',
            }} />

            {esquina({ top: 5, left: 5 })}
            {esquina({ top: 5, right: 5 })}
            {esquina({ bottom: 5, left: 5 })}
            {esquina({ bottom: 5, right: 5 })}

            <div style={{ position: 'relative', textAlign: 'center' }}>

                {/* ── Marca ── */}
                <img src={logoDestello} alt="" width={54} height={54}
                     style={{ display: 'block', margin: '0 auto 8px' }} />
                <div style={{
                    fontFamily: SERIF, fontSize: 15, fontWeight: 700,
                    letterSpacing: '.42em', textIndent: '.42em',
                    color: VERDE, textTransform: 'uppercase',
                }}>
                    Destello
                </div>

                <Filete ancho={200} />

                {/* ── Título ── En <div>, no en <h2>: el CSS global de la app le
                    pone degradado a los encabezados y salía fantasma. */}
                <div style={{
                    marginTop: 18,
                    fontFamily: SERIF, fontStyle: 'italic',
                    fontSize: 'clamp(26px, 4.2vw, 40px)',
                    fontWeight: 400, lineHeight: 1.1, color: TINTA,
                }}>
                    Constancia de participación
                </div>

                <div style={{
                    marginTop: 22, fontSize: 11, letterSpacing: '.3em',
                    textIndent: '.3em', textTransform: 'uppercase',
                    color: GRIS, fontFamily: SERIF,
                }}>
                    Se otorga a
                </div>

                {/* ── El nombre ── Lo más grande de la hoja: el logro es suyo. */}
                <div style={{
                    margin: '10px auto 0', maxWidth: '92%',
                    fontFamily: SERIF, fontWeight: 700,
                    fontSize: 'clamp(28px, 5.4vw, 52px)',
                    lineHeight: 1.12, color: VERDE,
                }}>
                    {cert.nombre}
                </div>
                <Filete ancho={340} />

                <div style={{
                    margin: '22px auto 0', maxWidth: 640,
                    fontFamily: SERIF, fontSize: 15, lineHeight: 1.75, color: '#33443e',
                }}>
                    por haber concluido satisfactoriamente el taller
                    <div style={{ fontWeight: 700, color: TINTA, fontSize: 17, margin: '6px 0' }}>
                        {cert.taller_nombre}
                    </div>
                    {cert.duracion_horas
                        ? <>con una duración de <strong style={{ color: TINTA }}>
                              {Number(cert.duracion_horas)} horas</strong>{cert.fecha_taller ? ', ' : '.'}</>
                        : null}
                    {cert.fecha_taller
                        ? <>impartido el {fmtFecha(cert.fecha_taller)}.</>
                        : null}
                </div>

                {/* ── Firma · sello · folio ── */}
                <div style={{
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    gap: 20, marginTop: 'clamp(24px, 4.5vw, 46px)', flexWrap: 'wrap',
                }}>
                    <div style={{ width: 220, maxWidth: '100%', textAlign: 'center' }}>
                        {/* TODO(Paola): aquí va la imagen de la firma cuando la
                            mandes. Mientras, la línea sola no miente. */}
                        <div style={{ height: 30 }} />
                        <div style={{ borderTop: `1px solid ${TINTA}`, paddingTop: 7 }}>
                            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 13, color: TINTA }}>
                                {cert.instructor || 'Destello'}
                            </div>
                            <div style={{ fontSize: 10, letterSpacing: '.22em', textIndent: '.22em',
                                          textTransform: 'uppercase', color: GRIS, marginTop: 2 }}>
                                Instructor
                            </div>
                        </div>
                    </div>

                    <Sello tam={92} />

                    <div style={{ width: 220, maxWidth: '100%', textAlign: 'right' }}>
                        <div style={{ fontSize: 10, letterSpacing: '.22em', textIndent: '.22em',
                                      textTransform: 'uppercase', color: ORO, fontWeight: 700 }}>
                            Folio
                        </div>
                        <div style={{
                            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                            fontSize: 14, fontWeight: 700, color: TINTA,
                            letterSpacing: '.07em', margin: '3px 0 4px',
                        }}>
                            {cert.folio}
                        </div>
                        <div style={{ fontSize: 10, color: GRIS, fontFamily: SERIF }}>
                            Verifica en destello.courses/certificado
                        </div>
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
    const [valor,     setValor]     = useState(sugerido ?? '')
    const [guardando, setGuardando] = useState(false)
    const [error,     setError]     = useState(null)

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
                    <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>
                        Tu nombre en el certificado
                    </span>
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
   Vista completa
   ══════════════════════════════════════════════════════════════════════════ */

function ModalCertificado({ cert, onCerrar }) {
    const [copiado, setCopiado] = useState(false)

    const compartir = async () => {
        const url   = `${window.location.origin}/certificado/${cert.folio}`
        const texto = `Terminé el taller "${cert.taller_nombre}" en Destello ✨`
        // El compartir nativo es el que la gente ya conoce en el celular; en
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
            background: 'rgba(6,14,12,.82)', backdropFilter: 'blur(5px)',
            display: 'grid', placeItems: 'center',
            padding: 'var(--space-4)', overflowY: 'auto',
        }}>
            <div style={{ width: '100%', maxWidth: 900 }}>
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
                    “Gráficos de fondo” para que salga con el papel y el marco dorado.
                </p>
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   La sección
   ══════════════════════════════════════════════════════════════════════════ */

export default function Certificados({ token, tieneTalleres = false, nombreCuenta }) {
    const [certs,     setCerts]     = useState([])
    const [nombre,    setNombre]    = useState(null)
    const [cargado,   setCargado]   = useState(false)
    const [pagina,    setPagina]    = useState(0)
    const [abierto,   setAbierto]   = useState(null)
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
    // apenas está viendo la plataforma no tiene por qué recibir un pop-up sobre
    // un certificado que todavía no le toca.
    const preguntarNombre = cargado && !nombre && tieneTalleres && !pospuesto

    const paginas  = Math.ceil(certs.length / POR_PAGINA)
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
                    // Aire propio: pegado al bloque de arriba se leía como parte
                    // de la constelación, y es otra cosa.
                    marginTop: 'var(--space-6)',
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
