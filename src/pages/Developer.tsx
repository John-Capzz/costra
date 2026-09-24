// ============================================================
// COSTRA — Developer / API (/developer)
// ============================================================

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

function CodeBlock({ code, language: _language = 'typescript' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    void navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div className="relative group">
      <pre
        className="mono text-[12px] leading-relaxed overflow-x-auto p-4 rounded-[var(--radius-md)]"
        style={{ background: 'var(--code-bg)', color: 'var(--code-fg)', border: '1px solid var(--border)' }}
      >
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        className={cn(
          'absolute top-3 right-3 p-1.5 rounded-[6px] transition-all',
          'bg-[var(--surface-muted)] border border-[var(--border)]',
          'text-[var(--muted)] hover:text-[var(--ink)]',
        )}
        aria-label="Copy code"
      >
        {copied ? <Check size={12} className="text-[var(--success)]" /> : <Copy size={12} />}
      </button>
    </div>
  )
}

const REST_ENDPOINTS = [
  { method: 'POST', path: '/api/v1/plans',              desc: 'Create a new cost plan' },
  { method: 'GET',  path: '/api/v1/plans/:id',          desc: 'Get a cost plan by ID' },
  { method: 'POST', path: '/api/v1/tasks',              desc: 'Create a new task' },
  { method: 'GET',  path: '/api/v1/tasks/:id',          desc: 'Get a task by ID' },
  { method: 'POST', path: '/api/v1/tasks/:id/events',   desc: 'Append an event to a task' },
  { method: 'POST', path: '/api/v1/tasks/:id/reconcile','desc': 'Reconcile a completed task' },
  { method: 'GET',  path: '/api/v1/agents',             desc: 'List all agents' },
  { method: 'GET',  path: '/api/v1/spending',           desc: 'Query spending history' },
  { method: 'POST', path: '/api/v1/budget/check',       desc: 'Check a spend against a budget' },
]

const METHOD_BADGE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'muted'> = {
  GET:    'info',
  POST:   'success',
  PUT:    'warning',
  DELETE: 'danger',
}

const SDK_INSTALL = `npm install @costra/sdk
# or
bun add @costra/sdk`

const SDK_INIT = `import { Costra } from '@costra/sdk'

const costra = new Costra({
  apiKey: process.env.COSTRA_API_KEY,
  baseUrl: 'https://api.costra.io', // optional
})`

const SDK_PLAN = `// 1. Create a cost plan
const plan = await costra.plan({
  agent:     'research-agent',
  task:      'Research 10 DeFi protocols on Arc',
  network:   'arc-testnet',
  currency:  'USDC',
  maxBudget: '5.00',
})

console.log(plan.estimatedCost)     // 1.06
console.log(plan.recommendedBudget) // 1.27`

const SDK_TRACK = `// 2. Track a running task
const tracker = costra.track(plan.taskId)

// Report a spend event
await tracker.event({
  type:        'API_CALL',
  description: 'DeFiLlama TVL fetch',
  provider:    'defillama.com',
  cost:        '0.0018',
})

// Check if budget allows a proposed spend
const check = await tracker.budgetCheck({ proposedSpend: '0.50' })
if (!check.allowed) {
  console.warn('Spend blocked:', check.reason)
}`

const SDK_RECONCILE = `// 3. Reconcile on completion
const reconciliation = await costra.reconcile(plan.taskId)

console.log(reconciliation.actualCost)   // 1.18
console.log(reconciliation.variance)     // +0.12
console.log(reconciliation.variancePct)  // +11.32%`

const API_PLAN = `// POST /api/v1/plans
{
  "agentId":   "agent_research_01",
  "task":      "Research 10 DeFi protocols on Arc",
  "network":   "arc-testnet",
  "currency":  "USDC",
  "maxBudget": "5.00"
}

// Response
{
  "id":                "plan_abc123",
  "estimatedCost":     1.06,
  "safetyBuffer":      0.21,
  "recommendedBudget": 1.27,
  "maxBudget":         5.00,
  "confidence":        0.88,
  "items": [
    { "label": "Data / API requests",  "estimated": 0.42, "confidence": 0.90 },
    { "label": "Agent inference",      "estimated": 0.31, "confidence": 0.82 },
    { "label": "Arc transactions",     "estimated": 0.06, "confidence": 0.95 },
    { "label": "External services",    "estimated": 0.18, "confidence": 0.85 },
    { "label": "Expected retries",     "estimated": 0.09, "confidence": 0.75 }
  ]
}`

