// ============================================================
// COSTRA — BudgetBar
// ============================================================

import { cn } from '@/lib/utils'
import { formatUsd, clamp } from '@/lib/utils'
import type { BudgetState } from '@/types'

const STATE_COLOR: Record<BudgetState, string> = {
  within:     'var(--success)',
  approaching:'var(--warning)',
  blocked:    'var(--danger)',
  completed:  'var(--faint)',
}

interface BudgetBarProps {
  current:    number
  max:        number
  state:      BudgetState
  size?:      'sm' | 'md'
  showLabel?: boolean
  className?: string
}

export function BudgetBar({ current, max, state, size = 'md', showLabel = true, className }: BudgetBarProps) {
  const pct    = clamp((current / max) * 100, 0, 100)
  const color  = STATE_COLOR[state]
  const height = size === 'sm' ? 3 : 5

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between mb-1.5">
          <span className="text-[11px] text-[var(--muted)]">
            {formatUsd(current)} spent
          </span>
          <span className="text-[11px] text-[var(--muted)]">
            {formatUsd(max)} limit
          </span>
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden bg-[var(--surface-muted)]"
        style={{ height }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}
