// ============================================================
// COSTRA — Tasks list (/tasks)
// ============================================================

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { costraApi, type TaskApiRecord } from '@/lib/api-client'
import { deriveBudgetState } from '@/lib/budget-engine'
import { formatUsd, formatRelative } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { BudgetBar } from '@/components/ui/BudgetBar'
import { cn } from '@/lib/utils'
import type { TaskStatus } from '@/types'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/lib/money'

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
  const [tasks, setTasks] = useState<TaskApiRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void costraApi.getTasks()
      .then((result) => { if (active) setTasks(result.tasks) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Tasks could not be loaded.') })
    return () => { active = false }
  }, [])

  const filtered = filterStatus === 'all'
    ? tasks ?? []
    : (tasks ?? []).filter((t) => t.status === filterStatus)

  return (
    <div className="max-w-4xl mx-auto px-5 py-7">
      <div className="mb-6">
        <h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>
          Tasks
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">All agent task executions with economic tracking.</p>
      </div>

      {error && <Card padding="md" className="mb-5"><p className="text-sm text-[var(--danger)]">{error}</p><p className="text-xs text-[var(--muted)] mt-1">Configure the authenticated COSTRA API to load persisted tasks.</p></Card>}
      {!tasks && !error && <LoadingSpinner className="mx-auto my-16" />}
      {tasks && tasks.length === 0 && <EmptyState title="No tasks yet" description="Create a task from an approved cost plan to see it here." />}
      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            aria-pressed={filterStatus === s}
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
          const budget = task.budget
          const currentSpend = task.currentSpend
          const budgetState = deriveBudgetState(currentSpend, budget)
          const spendPct    = Number(Money.percentOf(Money.from(currentSpend), Money.from(budget), 0))
          const remaining   = Money.from(budget).subtract(Money.from(currentSpend)).compare(Money.zero()) < 0 ? '0.000000' : Money.from(budget).subtract(Money.from(currentSpend)).toString()

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
                        <span className="text-[11px] text-[var(--muted)]">Agent {task.agentId}</span>
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  {[
                    { label: 'Budget',    value: formatUsd(budget) },
                    { label: 'Estimated', value: formatUsd(task.estimated ?? '0.000000') },
                    { label: 'Spent',     value: formatUsd(currentSpend) },
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
                  current={currentSpend}
                  max={budget}
                  state={budgetState}
                  size="sm"
                  showLabel={false}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-[var(--muted)]">{spendPct.toFixed(0)}% used</span>
                  <span className="text-[10px] text-[var(--muted)]">{task.events?.length ?? 0} events</span>
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