const BUDGET_CHECK = `// POST /api/v1/budget/check
{
  "taskId":        "task_xyz789",
  "proposedSpend": "0.50"
}

// Allowed
{ "allowed": true, "remaining": 3.26 }

// Blocked
{
  "allowed": false,
  "reason":  "proposedSpend exceeds remaining budget",
  "current": 4.82,
  "limit":   5.00,
  "remaining": 0.18
}`

export default function Developer() {
  const [activeTab, setActiveTab] = useState<'sdk' | 'rest'>('sdk')

  return (
    <div className="max-w-4xl mx-auto px-5 py-7">
      <div className="mb-6">
        <h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>
          Developer
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          SDK and REST API reference for programmatic COSTRA integration.
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-0.5 p-1 rounded-[var(--radius-md)] mb-6 w-fit"
        style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
      >
        {(['sdk', 'rest'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-1.5 rounded-[6px] text-[12px] font-semibold uppercase tracking-[0.06em] transition-all"
            style={
              activeTab === tab
                ? { background: 'var(--surface-strong)', color: 'var(--ink)', boxShadow: 'var(--shadow-xs)' }
                : { color: 'var(--muted)' }
            }
          >
            {tab === 'sdk' ? '@costra/sdk' : 'REST API'}
          </button>
        ))}
      </div>

      {activeTab === 'sdk' && (
        <div className="space-y-5">
          <Card padding="lg">
            <h2 className="display text-sm font-semibold text-[var(--ink)] mb-1">Installation</h2>
            <p className="text-[12px] text-[var(--muted)] mb-3">
              The COSTRA SDK provides a typed TypeScript client for the core plan → track → reconcile loop.
            </p>
            <CodeBlock code={SDK_INSTALL} language="bash" />
          </Card>

          <Card padding="lg">
            <h2 className="display text-sm font-semibold text-[var(--ink)] mb-1">Initialise</h2>
            <CodeBlock code={SDK_INIT} />
          </Card>

          <Card padding="lg">
            <h2 className="display text-sm font-semibold text-[var(--ink)] mb-1">Create a Cost Plan</h2>
            <CodeBlock code={SDK_PLAN} />
          </Card>

          <Card padding="lg">
            <h2 className="display text-sm font-semibold text-[var(--ink)] mb-1">Track Execution</h2>
            <CodeBlock code={SDK_TRACK} />
          </Card>

          <Card padding="lg">
            <h2 className="display text-sm font-semibold text-[var(--ink)] mb-1">Reconcile</h2>
            <CodeBlock code={SDK_RECONCILE} />
          </Card>
        </div>
      )}

      {activeTab === 'rest' && (
        <div className="space-y-5">
          <Card padding="none">
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <h2 className="display text-sm font-semibold text-[var(--ink)]">Endpoints</h2>
              <p className="text-[12px] text-[var(--muted)] mt-0.5">
                All requests require <span className="mono text-[11px]">Authorization: Bearer &lt;api_key&gt;</span>
              </p>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {REST_ENDPOINTS.map((ep) => (
                <div key={ep.path} className="flex items-center gap-4 px-5 py-3">
                  <Badge variant={METHOD_BADGE[ep.method] ?? 'muted'} size="sm" className="flex-shrink-0 w-12 justify-center">
                    {ep.method}
                  </Badge>
                  <span className="mono text-[12px] text-[var(--ink)] flex-shrink-0">{ep.path}</span>
                  <span className="text-[12px] text-[var(--muted)] hidden sm:block">{ep.desc}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="lg">
            <h2 className="display text-sm font-semibold text-[var(--ink)] mb-1">Create Cost Plan</h2>
            <CodeBlock code={API_PLAN} language="json" />
          </Card>

          <Card padding="lg">
            <h2 className="display text-sm font-semibold text-[var(--ink)] mb-1">Budget Check</h2>
            <p className="text-[12px] text-[var(--muted)] mb-3">
              Agents should call this before any spend operation to confirm it is within budget.
            </p>
            <CodeBlock code={BUDGET_CHECK} language="json" />
          </Card>
        </div>
      )}
    </div>
  )
}
