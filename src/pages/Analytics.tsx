// ============================================================
// COSTRA — Analytics (/analytics)
// ============================================================

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { MetricCard } from '@/components/ui/MetricCard'
import { costraApi, type AgentApiRecord, type CostPlanApiRecord } from '@/lib/api-client'
import { formatUsd } from '@/lib/utils'
import { TrendingUp, Target, Zap, Shield } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Money } from '@/lib/money'

export default function Analytics() {
  const [plans, setPlans] = useState<CostPlanApiRecord[] | null>(null)
  const [agents, setAgents] = useState<AgentApiRecord[] | null>(null)
  const [spending, setSpending] = useState<{ series: Array<{ date: string; amount: string }>; total: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([costraApi.plans, costraApi.agents, costraApi.getSpending()])
      .then(([planResult, agentResult, spendingResult]) => {
        if (!active) return
        setPlans(planResult.plans)
        setAgents(agentResult.agents)
        setSpending(spendingResult)
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Analytics could not be loaded.') })
    return () => { active = false }
  }, [])

  const totalEstimated = plans?.reduce((sum, plan) => sum.add(Money.from(plan.estimatedCost ?? '0.000000')), Money.zero()).toString() ?? '0.000000'
  const totalActual = spending?.total ?? '0.000000'
  const accuracyValues = agents?.map((agent) => Number(agent.planningAccuracy)).filter(Number.isFinite) ?? []
  const avgAccuracy = accuracyValues.length ? accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length : null
  const avgVariance = avgAccuracy === null ? null : 100 - avgAccuracy
  const pvActual: Array<{ name: string; estimated: number; actual: number }> = []
  const accuracyTrend = agents?.map((agent) => ({ date: agent.name, accuracy: Number(agent.planningAccuracy ?? 0) })) ?? []
  const categoryData: Array<{ type: string; amount: number }> = []

  return (
    <div className="max-w-6xl mx-auto px-5 py-7">
      <div className="mb-6">
        <h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>Analytics</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Historical cost performance and estimation accuracy</p>
      </div>

      {error && <Card padding="md" className="mb-5"><p className="text-sm text-[var(--danger)]">{error}</p><p className="text-xs text-[var(--muted)] mt-1">Configure the authenticated COSTRA API to load persisted analytics.</p></Card>}
      {!plans && !agents && !spending && !error && <LoadingSpinner className="mx-auto my-16" />}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Plan Accuracy" value={avgAccuracy === null ? '—' : `${avgAccuracy.toFixed(1)}%`} subValue="Persisted agent data" icon={Target} />
        <MetricCard label="Avg Variance"  value={avgVariance === null ? '—' : `${avgVariance.toFixed(1)}%`} subValue="Reconciliation data pending"   icon={TrendingUp} />
        <MetricCard label="Total Planned" value={plans ? formatUsd(totalEstimated) : '—'}    subValue="Across persisted plans"   icon={Shield} />
        <MetricCard label="Recorded Spend"  value={spending ? formatUsd(totalActual) : '—'}       subValue="Persisted event totals"   icon={Zap} />
      </div>

      {/* Planned vs actual */}
      <Card className="mb-5" padding="lg">
        <h2 className="display text-sm font-semibold text-[var(--ink)] mb-1">Planned vs Actual Cost</h2>
        <p className="text-[11px] text-[var(--muted)] mb-4">Per-task reconciliation aggregation is not exposed by the current API.</p>
        <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pvActual} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--ink)' }}
              formatter={(v) => [formatUsd(String(v))]}
            />
            <Legend
              iconType="circle" iconSize={8}
              formatter={(v) => <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{v}</span>}
            />
            <Bar dataKey="estimated" name="Estimated" fill="var(--subtle)"   radius={[4, 4, 0, 0]} opacity={0.5} />
            <Bar dataKey="actual"    name="Actual"    fill="var(--accent-text)" radius={[4, 4, 0, 0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Accuracy trend */}
        <Card padding="lg">
          <h2 className="display text-sm font-semibold text-[var(--ink)] mb-1">Accuracy by Agent</h2>
          <p className="text-[11px] text-[var(--muted)] mb-4">Historical trend requires persisted reconciliation history.</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={accuracyTrend} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} domain={[60, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--ink)' }}
                formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Accuracy']}
              />
              <Line type="monotone" dataKey="accuracy" stroke="var(--success)" strokeWidth={2} dot={false}
                activeDot={{ r: 4, fill: 'var(--success)', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Spend by cost type */}
        <Card padding="lg">
          <h2 className="display text-sm font-semibold text-[var(--ink)] mb-1">Estimated Cost by Type</h2>
          <p className="text-[11px] text-[var(--muted)] mb-4">Cost-item aggregation is available on individual plan records.</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: 'var(--ink)' }} tickLine={false} axisLine={false} width={110} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--ink)' }}
                formatter={(v) => [formatUsd(String(v)), 'Estimated']}
              />
              <Bar dataKey="amount" fill="var(--accent-text)" radius={[0, 4, 4, 0]} opacity={0.75} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Reconciliations table */}
        <Card className="lg:col-span-2" padding="none">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="display text-sm font-semibold text-[var(--ink)]">Reconciliation History</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            <p className="px-5 py-8 text-center text-[12px] text-[var(--muted)]">Reconciliation history is available on persisted task detail views and is not yet aggregated here.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
