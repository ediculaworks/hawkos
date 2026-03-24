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
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends HawkError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class AuthorizationError extends HawkError {
  constructor() {
    super('Unauthorized', 'UNAUTHORIZED');
    this.name = 'AuthorizationError';
  }
}
