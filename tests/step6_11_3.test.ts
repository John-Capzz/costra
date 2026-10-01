import { describe, expect, test } from 'bun:test'
import { Money } from '../src/lib/money'
import { estimateCost } from '../src/lib/cost-engine'
import { checkBudget, computeVariance } from '../src/lib/budget-engine'
import { readFileSync } from 'node:fs'

describe('Phase 6.11.3 exact-money boundary', () => {
  test('preserves micro-USDC values through arithmetic and formatting', () => {
    expect(Money.from('0.000001').add(Money.from('0.000002')).toString()).toBe('0.000003')
    expect(Money.from('1.230456').subtract(Money.from('0.000001')).toString()).toBe('1.230455')
    expect(Money.multiplyDecimal('0.000003', '1', 'reject').toString()).toBe('0.000003')
    expect(Money.from('999999.999999').add(Money.from('0.000001')).toString()).toBe('1000000.000000')
  })

  test('keeps estimation, budget checks, and variance exact', () => {
    const estimate = estimateCost({ agentId: 'agent-1', agentName: 'Agent', task: 'Research Arc', network: 'Arc Testnet', currency: 'USDC', maxBudget: '5.000000' })
    expect(typeof estimate.estimatedCost).toBe('string')
    expect(checkBudget('0.100001', '1.230456', '0.000002').remaining).toBe('1.130455')
    expect(computeVariance('1.230456', '1.230459')).toEqual({ variance: '0.000003', variancePct: '0.00' })
  })

  test('authoritative server and SDK paths contain no monetary Number coercion', () => {
    const paths = [
      'server/routes/plans.ts', 'server/routes/tasks.ts', 'server/routes/spending.ts',
      'server/services/plan-persistence.ts', 'server/services/budget-persistence.ts',
      'sdk/index.ts', 'src/lib/cost-engine.ts', 'src/lib/budget-engine.ts',
    ]
    for (const path of paths) {
      const source = readFileSync(path, 'utf8')
      expect(source).not.toMatch(/Number\(|parseFloat\(|\.toFixed\(/)
    }
  })
})
