import { HawkErrorCode } from './error-codes.ts';

export class HawkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'HawkError';
  }
}

export class ValidationError extends HawkError {
  constructor(message: string) {
    super(message, HawkErrorCode.VALIDATION_FAILED);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends HawkError {
  constructor(resource: string) {
    super(`${resource} not found`, HawkErrorCode.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

export class AuthorizationError extends HawkError {
  constructor() {
    super('Unauthorized', HawkErrorCode.UNAUTHORIZED);
    this.name = 'AuthorizationError';
  }
}
