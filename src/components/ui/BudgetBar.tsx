// ============================================================
// COSTRA — BudgetBar
// ============================================================

import { cn } from '@/lib/utils'
import { formatUsd } from '@/lib/utils'
import { Money } from '@/lib/money'
import type { BudgetState } from '@/types'

const STATE_COLOR: Record<BudgetState, string> = {
  within:     'var(--success)',
  approaching:'var(--warning)',
  blocked:    'var(--danger)',
  completed:  'var(--faint)',
}

interface BudgetBarProps {
  current:    string
  max:        string
  state:      BudgetState
  size?:      'sm' | 'md'
  showLabel?: boolean
  className?: string
}

export function BudgetBar({ current, max, state, size = 'md', showLabel = true, className }: BudgetBarProps) {
  const pctText = Money.percentOf(Money.from(current), Money.from(max), 2)
  const pct = Math.max(0, Math.min(100, Number(pctText)))
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
