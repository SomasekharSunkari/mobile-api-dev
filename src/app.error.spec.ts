import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import {
  CheckViolationError,
  DataError,
  DBError,
  ForeignKeyViolationError,
  NotNullViolationError,
  UniqueViolationError,
} from 'objection';
import { AllExceptionFilters } from './app.error';
import { EnvironmentService } from './config/environment/environment.service';

/**
 * Creates a DBError instance for testing purposes
 */
function createDBError(message: string): InstanceType<typeof DBError> {
  const nativeError = new Error(message);
  const dbError = Object.create(DBError.prototype);
  dbError.message = message;
  dbError.name = 'DBError';
  dbError.nativeError = nativeError;
  dbError.stack = nativeError.stack;
  return dbError as InstanceType<typeof DBError>;
}

/**
 * Creates a UniqueViolationError instance for testing purposes
 */
function createUniqueViolationError(
  message: string,
  table: string,
  columns: string[],
  constraint: string,
): InstanceType<typeof UniqueViolationError> {
  const nativeError = new Error(message);
  const error = Object.create(UniqueViolationError.prototype);
  error.message = message;
  error.name = 'UniqueViolationError';
  error.nativeError = nativeError;
  error.stack = nativeError.stack;
  error.table = table;
  error.columns = columns;
  error.constraint = constraint;
  return error as InstanceType<typeof UniqueViolationError>;
}

/**
 * Creates a NotNullViolationError instance for testing purposes
 */
function createNotNullViolationError(
  message: string,
  table: string,
  column: string,
): InstanceType<typeof NotNullViolationError> {
  const nativeError = new Error(message);
  const error = Object.create(NotNullViolationError.prototype);
  error.message = message;
  error.name = 'NotNullViolationError';
  error.nativeError = nativeError;
  error.stack = nativeError.stack;
  error.table = table;
  error.column = column;
  return error as InstanceType<typeof NotNullViolationError>;
}

/**
 * Creates a ForeignKeyViolationError instance for testing purposes
 */
function createForeignKeyViolationError(message: string, table: string): InstanceType<typeof ForeignKeyViolationError> {
  const nativeError = new Error(message);
  const error = Object.create(ForeignKeyViolationError.prototype);
  error.message = message;
  error.name = 'ForeignKeyViolationError';
  error.nativeError = nativeError;
  error.stack = nativeError.stack;
  error.table = table;
  return error as InstanceType<typeof ForeignKeyViolationError>;
}

/**
 * Creates a CheckViolationError instance for testing purposes
 */
function createCheckViolationError(
  message: string,
  table: string,
  constraint: string,
): InstanceType<typeof CheckViolationError> {
  const nativeError = new Error(message);
  const error = Object.create(CheckViolationError.prototype);
  error.message = message;
  error.name = 'CheckViolationError';
  error.nativeError = nativeError;
  error.stack = nativeError.stack;
  error.table = table;
  error.constraint = constraint;
  return error as InstanceType<typeof CheckViolationError>;
}

/**
 * Creates a DataError instance for testing purposes
 */
function createDataError(message: string): InstanceType<typeof DataError> {
  const nativeError = new Error(message);
  const error = Object.create(DataError.prototype);
  error.message = message;
  error.name = 'DataError';
  error.nativeError = nativeError;
  error.stack = nativeError.stack;
  return error as InstanceType<typeof DataError>;
}

