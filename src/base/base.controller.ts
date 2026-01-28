import { Controller, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { LogContext } from '../config/logging/winston.interface';
import { IResponse } from './base.interface';

@Controller()
export class BaseController {
  protected readonly logger: Logger = new Logger(BaseController.name);

  public async transformResponse(
    message: string,
    data?: any,
    statusCode: number = HttpStatus.OK,
    logContext?: LogContext,
  ): Promise<IResponse> {
    if (statusCode > 299) {
      // Log error responses
      this.logger.error(`HTTP Error Response: ${message}`, undefined, {
        ...logContext,
        operation: 'http_error_response',
        metadata: {
          statusCode,
          message,
          ...logContext?.metadata,
        },
      });
      throw new HttpException(message, statusCode);
    }

    data = await data;

    // Log successful responses at info level
    this.logger.log(`HTTP Success Response: ${message}`, {
      ...logContext,
      operation: 'http_success_response',
      metadata: {
        statusCode,
        message,
        hasData: !!data,
        ...logContext?.metadata,
      },
    });

    const dateTime = new Date().toISOString();
    return {
      statusCode,
      message,
      data,
      timestamp: dateTime,
    };
  }

  /**
   * Log user actions from controllers
   */
  protected logUserAction(action: string, userId: string, details: Record<string, any>): void {
    this.logger.log(action, userId, details, {
      operation: 'user_action',
      userId,
      metadata: { source: 'controller' },
    });
  }
}
