// ============================================================
// COSTRA — Dashboard (/dashboard)
// ============================================================

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Plus, ArrowRight, Zap, TrendingUp } from 'lucide-react'
import {
  DEMO_TASKS, DEMO_AGENTS, DEMO_SPENDING_SERIES,
  DEMO_SPENDING_BY_SERVICE, DEMO_RECONCILIATIONS,
} from '@/lib/demo-data'
import { deriveBudgetState } from '@/lib/budget-engine'
import { formatUsd, formatRelative, formatPct } from '@/lib/utils'
import { MetricCard } from '@/components/ui/MetricCard'
import { Card } from '@/components/ui/Card'
import { StatusDot } from '@/components/ui/StatusDot'
import { BudgetBar } from '@/components/ui/BudgetBar'




// Slim chart tooltip
function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="px-3 py-2 rounded-[8px] text-[12px]"
      style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
    >
      <p className="text-[var(--muted)] mb-0.5">{label}</p>
      <p className="font-semibold text-[var(--ink)] tabular">{formatUsd(payload[0].value)}</p>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()

  // Derived stats
  const stats = useMemo(() => {
    const totalSpend   = DEMO_AGENTS.reduce((s, a) => s + a.totalSpend, 0)
    const todaySpend   = DEMO_SPENDING_SERIES[DEMO_SPENDING_SERIES.length - 1].amount
    const activeTasks  = DEMO_TASKS.filter((t) => t.status === 'executing').length
    const totalBudget  = DEMO_TASKS.reduce((s, t) => s + t.budget, 0)
    const usedBudget   = DEMO_TASKS.filter((t) => t.status !== 'completed').reduce((s, t) => s + t.currentSpend, 0)
    const availBudget  = totalBudget - usedBudget
    const accuracy     = Math.round(DEMO_AGENTS.reduce((s, a) => s + a.planningAccuracy, 0) / DEMO_AGENTS.length)

    return { totalSpend, todaySpend, activeTasks, availBudget, accuracy }
  }, [])

  // Trim chart data to last 14 points
  const chartData = DEMO_SPENDING_SERIES.slice(-14).map((d) => ({
    date:   d.date.slice(5), // MM-DD
    amount: d.amount,
  }))

  return (
    <div className="px-5 py-6 max-w-5xl mx-auto space-y-6">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>
            Overview
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">Spending intelligence across all agents.</p>
        </div>
        <button
          onClick={() => { void navigate('/plans/new') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] text-[13px] font-semibold
            text-white shadow-[var(--shadow-sm)] transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={14} strokeWidth={2.5} />
          Create Cost Plan
        </button>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard
          label="Total Spend"
          value={formatUsd(stats.totalSpend)}
          subValue="All time"
          className="col-span-1"
        />
        <MetricCard
          label="Today"
          value={formatUsd(stats.todaySpend)}
          delta="+12%"
          deltaPositive={false}
          subValue="vs yesterday"
        />
        <MetricCard
          label="Active Tasks"
          value={stats.activeTasks}
          subValue="Currently executing"
        />
        <MetricCard
          label="Available Budget"
          value={formatUsd(stats.availBudget)}
          subValue="Remaining across tasks"
        />
        <MetricCard
          label="Plan Accuracy"
          value={`${stats.accuracy}%`}
          delta="+3%"
          deltaPositive
          subValue="7-day average"
        />
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Spending chart — 2/3 */}
        <Card padding="none" className="lg:col-span-2">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
            <div>
              <h2 className="display text-[14px] font-semibold text-[var(--ink)]">Spending Activity</h2>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">USDC · Last 14 days · Demo data</p>
            </div>
            <TrendingUp size={14} className="text-[var(--muted)]" />
          </div>
          <div className="px-3 py-4" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--accent-text)" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="var(--accent-text)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'DM Sans' }}
                  axisLine={false} tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'DM Sans' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                  width={42}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone" dataKey="amount"
                  stroke="var(--accent-text)" strokeWidth={1.8}
                  fill="url(#areaGrad)"
                  dot={false} activeDot={{ r: 3, fill: 'var(--accent-text)', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Spend by service — 1/3 */}
        <Card padding="none">
          <div className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
            <h2 className="display text-[14px] font-semibold text-[var(--ink)]">By Service</h2>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">All time · Demo data</p>
          </div>
          <div className="px-4 py-3 space-y-3">
            {DEMO_SPENDING_BY_SERVICE.map((s) => {
              const total = DEMO_SPENDING_BY_SERVICE.reduce((sum, x) => sum + x.amount, 0)
              const pct   = (s.amount / total) * 100
              return (
                <div key={s.name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[12px] text-[var(--ink)]">{s.name}</span>
                    <span className="text-[12px] font-medium tabular text-[var(--muted)]">{formatUsd(s.amount)}</span>
                  </div>
                  <div className="h-1 rounded-full bg-[var(--surface-muted)]">
                    <div
                      className="h-1 rounded-full"
                      style={{ width: `${pct}%`, background: 'var(--accent-text)' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Bottom grid */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* Recent tasks */}
        <Card padding="none">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
            <h2 className="display text-[14px] font-semibold text-[var(--ink)]">Recent Tasks</h2>
            <button
              onClick={() => { void navigate('/tasks') }}
              className="flex items-center gap-1 text-[11px] font-medium text-[var(--accent-text)] hover:opacity-70 transition-opacity"
            >
              View all <ArrowRight size={11} />
            </button>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {DEMO_TASKS.slice(0, 4).map((task) => {
              const budgetState = deriveBudgetState(task.currentSpend, task.budget)
              return (
                <div
                  key={task.id}
                  className="flex items-start gap-3 px-5 py-3.5 hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
                  onClick={() => { void navigate(`/tasks/${task.id}`) }}
                >
                  <StatusDot status={task.status} className="mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--ink)] truncate">{task.description}</p>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5">{task.agentName} · {formatRelative(task.updatedAt)}</p>
                    <div className="mt-2">
                      <BudgetBar
                        current={task.currentSpend}
                        max={task.budget}
                        state={budgetState}
                        size="sm"
                        showLabel={false}
                      />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-[12px] font-semibold tabular text-[var(--ink)]">{formatUsd(task.currentSpend)}</p>
                    <p className="text-[10px] text-[var(--muted)] tabular">of {formatUsd(task.budget)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Planned vs Actual */}
        <Card padding="none">
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
            <h2 className="display text-[14px] font-semibold text-[var(--ink)]">Planned vs Actual</h2>
            <Zap size={13} className="text-[var(--muted)]" />
          </div>
          <div className="divide-y divide-[var(--border)]">
            {DEMO_RECONCILIATIONS.map((r) => (
              <div key={r.taskId} className="px-5 py-4">
                <p className="text-[12px] font-medium text-[var(--ink)] mb-2 truncate">{r.taskDescription}</p>
                <div className="grid grid-cols-4 gap-2 text-center mb-3">
                  {[
                    { l: 'Estimated', v: formatUsd(r.estimatedCost) },
                    { l: 'Budget',    v: formatUsd(r.budget) },
                    { l: 'Actual',    v: formatUsd(r.actualCost) },
                    { l: 'Variance',  v: formatPct(r.variancePct) },
                  ].map(({ l, v }) => (
                    <div key={l}>
                      <p className="text-[10px] text-[var(--muted)] uppercase tracking-wider mb-0.5">{l}</p>
                      <p className="text-[12px] font-semibold tabular text-[var(--ink)]">{v}</p>
                    </div>
                  ))}
                </div>
                {/* Item breakdown bar */}
                <div className="space-y-1.5">
                  {r.items.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="text-[11px] text-[var(--muted)] w-28 truncate flex-shrink-0">{item.label}</span>
                      <div className="flex-1 h-1 bg-[var(--surface-muted)] rounded-full overflow-hidden">
                        <div
                          className="h-1 rounded-full"
                          style={{
                            width: `${Math.min(100, (item.actual / (r.actualCost || 1)) * 100)}%`,
                            background: item.variance > 0 ? 'var(--warning)' : item.variance < 0 ? 'var(--success)' : 'var(--faint)',
                          }}
                        />
                      </div>
                      <span
                        className="text-[10px] tabular font-medium w-12 text-right flex-shrink-0"
                        style={{ color: item.variance > 0 ? 'var(--warning)' : item.variance < 0 ? 'var(--success)' : 'var(--muted)' }}
                      >
                        {item.variance > 0 ? '+' : ''}{formatUsd(item.variance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
