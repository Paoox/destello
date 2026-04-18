/**
 * AccessCodeInput — Componente reutilizable
 * Input para ingresar el código "Chispa" de acceso.
 * Úsalo en PageAcceso, PageLogin, o donde se necesite validar código.
 *
 * Props:
 *  value       string   — valor controlado
 *  onChange    fn       — (valor) => void
 *  error       string   — mensaje de error (opcional)
 *  isLoading   bool     — deshabilita el input mientras carga
 *  placeholder string   — texto placeholder (opcional)
 */
import { useState } from 'react'
import { Key, Eye, EyeSlash } from '@phosphor-icons/react'

export default function AccessCodeInput({
                                            value       = '',
                                            onChange,
                                            error       = null,
                                            isLoading   = false,
                                            placeholder = 'Tu Chispa de acceso',
                                        }) {
    const [showCode, setShowCode] = useState(false)
    const [focused,  setFocused]  = useState(false)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

            {/* ── Contenedor del input ── */}
            <div style={{
                position: 'relative',
                borderRadius: 'var(--radius-lg)',
                // El borde cambia si hay error, si está enfocado o normal
                boxShadow: error
                    ? '0 0 0 2px var(--color-error)'
                    : focused
                        ? '0 0 0 2px var(--color-jade-500)'
                        : '0 0 0 1px var(--border-default)',
                transition: 'box-shadow 0.18s ease',
            }}>

                {/* Ícono llave */}
                <Key
                    size={16}
                    style={{
                        position: 'absolute',
                        left: 14,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: error
                            ? 'var(--color-error)'
                            : focused
                                ? 'var(--color-jade-500)'
                                : 'var(--text-muted)',
                        pointerEvents: 'none',
                        transition: 'color 0.18s ease',
                    }}
                />

                {/* Input */}
                <input
                    type={showCode ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange?.(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={()  => setFocused(false)}
                    placeholder={placeholder}
                    disabled={isLoading}
                    autoComplete="off"
                    spellCheck={false}
                    style={{
                        width: '100%',
                        padding: 'var(--space-3) var(--space-10) var(--space-3) var(--space-10)',
                        background: 'var(--bg-surface)',
                        border: 'none',
                        outline: 'none',
                        borderRadius: 'var(--radius-lg)',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--text-sm)',
                        fontFamily: 'var(--font-mono)', // ← mono para que el código se lea mejor
                        letterSpacing: '0.05em',
                        boxSizing: 'border-box',
                        opacity: isLoading ? 0.6 : 1,
                        cursor: isLoading ? 'not-allowed' : 'text',
                    }}
                />

                {/* Toggle mostrar/ocultar */}
                <button
                    type="button"
                    onClick={() => setShowCode(v => !v)}
                    disabled={isLoading}
                    style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 2,
                        borderRadius: 'var(--radius-sm)',
                        transition: 'color 0.18s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                    {showCode ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>

            </div>

            {/* ── Mensaje de error ── */}
            {error && (
                <p style={{
                    margin: 0,
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-error)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    paddingLeft: 2,
                }}>
                    {error}
                </p>
            )}

        </div>
    )
}