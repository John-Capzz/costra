// ============================================================
// COSTRA — StatusDot
// ============================================================

import { cn } from '@/lib/utils'
import type { TaskStatus, AgentStatus, BudgetState } from '@/types'

type Status = TaskStatus | AgentStatus | BudgetState

const COLOR: Record<string, string> = {
  // Task
  executing:  'var(--info)',
  completed:  'var(--success)',
  failed:     'var(--danger)',
  blocked:    'var(--danger)',
  pending:    'var(--faint)',
  // Agent
  active:     'var(--success)',
  idle:       'var(--faint)',
  paused:     'var(--warning)',
  error:      'var(--danger)',
  // Budget
  within:     'var(--success)',
  approaching:'var(--warning)',
}

interface StatusDotProps {
  status:     Status
  pulse?:     boolean
  className?: string
}

export function StatusDot({ status, pulse, className }: StatusDotProps) {
  const color  = COLOR[status] ?? 'var(--faint)'
  const doPulse = pulse ?? (status === 'executing' || status === 'active')

  return (
    <span
      className={cn('relative inline-flex flex-shrink-0', className)}
      style={{ width: 8, height: 8 }}
    >
      {doPulse && (
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: color, opacity: 0.45 }}
        />
      )}
      <span
        className="relative rounded-full"
        style={{ width: 8, height: 8, background: color }}
      />
    </span>
  )
}
