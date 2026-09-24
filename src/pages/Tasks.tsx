// ============================================================
// COSTRA — Tasks list (/tasks)
// ============================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEMO_TASKS } from '@/lib/demo-data'
import { deriveBudgetState } from '@/lib/budget-engine'
import { formatUsd, formatRelative } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { BudgetBar } from '@/components/ui/BudgetBar'
import { cn } from '@/lib/utils'
import type { TaskStatus } from '@/types'

const STATUS_VARIANT: Record<TaskStatus, 'success' | 'info' | 'danger' | 'warning' | 'muted'> = {
  completed: 'success',
  executing: 'info',
  failed:    'danger',
  blocked:   'danger',
  pending:   'muted',
}

const ALL_STATUSES: (TaskStatus | 'all')[] = ['all', 'executing', 'completed', 'failed', 'blocked', 'pending']

export default function Tasks() {
  const navigate = useNavigate()
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all')

  const filtered = filterStatus === 'all'
    ? DEMO_TASKS
    : DEMO_TASKS.filter((t) => t.status === filterStatus)

  return (
    <div className="max-w-4xl mx-auto px-5 py-7">
      <div className="mb-6">
        <h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>
          Tasks
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">All agent task executions with economic tracking.</p>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.06em] transition-all capitalize',
              filterStatus === s
                ? 'text-white shadow-[var(--shadow-xs)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]',
            )}
            style={
              filterStatus === s
                ? { background: 'var(--accent)' }
                : { background: 'var(--surface-muted)', border: '1px solid var(--border)' }
            }
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((task) => {
          const budgetState = deriveBudgetState(task.currentSpend, task.budget)
          const spendPct    = (task.currentSpend / task.budget) * 100
          const remaining   = task.budget - task.currentSpend

          return (
            <Card
              key={task.id}
              padding="none"
              className="hover:shadow-[var(--shadow)] transition-shadow cursor-pointer"
              onClick={() => { void navigate(`/tasks/${task.id}`) }}
            >
              <div className="px-5 pt-4 pb-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <StatusDot status={task.status} className="mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[var(--ink)] truncate">{task.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-[var(--muted)]">{task.agentName}</span>
                        <span className="text-[var(--faint)]">·</span>
                        <span className="text-[11px] text-[var(--muted)]">{task.network}</span>
                        <span className="text-[var(--faint)]">·</span>
                        <span className="text-[11px] text-[var(--muted)]">{formatRelative(task.updatedAt)}</span>
                        {task.spendingMode === 'observe' && (
                          <>
                            <span className="text-[var(--faint)]">·</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--warning)]">Observe</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[task.status]}>{task.status}</Badge>
                </div>

                {/* Spend figures */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                  {[
                    { label: 'Budget',    value: formatUsd(task.budget) },
                    { label: 'Estimated', value: formatUsd(task.estimated) },
                    { label: 'Spent',     value: formatUsd(task.currentSpend) },
                    { label: 'Remaining', value: formatUsd(remaining) },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center">
                      <p className="text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] mb-0.5">{label}</p>
                      <p className="text-[13px] font-semibold tabular text-[var(--ink)]">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Budget bar */}
                <BudgetBar
                  current={task.currentSpend}
                  max={task.budget}
                  state={budgetState}
                  size="sm"
                  showLabel={false}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-[var(--muted)]">{spendPct.toFixed(0)}% used</span>
                  <span className="text-[10px] text-[var(--muted)]">{task.events.length} events</span>
                </div>
              </div>
            </Card>
          )
        })}

        {filtered.length === 0 && (
          <div className="py-16 text-center text-[var(--muted)] text-[14px]">
            No tasks with status "{filterStatus}".
          </div>
        )}
      </div>
    </div>
  )
}
