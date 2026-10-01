// COSTRA — Spending (/spending)

import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card } from '@/components/ui/Card'
import { MetricCard } from '@/components/ui/MetricCard'
import { costraApi } from '@/lib/api-client'
import { formatUsd } from '@/lib/utils'
import { Filter } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Money } from '@/lib/money'

type SpendingResult = { series: Array<{ date: string; amount: string }>; total: string }

export default function Spending() {
  const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d'>('30d')
  const [spending, setSpending] = useState<SpendingResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void costraApi.getSpending()
      .then((result) => { if (active) setSpending(result) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Spending could not be loaded.') })
    return () => { active = false }
  }, [])

  const rangeMap = { '7d': 7, '14d': 14, '30d': 30 }
  const visibleSeries = (spending?.series ?? []).slice(-rangeMap[dateRange]).map((point) => ({ ...point, date: point.date.slice(5) }))
  const totalSpend = spending?.total ?? '0.000000'
  const todaySpend = spending?.series[spending.series.length - 1]?.amount ?? '0.000000'
  const avgDaily = spending ? Money.from(totalSpend).divideInteger(30, 'half-up').toString() : '0.000000'

  return (
    <div className="max-w-5xl mx-auto px-5 py-7">
      <div className="flex items-center justify-between mb-6"><div><h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>Spending</h1><p className="text-sm text-[var(--muted)] mt-0.5">Persisted USDC spending recorded by COSTRA.</p></div><div className="flex items-center gap-2"><Filter size={13} className="text-[var(--muted)]" /><div className="flex p-0.5 gap-0.5 rounded-[8px]" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>{(['7d', '14d', '30d'] as const).map((range) => <button key={range} onClick={() => setDateRange(range)} className="px-3 py-1.5 rounded-[6px] text-[11px] font-semibold" style={dateRange === range ? { background: 'var(--surface-strong)', color: 'var(--ink)' } : { color: 'var(--muted)' }}>{range}</button>)}</div></div></div>
      {error && <Card padding="md" className="mb-5"><p className="text-sm text-[var(--danger)]">{error}</p><p className="text-xs text-[var(--muted)] mt-1">Authenticate the COSTRA API to load persisted spending.</p></Card>}
      {!spending && !error && <LoadingSpinner className="mx-auto my-16" />}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5"><MetricCard label="Total Spend" value={spending ? formatUsd(totalSpend) : '—'} subValue="Persisted records" /><MetricCard label="Today" value={spending ? formatUsd(todaySpend) : '—'} subValue="Current day" /><MetricCard label="Average Daily" value={spending ? formatUsd(avgDaily) : '—'} subValue="30-day view" /></div>
      <Card padding="none" className="mb-5"><div className="px-5 pt-4 pb-3 border-b border-[var(--border)]"><h2 className="display text-[14px] font-semibold text-[var(--ink)]">Daily USDC Spend</h2><p className="text-[11px] text-[var(--muted)] mt-0.5">Persisted API event totals</p></div>{visibleSeries.length > 0 ? <div className="px-3 py-4" style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={visibleSeries}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={(value: number) => `$${value.toFixed(2)}`} /><Tooltip /><Area type="monotone" dataKey="amount" stroke="var(--accent-text)" fill="var(--accent-soft)" dot={false} /></AreaChart></ResponsiveContainer></div> : <p className="px-5 py-12 text-center text-sm text-[var(--muted)]">No persisted spending records yet.</p>}</Card>
      <div className="grid lg:grid-cols-2 gap-5"><Card padding="md"><h2 className="display text-[13px] font-semibold text-[var(--ink)]">By Agent</h2><p className="text-[11px] text-[var(--muted)] mt-1">Deferred: the current spending API does not expose agent aggregation.</p><p className="mt-8 text-center text-xs text-[var(--muted)]">Unavailable</p></Card><Card padding="md"><h2 className="display text-[13px] font-semibold text-[var(--ink)]">By Service Type</h2><p className="text-[11px] text-[var(--muted)] mt-1">Deferred: the current spending API does not expose service aggregation.</p><p className="mt-8 text-center text-xs text-[var(--muted)]">Unavailable</p></Card></div>
    </div>
  )
}
