// COSTRA — Dashboard (/dashboard)

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { Plus, ArrowRight, Zap } from 'lucide-react'
import { costraApi, type AgentApiRecord, type TaskApiRecord } from '@/lib/api-client'
import { deriveBudgetState } from '@/lib/budget-engine'
import { formatUsd, formatRelative } from '@/lib/utils'
import { MetricCard } from '@/components/ui/MetricCard'
import { Card } from '@/components/ui/Card'
import { StatusDot } from '@/components/ui/StatusDot'
import { BudgetBar } from '@/components/ui/BudgetBar'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Money } from '@/lib/money'

type SpendingResult = { series: Array<{ date: string; amount: string }>; total: string }

export default function Dashboard() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<AgentApiRecord[] | null>(null)
  const [tasks, setTasks] = useState<TaskApiRecord[] | null>(null)
  const [spending, setSpending] = useState<SpendingResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([costraApi.agents, costraApi.getTasks(), costraApi.getSpending()])
      .then(([agentResult, taskResult, spendingResult]) => {
        if (!active) return
        setAgents(agentResult.agents); setTasks(taskResult.tasks); setSpending(spendingResult)
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Dashboard data could not be loaded.') })
    return () => { active = false }
  }, [])

  const stats = useMemo(() => {
    const totalBudget = agents?.reduce((sum, agent) => sum.add(Money.from(agent.budgetLimit)), Money.zero()) ?? Money.zero()
    const usedBudget = agents?.reduce((sum, agent) => sum.add(Money.from(agent.totalSpend)), Money.zero()) ?? Money.zero()
    const accuracyValues = agents?.map((agent) => Number(agent.planningAccuracy)).filter(Number.isFinite) ?? []
    return {
      totalSpend: spending?.total ?? '0.000000',
      todaySpend: spending?.series[spending.series.length - 1]?.amount ?? '0.000000',
      availableBudget: totalBudget.subtract(usedBudget).compare(Money.zero()) < 0 ? Money.zero().toString() : totalBudget.subtract(usedBudget).toString(),
      activeTasks: tasks?.filter((task) => task.status === 'executing').length ?? 0,
      accuracy: accuracyValues.length ? Math.round(accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length) : null,
    }
  }, [agents, spending, tasks])

  const loading = !error && (!agents || !tasks || !spending)
  const chartData = (spending?.series ?? []).slice(-14).map((point) => ({ ...point, date: point.date.slice(5) }))
  const recentTasks = [...(tasks ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)

  return (
    <div className="px-5 py-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>Overview</h1><p className="text-sm text-[var(--muted)] mt-0.5">Spending intelligence across persisted COSTRA data.</p></div><button onClick={() => { void navigate('/plans/new') }} className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] text-[13px] font-semibold text-white shadow-[var(--shadow-sm)]" style={{ background: 'var(--accent)' }}><Plus size={14} strokeWidth={2.5} /> Create Cost Plan</button></div>
      {error && <Card padding="md"><p className="text-sm text-[var(--danger)]">{error}</p><p className="text-xs text-[var(--muted)] mt-1">Authenticate the COSTRA API to load persisted dashboard data.</p></Card>}
      {loading && <LoadingSpinner className="mx-auto my-12" />}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3"><MetricCard label="Total Spend" value={spending ? formatUsd(stats.totalSpend) : '—'} subValue="Persisted spend" /><MetricCard label="Today" value={spending ? formatUsd(stats.todaySpend) : '—'} subValue="Persisted spend" /><MetricCard label="Active Tasks" value={tasks ? stats.activeTasks : '—'} subValue="Persisted tasks" /><MetricCard label="Available Budget" value={agents ? formatUsd(stats.availableBudget) : '—'} subValue="Agent headroom" /><MetricCard label="Plan Accuracy" value={stats.accuracy === null ? '—' : `${stats.accuracy}%`} subValue="Persisted agent data" /></div>
      <div className="grid lg:grid-cols-3 gap-5"><Card padding="none" className="lg:col-span-2"><div className="px-5 pt-4 pb-3 border-b border-[var(--border)]"><h2 className="display text-[14px] font-semibold text-[var(--ink)]">Spending Activity</h2><p className="text-[11px] text-[var(--muted)] mt-0.5">USDC · persisted API data</p></div>{spending && chartData.length > 0 ? <div className="px-3 py-4" style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `$${value.toFixed(2)}`} width={42} /><Area type="monotone" dataKey="amount" stroke="var(--accent-text)" fill="var(--accent-soft)" dot={false} /></AreaChart></ResponsiveContainer></div> : <p className="px-5 py-12 text-center text-sm text-[var(--muted)]">No persisted spending data yet.</p>}</Card><Card padding="md"><h2 className="display text-[14px] font-semibold text-[var(--ink)]">Service allocation</h2><p className="text-[11px] text-[var(--muted)] mt-1">Deferred: the current API does not expose persisted totals by service.</p><div className="mt-6 flex items-center gap-2 text-xs text-[var(--muted)]"><Zap size={14} /> Unavailable</div></Card></div>
      <div className="grid lg:grid-cols-2 gap-5"><Card padding="none"><div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]"><h2 className="display text-[14px] font-semibold text-[var(--ink)]">Recent Tasks</h2><button onClick={() => { void navigate('/tasks') }} className="flex items-center gap-1 text-[11px] font-medium text-[var(--accent-text)]">View all <ArrowRight size={11} /></button></div>{recentTasks.length > 0 ? <div className="divide-y divide-[var(--border)]">{recentTasks.map((task) => { const budget = task.budget; const spend = task.currentSpend; return <div key={task.id} className="flex items-start gap-3 px-5 py-3.5 cursor-pointer" onClick={() => { void navigate(`/tasks/${task.id}`) }}><StatusDot status={task.status} className="mt-1.5" /><div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-[var(--ink)] truncate">{task.description}</p><p className="text-[11px] text-[var(--muted)] mt-0.5">{formatRelative(task.updatedAt)}</p><BudgetBar current={spend} max={budget} state={deriveBudgetState(spend, budget)} size="sm" showLabel={false} /></div><span className="text-[12px] font-semibold tabular text-[var(--ink)]">{formatUsd(spend)}</span></div> })}</div> : <p className="px-5 py-12 text-center text-sm text-[var(--muted)]">No persisted tasks yet.</p>}</Card><Card padding="md"><h2 className="display text-[14px] font-semibold text-[var(--ink)]">Planned vs Actual</h2><p className="text-[11px] text-[var(--muted)] mt-1">Deferred: reconciliation aggregation is available on persisted task detail views, not this dashboard endpoint.</p><p className="mt-8 text-center text-xs text-[var(--muted)]">Unavailable</p></Card></div>
    </div>
  )
}
