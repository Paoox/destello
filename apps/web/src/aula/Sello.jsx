/**
 * Destello — El aula: dibujar un sello
 *
 * Un solo lugar que sabe cómo se ve un sello. Hoy dibuja el emoji de reserva;
 * el día que Paola mande las ilustraciones, se llena `imagen` en el catálogo y
 * **este archivo es el único que se entera**.
 *
 * Por eso existe aunque hoy parezca de más: si cada pantalla dibujara el sello
 * por su cuenta, meter el arte nuevo obligaría a tocar cuatro archivos y alguno
 * se quedaría con el emoji viejo.
 */

export default function Sello({ sello, size = 22, conFondo = false, title }) {
    if (!sello) return null

    const contenido = sello.imagen
        ? <img src={sello.imagen} alt={sello.nombre}
               style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        : <span style={{ fontSize: Math.round(size * 0.62), lineHeight: 1 }}>{sello.emoji}</span>

    if (!conFondo) {
        return (
            <span title={title ?? sello.nombre} style={{
                width: size, height: size, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', flex: 'none',
            }}>
                {contenido}
            </span>
        )
    }

    // Con fondo: como el sello de tinta ya plantado, con su halo de color.
    return (
        <span title={title ?? sello.nombre} style={{
            width: size, height: size, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', flex: 'none',
            background: `${sello.color}22`,
            border: `1.5px solid ${sello.color}`,
            borderRadius: '50%',
        }}>
            {contenido}
        </span>
    )
}
