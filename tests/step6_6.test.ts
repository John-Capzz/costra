import { describe, expect, test } from 'bun:test'
import { MetricsRegistry, safeErrorDetails } from '../server/observability'

describe('Phase 6.6 observability', () => {
  test('tracks operational counters without exposing secrets', () => {
    const metrics = new MetricsRegistry()
    metrics.increment('http_requests_total')
    metrics.increment('execution_attempts_total', 2)
    expect(metrics.snapshot()).toEqual({ http_requests_total: 1, execution_attempts_total: 2 })
  })

  test('normalizes unknown errors to safe operational details', () => {
    expect(safeErrorDetails(new Error('postgresql://user:secret@host/db'))).toEqual({
      name: 'Error',
      message: '[redacted-database-url]',
    })
    expect(safeErrorDetails('failure')).toEqual({ name: 'UnknownError', message: 'Non-Error failure' })
  })
})
