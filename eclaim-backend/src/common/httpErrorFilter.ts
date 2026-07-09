import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { CommonErrorResponse } from './common-response';

@Catch(HttpException)
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception.getStatus();
    const exceptionResponse: any = exception.getResponse();

    let message: string;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      message =
        exceptionResponse.message ||
        exceptionResponse.error_description ||
        exceptionResponse.error ||
        'An unexpected error occurred';
    } else {
      message = 'An unexpected error occurred';
    }

    const errorResponse = new CommonErrorResponse(
      status,
      exception.name,
      message,
    );

    response.status(status).json(errorResponse);
  }
}
