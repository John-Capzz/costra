import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, LoaderCircle, Search, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { costraApi, type TaskApiRecord } from '@/lib/api-client'
import { formatUsd } from '@/lib/utils'

const DEMO_ESTIMATE = '0.730000'

export default function PublicTask() {
  const [description, setDescription] = useState('Research the top DeFi protocols on Arc and summarize the best opportunities.')
  const [task, setTask] = useState<TaskApiRecord | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!task?.id) return
    let active = true
    const poll = async () => {
      try {
        const current = await costraApi.getPublicTask(task.id)
        if (active) setTask(current)
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Task progress could not be loaded.')
      }
    }
    void poll()
    const timer = window.setInterval(() => { void poll() }, 2_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [task?.id])

  const transactionHash = useMemo(
    () => task?.events?.find((event) => event.txHash)?.txHash ?? null,
    [task?.events],
  )
  const complete = Boolean(task?.result || task?.events?.some((event) => event.type === 'TASK_FAILED'))

  async function runTask() {
    if (!description.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      setTask(await costraApi.createPublicTask(description))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The task could not be started.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen px-5 py-10" style={{ background: 'var(--bg)' }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-text)]">COSTRA public demo</p>
          <h1 className="display text-4xl font-bold text-[var(--ink)] mt-3">Run a real research task</h1>
          <p className="text-sm text-[var(--muted)] mt-3 max-w-xl mx-auto">Describe a task and watch an AI research agent plan, execute, track, and reconcile its economic activity on Arc Testnet.</p>
        </div>

        {!task && (
          <Card padding="lg" className="max-w-2xl mx-auto">
            <label htmlFor="public-task" className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Task description</label>
            <textarea id="public-task" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-strong)] p-3 text-sm text-[var(--ink)]" placeholder="What should the research agent investigate?" />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--muted)]">Estimated demo envelope: <strong className="text-[var(--ink)]">{formatUsd(DEMO_ESTIMATE)} USDC</strong></p>
              <button type="button" onClick={() => { void runTask() }} disabled={submitting || !description.trim()} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                {submitting ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />}
                {submitting ? 'Starting...' : 'Run Task'}
              </button>
            </div>
          </Card>
        )}

        {error && <p role="alert" className="mt-5 text-center text-sm text-[var(--danger)]">{error}</p>}

        {task && (
          <div className="space-y-5">
            <Card padding="md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Live task</p>
                  <h2 className="text-lg font-semibold text-[var(--ink)] mt-1">{task.description}</h2>
                </div>
                <Badge variant={complete ? 'success' : 'info'}>{complete ? 'completed' : 'running'}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-5 sm:grid-cols-4">
                <Metric label="Planned" value={`${formatUsd(task.budget)} USDC`} />
                <Metric label="Actual" value={`${formatUsd(task.currentSpend)} USDC`} />
                <Metric label="Events" value={String(task.events?.length ?? 0)} />
                <Metric label="Network" value="Arc Testnet" />
              </div>
            </Card>

            <Card padding="md">
              <div className="flex items-center gap-2 mb-4"><ShieldCheck size={16} className="text-[var(--accent-text)]" /><h2 className="font-semibold text-[var(--ink)]">Execution timeline</h2></div>
              <div className="space-y-3">
                {(task.events ?? []).map((event) => (
                  <div key={event.id} className="flex items-start gap-3 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium text-[var(--ink)]">{event.type.split('_').join(' ')}</p><p className="text-xs text-[var(--muted)]">{event.description ?? 'Recorded by COSTRA'}</p></div>
                    {event.cost && <span className="text-xs tabular text-[var(--muted)]">{formatUsd(event.cost)} USDC</span>}
                  </div>
                ))}
                {(!task.events || task.events.length === 0) && <p className="text-sm text-[var(--muted)]">Starting the agent...</p>}
              </div>
            </Card>

            {transactionHash && <Card padding="md"><p className="text-xs uppercase tracking-wider text-[var(--muted)]">Arc Testnet transaction</p><a href={`https://testnet.arcscan.app/tx/${transactionHash}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 break-all text-sm text-[var(--accent-text)]">{transactionHash}<ExternalLink size={14} /></a></Card>}
            {task.result && <Card padding="md"><h2 className="font-semibold text-[var(--ink)]">Research report</h2><div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--ink)]">{task.result}</div></Card>}
            {complete && <button type="button" onClick={() => { setTask(null); setError(null) }} className="mx-auto block text-sm font-semibold text-[var(--accent-text)]">Run another task</button>}
          </div>
        )}
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-3 text-center"><p className="text-[9px] uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-1 text-sm font-semibold tabular text-[var(--ink)]">{value}</p></div>
}
