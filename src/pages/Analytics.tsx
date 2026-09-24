// ============================================================
// COSTRA — Analytics (/analytics)
// ============================================================

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { MetricCard } from '@/components/ui/MetricCard'
import { DEMO_SPENDING_SERIES, DEMO_RECONCILIATIONS, DEMO_PLANS } from '@/lib/demo-data'
import { formatUsd } from '@/lib/utils'
import { TrendingUp, Target, Zap, Shield } from 'lucide-react'

// Build planned vs actual series
const pvActual = DEMO_RECONCILIATIONS.map((r, i) => ({
  name:      `Task ${i + 1}`,
  estimated: r.estimatedCost,
  actual:    r.actualCost,
  budget:    r.budget,
}))

// Accuracy trend (mock)
const accuracyTrend = DEMO_SPENDING_SERIES.slice(-10).map((p, i) => ({
  date:     new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  accuracy: 80 + Math.sin(i * 0.8) * 8 + i * 0.5,
}))

// Cost by category across all plans
const categorySpend: Record<string, number> = {}
DEMO_PLANS.forEach((plan) => {
  plan.items.forEach((item) => {
    categorySpend[item.type] = (categorySpend[item.type] ?? 0) + item.estimated
  })
})
const categoryData = Object.entries(categorySpend).map(([type, amount]) => ({ type, amount }))

export default function Analytics() {
  const avgVariance = DEMO_RECONCILIATIONS.length
    ? DEMO_RECONCILIATIONS.reduce((s, r) => s + Math.abs(r.variancePct), 0) / DEMO_RECONCILIATIONS.length
    : 0
  const avgAccuracy = 100 - avgVariance
  const totalEstimated = DEMO_PLANS.reduce((s, p) => s + p.estimatedCost, 0)
  const totalActual    = DEMO_RECONCILIATIONS.reduce((s, r) => s + r.actualCost, 0)

  return (
    <div className="max-w-6xl mx-auto px-5 py-7">
      <div className="mb-6">
        <h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>Analytics</h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Historical cost performance and estimation accuracy</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Plan Accuracy" value={`${avgAccuracy.toFixed(1)}%`} subValue="Estimate vs actual" icon={Target} />
        <MetricCard label="Avg Variance"  value={`${avgVariance.toFixed(1)}%`} subValue="Across all tasks"   icon={TrendingUp} />
        <MetricCard label="Total Planned" value={formatUsd(totalEstimated)}    subValue="Across all plans"   icon={Shield} />
        <MetricCard label="Total Actual"  value={formatUsd(totalActual)}       subValue="Reconciled tasks"   icon={Zap} />
      </div>

      {/* Planned vs actual */}
      <Card className="mb-5" padding="lg">
        <h2 className="display text-sm font-semibold text-[var(--ink)] mb-4">Planned vs Actual Cost</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={pvActual} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--ink)' }}
              formatter={(v) => [formatUsd(Number(v))]}
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
          <h2 className="display text-sm font-semibold text-[var(--ink)] mb-4">Accuracy Trend</h2>
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
          <h2 className="display text-sm font-semibold text-[var(--ink)] mb-4">Estimated Cost by Type</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: 'var(--ink)' }} tickLine={false} axisLine={false} width={110} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--ink)' }}
                formatter={(v) => [formatUsd(Number(v)), 'Estimated']}
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
            {DEMO_RECONCILIATIONS.map((rec) => (
              <div key={rec.taskId} className="grid grid-cols-5 items-center px-5 py-3 gap-4">
                <p className="text-[12px] text-[var(--ink)] font-medium col-span-2 truncate">{rec.taskDescription}</p>
                <span className="text-[12px] tabular text-[var(--muted)] text-right">{formatUsd(rec.estimatedCost)}</span>
                <span className="text-[12px] tabular font-semibold text-[var(--ink)] text-right">{formatUsd(rec.actualCost)}</span>
                <span
                  className="text-[12px] tabular font-semibold text-right"
                  style={{ color: rec.variance > 0 ? 'var(--warning)' : 'var(--success)' }}
                >
                  {rec.variance > 0 ? '+' : ''}{rec.variancePct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
