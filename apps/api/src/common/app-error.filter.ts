import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@pokerplan/shared';
import type { Response } from 'express';
import { AppError } from './app-error';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NAME_REQUIRED: HttpStatus.BAD_REQUEST,
  REMOVED: HttpStatus.FORBIDDEN,
  NOT_JOINED: HttpStatus.UNAUTHORIZED,
  CONFLICT: HttpStatus.CONFLICT,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  INTERNAL: HttpStatus.INTERNAL_SERVER_ERROR,
};

@Catch(AppError)
export class AppErrorFilter implements ExceptionFilter {
  catch(error: AppError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const status = STATUS[error.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
    res.status(status).json({ statusCode: status, code: error.code, message: error.message });
  }
}
