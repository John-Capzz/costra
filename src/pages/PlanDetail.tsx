// ============================================================
// COSTRA — Cost Plan Detail (/plans/:id)
// ============================================================

import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { DEMO_PLANS } from '@/lib/demo-data'
import { formatUsd, formatDate } from '@/lib/utils'
import type { CostPlanStatus } from '@/types'

const STATUS_VARIANT: Record<CostPlanStatus, 'success' | 'info' | 'muted' | 'warning'> = {
  completed: 'success',
  executing: 'info',
  approved:  'warning',
  draft:     'muted',
}

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const plan = DEMO_PLANS.find((p) => p.id === id)

  if (!plan) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <p className="text-[var(--muted)] text-[14px]">Plan not found.</p>
        <button onClick={() => { void navigate('/plans') }} className="mt-4 text-[12px] text-[var(--accent-text)]">
          ← Back to plans
        </button>
      </div>
    )
  }

  const headroom = plan.maxBudget - plan.recommendedBudget

  return (
    <div className="max-w-2xl mx-auto px-5 py-7">
      <button
        onClick={() => { void navigate('/plans') }}
        className="flex items-center gap-1.5 text-[12px] text-[var(--muted)] hover:text-[var(--ink)] transition-colors mb-5"
      >
        <ArrowLeft size={13} />
        Cost Plans
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={STATUS_VARIANT[plan.status]}>{plan.status}</Badge>
            <span className="text-[11px] text-[var(--muted)]">{plan.network} · {plan.currency}</span>
          </div>
          <h1 className="display text-xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>
            {plan.taskDescription}
          </h1>
          <p className="text-[12px] text-[var(--muted)] mt-1">
            {plan.agentName} · Created {formatDate(plan.createdAt)}
          </p>
        </div>
      </div>

      {/* Budget comparison */}
      <Card padding="md" className="mb-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1.5">Estimated</p>
            <p className="display text-[22px] font-700 tabular text-[var(--ink)]" style={{ fontWeight: 700 }}>
              {formatUsd(plan.estimatedCost)}
            </p>
            <p className="text-[10px] text-[var(--muted)] mt-1">Base estimate</p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1.5">Recommended</p>
            <p className="display text-[22px] font-700 tabular text-[var(--ink)]" style={{ fontWeight: 700 }}>
              {formatUsd(plan.recommendedBudget)}
            </p>
            <p className="text-[10px] text-[var(--muted)] mt-1">With safety buffer</p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1.5">Max Budget</p>
            <p className="display text-[22px] font-700 tabular text-[var(--ink)]" style={{ fontWeight: 700 }}>
              {formatUsd(plan.maxBudget)}
            </p>
            <p className="text-[10px] text-[var(--muted)] mt-1">Hard limit</p>
          </div>
        </div>

        {headroom > 0 && (
          <div
            className="mt-4 flex items-start gap-2.5 px-3 py-2.5 rounded-[8px] text-[12px]"
            style={{ background: 'var(--success-soft)', color: 'var(--success)' }}
          >
            <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              Budget headroom of <strong>{formatUsd(headroom)}</strong>.
              The agent only spends what it uses — the maximum is a safety ceiling, not a guaranteed spend.
            </span>
          </div>
        )}
      </Card>

      {/* Cost breakdown */}
      <Card padding="none" className="mb-5">
        <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <h2 className="display text-[14px] font-semibold text-[var(--ink)]">Cost Breakdown</h2>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px]"
              style={{ background: 'var(--success-soft)', color: 'var(--success)' }}
            >
              {Math.round(plan.confidence * 100)}% confidence
            </span>
          </div>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {plan.items.map((item) => {
            const pct = (item.estimated / plan.estimatedCost) * 100
            return (
              <div key={item.id} className="px-5 py-3.5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="flex-1 text-[13px] font-medium text-[var(--ink)]">{item.label}</span>
                  <span className="text-[11px] text-[var(--muted)]">{item.provider}</span>
                  <span className="text-[14px] font-semibold tabular text-[var(--ink)] w-14 text-right">
                    {formatUsd(item.estimated)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-[var(--surface-muted)]">
                    <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: 'var(--accent-text)' }} />
                  </div>
                  <span className="text-[10px] tabular text-[var(--muted)] w-8 text-right">
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="flex gap-3 mt-1.5">
                  <span className="text-[10px] text-[var(--muted)]">
                    {item.quantity} × {formatUsd(item.unitPrice, 4)}/{item.type.replace('_', ' ')}
                  </span>
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: item.confidence > 0.85 ? 'var(--success)' : item.confidence > 0.70 ? 'var(--warning)' : 'var(--muted)' }}
                  >
                    {Math.round(item.confidence * 100)}% confidence · {item.source}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Safety buffer row */}
        <div className="flex items-center px-5 py-3.5 border-t border-dashed border-[var(--border)]">
          <span className="flex-1 text-[13px] text-[var(--muted)]">Safety Buffer</span>
          <span className="text-[14px] font-semibold tabular text-[var(--muted)]">
            {formatUsd(plan.safetyBuffer)}
          </span>
        </div>
        <div className="flex items-center px-5 py-3.5 border-t border-[var(--border)]">
          <span className="flex-1 text-[14px] font-semibold text-[var(--ink)]">Recommended Budget</span>
          <span className="display text-[18px] font-700 tabular text-[var(--ink)]" style={{ fontWeight: 700 }}>
            {formatUsd(plan.recommendedBudget)}
          </span>
        </div>
      </Card>
    </div>
  )
}
