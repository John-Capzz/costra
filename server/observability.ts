import type { Request, RequestHandler, Response, NextFunction } from 'express'

export class MetricsRegistry {
  private readonly counters = new Map<string, number>()

  increment(name: string, value = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + value)
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counters.entries())
  }
}

function safePath(req: Request): string {
  return req.path || '/'
}

function principalId(req: Request): string | undefined {
  return req.principal?.userId
}

function safeLogValue(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/0x[0-9a-fA-F]{64}/g, '[redacted-hex-secret]')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[redacted-database-url]')
}

export function logOperationalEvent(event: Record<string, unknown>, level: 'info' | 'error' = 'info'): void {
  const safeEvent = Object.fromEntries(
    Object.entries(event).map(([key, value]) => [key, typeof value === 'string' ? safeLogValue(value) : value]),
  )
  const line = JSON.stringify(safeEvent)
  if (level === 'error') console.error(line)
  else console.info(line)
}

export function observabilityMiddleware(metrics: MetricsRegistry): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now()
    res.on('finish', () => {
      const path = safePath(req)
      const statusCode = res.statusCode
      metrics.increment('http_requests_total')
      if (statusCode >= 400) metrics.increment('http_errors_total')
      if (req.method === 'POST' && path === '/api/v1/executions') metrics.increment('execution_attempts_total')
      if (req.method === 'POST' && path === '/api/v1/executions' && statusCode >= 400) metrics.increment('execution_failures_total')
      if (path.includes('/reconcile') && statusCode >= 400) metrics.increment('reconciliation_failures_total')
      if ((path === '/api/v1/budget/check' || path === '/api/v1/executions') && statusCode === 409) metrics.increment('budget_rejections_total')
      if (statusCode === 429) metrics.increment('rate_limit_events_total')

      logOperationalEvent({
        event: 'http_request',
        requestId: req.requestId ?? 'unknown',
        principalId: principalId(req),
        operation: `${req.method} ${path}`,
        resourceId: typeof req.params.id === 'string' ? req.params.id : undefined,
        statusCode,
        durationMs: Date.now() - startedAt,
      })
    })
    next()
  }
}

export function safeErrorDetails(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: safeLogValue(error.message) }
  return { name: 'UnknownError', message: 'Non-Error failure' }
}
