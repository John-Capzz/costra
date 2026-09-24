// ============================================================
// COSTRA — Agent Detail (/agents/:id)
// ============================================================

import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield, Eye, Activity } from 'lucide-react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { BudgetBar } from '@/components/ui/BudgetBar'
import { EventTimeline } from '@/components/ui/EventTimeline'
import { DEMO_AGENTS, DEMO_TASKS } from '@/lib/demo-data'
import { deriveBudgetState } from '@/lib/budget-engine'
import { formatUsd, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { AgentStatus, TaskStatus, BudgetPolicy } from '@/types'

const STATUS_VARIANT: Record<AgentStatus, 'success' | 'muted' | 'warning' | 'danger'> = {
  active: 'success', idle: 'muted', paused: 'warning', error: 'danger',
}
const TASK_STATUS_VARIANT: Record<TaskStatus, 'success' | 'info' | 'danger' | 'warning' | 'muted'> = {
  completed: 'success', executing: 'info', failed: 'danger', blocked: 'danger', pending: 'muted',
}

const POLICY_LABELS: Record<BudgetPolicy['type'], string> = {
  per_task:        'Per Task',
  per_transaction: 'Per Transaction',
  daily:           'Daily',
  agent:           'Agent Total',
  service:         'Per Service',
}

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const agent = DEMO_AGENTS.find((a) => a.id === id)
  const agentTasks = DEMO_TASKS.filter((t) => t.agentId === id)

  if (!agent) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <p className="text-[var(--muted)] text-[14px]">Agent not found.</p>
        <button onClick={() => { void navigate('/agents') }} className="mt-4 text-[12px] text-[var(--accent-text)]">
          ← Back to agents
        </button>
      </div>
    )
  }

  const budgetState = deriveBudgetState(agent.totalSpend, agent.budgetLimit)

  // Radar chart data — multi-dimensional agent health
  const radarData = [
    { metric: 'Accuracy',   value: agent.planningAccuracy },
    { metric: 'Budget Use', value: Math.round((agent.totalSpend / agent.budgetLimit) * 100) },
    { metric: 'Tasks',      value: Math.min(100, agentTasks.length * 25) },
    { metric: 'Reliability',value: agentTasks.filter((t) => t.status !== 'failed').length / Math.max(agentTasks.length, 1) * 100 },
    { metric: 'Efficiency', value: 85 },
  ]

  // All events across agent tasks (latest N)
  const allEvents = agentTasks
    .flatMap((t) => t.events)
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
              {agent.spendingMode}
            </span>
          </div>
          <h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>
            {agent.name}
          </h1>
          <p className="text-[13px] text-[var(--muted)] mt-1 max-w-2xl">{agent.description}</p>
          <p className="text-[11px] text-[var(--muted)] mt-1">Since {formatDate(agent.createdAt)}</p>
        </div>
      </div>

      {/* Metric row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Spend',  value: formatUsd(agent.totalSpend) },
          { label: 'Budget Limit', value: formatUsd(agent.budgetLimit) },
          { label: 'Active Tasks', value: agent.activeTasks },
          { label: 'Accuracy',     value: `${agent.planningAccuracy}%` },
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
        <BudgetBar current={agent.totalSpend} max={agent.budgetLimit} state={budgetState} size="md" />
      </Card>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        {/* Radar */}
        <Card padding="md">
          <h2 className="display text-[13px] font-semibold text-[var(--ink)] mb-3">Agent Health</h2>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <Radar
                dataKey="value" name={agent.name}
                stroke="var(--accent-text)" fill="var(--accent-text)"
                fillOpacity={0.15} strokeWidth={1.5}
              />
            </RadarChart>
          </ResponsiveContainer>
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
            {agent.budgetPolicies.map((policy, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <span className="text-[12px] text-[var(--ink)]">{POLICY_LABELS[policy.type]}</span>
                <span className="text-[13px] font-semibold tabular text-[var(--ink)]">
                  {formatUsd(policy.limit)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Tasks */}
      <Card padding="none" className="mb-5">
        <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <h2 className="display text-[14px] font-semibold text-[var(--ink)]">Tasks</h2>
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
