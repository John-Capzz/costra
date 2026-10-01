import { randomUUID } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'

const REQUEST_ID_HEADER = 'x-request-id'
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

export function isValidRequestId(value: string): boolean {
  return REQUEST_ID_PATTERN.test(value)
}

function getRequestId(req: Request): string {
  const incoming = req.get(REQUEST_ID_HEADER)?.trim()
  return incoming && isValidRequestId(incoming) ? incoming : randomUUID()
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = getRequestId(req)
  req.requestId = requestId
  res.locals.requestId = requestId
  res.setHeader('X-Request-ID', requestId)

  next()
}
