// ============================================================
// COSTRA — EventTimeline (task execution history)
// ============================================================

import { cn } from '@/lib/utils'
import { formatDateTime, formatUsd, truncateHash } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { TaskEvent, TaskEventType } from '@/types'

const EVENT_META: Record<TaskEventType, {
  label:   string
  variant: 'success' | 'info' | 'warning' | 'danger' | 'muted' | 'accent'
  dot:     string
}> = {
  TASK_CREATED:    { label: 'Created',    variant: 'muted',   dot: 'var(--faint)' },
  PLAN_GENERATED:  { label: 'Plan',       variant: 'accent',  dot: 'var(--accent-text)' },
  BUDGET_APPROVED: { label: 'Approved',   variant: 'success', dot: 'var(--success)' },
  API_CALL:        { label: 'API Call',   variant: 'info',    dot: 'var(--info)' },
  SERVICE_PAYMENT: { label: 'Payment',    variant: 'info',    dot: 'var(--info)' },
  ARC_TRANSACTION: { label: 'Arc Tx',     variant: 'accent',  dot: 'var(--accent-text)' },
  RETRY:           { label: 'Retry',      variant: 'warning', dot: 'var(--warning)' },
  SPEND_BLOCKED:   { label: 'Blocked',    variant: 'danger',  dot: 'var(--danger)' },
  TASK_COMPLETED:  { label: 'Completed',  variant: 'success', dot: 'var(--success)' },
  TASK_FAILED:     { label: 'Failed',     variant: 'danger',  dot: 'var(--danger)' },
}

interface EventTimelineProps {
  events:     TaskEvent[]
  className?: string
}

export function EventTimeline({ events, className }: EventTimelineProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  return (
    <div className={cn('relative', className)}>
      {/* Vertical rule */}
      <div
        className="absolute left-[15px] top-3 bottom-3 w-px"
        style={{ background: 'var(--border)' }}
      />

      <div className="space-y-0">
        {sorted.map((ev, i) => {
          const meta = EVENT_META[ev.type]
          return (
            <div key={ev.id} className="relative flex gap-4 pl-10">
              {/* Dot */}
              <span
                className="absolute left-[11px] top-4 w-2 h-2 rounded-full border-2 flex-shrink-0"
                style={{
                  background:   meta.dot,
                  borderColor:  'var(--surface-strong)',
                  marginTop:    0,
                }}
              />

              <div
                className={cn(
                  'flex-1 pb-5',
                  i === sorted.length - 1 && 'pb-0',
                )}
              >
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  <span className="text-[11px] text-[var(--muted)] tabular">
                    {formatDateTime(ev.timestamp)}
                  </span>
                  {ev.cost !== undefined && ev.cost > 0 && (
                    <span className="text-[11px] font-semibold tabular text-[var(--ink)]">
                      {formatUsd(ev.cost)}
                    </span>
                  )}
                  {ev.provider && (
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
                      {ev.provider}
                    </span>
                  )}
                </div>
                {ev.description && (
                  <p className="text-[12px] text-[var(--muted)] leading-relaxed">
                    {ev.description}
                  </p>
                )}
                {ev.txHash && (
                  <p className="mono text-[10px] text-[var(--accent-text)] mt-0.5">
                    {truncateHash(ev.txHash)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
