import type { AckError, ErrorCode } from '@pokerplan/shared';

/** Domain error understood by both the REST layer and the socket gateway. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toAck(): AckError {
    return { code: this.code, message: this.message };
  }

  static notFound(what = 'Room'): AppError {
    return new AppError('NOT_FOUND', `${what} not found`);
  }

  static forbidden(message = 'Only the facilitator can do that'): AppError {
    return new AppError('FORBIDDEN', message);
  }
}
