export type ErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'unavailable'
  | 'internal_error'

export interface ErrorResponse {
  error: ErrorCode
  message: string
  requestId: string
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly statusCode: number
  readonly expose: boolean

  constructor(
    code: ErrorCode,
    statusCode: number,
    message: string,
    options: { expose?: boolean; cause?: unknown } = {},
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.expose = options.expose ?? true

    if (options.cause !== undefined) {
      Object.defineProperty(this, 'cause', {
        configurable: true,
        enumerable: false,
        value: options.cause,
        writable: true,
      })
    }
  }
}

export class ValidationError extends AppError {
  constructor(message = 'The request could not be validated.', cause?: unknown) {
    super('validation', 400, message, { cause })
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication is required.', cause?: unknown) {
    super('unauthorized', 401, message, { cause })
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'You are not authorized to perform this action.', cause?: unknown) {
    super('forbidden', 403, message, { cause })
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found.', cause?: unknown) {
    super('not_found', 404, message, { cause })
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message = 'The request conflicts with the current resource state.', cause?: unknown) {
    super('conflict', 409, message, { cause })
    this.name = 'ConflictError'
  }
}

export class UnavailableError extends AppError {
  constructor(message = 'The requested service is temporarily unavailable.', cause?: unknown) {
    super('unavailable', 503, message, { cause })
    this.name = 'UnavailableError'
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'An unexpected error occurred.', cause?: unknown) {
    super('internal_error', 500, message, { expose: false, cause })
    this.name = 'InternalServerError'
  }
}
