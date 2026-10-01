// ============================================================
// COSTRA — Task Detail (/tasks/:id)
// ============================================================

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, Shield, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { BudgetBar } from '@/components/ui/BudgetBar'
import { EventTimeline } from '@/components/ui/EventTimeline'
import { costraApi, type ExecutionApiRecord, type ReconciliationApiRecord, type TaskApiRecord, type TransactionApiRecord } from '@/lib/api-client'
import { deriveBudgetState } from '@/lib/budget-engine'
import { formatUsd, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { TaskStatus } from '@/types'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Money } from '@/lib/money'

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
  const [task, setTask] = useState<TaskApiRecord | null>(null)
  const [reconciliation, setReconciliation] = useState<ReconciliationApiRecord | null>(null)
  const [transactions, setTransactions] = useState<TransactionApiRecord[]>([])
  const [execution, setExecution] = useState<ExecutionApiRecord | null>(null)
  const [executionAmount, setExecutionAmount] = useState('')
  const [destination, setDestination] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(() => `ui-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`)
  const [executionBusy, setExecutionBusy] = useState(false)
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    void costraApi.getTask(id)
      .then((result) => {
        if (!active) return
        setTask(result)
        void costraApi.getTaskTransactions(result.id)
          .then((response) => { if (active) setTransactions(response.transactions) })
          .catch(() => undefined)
        if (result.planId) {
          void costraApi.getPlanReconciliation(result.planId)
            .then((record) => { if (active) setReconciliation(record) })
            .catch(() => undefined)
        }
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Task could not be loaded.') })
    return () => { active = false }
  }, [id])

  if (!task && !error) return <LoadingSpinner className="mx-auto my-24" />
  if (!task) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <p className="text-[var(--danger)] text-[14px]">{error ?? 'Task not found.'}</p>
        <button onClick={() => { void navigate('/tasks') }} className="mt-4 text-[12px] text-[var(--accent-text)]">
          ← Back to tasks
        </button>
      </div>
    )
  }

  const budget = task.budget
  const estimated = task.estimated ?? '0.000000'
  const currentSpend = task.currentSpend
  const budgetState = deriveBudgetState(currentSpend, budget)
  const remaining = Money.from(budget).subtract(Money.from(currentSpend)).compare(Money.zero()) < 0 ? '0.000000' : Money.from(budget).subtract(Money.from(currentSpend)).toString()
  const events = (task.events ?? []).map((event) => ({
    ...event,
    type: event.type as import('@/types').TaskEventType,
    cost: event.cost === null ? undefined : event.cost,
    description: event.description ?? undefined,
    provider: event.provider ?? undefined,
    txHash: event.txHash ?? undefined,
    metadata: event.metadata ?? undefined,
  }))
  const currentTask = task

  async function submitControlledExecution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentTask.planId || currentTask.spendingMode !== 'guarded') return
    setExecutionBusy(true)
    setExecutionError(null)
    try {
      const result = await costraApi.execute({
        agentId: currentTask.agentId,
        taskId: currentTask.id,
        planId: currentTask.planId,
        amount: executionAmount,
        destination,
        idempotencyKey,
        network: 'Arc Testnet',
        currency: 'USDC',
        mode: 'guarded',
      })
      setExecution(result)
      const transaction = result.transaction
      if (transaction) {
        setTransactions((current) => [
          ...current.filter((item) => item.id !== transaction.id),
          transaction,
        ])
      }
    } catch (reason) {
      setExecutionError(reason instanceof Error ? reason.message : 'The controlled execution failed.')
    } finally {
      setExecutionBusy(false)
    }
  }

  async function trackControlledExecution() {
    if (!execution?.executionId) return
    setExecutionBusy(true)
    setExecutionError(null)
    try {
      const result = await costraApi.trackExecution(execution.executionId)
      setExecution((current) => current ? { ...current, transaction: result.transaction, status: result.transaction.status === 'success' ? 'confirmed' : result.transaction.status === 'failed' ? 'failed' : current.status } : current)
      setTransactions((current) => [
        ...current.filter((transaction) => transaction.id !== result.transaction.id),
        result.transaction,
      ])
    } catch (reason) {
      setExecutionError(reason instanceof Error ? reason.message : 'The transaction receipt could not be loaded.')
    } finally {
      setExecutionBusy(false)
    }
  }

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
              {task.spendingMode === 'guarded' ? 'guarded · policy checks only' : 'observe'}
            </span>
          </div>
          <h1 className="display text-xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>
            {task.description}
          </h1>
          <p className="text-[12px] text-[var(--muted)] mt-1">
            Agent {task.agentId} · Started {formatDate(task.createdAt)}
          </p>
          {task.spendingMode === 'guarded' && (
            <p className="text-[11px] text-[var(--warning)] mt-1">
              Guarded mode is not enforced for arbitrary external wallets yet.
            </p>
          )}
        </div>
      </div>

      {/* Spend overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Budget',    value: formatUsd(budget) },
          { label: 'Estimated', value: formatUsd(estimated) },
          { label: 'Spent',     value: formatUsd(currentSpend) },
          { label: 'Remaining', value: formatUsd(remaining) },
        ].map(({ label, value }) => (
          <Card key={label} padding="sm" className="text-center">
            <p className="text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">{label}</p>
            <p className="display text-[18px] font-700 tabular text-[var(--ink)]" style={{ fontWeight: 700 }}>{value}</p>
          </Card>
        ))}
      </div>

      <Card padding="md" className="mb-5">
        <BudgetBar current={currentSpend} max={budget} state={budgetState} size="md" />
      </Card>

      <Card padding="md" className="mb-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="display text-[14px] font-semibold text-[var(--ink)]">Controlled execution</h2>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">Arc Testnet · USDC · explicit action required</p>
          </div>
          <Badge variant={task.spendingMode === 'guarded' ? 'success' : 'warning'}>
            {task.spendingMode === 'guarded' ? 'Guarded path' : 'Observe only'}
          </Badge>
        </div>
        {task.spendingMode !== 'guarded' ? (
          <p className="text-[12px] text-[var(--muted)]">Observe mode records spending but does not submit or block an external wallet transaction.</p>
        ) : !task.planId ? (
          <p className="text-[12px] text-[var(--warning)]">Guarded execution requires a persisted plan association.</p>
        ) : (
          <form onSubmit={(event) => { void submitControlledExecution(event) }} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <label htmlFor="execution-amount" className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Amount (USDC)</span>
                <input id="execution-amount" required value={executionAmount} onChange={(event) => setExecutionAmount(event.target.value)} placeholder="0.400000" className="mt-1 w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-strong)] border border-[var(--border)] text-sm text-[var(--ink)]" />
              </label>
              <label htmlFor="execution-destination" className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Destination</span>
                <input id="execution-destination" required value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="0x…" className="mt-1 w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-strong)] border border-[var(--border)] text-sm text-[var(--ink)]" />
              </label>
            </div>
            <label htmlFor="execution-idempotency-key" className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Idempotency key</span>
              <input id="execution-idempotency-key" required value={idempotencyKey} onChange={(event) => setIdempotencyKey(event.target.value)} className="mt-1 w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-strong)] border border-[var(--border)] text-sm text-[var(--ink)]" />
            </label>
            <button type="submit" disabled={executionBusy} className="px-4 py-2 rounded-[var(--radius-md)] text-[12px] font-semibold text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
              {executionBusy ? 'Submitting…' : 'Submit controlled payment'}
            </button>
            <p className="text-[10px] text-[var(--muted)]">COSTRA can enforce this budget only because the payment is submitted through its controlled path. External wallets can bypass COSTRA.</p>
          </form>
        )}
        {executionError && <p className="mt-3 text-[12px] text-[var(--danger)]">{executionError}</p>}
        {execution && (
          <div className="mt-4 pt-3 border-t border-[var(--border)] text-[12px] text-[var(--muted)]">
            <div className="flex items-center justify-between gap-3">
              <span>Execution status: <strong className="text-[var(--ink)]">{execution.status ?? (execution.transaction?.status ?? 'submitted')}</strong></span>
              {execution.transaction?.status === 'pending' && <button type="button" onClick={() => { void trackControlledExecution() }} disabled={executionBusy} className="text-[var(--accent-text)] font-semibold">Track receipt</button>}
            </div>
            {execution.transaction?.txHash && <p className="mono mt-1 break-all">{execution.transaction.txHash}</p>}
          </div>
        )}
      </Card>

      {transactions.length > 0 && (
        <Card padding="none" className="mb-5">
          <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]"><h2 className="display text-[14px] font-semibold text-[var(--ink)]">Transactions</h2></div>
          <div className="divide-y divide-[var(--border)]">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="px-5 py-3 flex flex-wrap items-center gap-3 text-[12px]">
                <Badge variant={transaction.status === 'success' ? 'success' : transaction.status === 'failed' ? 'danger' : 'warning'}>{transaction.status}</Badge>
                <span className="text-[var(--muted)]">{transaction.executionMode}</span>
                <span className="font-semibold tabular text-[var(--ink)]">{formatUsd(transaction.value ?? '0.000000')}</span>
                {transaction.txHash && <span className="mono text-[10px] text-[var(--accent-text)] break-all">{transaction.txHash}</span>}
                {transaction.txHash && <ExternalLink size={12} className="text-[var(--muted)]" />}
              </div>
            ))}
          </div>
        </Card>
      )}

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
                  value: `${Money.from(reconciliation.variance ?? '0.000000').compare(Money.zero()) > 0 ? '+' : ''}${formatUsd(reconciliation.variance ?? '0.000000')}`,
                  highlight: false,
                  color: Money.from(reconciliation.variance ?? '0.000000').compare(Money.zero()) > 0 ? 'var(--warning)' : 'var(--success)',
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
                      style={{ color: Number(reconciliation.variancePct ?? '0') > 0 ? 'var(--warning)' : 'var(--success)' }}
                    >
                      {Number(reconciliation.variancePct ?? '0') > 0 ? '+' : ''}{reconciliation.variancePct ?? '0.00'}%
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Item breakdown */}
            <div className="space-y-2.5">
              <p className="text-[11px] text-[var(--muted)]">Detailed reconciliation components are available in the persisted record.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Event timeline */}
      <Card padding="none">
        <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <h2 className="display text-[14px] font-semibold text-[var(--ink)]">Execution Timeline</h2>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">{events.length} events · {task.spendingMode} mode</p>
        </div>
        <div className="px-5 py-5">
          <EventTimeline events={events} />
        </div>
      </Card>
    </div>
  )
}
