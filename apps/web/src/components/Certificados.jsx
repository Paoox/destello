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
import { createPortal } from 'react-dom'
import {
    Certificate, CaretLeft, CaretRight, DownloadSimple, ShareNetwork, X,
} from '@phosphor-icons/react'
import logoDestello from '../Images/destello-logo-512.png'
import qrcode from 'qrcode-generator'

const POR_PAGINA = 3

/* ── Tinta del certificado ────────────────────────────────────────────────── */
const TINTA = '#13221e'   // casi negro, tirando a verde
const VERDE = '#0f6b57'   // el teal de la marca
const ORO   = '#b98b1d'
const PAPEL = '#fdfbf5'
const GRIS  = '#6b7a74'
const SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", serif'

/** Hoy todos los talleres duran lo mismo. Si un día dejan de durarlo, el dato
 *  de `talleres.duracion_horas` manda y esto solo es el respaldo. */
const HORAS_POR_DEFECTO = 4

/** Dominio para el QR. Fijo y no `window.location`: un certificado emitido
 *  desde una vista previa local no puede quedarse con un enlace a localhost. */
const URL_BASE = 'https://destello.courses'

const PRINT_CSS = `
@media print {
    /* Sin esto el PDF sale con el fondo oscuro de la app: en pantalla no se
       nota, pero impreso es una plancha de tinta negra. */
    html, body { background: #ffffff !important; }

    /* Toda la app se APAGA con display:none, no con visibility.
       ⚠️ Con \`visibility: hidden\` los elementos se ocultan pero SIGUEN
       ocupando su espacio, así que el PDF salía con la altura completa de
       Inicio: tres hojas, con el diploma en la primera y dos en blanco.
       Por eso el diploma se saca a un portal fuera de #root: así se puede
       apagar la app entera sin apagarlo a él. */
    #root { display: none !important; }

    /* El portal deja de ser una capa flotante y pasa a ser la hoja. */
    .cert-portal {
        position: static !important; inset: auto !important;
        display: block !important; overflow: visible !important;
        background: none !important; backdrop-filter: none !important;
        padding: 0 !important; margin: 0 !important;
    }
    .cert-portal > * { max-width: none !important; width: 100% !important; }

    .cert-hoja {
        box-sizing: border-box !important;
        box-shadow: none !important;
        /* El papel se imprime aunque el navegador tenga apagados los gráficos
           de fondo: el degradado es un adorno, no puede ser un requisito. */
        background: #ffffff !important;
    }

    .cert-no-print { display: none !important; }

    /* Que quepa en UNA hoja aunque el navegador imprima con encabezado y pie.
       Los tamaños de pantalla usan vw y en papel se quedan grandes: aquí se
       aprietan a mano, con margen de sobra sobre el alto de la página. */
    body { margin: 0 !important; padding: 0 !important; }
    .cert-hoja  { padding: 26px !important; }
    .cert-logo  { width: 38px !important; height: 38px !important; margin-bottom: 4px !important; }
    .cert-titulo { font-size: 34px !important; margin-top: 10px !important; }
    .cert-nombre { font-size: 38px !important; }
    .cert-pie    { margin-top: 16px !important; }
    .cert-sello  { width: 74px !important; height: 99px !important; }

    @page { size: landscape; margin: 8mm; }
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

/**
 * Filigrana de esquina.
 *
 * Va dibujada en SVG y no como imagen por dos razones: imprime nítida a
 * cualquier tamaño, y no depende de que el navegador tenga activados los
 * "gráficos de fondo" — una imagen de fondo desaparecería justo al exportar el
 * PDF, que es cuando más importa.
 *
 * `voltearX` / `voltearY` reusan el mismo dibujo en las cuatro esquinas.
 *
 * ⚠️ El SVG NO se posiciona solo: lo coloca la envoltura. Cuando el SVG también
 * era `absolute` las cuatro esquinas se apilaban en una sola.
 */
function Filigrana({ tam = 118, voltearX = false, voltearY = false }) {
    return (
        <svg width={tam} height={tam} viewBox="0 0 120 120" aria-hidden="true"
             style={{
                 display: 'block', pointerEvents: 'none',
                 transform: `scale(${voltearX ? -1 : 1}, ${voltearY ? -1 : 1})`,
                 transformOrigin: 'center',
             }}>
            <g fill="none" stroke={ORO} strokeLinecap="round">
                {/* Escuadra doble: la línea gruesa marca el marco, la fina lo
                    acompaña. El aire entre las dos es lo que se ve "caro". */}
                <path d="M 10,112 L 10,26 Q 10,10 26,10 L 112,10" strokeWidth="2" />
                <path d="M 17,112 L 17,29 Q 17,17 29,17 L 112,17" strokeWidth="0.9" opacity=".7" />

                {/* Voluta interior: el rizo es lo que convierte una escuadra en
                    un ornamento. */}
                <path d="M 26,58 C 26,38 38,26 58,26" strokeWidth="1.5" />
                <path d="M 26,58 C 26,70 34,78 46,78 C 55,78 60,72 60,64
                         C 60,57 55,53 49,54 C 44,55 42,59 44,63"
                      strokeWidth="1.4" />
                <path d="M 58,26 C 70,26 78,34 78,46 C 78,55 72,60 64,60
                         C 57,60 53,55 54,49 C 55,44 59,42 63,44"
                      strokeWidth="1.4" />

                {/* Hojas: rompen la simetría dura de las curvas. */}
                <path d="M 33,40 C 40,33 50,31 56,34 C 50,41 40,44 33,40 Z"
                      fill={ORO} stroke="none" opacity=".55" />
                <path d="M 22,86 C 27,80 34,78 39,80 C 34,86 27,89 22,86 Z"
                      fill={ORO} stroke="none" opacity=".4" />
                <path d="M 86,22 C 92,27 94,34 92,39 C 86,34 83,27 86,22 Z"
                      fill={ORO} stroke="none" opacity=".4" />
            </g>
        </svg>
    )
}

/** Regla con rombo al centro: separa sin cortar. */
function Filete({ ancho = 260 }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, margin: '12px auto 0', width: ancho, maxWidth: '78%',
        }}>
            <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${ORO})` }} />
            <span style={{
                width: 6, height: 6, background: ORO,
                transform: 'rotate(45deg)', flexShrink: 0,
            }} />
            <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${ORO}, transparent)` }} />
        </div>
    )
}

/** Borde festoneado del sello, calculado: 24 ondas exactas y simétricas. */
function pathFestoneado(cx, cy, r, ondas) {
    const paso = (Math.PI * 2) / ondas
    let d = ''
    for (let i = 0; i < ondas; i++) {
        const a0 = i * paso
        const a1 = (i + 1) * paso
        const am = a0 + paso / 2
        const x0 = cx + r * Math.cos(a0),        y0 = cy + r * Math.sin(a0)
        const x1 = cx + r * Math.cos(a1),        y1 = cy + r * Math.sin(a1)
        const xm = cx + (r + 3.6) * Math.cos(am), ym = cy + (r + 3.6) * Math.sin(am)
        d += (i === 0 ? `M ${x0.toFixed(2)},${y0.toFixed(2)} ` : '')
           + `Q ${xm.toFixed(2)},${ym.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)} `
    }
    return `${d}Z`
}

/**
 * Sello con listones.
 *
 * Mismo criterio que la filigrana: SVG, no imagen. El texto va en dos arcos
 * separados y no en un aro cerrado, porque en un círculo completo la mitad de
 * abajo sale de cabeza y a este tamaño no se lee.
 */
function Sello({ tam = 118 }) {
    return (
        <svg className="cert-sello" width={tam} height={tam * 1.34}
             viewBox="0 0 100 134" aria-hidden="true"
             style={{ flexShrink: 0, display: 'block' }}>
            <defs>
                <linearGradient id="cert-oro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#e8c76a" />
                    <stop offset="45%"  stopColor="#c9a227" />
                    <stop offset="100%" stopColor="#9c7112" />
                </linearGradient>
                {/* ⚠️ Los dos radios NO son iguales, y tiene que ser así.
                    El texto del arco de arriba se dibuja hacia AFUERA de su
                    arco y el de abajo hacia ADENTRO del suyo. Con el mismo
                    radio las dos palabras quedan pegadas a anillos opuestos:
                    DESTELLO al dorado de afuera y CONSTANCIA al fino de
                    adentro. (Con r=33 DESTELLO ni siquiera cabía: llegaba a
                    r≈38 sobre un papel que termina en 37, y se perdía encima
                    del borde dorado.)

                    La banda clara va del anillo interior (r=21) al exterior
                    (r=34.5), así que su centro está en r≈27.75. Cada radio se
                    calcula para que su palabra quede centrada AHÍ:
                      · arriba  → 27.75 − alto/2 ≈ 25
                      · abajo   → 27.75 + alto/2 ≈ 29.9
                    Si alguien cambia un `fontSize`, hay que recalcular ese
                    radio o la palabra se vuelve a recargar a un anillo. */}
                <path id="cert-arco-sup" d="M 25,50 A 25,25 0 0 1 75,50" />
                <path id="cert-arco-inf" d="M 20.1,50 A 29.9,29.9 0 0 0 79.9,50" />
            </defs>

            {/* Listones: van detrás de la medalla para que se vean colgando. */}
            <path d="M 33,72 L 24,128 L 39,118 L 50,127 L 50,72 Z"
                  fill="#0f6b57" />
            <path d="M 67,72 L 76,128 L 61,118 L 50,127 L 50,72 Z"
                  fill="#0c5545" />

            <path d={pathFestoneado(50, 50, 40, 24)} fill="url(#cert-oro)" />
            <circle cx="50" cy="50" r="37"   fill={PAPEL} />
            <circle cx="50" cy="50" r="34.5" fill="none" stroke={ORO} strokeWidth="1.2" />
            <circle cx="50" cy="50" r="21"   fill="none" stroke={ORO} strokeWidth="0.8" opacity=".5" />

            <text fill={ORO} fontSize="7.6" letterSpacing="1.8"
                  fontFamily={SERIF} fontWeight="700">
                <textPath href="#cert-arco-sup" startOffset="50%" textAnchor="middle">
                    DESTELLO
                </textPath>
            </text>
            <text fill={ORO} fontSize="6" letterSpacing="1.3"
                  fontFamily={SERIF} fontWeight="700">
                <textPath href="#cert-arco-inf" startOffset="50%" textAnchor="middle">
                    CONSTANCIA
                </textPath>
            </text>

            {/* La chispa de la marca, dibujada: no depende de ninguna fuente. */}
            <g stroke={VERDE} strokeLinecap="round">
                <line x1="50" y1="41" x2="50" y2="59" strokeWidth="2.2" />
                <line x1="41" y1="50" x2="59" y2="50" strokeWidth="2.2" />
                <line x1="43.6" y1="43.6" x2="56.4" y2="56.4" strokeWidth="1.3" />
                <line x1="56.4" y1="43.6" x2="43.6" y2="56.4" strokeWidth="1.3" />
            </g>
            <circle cx="50" cy="50" r="4" fill={ORO} />
        </svg>
    )
}

/**
 * Código QR a la página pública de verificación.
 *
 * Un certificado impreso no se puede comprobar: quien lo recibe tendría que
 * teclear el folio a mano. Con el QR, apunta la cámara y la plataforma le dice
 * si ese folio existe y a nombre de quién.
 *
 * ── Por qué una librería y no código propio ─────────────────────────────────
 * Codificar un QR es Reed-Solomon, tablas de bloques por versión y ocho
 * máscaras con su puntuación. Escribirlo a mano son ~300 líneas donde un error
 * sutil produce un código que se ve bien y que algunos teléfonos no leen — y
 * eso es peor que no tener QR. `qrcode-generator` no tiene dependencias y pesa
 * ~6 KB comprimido: menos de lo que costaría equivocarse.
 *
 * El DIBUJO sí es nuestro: un solo `path` de SVG en vez de cientos de `<rect>`,
 * para que imprima nítido y no infle el DOM.
 */
function QR({ texto, tam = 96 }) {
    // 0 = que la librería elija la versión más chica que quepa.
    // 'M' aguanta ~15 % de daño: suficiente para papel, sin agrandar el código.
    const qr = qrcode(0, 'M')
    qr.addData(texto)
    qr.make()

    const n = qr.getModuleCount()
    let d = ''
    for (let f = 0; f < n; f++) {
        for (let c = 0; c < n; c++) {
            if (qr.isDark(f, c)) d += `M${c},${f}h1v1h-1z`
        }
    }

    return (
        <svg width={tam} height={tam} viewBox={`-2 -2 ${n + 4} ${n + 4}`}
             shapeRendering="crispEdges" aria-hidden="true"
             style={{ display: 'block' }}>
            {/* El margen blanco (las 2 unidades del viewBox) no es decorativo:
                sin zona tranquila alrededor, muchos lectores no enganchan. */}
            <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#ffffff" />
            <path d={d} fill={TINTA} />
        </svg>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   El diploma
   ══════════════════════════════════════════════════════════════════════════
   Papel claro incluso en modo oscuro: un certificado se imprime y se comparte,
   y en papel un fondo oscuro se vuelve un rectángulo de tinta. */

function Diploma({ cert }) {
    // Todos los talleres duran 4 h; si el dato falta, no hay razón para callarlo.
    const horas = Number(cert.duracion_horas) || HORAS_POR_DEFECTO
    // Absoluta a propósito: el QR se escanea desde una hoja de papel, donde no
    // existe "la página actual" contra la cual resolver una ruta relativa.
    const urlVerificacion = `${URL_BASE}/certificado/${cert.folio}`

    return (
        <div className="cert-hoja" style={{
            position: 'relative',
            boxSizing: 'border-box',
            background: `radial-gradient(120% 90% at 50% 0%, #ffffff 0%, ${PAPEL} 55%, #f6f0e2 100%)`,
            color: TINTA,
            fontFamily: SERIF,
            borderRadius: 4,
            padding: 'clamp(30px, 5vw, 62px)',
            border: `1px solid ${ORO}`,
            boxShadow: '0 22px 60px rgba(0,0,0,.42)',
            overflow: 'hidden',
        }}>
            {/* Las cuatro esquinas con el mismo dibujo, volteado. */}
            <span style={{ position: 'absolute', top: 6,  left: 6, lineHeight: 0 }}>
                <Filigrana />
            </span>
            <span style={{ position: 'absolute', top: 6,  right: 6, lineHeight: 0 }}>
                <Filigrana voltearX />
            </span>
            <span style={{ position: 'absolute', bottom: 6, left: 6, lineHeight: 0 }}>
                <Filigrana voltearY />
            </span>
            <span style={{ position: 'absolute', bottom: 6, right: 6, lineHeight: 0 }}>
                <Filigrana voltearX voltearY />
            </span>

            <div style={{ position: 'relative', textAlign: 'center' }}>

                {/* ── Marca ── */}
                <img className="cert-logo" src={logoDestello} alt="" width={48} height={48}
                     style={{ display: 'block', margin: '0 auto 6px' }} />
                <div style={{
                    fontFamily: SERIF, fontSize: 13, fontWeight: 700,
                    letterSpacing: '.44em', textIndent: '.44em',
                    color: VERDE, textTransform: 'uppercase',
                }}>
                    Destello
                </div>

                {/* ── Título ── En <div>, no en <h2>: el CSS global de la app le
                    pone degradado a los encabezados y salía fantasma. */}
                <div className="cert-titulo" style={{
                    marginTop: 16, fontFamily: SERIF, fontWeight: 700,
                    fontSize: 'clamp(30px, 5.6vw, 54px)',
                    letterSpacing: '.16em', textIndent: '.16em',
                    lineHeight: 1, color: TINTA,
                }}>
                    CERTIFICADO
                </div>
                <div style={{
                    marginTop: 8, fontFamily: SERIF, fontStyle: 'italic',
                    fontSize: 'clamp(14px, 2vw, 19px)', color: GRIS,
                }}>
                    de participación
                </div>

                <Filete ancho={230} />

                <div style={{
                    marginTop: 20, fontSize: 10.5, letterSpacing: '.32em',
                    textIndent: '.32em', textTransform: 'uppercase',
                    color: GRIS, fontFamily: SERIF,
                }}>
                    Se otorga a
                </div>

                {/* ── El nombre ── Lo más grande de la hoja: el logro es suyo. */}
                <div className="cert-nombre" style={{
                    margin: '8px auto 0', maxWidth: '92%',
                    fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700,
                    fontSize: 'clamp(30px, 5.8vw, 56px)',
                    lineHeight: 1.1, color: VERDE,
                }}>
                    {cert.nombre}
                </div>
                <Filete ancho={400} />

                <div style={{
                    margin: '20px auto 0', maxWidth: 620,
                    fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.7, color: '#33443e',
                }}>
                    por haber concluido satisfactoriamente el taller
                    <div style={{ fontWeight: 700, color: TINTA, fontSize: 16.5, margin: '5px 0' }}>
                        {cert.taller_nombre}
                    </div>
                    con una duración de <strong style={{ color: TINTA }}>{horas} horas</strong>
                    {cert.fecha_taller ? <>, impartido el {fmtFecha(cert.fecha_taller)}</> : null}.
                </div>

                {/* ── Firma · sello · folio ──
                    Agrupados al centro y no pegados a los bordes: separados se
                    leían como tres cosas sueltas en vez de un pie de documento. */}
                <div className="cert-pie" style={{
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    gap: 'clamp(14px, 3vw, 38px)',
                    margin: 'clamp(18px, 3vw, 34px) auto 0',
                    maxWidth: 660, flexWrap: 'wrap',
                }}>
                    <div style={{ width: 190, maxWidth: '45%', textAlign: 'center' }}>
                        {/* TODO(Paola): aquí va la imagen de la firma cuando la
                            mandes. Mientras, la línea sola no miente. */}
                        <div style={{ height: 26 }} />
                        <div style={{ borderTop: `1px solid ${TINTA}`, paddingTop: 6 }}>
                            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 12.5, color: TINTA }}>
                                {cert.instructor || 'Destello'}
                            </div>
                            <div style={{ fontSize: 9.5, letterSpacing: '.2em', textIndent: '.2em',
                                          textTransform: 'uppercase', color: GRIS, marginTop: 2 }}>
                                Instructor
                            </div>
                        </div>
                    </div>

                    <Sello tam={104} />

                    {/* El folio ya no lleva línea: no es una firma, es un dato.
                        La línea lo hacía parecer un segundo espacio para firmar. */}
                    <div style={{ width: 190, maxWidth: '45%', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <QR texto={urlVerificacion} tam={104} />
                        </div>
                        <div style={{
                            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                            fontSize: 12.5, fontWeight: 700, color: TINTA,
                            letterSpacing: '.06em', marginTop: 7,
                        }}>
                            {cert.folio}
                        </div>
                        <div style={{ fontSize: 9.5, letterSpacing: '.2em', textIndent: '.2em',
                                      textTransform: 'uppercase', color: GRIS, marginTop: 2 }}>
                            Escanea para verificar
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: 12, fontSize: 9.5, color: GRIS, fontFamily: SERIF }}>
                    destello.courses/certificado/{cert.folio}
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

    // Portal a <body>: fuera de #root. Es lo que permite apagar la app entera
    // al imprimir sin apagar el diploma — y por lo tanto imprimir UNA hoja.
    return createPortal(
        <div className="cert-portal" style={{
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
        </div>,
        document.body
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
