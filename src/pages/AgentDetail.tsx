// ============================================================
// COSTRA — Agent Detail (/agents/:id)
// ============================================================

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield, Eye, Activity } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { BudgetBar } from '@/components/ui/BudgetBar'
import { EventTimeline } from '@/components/ui/EventTimeline'
import { costraApi, type AgentApiRecord, type TaskApiRecord } from '@/lib/api-client'
import { deriveBudgetState } from '@/lib/budget-engine'
import { formatUsd, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { AgentStatus, TaskEventType, TaskStatus } from '@/types'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

const STATUS_VARIANT: Record<AgentStatus, 'success' | 'muted' | 'warning' | 'danger'> = {
  active: 'success', idle: 'muted', paused: 'warning', error: 'danger',
}
const TASK_STATUS_VARIANT: Record<TaskStatus, 'success' | 'info' | 'danger' | 'warning' | 'muted'> = {
  completed: 'success', executing: 'info', failed: 'danger', blocked: 'danger', pending: 'muted',
}

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [agent, setAgent] = useState<AgentApiRecord | null>(null)
  const [tasks, setTasks] = useState<TaskApiRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    void costraApi.getAgent(id)
      .then((result) => { if (active) setAgent(result) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Agent could not be loaded.') })
    void costraApi.getTasks()
      .then((result) => { if (active) setTasks(result.tasks.filter((task) => task.agentId === id)) })
      .catch(() => { if (active) setTasks([]) })
    return () => { active = false }
  }, [id])

  const agentTasks = tasks ?? []

  if (!agent && !error) {
    return <LoadingSpinner className="mx-auto my-24" />
  }
  if (!agent) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <p className="text-[var(--danger)] text-[14px]">{error ?? 'Agent not found.'}</p>
        <p className="text-xs text-[var(--muted)] mt-2">Live agent data is unavailable. Authenticate the COSTRA API and retry.</p>
        <button onClick={() => { void navigate('/agents') }} className="mt-4 text-[12px] text-[var(--accent-text)]">
          ← Back to agents
        </button>
      </div>
    )
  }

  const totalSpend = agent.totalSpend
  const budgetLimit = agent.budgetLimit
  const budgetState = deriveBudgetState(totalSpend, budgetLimit)

  // All persisted events across this agent's tasks (latest N)
  const allEvents = agentTasks
    .flatMap((task) => (task.events ?? []).map((event) => ({
      ...event,
      type: event.type as TaskEventType,
      cost: event.cost === null ? undefined : event.cost,
      description: event.description ?? undefined,
      provider: event.provider ?? undefined,
      txHash: event.txHash ?? undefined,
      metadata: event.metadata ?? undefined,
    })))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 12)

  return (
    <div className="max-w-4xl mx-auto px-5 py-7">
      <button
        onClick={() => { void navigate('/agents') }}
        className="flex items-center gap-1.5 text-[12px] text-[var(--muted)] hover:text-[var(--ink)] transition-colors mb-5"
      >
        <ArrowLeft size={13} />
        Agents
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <StatusDot status={agent.status} className="mt-1.5 flex-shrink-0" />
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={STATUS_VARIANT[agent.status]}>{agent.status}</Badge>
            <span
              className={cn('flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px]')}
              style={{
                color:      agent.spendingMode === 'guarded' ? 'var(--success)' : 'var(--warning)',
                background: agent.spendingMode === 'guarded' ? 'var(--success-soft)' : 'var(--warning-soft)',
              }}
            >
              {agent.spendingMode === 'guarded' ? <Shield size={10} /> : <Eye size={10} />}
              {agent.spendingMode === 'guarded' ? 'guarded · policy checks only' : 'observe'}
            </span>
          </div>
          <h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>
            {agent.name}
          </h1>
          <p className="text-[13px] text-[var(--muted)] mt-1 max-w-2xl">{agent.description}</p>
          {agent.spendingMode === 'guarded' && (
            <p className="text-[11px] text-[var(--warning)] mt-1">
              Guarded mode is not enforced for arbitrary external wallets yet.
            </p>
          )}
          <p className="text-[11px] text-[var(--muted)] mt-1">Since {formatDate(agent.createdAt)}</p>
        </div>
      </div>

      {/* Metric row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Spend',  value: formatUsd(totalSpend) },
          { label: 'Budget Limit', value: formatUsd(budgetLimit) },
          { label: 'Active Tasks', value: '—' },
          { label: 'Accuracy',     value: agent.planningAccuracy === null ? '—' : `${agent.planningAccuracy}%` },
        ].map(({ label, value }) => (
          <Card key={label} padding="sm" className="text-center">
            <p className="text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] mb-1">{label}</p>
            <p className="display text-[18px] font-700 tabular text-[var(--ink)]" style={{ fontWeight: 700 }}>
              {value}
            </p>
          </Card>
        ))}
      </div>

      {/* Budget bar */}
      <Card padding="md" className="mb-5">
        <BudgetBar current={totalSpend} max={budgetLimit} state={budgetState} size="md" />
      </Card>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <Card padding="md">
          <h2 className="display text-[13px] font-semibold text-[var(--ink)] mb-3">Agent Health</h2>
          <p className="text-[12px] text-[var(--muted)]">Historical health scoring is unavailable until persisted task and reconciliation analytics are exposed.</p>
        </Card>

        {/* Budget policies */}
        <Card padding="none">
          <div className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-1.5">
              <Activity size={13} className="text-[var(--muted)]" />
              <h2 className="display text-[13px] font-semibold text-[var(--ink)]">Spending Policies</h2>
            </div>
          </div>
          <div className="divide-y divide-[var(--border)]">
            <p className="px-4 py-8 text-center text-[12px] text-[var(--muted)]">Policy details are not included in the current agent API response.</p>
          </div>
        </Card>
      </div>

      {/* Tasks */}
      <Card padding="none" className="mb-5">
        <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <h2 className="display text-[14px] font-semibold text-[var(--ink)]">Tasks</h2>
          <p className="text-[10px] text-[var(--muted)] mt-0.5">Persisted tasks associated with this agent.</p>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {agentTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
              onClick={() => { void navigate(`/tasks/${task.id}`) }}
            >
              <StatusDot status={task.status} className="flex-shrink-0" />
              <p className="flex-1 text-[13px] text-[var(--ink)] truncate">{task.description}</p>
              <Badge variant={TASK_STATUS_VARIANT[task.status]}>{task.status}</Badge>
              <span className="text-[12px] tabular font-medium text-[var(--ink)]">
                {formatUsd(task.currentSpend)}
              </span>
            </div>
          ))}
          {agentTasks.length === 0 && (
            <p className="px-5 py-8 text-center text-[12px] text-[var(--muted)]">No tasks yet.</p>
          )}
        </div>
      </Card>

      {/* Recent activity timeline */}
      {allEvents.length > 0 && (
        <Card padding="none">
          <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
            <h2 className="display text-[14px] font-semibold text-[var(--ink)]">Recent Activity</h2>
          </div>
          <div className="px-5 py-5">
            <EventTimeline events={allEvents.map((e) => ({ ...e }))} />
          </div>
        </Card>
      )}
    </div>
  )
}
