/**
 * Destello Admin — Piezas compartidas de Métricas
 *
 * Las tres vistas (Resumen · Financiero · Alumno) usan los mismos ladrillos.
 * Tenerlos en un solo archivo es lo que hace que se vean como un sistema y no
 * como tres tableros distintos pegados con cinta.
 *
 * ── La paleta está validada, no elegida a ojo ───────────────────────────────
 *
 * Los cuatro colores de serie pasan las seis pruebas sobre el fondo oscuro de
 * Destello: banda de luminosidad, croma mínimo, separación para daltonismo
 * (protan / deutan / tritan), piso de visión normal y contraste contra la
 * superficie. **No se cambian sin volver a validarlos.**
 */

import { useState } from 'react'

// ── Paleta de series (validada sobre superficie #0E1B18) ─────────────────────
export const SERIE = {
    uno:    '#199e70',   // jade — la marca
    dos:    '#3987e5',   // azul
    tres:   '#c98500',   // ámbar
    cuatro: '#d55181',   // magenta
}

/** Estados: reservados. Nunca se reciclan como "serie 5" y siempre van con texto. */
export const ESTADO = {
    bien:     '#199e70',
    atencion: '#c98500',
    urgente:  '#e66767',
}

// ── Formato ──────────────────────────────────────────────────────────────────

export const fmtMoneda = n =>
    `$${Number(n ?? 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`

export const fmtNum = n => Number(n ?? 0).toLocaleString('es-MX')

