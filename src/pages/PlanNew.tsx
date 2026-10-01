// ============================================================
// COSTRA — Create Cost Plan (/plans/new)
// ============================================================

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Sparkles, ChevronRight, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { costraApi, type AgentApiRecord } from '@/lib/api-client'
import { estimateCost } from '@/lib/cost-engine'
import { formatUsd } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Money } from '@/lib/money'

const NETWORKS = ['Arc Testnet']

interface FormState {
  task:       string
  agentId:    string
  network:    string
  currency:   string
  maxBudget:  string
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] font-semibold text-[var(--ink)] uppercase tracking-[0.07em] mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[var(--muted)] mt-1">{hint}</p>}
    </div>
  )
}

const INPUT = cn(
  'w-full px-3.5 py-2.5 rounded-[var(--radius-md)] text-[13px]',
  'bg-[var(--surface-strong)] border border-[var(--border)]',
  'text-[var(--ink)] placeholder:text-[var(--faint)]',
  'focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)] focus:border-[var(--border-mid)]',
  'transition-all',
)

export default function PlanNew() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>({
    task:      'Research the top 10 DeFi protocols on Arc',
    agentId:   '',
    network:   'Arc Testnet',
    currency:  'USDC',
    maxBudget: '5.00',
  })
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<ReturnType<typeof estimateCost> | null>(null)
  const [agents, setAgents] = useState<AgentApiRecord[] | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void costraApi.agents
      .then((response) => {
        if (!active) return
        setAgents(response.agents)
        if (response.agents[0]) setForm((current) => ({ ...current, agentId: current.agentId || response.agents[0].id }))
      })
      .catch((reason: unknown) => { if (active) setApiError(reason instanceof Error ? reason.message : 'Agents could not be loaded.') })
    return () => { active = false }
  }, [])

  function handleChange(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    setResult(null)
    setCreatedPlanId(null)
  }

  async function generate() {
    if (!form.task.trim()) return
    if (!form.agentId || !agents) return
    setGenerating(true)
    setApiError(null)
    const agent = agents.find((a) => a.id === form.agentId)
    const est = estimateCost({
      agentId:    form.agentId,
      agentName:  agent?.name ?? 'Agent',
      task:       form.task,
      network:    form.network,
      currency:   form.currency,
      maxBudget:  form.maxBudget,
    })
    try {
      const persisted = await costraApi.createExactPlan({
        agentId: form.agentId,
        task: form.task,
        network: 'Arc Testnet',
        currency: 'USDC',
        maxBudget: form.maxBudget,
        safetyMargin: { type: 'fixed', value: est.safetyBuffer },
        items: est.items.map((item) => ({
          id: item.id,
          type: item.type,
          label: item.label,
          provider: item.provider,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          confidence: item.confidence,
          source: item.source,
          currency: 'USDC' as const,
        })),
      })
      setCreatedPlanId(persisted.id)
      setResult({
        estimatedCost: persisted.estimatedCost ?? '0.000000',
        safetyBuffer: persisted.safetyBuffer ?? '0.000000',
        recommendedBudget: persisted.recommendedBudget ?? '0.000000',
        confidence: persisted.confidence ?? '0.000000',
        items: (persisted.items ?? []).map((item) => ({
          id: item.id, type: item.type as ReturnType<typeof estimateCost>['items'][number]['type'],
          label: item.label, provider: item.providerId ?? 'Provider',
          unitPrice: item.unitPrice, quantity: item.quantity, estimated: item.estimated,
          confidence: item.confidence ?? '0.0000', source: item.source, currency: 'USDC' as const,
        })),
      })
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'The cost plan could not be created.')
    } finally {
      setGenerating(false)
    }
  }

  const maxBudgetExact = form.maxBudget

  return (
    <div className="max-w-2xl mx-auto px-5 py-7">
      {/* Back */}
      <button
        onClick={() => { void navigate('/plans') }}
        className="flex items-center gap-1.5 text-[12px] text-[var(--muted)] hover:text-[var(--ink)] transition-colors mb-5"
      >
        <ArrowLeft size={13} />
        Cost Plans
      </button>

      <div className="mb-6">
        <h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>
          Create Cost Plan
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          Estimate the total economic cost before your agent begins executing. Arc Testnet and USDC are the active development options.
        </p>
      </div>

      {apiError && <p className="mb-4 text-sm text-[var(--danger)]">{apiError}</p>}

      <Card padding="lg" className="space-y-5">
        {/* Task */}
        <Field id="plan-task" label="Task" hint="Describe what the agent will do. The more specific, the more accurate the estimate.">
          <textarea
            id="plan-task"
            className={cn(INPUT, 'resize-none')}
            rows={3}
            placeholder="e.g. Research the top 10 DeFi protocols on Arc by TVL"
            value={form.task}
            onChange={(e) => handleChange('task', e.target.value)}
          />
        </Field>

        {/* Agent */}
        <Field id="plan-agent" label="Agent">
          <select
            id="plan-agent"
            className={INPUT}
            value={form.agentId}
            onChange={(e) => handleChange('agentId', e.target.value)}
          >
            {(agents ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
            {!agents && <option>Loading agents…</option>}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          {/* Network */}
          <Field id="plan-network" label="Network">
            <select
              id="plan-network"
              className={INPUT}
              value={form.network}
              onChange={(e) => handleChange('network', e.target.value)}
            >
              {NETWORKS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </Field>

          {/* Currency */}
          <Field id="plan-currency" label="Currency">
            <select
              id="plan-currency"
              className={INPUT}
              value={form.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
            >
              <option>USDC</option>
            </select>
          </Field>
        </div>

        {/* Max budget */}
        <Field id="plan-max-budget" label="Maximum Budget" hint="COSTRA records the limit and can report policy results; it does not block arbitrary external-wallet spending yet.">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-medium text-[var(--muted)]">$</span>
            <input
              id="plan-max-budget"
              type="number"
              min={0.01}
              step={0.01}
              className={cn(INPUT, 'pl-7 tabular')}
              value={form.maxBudget}
              onChange={(e) => handleChange('maxBudget', e.target.value)}
            />
          </div>
        </Field>

        {/* CTA */}
        <button
          onClick={() => { void generate() }}
          disabled={generating || !form.task.trim() || !form.agentId || !agents}
          className="w-full flex items-center justify-center gap-2.5 py-3 rounded-[var(--radius-md)]
            text-[13px] font-semibold text-white transition-all
            disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.99]"
          style={{ background: 'var(--accent)', boxShadow: 'var(--shadow-sm)' }}
        >
          {generating ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Estimating cost…
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Generate Cost Plan
            </>
          )}
        </button>
      </Card>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25 }}
            className="mt-5 space-y-3"
          >
            {/* Breakdown */}
            <Card padding="none">
              <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
                <h2 className="display text-[14px] font-semibold text-[var(--ink)]">Cost Breakdown</h2>
                <p className="text-[11px] text-[var(--muted)] mt-0.5">
                  Confidence {Number(Money.from(result.confidence).multiply('100').toString())}% · Simulated estimation
                </p>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {result.items.map((item) => (
                  <div key={item.id} className="flex items-center px-5 py-3 gap-3">
                    <span className="flex-1 text-[13px] text-[var(--ink)]">{item.label}</span>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px]"
                      style={{
                        color:       Money.from(item.confidence).compare(Money.from('0.85')) > 0 ? 'var(--success)' : Money.from(item.confidence).compare(Money.from('0.70')) > 0 ? 'var(--warning)' : 'var(--muted)',
                        background:  Money.from(item.confidence).compare(Money.from('0.85')) > 0 ? 'var(--success-soft)' : Money.from(item.confidence).compare(Money.from('0.70')) > 0 ? 'var(--warning-soft)' : 'var(--surface-muted)',
                      }}
                    >
                      {Number(Money.from(item.confidence).multiply('100').toString())}%
                    </span>
                    <span className="text-[14px] font-semibold tabular text-[var(--ink)] w-16 text-right">
                      {formatUsd(item.estimated)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Summary figures */}
            <Card padding="md">
              <div className="space-y-2.5">
                {[
                  { label: 'Estimated Cost',    value: result.estimatedCost,     highlight: false, size: 'base' },
                  { label: 'Safety Buffer',      value: result.safetyBuffer,      highlight: false, size: 'sm' },
                  { label: 'Recommended Budget', value: result.recommendedBudget, highlight: true,  size: 'lg' },
                ].map(({ label, value, highlight, size }) => (
                  <div
                    key={label}
                    className={cn(
                      'flex items-center justify-between py-1',
                      highlight && 'border-t border-[var(--border)] pt-3 mt-1',
                    )}
                  >
                    <span
                      className={cn('text-[var(--muted)]', highlight ? 'text-[13px] font-semibold text-[var(--ink)]' : 'text-[13px]')}
                    >
                      {label}
                    </span>
                    <span
                      className={cn(
                        'tabular font-semibold',
                        highlight ? 'text-[18px] text-[var(--ink)]' : 'text-[14px] text-[var(--ink)]',
                        size === 'sm' && 'text-[var(--muted)]',
                      )}
                    >
                      {formatUsd(value)}
                    </span>
                  </div>
                ))}

                {/* Max budget row */}
                <div className="flex items-center justify-between py-1 border-t border-dashed border-[var(--border)] pt-3 mt-1">
                  <span className="text-[12px] text-[var(--muted)]">Maximum Budget (your limit)</span>
                  <span className="tabular text-[13px] font-medium text-[var(--muted)]">
                    {formatUsd(maxBudgetExact)}
                  </span>
                </div>
              </div>

              {/* Headroom callout */}
              {Money.from(maxBudgetExact).compare(Money.from(result.recommendedBudget)) > 0 && (
                <div
                  className="mt-4 flex items-start gap-2.5 px-3 py-2.5 rounded-[8px] text-[12px]"
                  style={{ background: 'var(--success-soft)', color: 'var(--success)' }}
                >
                  <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Budget headroom: {formatUsd(Money.from(maxBudgetExact).subtract(Money.from(result.recommendedBudget)).toString())}</strong>
                    {' '}— your maximum budget comfortably covers the recommended amount.
                    You will only spend what the agent actually uses.
                  </span>
                </div>
              )}
            </Card>

            {/* Approve CTA */}
            <button
              onClick={() => { void navigate(createdPlanId ? `/plans/${createdPlanId}` : '/plans') }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-[var(--radius-md)]
                text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.99]"
              style={{
                background: 'var(--surface-strong)',
                border:     '1px solid var(--border)',
                color:      'var(--ink)',
                boxShadow:  'var(--shadow-xs)',
              }}
            >
              View Persisted Plan
              <ChevronRight size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