describe('AllExceptionFilters', () => {
  let filter: AllExceptionFilters;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { url: string; body: Record<string, unknown> };
  let mockArgumentsHost: ArgumentsHost;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new AllExceptionFilters();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockRequest = {
      url: '/api/test',
      body: {},
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;

    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('DBError handling', () => {
    const sqlErrorMessage = 'relation "users" does not exist';

    it('should return generic message in production environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const dbError = createDBError(sqlErrorMessage);

      filter.catch(dbError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'An unexpected error occurred. Please try again later.',
          type: 'UnknownDatabaseError',
          data: {},
          path: '/api/test',
        }),
      );
    });

    it('should return actual error message in non-production environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const dbError = createDBError(sqlErrorMessage);

      filter.catch(dbError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: sqlErrorMessage,
          type: 'UnknownDatabaseError',
          data: {},
          path: '/api/test',
        }),
      );
    });

    it('should log the database error with request URL and stack trace', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const dbError = createDBError(sqlErrorMessage);

      filter.catch(dbError, mockArgumentsHost);

      expect(loggerErrorSpy).toHaveBeenCalledWith(`Database error on /api/test: ${sqlErrorMessage}`, dbError.stack);
    });

    it('should log the database error even in non-production environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const dbError = createDBError(sqlErrorMessage);

      filter.catch(dbError, mockArgumentsHost);

      expect(loggerErrorSpy).toHaveBeenCalledWith(`Database error on /api/test: ${sqlErrorMessage}`, dbError.stack);
    });
  });

  describe('UniqueViolationError handling', () => {
    const sqlErrorMessage = 'duplicate key value violates unique constraint "users_email_unique"';
    const table = 'users';
    const columns = ['email'];
    const constraint = 'users_email_unique';

    it('should return generic message and hide data in production environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const error = createUniqueViolationError(sqlErrorMessage, table, columns, constraint);

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          message: 'A record with this information already exists.',
          type: 'UniqueViolationError',
          data: {},
          path: '/api/test',
        }),
      );
    });

    it('should return actual error message and data in non-production environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const error = createUniqueViolationError(sqlErrorMessage, table, columns, constraint);

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          message: sqlErrorMessage,
          type: 'UniqueViolationError',
          data: {
            columns,
            table,
            constraint,
          },
          path: '/api/test',
        }),
      );
    });

    it('should log the error with request URL and stack trace', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const error = createUniqueViolationError(sqlErrorMessage, table, columns, constraint);

      filter.catch(error, mockArgumentsHost);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Unique violation error on /api/test: ${sqlErrorMessage}`,
        error.stack,
      );
    });
  });

  describe('NotNullViolationError handling', () => {
    const sqlErrorMessage = 'null value in column "email" violates not-null constraint';
    const table = 'users';
    const column = 'email';

    it('should return generic message and hide data in production environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const error = createNotNullViolationError(sqlErrorMessage, table, column);

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'A required field is missing.',
          type: 'NotNullViolationError',
          data: {},
          path: '/api/test',
        }),
      );
    });

    it('should return actual error message and data in non-production environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const error = createNotNullViolationError(sqlErrorMessage, table, column);

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: sqlErrorMessage,
          type: 'NotNullViolationError',
          data: {
            column,
            table,
          },
          path: '/api/test',
        }),
      );
    });

    it('should log the error with request URL and stack trace', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const error = createNotNullViolationError(sqlErrorMessage, table, column);

      filter.catch(error, mockArgumentsHost);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Not null violation error on /api/test: ${sqlErrorMessage}`,
        error.stack,
      );
    });
  });

  describe('ForeignKeyViolationError handling', () => {
    const sqlErrorMessage = 'insert or update on table "orders" violates foreign key constraint "orders_user_id_fkey"';
    const table = 'orders';

    it('should return generic message in production environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const error = createForeignKeyViolationError(sqlErrorMessage, table);

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          message: 'Cannot complete this operation due to related data constraints.',
          type: 'ForeignKeyViolationError',
          data: {},
          path: '/api/test',
        }),
      );
    });

    it('should return actual error message with table name in non-production environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const error = createForeignKeyViolationError(sqlErrorMessage, table);

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          message: `Can not delete or update data because of a foreign key constraint violation on table: ${table}`,
          type: 'ForeignKeyViolationError',
          data: {},
          path: '/api/test',
        }),
      );
    });

    it('should log the error with request URL and stack trace', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const error = createForeignKeyViolationError(sqlErrorMessage, table);

      filter.catch(error, mockArgumentsHost);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Foreign key violation error on /api/test: ${sqlErrorMessage}`,
        error.stack,
      );
    });
  });

  describe('CheckViolationError handling', () => {
    const sqlErrorMessage = 'new row for relation "users" violates check constraint "users_age_check"';
    const table = 'users';
    const constraint = 'users_age_check';

    it('should return generic message and hide data in production environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const error = createCheckViolationError(sqlErrorMessage, table, constraint);

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'The provided data does not meet the required constraints.',
          type: 'CheckViolation',
          data: {},
          path: '/api/test',
        }),
      );
    });

    it('should return actual error message and data in non-production environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const error = createCheckViolationError(sqlErrorMessage, table, constraint);

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: sqlErrorMessage,
          type: 'CheckViolation',
          data: {
            table,
            constraint,
          },
          path: '/api/test',
        }),
      );
    });

    it('should log the error with request URL and stack trace', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const error = createCheckViolationError(sqlErrorMessage, table, constraint);

      filter.catch(error, mockArgumentsHost);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        `Check violation error on /api/test: ${sqlErrorMessage}`,
        error.stack,
      );
    });
  });

  describe('DataError handling', () => {
    const sqlErrorMessage = 'invalid input syntax for type integer: "abc"';

    it('should return generic message in production environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const error = createDataError(sqlErrorMessage);

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid data format provided.',
          type: 'InvalidData',
          data: {},
          path: '/api/test',
        }),
      );
    });

    it('should return actual error message in non-production environment', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const error = createDataError(sqlErrorMessage);

      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: sqlErrorMessage,
          type: 'InvalidData',
          data: {},
          path: '/api/test',
        }),
      );
    });

    it('should log the error with request URL and stack trace', () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const error = createDataError(sqlErrorMessage);

      filter.catch(error, mockArgumentsHost);

      expect(loggerErrorSpy).toHaveBeenCalledWith(`Data error on /api/test: ${sqlErrorMessage}`, error.stack);
    });
  });
});
