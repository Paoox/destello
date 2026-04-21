/**
 * Destello Admin — ChispaStats
 * Tarjetas de estadísticas del estado de las chispas.
 */
import { Sparkle, CheckCircle, XCircle, Clock } from '@phosphor-icons/react'

function StatCard({ icon: Icon, label, value, color }) {
    return (
        <div style={{
            background:   'var(--bg-card)',
            border:       '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding:      'var(--space-5)',
            display:      'flex',
            alignItems:   'center',
            gap:          'var(--space-4)',
        }}>
            <div style={{
                width:          44,
                height:         44,
                borderRadius:   'var(--radius-lg)',
                background:     color + '22',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                flexShrink:     0,
            }}>
                <Icon size={22} color={color} weight="fill" />
            </div>
            <div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, lineHeight: 1 }}>{value ?? '—'}</p>
            </div>
        </div>
    )
}

export default function ChispaStats({ stats }) {
    return (
        <div style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap:                 'var(--space-4)',
        }}>
            <StatCard icon={Sparkle}      label="Total"    value={stats?.total}   color="var(--color-jade-500)" />
            <StatCard icon={CheckCircle}  label="Activas"  value={stats?.active}  color="#22c55e" />
            <StatCard icon={CheckCircle}  label="Usadas"   value={stats?.used}    color="#3b82f6" />
            <StatCard icon={Clock}        label="Expiradas" value={stats?.expired} color="#f59e0b" />
            <StatCard icon={XCircle}      label="Revocadas" value={stats?.revoked} color="var(--color-error)" />
        </div>
    )
}