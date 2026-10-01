import { describe, expect, test } from 'bun:test'
import { getAdapter, ArcAdapter } from '../src/lib/arc-adapter'
import { SUPPORTED_NETWORKS, validatePlanBody } from '../server/validation'
import { ValidationError } from '../server/errors'

describe('capability restrictions', () => {
  test('exposes Arc Testnet as the only supported API network', () => {
    expect(SUPPORTED_NETWORKS).toEqual(['Arc Testnet'])
    expect(validatePlanBody({ task: 'Research Arc', maxBudget: '1', network: 'Arc Testnet' }).network)
      .toBe('Arc Testnet')
  })

  test('rejects unsupported network choices', () => {
    for (const network of ['Arc Mainnet', 'Ethereum', 'Ethereum Sepolia', 'Base', 'Base Sepolia']) {
      expect(() => validatePlanBody({ task: 'Research', maxBudget: '1', network })).toThrow(ValidationError)
    }
  })
})

describe('Arc adapter capability status', () => {
  test('registers only the Arc Testnet adapter', () => {
    expect(getAdapter('Arc Testnet')).toBeInstanceOf(ArcAdapter)
    expect(getAdapter('Arc Mainnet')).toBeUndefined()
    expect(getAdapter('Ethereum')).toBeUndefined()
    expect(getAdapter('Base')).toBeUndefined()
  })

  test('labels balance data simulated and does not fabricate transaction receipts', () => {
    const adapter = new ArcAdapter()

    expect(adapter.getBalance('0x0000000000000000000000000000000000000001').source).toBe('simulated')
    expect(adapter.getTransaction(`0x${'a'.repeat(64)}`)).toBeNull()
    expect(adapter.estimateTransactionCost().note).toContain('Simulated')
  })
})
