// ============================================================
// COSTRA — MetricCard
// ============================================================

import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label:         string
  value:         string | number
  subValue?:     string
  delta?:        string
  deltaPositive?: boolean
  icon?:         LucideIcon
  className?:    string
}

export function MetricCard({
  label, value, subValue, delta, deltaPositive, icon: Icon, className,
}: MetricCardProps) {
  return (
    <div
      className={cn('rounded-[var(--radius-lg)] p-4 flex flex-col justify-between', className)}
      style={{
        background: 'var(--surface-strong)',
        border:     '1px solid var(--border)',
        boxShadow:  'var(--shadow-sm)',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          {label}
        </span>
        {Icon && <Icon size={13} className="text-[var(--faint)] mt-0.5" strokeWidth={1.75} />}
      </div>
      <div>
        <p className="display text-[22px] font-700 text-[var(--ink)] tabular leading-none" style={{ fontWeight: 700 }}>
          {value}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          {subValue && (
            <span className="text-[11px] text-[var(--muted)]">{subValue}</span>
          )}
          {delta && (
            <span
              className="text-[10px] font-semibold tabular"
              style={{ color: deltaPositive ? 'var(--success)' : 'var(--warning)' }}
            >
              {delta}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
