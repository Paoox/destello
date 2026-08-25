/**
 * Destello — El aula: la bandeja de sellos de la profe
 *
 * ── POR QUÉ FUNCIONA ASÍ (agarrar y plantar) ─────────────────────────────
 *
 * La referencia de Paola son los sellos de maestra de los noventa, y lo que
 * los hacía memorables no era el dibujo: era el **gesto**. El maestro agarraba
 * el sello, lo entintaba y lo plantaba en tu hoja. Había un momento.
 *
 * Por eso aquí no se abre un menú encima de cada alumna. Se **agarra** un
 * sello —queda cargado, y la bandeja te lo dice— y después se **planta** en
 * el pizarrón de quien sea, o en todos de un golpe. Se pueden repartir cinco
 * sellos seguidos sin volver a abrir nada, que es justo lo que la profe va a
 * querer hacer cuando el grupo va bien.
 *
 * Con el sello cargado, las miniaturas de los pizarrones se vuelven el blanco.
 * Se sale con Escape o soltando el sello.
 */
import { useEffect } from 'react'
import { X, Sparkle } from '@phosphor-icons/react'
import { SELLOS } from './catalogo.js'
import Sello from './Sello.jsx'

export default function BandejaSellos({ abierta, cargado, onCargar, onSoltar, onATodos, onCerrar }) {
    // Escape suelta el sello antes de cerrar la bandeja: si alguien lo trae
    // cargado, lo que quiere soltar primero es el sello, no la bandeja.
    useEffect(() => {
        if (!abierta) return
        const alTeclear = (e) => {
            if (e.key !== 'Escape') return
            if (cargado) onSoltar()
            else onCerrar()
        }
        window.addEventListener('keydown', alTeclear)
        return () => window.removeEventListener('keydown', alTeclear)
    }, [abierta, cargado, onSoltar, onCerrar])

    if (!abierta) return null

    return (
        <div style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: 'var(--space-3)',
            background: 'var(--bg-surface)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                <Sparkle size={14} color="var(--color-amber-500)" weight="fill" />
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                    {cargado ? 'Ahora pícale a quien se lo ganó' : 'Agarra un sello'}
                </span>
                <button onClick={onCerrar} title="Cerrar la bandeja" style={{
                    marginLeft: 'auto', display: 'flex', background: 'transparent',
                    border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
                }}>
                    <X size={13} />
                </button>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SELLOS.map(s => {
                    const activo = cargado?.id === s.id
                    return (
                        <button
                            key={s.id}
                            onClick={() => activo ? onSoltar() : onCargar(s)}
                            title={`${s.nombre} — ${s.mensaje}`}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '5px 10px 5px 6px',
                                background: activo ? `${s.color}22` : 'var(--bg-card)',
                                border: `1px solid ${activo ? s.color : 'var(--border-subtle)'}`,
                                borderRadius: 'var(--radius-full)',
                                color: activo ? s.color : 'var(--text-secondary)',
                                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                                fontWeight: activo ? 700 : 400,
                                cursor: 'pointer', transition: 'all .12s',
                            }}
                        >
                            <Sello sello={s} size={20} />
                            {s.nombre}
                        </button>
                    )
                })}
            </div>

            {cargado && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginTop: 10, flexWrap: 'wrap',
                }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        Traes <strong style={{ color: cargado.color }}>{cargado.nombre}</strong> en la mano
                    </span>
                    <button onClick={onATodos} style={{
                        padding: '5px 12px',
                        background: `${cargado.color}1a`,
                        border: `1px solid ${cargado.color}`,
                        borderRadius: 'var(--radius-full)',
                        color: cargado.color, fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-xs)', fontWeight: 700, cursor: 'pointer',
                    }}>
                        Ponérselo a todos
                    </button>
                    <button onClick={onSoltar} style={{
                        padding: '5px 12px', background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-full)',
                        color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
                        fontSize: 'var(--text-xs)', cursor: 'pointer',
                    }}>
                        Soltarlo
                    </button>
                </div>
            )}
        </div>
    )
}
