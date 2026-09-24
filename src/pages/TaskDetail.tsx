// ============================================================
// COSTRA — Task Detail (/tasks/:id)
// ============================================================

import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, Shield } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { BudgetBar } from '@/components/ui/BudgetBar'
import { EventTimeline } from '@/components/ui/EventTimeline'
import { DEMO_TASKS, DEMO_RECONCILIATIONS } from '@/lib/demo-data'
import { deriveBudgetState } from '@/lib/budget-engine'
import { formatUsd, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { TaskStatus } from '@/types'

const STATUS_VARIANT: Record<TaskStatus, 'success' | 'info' | 'danger' | 'warning' | 'muted'> = {
  completed: 'success',
  executing: 'info',
  failed:    'danger',
  blocked:   'danger',
  pending:   'muted',
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const task = DEMO_TASKS.find((t) => t.id === id)
  const reconciliation = DEMO_RECONCILIATIONS.find((r) => r.taskId === id)

  if (!task) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <p className="text-[var(--muted)] text-[14px]">Task not found.</p>
        <button onClick={() => { void navigate('/tasks') }} className="mt-4 text-[12px] text-[var(--accent-text)]">
          ← Back to tasks
        </button>
      </div>
    )
  }

  const budgetState = deriveBudgetState(task.currentSpend, task.budget)
  const remaining = task.budget - task.currentSpend

  return (
    <div className="max-w-3xl mx-auto px-5 py-7">
      <button
        onClick={() => { void navigate('/tasks') }}
        className="flex items-center gap-1.5 text-[12px] text-[var(--muted)] hover:text-[var(--ink)] transition-colors mb-5"
      >
        <ArrowLeft size={13} />
        Tasks
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <StatusDot status={task.status} className="mt-1.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant={STATUS_VARIANT[task.status]}>{task.status}</Badge>
            <span className="text-[11px] text-[var(--muted)]">{task.network} · {task.currency}</span>
            <span
              className={cn(
                'flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px]',
              )}
              style={{
                color:      task.spendingMode === 'guarded' ? 'var(--success)' : 'var(--warning)',
                background: task.spendingMode === 'guarded' ? 'var(--success-soft)' : 'var(--warning-soft)',
              }}
            >
              {task.spendingMode === 'guarded' ? <Shield size={10} /> : <Eye size={10} />}
              {task.spendingMode}
            </span>
          </div>
          <h1 className="display text-xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>
            {task.description}
          </h1>
          <p className="text-[12px] text-[var(--muted)] mt-1">
            {task.agentName} · Started {formatDate(task.createdAt)}
          </p>
        </div>
      </div>

      {/* Spend overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Budget',    value: formatUsd(task.budget) },
          { label: 'Estimated', value: formatUsd(task.estimated) },
          { label: 'Spent',     value: formatUsd(task.currentSpend) },
          { label: 'Remaining', value: formatUsd(remaining) },
        ].map(({ label, value }) => (
          <Card key={label} padding="sm" className="text-center">
            <p className="text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">{label}</p>
            <p className="display text-[18px] font-700 tabular text-[var(--ink)]" style={{ fontWeight: 700 }}>{value}</p>
          </Card>
        ))}
      </div>

      <Card padding="md" className="mb-5">
        <BudgetBar current={task.currentSpend} max={task.budget} state={budgetState} size="md" />
      </Card>

      {/* Planned vs Actual (if reconciled) */}
      {reconciliation && (
        <Card padding="none" className="mb-5">
          <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
            <h2 className="display text-[14px] font-semibold text-[var(--ink)]">Planned vs Actual</h2>
          </div>
          <div className="px-5 py-4">
            {/* Summary row */}
            <div className="grid grid-cols-4 gap-4 text-center mb-5">
              {[
                { label: 'Estimated', value: formatUsd(reconciliation.estimatedCost), highlight: false },
                { label: 'Budget',    value: formatUsd(reconciliation.budget),         highlight: false },
                { label: 'Actual',    value: formatUsd(reconciliation.actualCost),     highlight: true },
                {
                  label: 'Variance',
                  value: `${reconciliation.variance > 0 ? '+' : ''}${formatUsd(reconciliation.variance)}`,
                  highlight: false,
                  color: reconciliation.variance > 0 ? 'var(--warning)' : 'var(--success)',
                },
              ].map(({ label, value, highlight, color }) => (
                <div key={label}>
                  <p className="text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">{label}</p>
                  <p
                    className="display text-[16px] font-700 tabular"
                    style={{ fontWeight: 700, color: color ?? (highlight ? 'var(--ink)' : 'var(--ink)') }}
                  >
                    {value}
                  </p>
                  {label === 'Variance' && (
                    <p
                      className="text-[10px] font-semibold tabular mt-0.5"
                      style={{ color: reconciliation.variancePct > 0 ? 'var(--warning)' : 'var(--success)' }}
                    >
                      {reconciliation.variancePct > 0 ? '+' : ''}{reconciliation.variancePct.toFixed(2)}%
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Item breakdown */}
            <div className="space-y-2.5">
              {reconciliation.items.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-[12px] text-[var(--muted)] w-32 flex-shrink-0">{item.label}</span>
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div className="h-1 rounded-full bg-[var(--surface-muted)] relative overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ width: `${(item.estimated / reconciliation.estimatedCost) * 100}%`, background: 'var(--faint)' }}
                      />
                    </div>
                    <div className="h-1 rounded-full bg-[var(--surface-muted)] relative overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width:      `${(item.actual / reconciliation.actualCost) * 100}%`,
                          background: item.variance > 0 ? 'var(--warning)' : item.variance < 0 ? 'var(--success)' : 'var(--faint)',
                        }}
                      />
                    </div>
                    <span
                      className="text-[11px] tabular font-semibold text-right"
                      style={{ color: item.variance > 0 ? 'var(--warning)' : item.variance < 0 ? 'var(--success)' : 'var(--muted)' }}
                    >
                      {item.variance > 0 ? '+' : ''}{formatUsd(item.variance)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Event timeline */}
      <Card padding="none">
        <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <h2 className="display text-[14px] font-semibold text-[var(--ink)]">Execution Timeline</h2>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">{task.events.length} events · {task.spendingMode} mode</p>
        </div>
        <div className="px-5 py-5">
          <EventTimeline events={task.events} />
        </div>
      </Card>
    </div>
  )
}
