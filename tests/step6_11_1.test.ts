import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const page = (name: string) => readFile(join(process.cwd(), 'src', 'pages', name), 'utf8')

describe('Phase 6.11.1 production frontend data boundary', () => {
  test('production pages do not import or render demo records', async () => {
    for (const file of ['Dashboard.tsx', 'Spending.tsx', 'AgentDetail.tsx', 'Agents.tsx', 'Plans.tsx', 'Tasks.tsx']) {
      const source = await page(file)
      expect(source).not.toContain('demo-data')
      expect(source).not.toContain('DEMO_')
      expect(source).not.toContain('DEMO MODE')
    }
  })

  test('supported views expose API loading, failure, or empty states', async () => {
    const sources = await Promise.all(['Dashboard.tsx', 'Spending.tsx', 'AgentDetail.tsx', 'Agents.tsx', 'Plans.tsx', 'Tasks.tsx'].map(page))
    const combined = sources.join('\n')
    expect(combined).toContain('LoadingSpinner')
    expect(combined).toContain('setError')
    expect(combined).toContain('No persisted')
    expect(combined).toContain('costraApi')
  })
})
