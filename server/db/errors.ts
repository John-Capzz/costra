import { AppError, UnavailableError } from '../errors'

export function asDatabaseUnavailable(error: unknown): AppError {
  if (error instanceof AppError) return error
  return new UnavailableError('The persistence service is temporarily unavailable.', error)
}
