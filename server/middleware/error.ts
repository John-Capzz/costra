import type { Request, Response, NextFunction } from 'express'
import { AppError, type ErrorResponse } from '../errors'
import { logOperationalEvent, safeErrorDetails } from '../observability'

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestId = req.requestId ?? res.locals.requestId ?? 'unknown'
  const appError = err instanceof AppError ? err : undefined
  const statusCode = appError?.statusCode ?? 500
  const errorCode = appError?.code ?? 'internal_error'
  const message = appError?.expose && errorCode !== 'internal_error'
    ? appError.message
    : 'An unexpected error occurred.'

  if (appError) {
    logOperationalEvent({
      event: 'api_error',
      requestId,
      principalId: req.principal?.userId,
      operation: `${req.method} ${req.path}`,
      resourceId: typeof req.params.id === 'string' ? req.params.id : undefined,
      errorCategory: errorCode,
      statusCode,
      message: appError.message,
    }, 'error')
  } else {
    logOperationalEvent({
      event: 'internal_error',
      requestId,
      principalId: req.principal?.userId,
      operation: `${req.method} ${req.path}`,
      ...safeErrorDetails(err),
    }, 'error')
  }

  const response: ErrorResponse = {
    error: errorCode,
    message,
    requestId,
  }

  res.status(statusCode).json(response)
}
