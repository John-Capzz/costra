// ============================================================
// COSTRA — Cost Plans list (/plans)
// ============================================================

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { costraApi, type CostPlanApiRecord } from '@/lib/api-client'
import { formatUsd, formatDate } from '@/lib/utils'
import type { CostPlanStatus } from '@/types'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'

const STATUS_VARIANT: Record<CostPlanStatus, 'success' | 'info' | 'muted' | 'warning'> = {
  completed: 'success',
  executing: 'info',
  approved:  'warning',
  draft:     'muted',
}

export default function Plans() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<CostPlanApiRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void costraApi.plans
      .then((result) => { if (active) setPlans(result.plans) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Plans could not be loaded.') })
    return () => { active = false }
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-5 py-7">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>
            Cost Plans
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">Economic blueprints for autonomous tasks.</p>
        </div>
        <button
          onClick={() => { void navigate('/plans/new') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] text-[13px] font-semibold
            text-white shadow-[var(--shadow-sm)] transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={14} strokeWidth={2.5} />
          New Plan
        </button>
      </div>

      {error && <Card padding="md" className="mb-5"><p className="text-sm text-[var(--danger)]">{error}</p><p className="text-xs text-[var(--muted)] mt-1">Configure the authenticated COSTRA API to load persisted plans.</p></Card>}
      {!plans && !error && <LoadingSpinner className="mx-auto my-16" />}
      {plans && plans.length === 0 && <EmptyState title="No cost plans yet" description="Create a plan to begin estimating task economics." />}
      <div className="space-y-3">
        {plans?.map((plan) => (
          <Card
            key={plan.id}
            padding="none"
            className="hover:shadow-[var(--shadow)] transition-shadow cursor-pointer"
            onClick={() => { void navigate(`/plans/${plan.id}`) }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4">
              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={STATUS_VARIANT[plan.status]}>{plan.status}</Badge>
                  <span className="text-[10px] text-[var(--muted)]">{plan.network} · {plan.currency}</span>
                </div>
                <p className="text-[14px] font-semibold text-[var(--ink)] truncate">{plan.taskDescription}</p>
                <p className="text-[12px] text-[var(--muted)] mt-0.5">Agent {plan.agentId} · {formatDate(plan.createdAt)}</p>
              </div>

              {/* Figures */}
              <div className="flex items-center gap-6 flex-shrink-0">
                <div className="text-center">
                  <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-0.5">Estimated</p>
                  <p className="text-[14px] font-semibold tabular text-[var(--ink)]">{formatUsd(plan.estimatedCost ?? '0.000000')}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-0.5">Recommended</p>
                  <p className="text-[14px] font-semibold tabular text-[var(--ink)]">{formatUsd(plan.recommendedBudget ?? '0.000000')}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-0.5">Max Budget</p>
                  <p className="text-[14px] font-semibold tabular text-[var(--ink)]">{formatUsd(plan.maxBudget)}</p>
                </div>
                <div className="hidden sm:flex items-center">
                  <ArrowRight size={14} className="text-[var(--faint)]" />
                </div>
              </div>
            </div>

            {/* Confidence bar */}
            <div
              className="h-0.5 mx-5 mb-4 rounded-full overflow-hidden"
              style={{ background: 'var(--surface-muted)' }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${Number(plan.confidence ?? 0) * 100}%`, background: 'var(--success)' }}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
