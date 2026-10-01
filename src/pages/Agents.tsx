// ============================================================
// COSTRA — Agents list (/agents)
// ============================================================

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { costraApi, type AgentApiRecord } from '@/lib/api-client'
import { deriveBudgetState } from '@/lib/budget-engine'
import { formatUsd } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { BudgetBar } from '@/components/ui/BudgetBar'
import { Eye, Shield, Activity } from 'lucide-react'
import type { AgentStatus } from '@/types'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/lib/money'

const STATUS_VARIANT: Record<AgentStatus, 'success' | 'muted' | 'warning' | 'danger'> = {
  active: 'success',
  idle:   'muted',
  paused: 'warning',
  error:  'danger',
}

export default function Agents() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<AgentApiRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void costraApi.agents
      .then((result) => { if (active) setAgents(result.agents) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Agents could not be loaded.') })
    return () => { active = false }
  }, [])

  const liveAgents = agents ?? []

  return (
    <div className="max-w-4xl mx-auto px-5 py-7">
      <div className="mb-6">
        <h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>
          Agents
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Configure agents, define spending limits, and monitor accuracy.</p>
      </div>

      {error && (
        <Card className="mb-5" padding="md">
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <p className="text-xs text-[var(--muted)] mt-1">Live agent data is unavailable. Configure the COSTRA API before using this view.</p>
        </Card>
      )}
      {!agents && !error && <LoadingSpinner className="mx-auto my-16" />}
      {agents && liveAgents.length === 0 && <EmptyState title="No agents yet" description="Create an agent through the authenticated COSTRA API to see it here." />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {liveAgents.map((agent) => {
          const totalSpend = agent.totalSpend
          const budgetLimit = agent.budgetLimit
          const budgetState = deriveBudgetState(totalSpend, budgetLimit)

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
                    <p className="text-[13px] font-semibold tabular text-[var(--ink)]">{formatUsd(totalSpend)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] mb-0.5">Active</p>
                    <p className="text-[13px] font-semibold tabular text-[var(--ink)]">—</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[var(--muted)] uppercase tracking-[0.1em] mb-0.5">Accuracy</p>
                    <p className="text-[13px] font-semibold tabular text-[var(--ink)]">{agent.planningAccuracy === null ? '—' : `${agent.planningAccuracy}%`}</p>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 border-b border-[var(--border)]">
                <BudgetBar
                  current={totalSpend}
                  max={budgetLimit}
                  state={budgetState}
                  size="sm"
                  showLabel={false}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-[var(--muted)]">
                    {formatUsd(totalSpend)} of {formatUsd(budgetLimit)}
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">
                    {budgetLimit !== '0.000000' ? `${Number(Money.percentOf(Money.from(totalSpend), Money.from(budgetLimit), 0))}% used` : 'No limit'}
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
                    {agent.spendingMode === 'guarded' ? 'guarded · checks only' : 'observe'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[var(--muted)]">
                  <Activity size={10} />
                  Policies available in agent detail
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
