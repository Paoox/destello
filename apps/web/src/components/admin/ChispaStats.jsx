/**
 * Destello Admin — ChispaStats
 * Tarjetas de estadísticas del estado de las chispas.
 */
import { Sparkle, CheckCircle, XCircle, Clock, Gift } from '@phosphor-icons/react'

function StatCard({ icon: Icon, label, value, color }) {
    return (
        <div style={{
            background:   'var(--bg-card)',
            border:       '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding:      'var(--space-4)',
            display:      'flex',
            flexDirection: 'column',
            alignItems:   'center',
            gap:          'var(--space-2)',
            textAlign:    'center',
        }}>
            <div style={{
                width:          36,
                height:         36,
                borderRadius:   'var(--radius-lg)',
                background:     color + '22',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                flexShrink:     0,
            }}>
                <Icon size={18} color={color} weight="fill" />
            </div>
            <div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 'var(--text-xl)', fontWeight: 700, lineHeight: 1 }}>{value ?? '—'}</p>
            </div>
        </div>
    )
}

export default function ChispaStats({ stats }) {
    return (
        <div style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap:                 'var(--space-3)',
        }}>
            <StatCard icon={Sparkle}      label="Total"    value={stats?.total}   color="var(--color-jade-500)" />
            <StatCard icon={CheckCircle}  label="Activas"  value={stats?.active}  color="#22c55e" />
            <StatCard icon={CheckCircle}  label="Usadas"   value={stats?.used}    color="#3b82f6" />
            <StatCard icon={Clock}        label="Expiradas" value={stats?.expired} color="#f59e0b" />
            <StatCard icon={XCircle}      label="Revocadas" value={stats?.revoked} color="var(--color-error)" />
            <StatCard icon={Gift}         label="Demo"      value={stats?.demo}    color="#a855f7" />
        </div>
    )
}