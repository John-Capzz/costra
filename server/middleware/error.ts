import type { Request, Response, NextFunction } from 'express'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error('[COSTRA ERROR]', err.message)
  res.status(500).json({
    error:   'internal_error',
    message: 'An unexpected error occurred.',
  })
}
