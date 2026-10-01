import { describe, expect, test } from 'bun:test'
import { ArcAdapter, ArcAdapterConfigurationError } from '../src/lib/arc-adapter'
import { UnavailableError } from '../server/errors'

describe('Phase 6.8 failure recovery boundaries', () => {
  test('rejects invalid destination and zero transfer before any provider call', () => {
    const adapter = new ArcAdapter()
    expect(() => adapter.prepareUsdcTransfer({ destination: 'not-an-address', amount: '1.000000' }))
      .toThrow(ArcAdapterConfigurationError)
    expect(() => adapter.prepareUsdcTransfer({ destination: `0x${'1'.repeat(40)}`, amount: '0.000000' }))
      .toThrow(ArcAdapterConfigurationError)
  })

  test('represents unknown submission outcomes as unavailable rather than retryable success', () => {
    const error = new UnavailableError(
      'The previous execution attempt has an unknown outcome. Manual recovery is required before retrying.',
    )
    expect(error.code).toBe('unavailable')
    expect(error.statusCode).toBe(503)
    expect(error.message).toContain('Manual recovery')
  })
})