export const fmtDia = d =>
    new Date(`${d}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })

export const fmtFecha = d => d
    ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

export const fmtMes = m => {
    const [a, mm] = String(m).split('-')
    return new Date(Number(a), Number(mm) - 1, 1)
        .toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
}

/**
 * Nombre presentable del método de pago.
 * En la BD se guarda sin acentos (es una llave, no un texto para leer); aquí se
 * traduce para la pantalla. La llave nunca cambia — solo cómo se muestra.
 */
export function fmtMetodo(m) {
    return {
        transferencia: 'Transferencia',
        efectivo:      'Efectivo',
        tarjeta:       'Tarjeta',
        cortesia:      'Cortesía',
    }[m] ?? m
}

/** Horas → "3 h" o "2.5 días", lo que se lea mejor. */
export function fmtHoras(h) {
    if (h == null) return '—'
    const n = Number(h)
    if (Number.isNaN(n)) return '—'
    if (n < 48) return `${Math.round(n)} h`
    return `${(n / 24).toFixed(1)} días`
}

// ── Componentes ──────────────────────────────────────────────────────────────

/**
 * Número protagonista. No lleva gráfica: cuando el dato es UNO, dibujarlo sería
 * decorar en vez de informar.
 */
export function Tile({ icon: Icon, label, valor, sub, color = 'var(--text-primary)' }) {
    return (
        <div className="mx-tile" style={{
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
            <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, color }}>{valor}</span>
            {sub && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{sub}</span>}
        </div>
    )
}

/**
 * Barra horizontal para comparar magnitudes.
 *
 * Horizontal y no vertical porque las etiquetas son nombres largos de taller:
 * en vertical habría que girarlas y dejarían de leerse.
 */
export function BarraH({ label, valor, max, color = SERIE.uno, nota }) {
    const num = typeof valor === 'number' ? valor : Number(String(valor).replace(/[^\d.-]/g, '')) || 0
    const pct = max > 0 ? Math.max((num / max) * 100, num > 0 ? 1.5 : 0) : 0
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <span style={{
                    fontSize: 'var(--text-xs)', color: 'var(--text-secondary, var(--text-muted))',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{label}</span>
                {/* El número va en color de texto, nunca en el de la serie. */}
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {valor}
                </span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4 }}>
                {/* Extremo redondeado solo del lado del dato; el otro queda
                    anclado a la línea base. */}
                <div style={{
                    width: `${pct}%`, height: '100%', background: color,
                    borderRadius: '0 4px 4px 0', transition: 'width .3s ease',
                }} />
            </div>
            {nota && <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>{nota}</span>}
        </div>
    )
}

export function Vacio({ texto }) {
    return (
        <p style={{
            color: 'var(--text-muted)', fontSize: 'var(--text-sm)',
            textAlign: 'center', padding: 'var(--space-6) 0', margin: 0,
        }}>{texto}</p>
    )
}

export function Seccion({ titulo, icon: Icon, children, accion, nota }) {
    return (
        <section className="mx-seccion" style={{
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
                {accion && <span className="mx-no-print">{accion}</span>}
            </header>
            {nota && (
                <p style={{
                    margin: '0 0 var(--space-4)', fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)', lineHeight: 1.5,
                }}>{nota}</p>
            )}
            {children}
        </section>
    )
}

export function Campo({ label, children }) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{
                fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase',
                letterSpacing: '.04em', fontWeight: 600,
            }}>{label}</span>
            {children}
        </label>
    )
}

/** Tabla simple con scroll horizontal propio: nunca empuja el ancho de la página. */
export function Tabla({ columnas, filas, render }) {
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                        {columnas.map(c => (
                            <th key={c} style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{c}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {filas.map((f, i) => (
                        <tr key={f.id ?? i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            {render(f).map((celda, j) => (
                                <td key={j} style={{ padding: '8px 10px', verticalAlign: 'top' }}>{celda}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// ── Estilos sueltos ──────────────────────────────────────────────────────────

export const sInput = {
    padding: '6px 10px', background: 'var(--bg-base, #0E1B18)',
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-xs)', outline: 'none',
}

export const sBtnGhost = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', height: 30,
    background: 'transparent', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-muted)',
    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 600,
    cursor: 'pointer',
}

export const sSubtitulo = {
    fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '.04em', fontWeight: 700, margin: '0 0 10px',
}

/**
 * CSS de impresión — así es como se descarga en PDF.
 *
 * ── Por qué no jsPDF ni puppeteer ───────────────────────────────────────────
 *
 * El navegador ya sabe exportar a PDF: Ctrl+P → "Guardar como PDF". Solo hay
 * que decirle cómo verse en papel. Eso cuesta este bloque de CSS y **cero KB de
 * dependencia**.
 *
 *   · jsPDF + html2canvas → cientos de KB al bundle, y el resultado es una
 *     imagen: no se puede seleccionar el texto ni buscar dentro del PDF.
 *   · puppeteer en la API → un Chromium entero corriendo en la Toshiba.
 *
 * Las gráficas salen nítidas a cualquier zoom porque son SVG, no imágenes.
 */
export const PRINT_CSS = `
@media print {
    /* Fuera todo lo que no es información: menús, filtros, botones. */
    .mx-no-print, nav, aside, header button, .dh-sidebar { display: none !important; }

    /* Papel blanco y tinta negra: imprimir el tema oscuro se come el tóner
       y deja el texto ilegible. */
    :root, body, #root { background: #fff !important; color: #111 !important; }
    .mx-seccion, .mx-tile {
        background: #fff !important;
        border: 1px solid #ddd !important;
        box-shadow: none !important;
        break-inside: avoid;          /* que una tarjeta no se parta a la mitad */
        page-break-inside: avoid;
    }
    .mx-seccion h3, .mx-tile span, td, th, p, h1, h2, h3 { color: #111 !important; }
    .mx-seccion { margin-bottom: 12px !important; }

    /* Las secciones grandes van una debajo de otra: en papel no hay scroll
       horizontal que valga. */
    .mx-grid { display: block !important; }
    .mx-grid > * { margin-bottom: 12px; }

    /* Pero las tarjetas de números SÍ se quedan en fila. Una por renglón
       gastaría cuatro páginas para decir cuatro cifras. */
    .mx-grid-tiles {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        gap: 8px !important;
    }
    .mx-grid-tiles > * { margin-bottom: 0; }
    .mx-tile { padding: 8px 10px !important; }
    .mx-tile span:nth-child(2) { font-size: 18px !important; }

    table { font-size: 10px !important; }
    thead { display: table-header-group; }   /* repetir encabezados por página */
    tr { break-inside: avoid; }

    .mx-print-head { display: block !important; }
    @page { margin: 14mm; }
}
.mx-print-head { display: none; }
`

/** Encabezado que SOLO aparece en el papel: qué es, de cuándo y con qué filtros. */
export function EncabezadoImpresion({ titulo, filtros }) {
    const partes = []
    if (filtros?.desde || filtros?.hasta) {
        partes.push(`Del ${filtros.desde || 'inicio'} al ${filtros.hasta || 'hoy'}`)
    }
    if (filtros?.tallerNombre) partes.push(`Taller: ${filtros.tallerNombre}`)
    if (filtros?.categoria)    partes.push(`Categoría: ${filtros.categoria}`)

    return (
        <div className="mx-print-head" style={{ marginBottom: 16, borderBottom: '1px solid #ddd', paddingBottom: 8 }}>
            <strong style={{ fontSize: 16 }}>Destello — {titulo}</strong>
            <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
                {partes.length ? partes.join(' · ') : 'Todo el histórico'}
                {' · '}Generado el {new Date().toLocaleString('es-MX')}
            </div>
        </div>
    )
}

/** Botón de descarga. Abre el diálogo de impresión del navegador. */
export function BotonPDF({ label = 'Descargar PDF' }) {
    const [avisando, setAvisando] = useState(false)
    return (
        <span style={{ position: 'relative' }}>
            <button
                className="mx-no-print"
                onClick={() => window.print()}
                onMouseEnter={() => setAvisando(true)}
                onMouseLeave={() => setAvisando(false)}
                style={sBtnGhost}
            >
                ⬇ {label}
            </button>
            {avisando && (
                <span style={{
                    position: 'absolute', top: '110%', right: 0, whiteSpace: 'nowrap',
                    background: 'var(--bg-elevated, #14241f)', border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)', padding: '6px 10px', zIndex: 20,
                    fontSize: 10, color: 'var(--text-muted)',
                }}>
                    En el diálogo elige <strong>Guardar como PDF</strong>
                </span>
            )}
        </span>
    )
}
