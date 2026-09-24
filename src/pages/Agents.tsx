// ============================================================
// COSTRA — Agents list (/agents)
// ============================================================

import { useNavigate } from 'react-router-dom'
import { DEMO_AGENTS } from '@/lib/demo-data'
import { deriveBudgetState } from '@/lib/budget-engine'
import { formatUsd } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { BudgetBar } from '@/components/ui/BudgetBar'
import { Eye, Shield, Activity } from 'lucide-react'
import type { AgentStatus } from '@/types'

const STATUS_VARIANT: Record<AgentStatus, 'success' | 'muted' | 'warning' | 'danger'> = {
  active: 'success',
  idle:   'muted',
  paused: 'warning',
  error:  'danger',
}

export default function Agents() {
  const navigate = useNavigate()

  return (
    <div className="max-w-4xl mx-auto px-5 py-7">
      <div className="mb-6">
        <h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>
          Agents
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Configure agents, define spending limits, and monitor accuracy.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_AGENTS.map((agent) => {
          const budgetState = deriveBudgetState(agent.totalSpend, agent.budgetLimit)

          return (
            <Card
              key={agent.id}
              padding="none"
              className="hover:shadow-[var(--shadow)] transition-all cursor-pointer group"
              onClick={() => { void navigate(`/agents/${agent.id}`) }}
            >
              <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status={agent.status} className="flex-shrink-0" />
                    <h2 className="display text-[14px] font-semibold text-[var(--ink)] truncate group-hover:text-[var(--accent-text)] transition-colors">
                      {agent.name}
                    </h2>
                  </div>
                  <Badge variant={STATUS_VARIANT[agent.status]}>{agent.status}</Badge>
                </div>
                <p className="text-[12px] text-[var(--muted)] leading-relaxed line-clamp-2">
                  {agent.description}
                </p>
              </div>

              <div className="px-5 py-3 border-b border-[var(--border)]">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] mb-0.5">Spent</p>
                    <p className="text-[13px] font-semibold tabular text-[var(--ink)]">{formatUsd(agent.totalSpend)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] mb-0.5">Active</p>
                    <p className="text-[13px] font-semibold tabular text-[var(--ink)]">{agent.activeTasks}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] mb-0.5">Accuracy</p>
                    <p className="text-[13px] font-semibold tabular text-[var(--ink)]">{agent.planningAccuracy}%</p>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 border-b border-[var(--border)]">
                <BudgetBar
                  current={agent.totalSpend}
                  max={agent.budgetLimit}
                  state={budgetState}
                  size="sm"
                  showLabel={false}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-[var(--muted)]">
                    {formatUsd(agent.totalSpend)} of {formatUsd(agent.budgetLimit)}
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">
                    {((agent.totalSpend / agent.budgetLimit) * 100).toFixed(0)}% used
                  </span>
                </div>
              </div>

              <div className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {agent.spendingMode === 'guarded' ? (
                    <Shield size={11} className="text-[var(--success)]" />
                  ) : (
                    <Eye size={11} className="text-[var(--warning)]" />
                  )}
                  <span className="text-[11px] font-medium capitalize"
                    style={{ color: agent.spendingMode === 'guarded' ? 'var(--success)' : 'var(--warning)' }}>
                    {agent.spendingMode}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
                  <Activity size={10} />
                  {agent.budgetPolicies.length} policies
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
