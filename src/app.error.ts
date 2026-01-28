import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SentryExceptionCaptured } from '@sentry/nestjs';
import * as _ from 'lodash';
import {
  CheckViolationError,
  DBError,
  DataError,
  ForeignKeyViolationError,
  NotFoundError,
  NotNullViolationError,
  UniqueViolationError,
  ValidationError,
} from 'objection';
import { IBaseError, IExceptionResponse } from './base';
import { EnvironmentService } from './config/environment/environment.service';
import { DoshPointsException } from './exceptions/dosh_points_exception';
import { ExternalAccountKycException } from './exceptions/external_account_kyc_exception';
import { LimitExceededException } from './exceptions/limit_exceeded_exception';
import { OtpRequiredException } from './exceptions/otp_required_exception';
import { RestrictedRegionException } from './exceptions/restricted_region_exception';
import { RestrictionException } from './exceptions/restriction_exception';
import { ServiceUnavailableException } from './exceptions/service_unavailable_exception';

@Catch()
export class AllExceptionFilters implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionFilters.name);

  @SentryExceptionCaptured()
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    let httpStatus = 500;
    let httpResponseBody: IBaseError;

    if (exception instanceof ValidationError) {
      switch (exception.type) {
        case 'ModelValidation':
          httpResponseBody = {
            statusCode: HttpStatus.BAD_REQUEST,
            message: exception.message,
            type: 'ModelValidationError',
            data: exception.data,
            modelClass: exception.modelClass,
            timestamp: new Date().toISOString(),
            path: request.url,
          };

          httpStatus = HttpStatus.BAD_REQUEST;
          break;
        case 'RelationExpression':
          httpResponseBody = {
            statusCode: HttpStatus.BAD_REQUEST,
            message: exception.message,
            type: 'RelationExpressionError',
            data: {},
            modelClass: exception.modelClass,
            timestamp: new Date().toISOString(),
            path: request.url,
          };

          httpStatus = HttpStatus.BAD_REQUEST;
          break;
        case 'UnallowedRelation':
          httpResponseBody = {
            statusCode: HttpStatus.BAD_REQUEST,
            message: exception.message,
            type: 'UnallowedRelationError',
            data: {},
            modelClass: exception.modelClass,
            timestamp: new Date().toISOString(),
            path: request.url,
          };

          httpStatus = HttpStatus.BAD_REQUEST;
          break;
        case 'InvalidGraph':
          httpResponseBody = {
            statusCode: HttpStatus.BAD_REQUEST,
            message: exception.message,
            type: 'InvalidGraphError',
            data: {},
            modelClass: exception.modelClass,
            timestamp: new Date().toISOString(),
            path: request.url,
          };

          httpStatus = HttpStatus.BAD_REQUEST;
          break;
        default:
          httpResponseBody = {
            statusCode: HttpStatus.BAD_REQUEST,
            message: exception.message,
            type: 'UnknownValidationError',
            data: {},
            modelClass: exception.modelClass,
            timestamp: new Date().toISOString(),
            path: request.url,
          };

          httpStatus = HttpStatus.BAD_REQUEST;
          break;
      }
    } else if (
      exception instanceof ServiceUnavailableException ||
      exception instanceof RestrictedRegionException ||
      exception instanceof LimitExceededException ||
      exception instanceof DoshPointsException
    ) {
      httpStatus = exception.statusCode;

      httpResponseBody = {
        statusCode: exception.statusCode,
        message: exception.message,
        type: exception.type,
        data: {},
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    } else if (exception instanceof OtpRequiredException) {
      httpStatus = exception.statusCode;

      httpResponseBody = {
        statusCode: exception.statusCode,
        message: exception.message,
        type: exception.type,
        data: exception.data,
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    } else if (exception instanceof RestrictionException) {
      httpStatus = exception.statusCode;

      httpResponseBody = {
        statusCode: exception.statusCode,
        message: exception.message,
        type: exception.type,
        restriction_type: exception.restrictionCategory,
        data: exception.data,
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      this.logger.warn(
        `Restriction exception on ${request.url}: type=${exception.type}, category=${exception.restrictionCategory}`,
      );
    } else if (exception instanceof ExternalAccountKycException) {
      httpStatus = exception.statusCode;

      httpResponseBody = {
        statusCode: exception.statusCode,
        message: exception.message,
        type: exception.type,
        data: { provider_kyc_status: exception.providerKycStatus },
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      this.logger.warn(
        `External account KYC exception on ${request.url}: type=${exception.type}, status=${exception.providerKycStatus}`,
      );
    } else if (exception instanceof RangeError) {
      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;

      httpResponseBody = {
        statusCode: httpStatus,
        message: exception.message,
        type: 'RangeError',
        data: request?.body?.data ?? {},
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    } else if (exception instanceof NotFoundException) {
      httpStatus = HttpStatus.NOT_FOUND;

      httpResponseBody = {
        statusCode: httpStatus,
        message: exception.message,
        type: 'NotFoundException',
        data: request?.body?.data ?? {},
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    } else if (exception instanceof ConflictException) {
      httpStatus = HttpStatus.CONFLICT;

      httpResponseBody = {
        statusCode: httpStatus,
        message: exception.message,
        type: 'ConflictException',
        data: request?.body?.data ?? {},
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    } else if (exception instanceof InternalServerErrorException) {
      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;

      httpResponseBody = {
        statusCode: httpStatus,
        message: exception.message,
        type: 'InternalServerError',
        data: request?.body?.data ?? {},
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    } else if (exception instanceof ForbiddenException) {
      httpStatus = HttpStatus.FORBIDDEN;

      httpResponseBody = {
        statusCode: httpStatus,
        message: exception.message,
        type: 'Forbidden',
        data: (exception as any)?.response?.data,
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    } else if (exception instanceof UnauthorizedException) {
      httpStatus = HttpStatus.UNAUTHORIZED;

      httpResponseBody = {
        statusCode: httpStatus,
        message: exception.message,
        type: 'Unauthorized',
        data: request?.body?.data,
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    } else if (exception instanceof HttpException) {
      const errorResponse: IExceptionResponse | any = exception.getResponse();
      httpStatus = exception.getStatus();

      httpResponseBody = {
        statusCode: httpStatus,
        message: _.isArray(errorResponse.message)
          ? errorResponse.message[0]
          : typeof errorResponse.message === 'string'
            ? errorResponse.message
            : errorResponse,
        type: 'HttpException',
        data: {},
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    } else if (exception instanceof NotFoundError) {
      httpResponseBody = {
        statusCode: HttpStatus.NOT_FOUND,
        message: exception.message,
        type: 'NotFoundError',
        data: {},
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      httpStatus = HttpStatus.NOT_FOUND;
    } else if (exception instanceof UniqueViolationError) {
      this.logger.error(`Unique violation error on ${request.url}: ${exception.message}`, exception.stack);

      httpResponseBody = {
        statusCode: HttpStatus.CONFLICT,
        message: EnvironmentService.isProduction()
          ? 'A record with this information already exists.'
          : exception.message,
        type: 'UniqueViolationError',
        data: EnvironmentService.isProduction()
          ? {}
          : {
              columns: exception.columns,
              table: exception.table,
              constraint: exception.constraint,
            },
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      httpStatus = HttpStatus.CONFLICT;
    } else if (exception instanceof NotNullViolationError) {
      this.logger.error(`Not null violation error on ${request.url}: ${exception.message}`, exception.stack);

      httpResponseBody = {
        statusCode: HttpStatus.BAD_REQUEST,
        message: EnvironmentService.isProduction() ? 'A required field is missing.' : exception.message,
        type: 'NotNullViolationError',
        data: EnvironmentService.isProduction()
          ? {}
          : {
              column: exception.column,
              table: exception.table,
            },
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      httpStatus = HttpStatus.BAD_REQUEST;
    } else if (exception instanceof ForeignKeyViolationError) {
      this.logger.error(`Foreign key violation error on ${request.url}: ${exception.message}`, exception.stack);

      httpResponseBody = {
        statusCode: HttpStatus.CONFLICT,
        message: EnvironmentService.isProduction()
          ? 'Cannot complete this operation due to related data constraints.'
          : `Can not delete or update data because of a foreign key constraint violation on table: ${exception.table}`,
        type: 'ForeignKeyViolationError',
        data: {},
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      httpStatus = HttpStatus.CONFLICT;
    } else if (exception instanceof CheckViolationError) {
      this.logger.error(`Check violation error on ${request.url}: ${exception.message}`, exception.stack);

      httpResponseBody = {
        statusCode: HttpStatus.BAD_REQUEST,
        message: EnvironmentService.isProduction()
          ? 'The provided data does not meet the required constraints.'
          : exception.message,
        type: 'CheckViolation',
        data: EnvironmentService.isProduction()
          ? {}
          : {
              table: exception.table,
              constraint: exception.constraint,
            },
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      httpStatus = HttpStatus.BAD_REQUEST;
    } else if (exception instanceof DataError) {
      this.logger.error(`Data error on ${request.url}: ${exception.message}`, exception.stack);

      httpResponseBody = {
        statusCode: HttpStatus.BAD_REQUEST,
        message: EnvironmentService.isProduction() ? 'Invalid data format provided.' : exception.message,
        type: 'InvalidData',
        data: {},
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      httpStatus = HttpStatus.BAD_REQUEST;
    } else if (exception instanceof DBError) {
      this.logger.error(`Database error on ${request.url}: ${exception.message}`, exception.stack);

      httpResponseBody = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: EnvironmentService.isProduction()
          ? 'An unexpected error occurred. Please try again later.'
          : exception.message,
        type: 'UnknownDatabaseError',
        data: {},
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    } else if (exception instanceof SyntaxError && 'body' in exception) {
      // Handle JSON parsing errors from body-parser
      httpStatus = HttpStatus.BAD_REQUEST;

      httpResponseBody = {
        statusCode: httpStatus,
        message:
          'Invalid JSON payload. Please verify the request body is valid JSON and the Content-Length header matches the actual body size.',
        type: 'JsonParseError',
        data: {
          originalError: exception.message,
        },
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    } else {
      httpResponseBody = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message,
        type: 'UnknownError',
        data: {},
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    }

    response.status(httpStatus ?? 500).json(httpResponseBody);
  }
}
