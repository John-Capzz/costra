// ============================================================
// COSTRA — Settings (/settings)
// ============================================================

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { useTheme } from '@/hooks/useTheme'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

function Section({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-3">
        <h2 className="display text-[15px] font-semibold text-[var(--ink)]">{title}</h2>
        {description && <p className="text-[12px] text-[var(--muted)] mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function Row({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-[var(--border)] last:border-0">
      <div>
        <p className="text-[13px] font-medium text-[var(--ink)]">{label}</p>
        {description && <p className="text-[11px] text-[var(--muted)] mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0 ml-4">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-10 h-5.5 rounded-full transition-colors',
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--surface-muted)] border border-[var(--border)]',
      )}
      style={{ height: '22px' }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white transition-transform shadow-[var(--shadow-xs)]"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(0)' }}
      />
    </button>
  )
}

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState({
    emailAlerts:      true,
    budgetWarnings:   true,
    taskCompletions:  false,
    blockOnLimit:     true,
    observeMode:      false,
    autoReconcile:    true,
    safetyBuffer:     20,
    dailyLimit:       25,
    txLimit:          1,
  })

  function toggle(key: keyof typeof settings) {
    setSettings((s) => ({ ...s, [key]: !s[key] }))
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-7">
      <div className="mb-7">
        <h1 className="display text-2xl font-700 text-[var(--ink)] tracking-tight" style={{ fontWeight: 700 }}>
          Settings
        </h1>
        <p className="text-sm text-[var(--muted)] mt-0.5">Configure COSTRA preferences and defaults.</p>
      </div>

      <div className="space-y-8">
        {/* Appearance */}
        <Section title="Appearance">
          <Card padding="md">
            <Row label="Theme" description="Choose light or dark display mode.">
              <div
                className="flex p-1 gap-0.5 rounded-[8px]"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
              >
                {(['light', 'dark'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-all capitalize"
                    style={
                      theme === t
                        ? { background: 'var(--surface-strong)', color: 'var(--ink)', boxShadow: 'var(--shadow-xs)' }
                        : { color: 'var(--muted)' }
                    }
                  >
                    {t === 'light' ? <Sun size={12} /> : <Moon size={12} />}
                    {t}
                  </button>
                ))}
              </div>
            </Row>
          </Card>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <Card padding="md">
            <Row label="Email alerts" description="Budget warnings and task completions via email.">
              <Toggle checked={settings.emailAlerts} onChange={() => toggle('emailAlerts')} />
            </Row>
            <Row label="Budget warnings" description="Alert when spending approaches the limit.">
              <Toggle checked={settings.budgetWarnings} onChange={() => toggle('budgetWarnings')} />
            </Row>
            <Row label="Task completions" description="Notify when a task finishes.">
              <Toggle checked={settings.taskCompletions} onChange={() => toggle('taskCompletions')} />
            </Row>
          </Card>
        </Section>

        {/* Spending control */}
        <Section title="Spending Control" description="These settings apply globally as defaults. Per-task and per-agent overrides take precedence.">
          <Card padding="md">
            <Row label="Block on limit" description="Prevent new spend events when the budget is exhausted.">
              <Toggle checked={settings.blockOnLimit} onChange={() => toggle('blockOnLimit')} />
            </Row>
            <Row label="Observe mode" description="Track spending without enforcing limits. Suitable for external wallets.">
              <Toggle checked={settings.observeMode} onChange={() => toggle('observeMode')} />
            </Row>
            <Row label="Auto reconcile" description="Automatically reconcile a task when it is marked complete.">
              <Toggle checked={settings.autoReconcile} onChange={() => toggle('autoReconcile')} />
            </Row>
          </Card>
        </Section>

        {/* Defaults */}
        <Section title="Default Limits">
          <Card padding="md">
            {[
              { key: 'safetyBuffer', label: 'Safety buffer',  suffix: '%',  min: 0, max: 50 },
              { key: 'dailyLimit',   label: 'Daily limit',    suffix: ' USDC', min: 1, max: 1000 },
              { key: 'txLimit',      label: 'Per-tx limit',   suffix: ' USDC', min: 0.01, max: 100 },
            ].map(({ key, label, suffix, min, max }) => (
              <Row key={key} label={label}>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={min} max={max} step={key === 'txLimit' ? 0.01 : 1}
                    value={settings[key as keyof typeof settings] as number}
                    onChange={(e) => setSettings((s) => ({ ...s, [key]: +e.target.value }))}
                    className="w-20 px-2 py-1.5 rounded-[6px] text-[13px] text-right tabular
                      bg-[var(--surface-strong)] border border-[var(--border)] text-[var(--ink)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                  />
                  <span className="text-[12px] text-[var(--muted)]">{suffix}</span>
                </div>
              </Row>
            ))}
          </Card>
        </Section>

        {/* API Key */}
        <Section title="API Access">
          <Card padding="md">
            <Row label="API Key" description="Used by agents to authenticate with the COSTRA API.">
              <button
                className="px-3 py-1.5 rounded-[6px] text-[12px] font-semibold
                  border border-[var(--border)] text-[var(--muted)] hover:text-[var(--ink)]
                  hover:bg-[var(--surface-muted)] transition-colors"
              >
                Reveal / Rotate
              </button>
            </Row>
          </Card>
        </Section>
      </div>
    </div>
  )
}
