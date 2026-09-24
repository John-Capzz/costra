// ============================================================
// COSTRA — Spending (/spending)
// ============================================================

import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { MetricCard } from '@/components/ui/MetricCard'
import {
  DEMO_SPENDING_SERIES, DEMO_SPENDING_BY_AGENT,
  DEMO_SPENDING_BY_SERVICE, DEMO_TASKS,
} from '@/lib/demo-data'
import { formatUsd } from '@/lib/utils'
import { Filter } from 'lucide-react'
import type { TaskStatus } from '@/types'

const TASK_STATUS_VARIANT: Record<TaskStatus, 'success' | 'info' | 'danger' | 'warning' | 'muted'> = {
  completed: 'success', executing: 'info', failed: 'danger', blocked: 'danger', pending: 'muted',
}

const chartTooltipStyle = {
  background:   'var(--surface-strong)',
  border:       '1px solid var(--border)',
  borderRadius: '8px',
  fontSize:     '12px',
  color:        'var(--ink)',
  boxShadow:    'var(--shadow)',
}

// Last 30 days windowed to 30 points
const seriesData = DEMO_SPENDING_SERIES.map((d) => ({
  date:   d.date.slice(5),
  amount: d.amount,
}))

export default function Spending() {
  const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d'>('30d')

  const rangeMap = { '7d': 7, '14d': 14, '30d': 30 }
  const visibleSeries = seriesData.slice(-rangeMap[dateRange])

  const totalSpend  = DEMO_SPENDING_SERIES.reduce((s, d) => s + d.amount, 0)
  const todaySpend  = DEMO_SPENDING_SERIES[DEMO_SPENDING_SERIES.length - 1].amount
  const blockedTxns = DEMO_TASKS.flatMap((t) => t.events).filter((e) => e.type === 'SPEND_BLOCKED').length
  const avgDaily    = totalSpend / 30

  // Stacked by service (simulated)
  const stackedData = visibleSeries.map((d) => ({
    date:       d.date,
    inference:  +(d.amount * 0.37).toFixed(4),
    api_calls:  +(d.amount * 0.31).toFixed(4),
    arc_txns:   +(d.amount * 0.07).toFixed(4),
    external:   +(d.amount * 0.15).toFixed(4),
    retries:    +(d.amount * 0.10).toFixed(4),
  }))

  return (
    <div className="max-w-5xl mx-auto px-5 py-7">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>
            Spending
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">USDC spending breakdown across all agents and services.</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-[var(--muted)]" />
          <div
            className="flex p-0.5 gap-0.5 rounded-[8px]"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
          >
            {(['7d', '14d', '30d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className="px-3 py-1.5 rounded-[6px] text-[11px] font-semibold transition-all"
                style={
                  dateRange === r
                    ? { background: 'var(--surface-strong)', color: 'var(--ink)', boxShadow: 'var(--shadow-xs)' }
                    : { color: 'var(--muted)' }
                }
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Total Spend"    value={formatUsd(totalSpend)}  subValue="30 days" />
        <MetricCard label="Today"          value={formatUsd(todaySpend)}  subValue="Current day" />
        <MetricCard label="Avg Daily"      value={formatUsd(avgDaily)}    subValue="Rolling 30d" />
        <MetricCard label="Blocked Spends" value={blockedTxns}            subValue="Budget enforcements" />
      </div>

      {/* Area chart — daily spend */}
      <Card padding="none" className="mb-5">
        <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <h2 className="display text-[14px] font-semibold text-[var(--ink)]">Daily USDC Spend</h2>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">All agents · Demo data · USDC</p>
        </div>
        <div className="px-3 py-4" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visibleSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--accent-text)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--accent-text)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(2)}`} width={46} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [formatUsd(Number(v)), 'Spent']} />
              <Area type="monotone" dataKey="amount" stroke="var(--accent-text)" strokeWidth={1.8}
                fill="url(#spendGrad)" dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Stacked bar chart */}
      <Card padding="none" className="mb-5">
        <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <h2 className="display text-[14px] font-semibold text-[var(--ink)]">Spend by Service Type</h2>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">Stacked by cost category · Demo data</p>
        </div>
        <div className="px-3 py-4" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stackedData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(2)}`} width={46} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v, name) => [formatUsd(Number(v)), String(name)]} />
              <Legend iconType="circle" iconSize={7} formatter={(v: string) => <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'capitalize' }}>{v.replace('_', ' ')}</span>} />
              <Bar dataKey="inference"  stackId="a" fill="var(--accent-text)"     opacity={0.85} radius={[0,0,0,0]} />
              <Bar dataKey="api_calls"  stackId="a" fill="var(--info)"            opacity={0.7} />
              <Bar dataKey="external"   stackId="a" fill="var(--warning)"         opacity={0.65} />
              <Bar dataKey="retries"    stackId="a" fill="var(--danger)"          opacity={0.5} />
              <Bar dataKey="arc_txns"   stackId="a" fill="var(--success)"         opacity={0.7}  radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        {/* By agent */}
        <Card padding="md">
          <h2 className="display text-[13px] font-semibold text-[var(--ink)] mb-4">By Agent</h2>
          <div className="space-y-3">
            {DEMO_SPENDING_BY_AGENT.map((a) => {
              const total = DEMO_SPENDING_BY_AGENT.reduce((s, x) => s + x.amount, 0)
              return (
                <div key={a.name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[12px] text-[var(--ink)]">{a.name}</span>
                    <span className="text-[12px] font-semibold tabular text-[var(--ink)]">{formatUsd(a.amount)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--surface-muted)]">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${(a.amount / total) * 100}%`, background: 'var(--accent-text)' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* By service */}
        <Card padding="md">
          <h2 className="display text-[13px] font-semibold text-[var(--ink)] mb-4">By Service Type</h2>
          <div className="space-y-3">
            {DEMO_SPENDING_BY_SERVICE.map((s) => {
              const total = DEMO_SPENDING_BY_SERVICE.reduce((sum, x) => sum + x.amount, 0)
              return (
                <div key={s.name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[12px] text-[var(--ink)]">{s.name}</span>
                    <span className="text-[12px] font-semibold tabular text-[var(--ink)]">{formatUsd(s.amount)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--surface-muted)]">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${(s.amount / total) * 100}%`, background: 'var(--info)' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Transaction-level list */}
      <Card padding="none">
        <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <h2 className="display text-[14px] font-semibold text-[var(--ink)]">Spend Events</h2>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">Individual spend events across all tasks</p>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {DEMO_TASKS
            .flatMap((t) => t.events.filter((e) => (e.cost ?? 0) > 0).map((e) => ({ ...e, taskDesc: t.description, taskStatus: t.status })))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 12)
            .map((e) => (
              <div key={e.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[var(--ink)] truncate">{e.description}</p>
                  <p className="text-[10px] text-[var(--muted)] mt-0.5 truncate">{e.taskDesc}</p>
                </div>
                {e.provider && (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)] hidden sm:block">
                    {e.provider}
                  </span>
                )}
                <Badge variant={TASK_STATUS_VARIANT[e.taskStatus]}>{e.type.replace(/_/g, ' ')}</Badge>
                <span className="text-[13px] font-semibold tabular text-[var(--ink)] w-14 text-right flex-shrink-0">
                  {formatUsd(e.cost ?? 0)}
                </span>
              </div>
            ))}
        </div>
      </Card>
    </div>
  )
}
