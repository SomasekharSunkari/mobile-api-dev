import { Logger } from 'winston';
import { LogLevel } from '../../config/logging/winston.interface';
import { RequestContext } from '../../config/request-context.config';
import { AppLoggerService } from './logger.service';

describe('AppLoggerService', () => {
  let service: AppLoggerService;
  let mockWinston: jest.Mocked<Logger>;

  beforeEach(() => {
    mockWinston = {
      log: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    service = new AppLoggerService(mockWinston);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('setContext', () => {
    it('should set the context', () => {
      service.setContext('TestContext');
      service.log('test message');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'test message',
        expect.objectContaining({
          context: 'TestContext',
        }),
      );
    });
  });

  describe('setDefaultMetadata', () => {
    it('should set default metadata', () => {
      service.setDefaultMetadata({ key1: 'value1' });
      service.log('test message');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'test message',
        expect.objectContaining({
          key1: 'value1',
        }),
      );
    });

    it('should merge with existing default metadata', () => {
      service.setDefaultMetadata({ key1: 'value1' });
      service.setDefaultMetadata({ key2: 'value2' });
      service.log('test message');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'test message',
        expect.objectContaining({
          key1: 'value1',
          key2: 'value2',
        }),
      );
    });
  });

  describe('clearDefaultMetadata', () => {
    it('should clear default metadata', () => {
      service.setDefaultMetadata({ key1: 'value1' });
      service.clearDefaultMetadata();
      service.log('test message');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'test message',
        expect.not.objectContaining({
          key1: 'value1',
        }),
      );
    });
  });

  describe('log', () => {
    it('should log info level message', () => {
      service.log('test message');

      expect(mockWinston.log).toHaveBeenCalledWith(LogLevel.INFO, 'test message', expect.any(Object));
    });

    it('should log with context', () => {
      service.log('test message', 'TestModule');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'test message',
        expect.objectContaining({
          context: 'TestModule',
        }),
      );
    });

    it('should log object message as JSON string', () => {
      const messageObj = { key: 'value' };
      service.log(messageObj);

      expect(mockWinston.log).toHaveBeenCalledWith(LogLevel.INFO, JSON.stringify(messageObj), expect.any(Object));
    });
  });

  describe('error', () => {
    it('should log error level message', () => {
      service.error('error message');

      expect(mockWinston.log).toHaveBeenCalledWith(LogLevel.ERROR, 'error message', expect.any(Object));
    });

    it('should log error with stack trace', () => {
      const stack = 'Error\n    at Test.fn';
      service.error('error message', stack);

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.ERROR,
        'error message',
        expect.objectContaining({
          stack,
          error: expect.objectContaining({
            message: 'error message',
            stack,
          }),
        }),
      );
    });

    it('should log error with context', () => {
      service.error('error message', undefined, 'ErrorContext');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.ERROR,
        'error message',
        expect.objectContaining({
          context: 'ErrorContext',
        }),
      );
    });
  });

  describe('warn', () => {
    it('should log warn level message', () => {
      service.warn('warning message');

      expect(mockWinston.log).toHaveBeenCalledWith(LogLevel.WARN, 'warning message', expect.any(Object));
    });

    it('should log warn with context', () => {
      service.warn('warning message', 'WarnContext');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.WARN,
        'warning message',
        expect.objectContaining({
          context: 'WarnContext',
        }),
      );
    });
  });

  describe('debug', () => {
    it('should log debug level message', () => {
      service.debug('debug message');

      expect(mockWinston.log).toHaveBeenCalledWith(LogLevel.DEBUG, 'debug message', expect.any(Object));
    });

    it('should log debug with context', () => {
      service.debug('debug message', 'DebugContext');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.DEBUG,
        'debug message',
        expect.objectContaining({
          context: 'DebugContext',
        }),
      );
    });
  });

  describe('verbose', () => {
    it('should log verbose level message', () => {
      service.verbose('verbose message');

      expect(mockWinston.log).toHaveBeenCalledWith(LogLevel.VERBOSE, 'verbose message', expect.any(Object));
    });

    it('should log verbose with context', () => {
      service.verbose('verbose message', 'VerboseContext');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.VERBOSE,
        'verbose message',
        expect.objectContaining({
          context: 'VerboseContext',
        }),
      );
    });
  });

  describe('logInfo', () => {
    it('should log info with context object', () => {
      service.logInfo('info message', { module: 'TestModule', userId: 'user-123' });

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'info message',
        expect.objectContaining({
          context: 'TestModule',
          userId: 'user-123',
        }),
      );
    });
  });

  describe('logError', () => {
    it('should log error with error object', () => {
      const error = new Error('Test error');
      service.logError('error occurred', error);

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.ERROR,
        'error occurred',
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'Error',
            message: 'Test error',
          }),
        }),
      );
    });

    it('should log error without error object', () => {
      service.logError('error occurred');

      expect(mockWinston.log).toHaveBeenCalledWith(LogLevel.ERROR, 'error occurred', expect.any(Object));
    });
  });

  describe('logWarn', () => {
    it('should log warn with context object', () => {
      service.logWarn('warning message', { module: 'TestModule' });

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.WARN,
        'warning message',
        expect.objectContaining({
          context: 'TestModule',
        }),
      );
    });
  });

  describe('logDebug', () => {
    it('should log debug with context object', () => {
      service.logDebug('debug message', { module: 'TestModule' });

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.DEBUG,
        'debug message',
        expect.objectContaining({
          context: 'TestModule',
        }),
      );
    });
  });

  describe('logHttpRequest', () => {
    it('should log HTTP request', () => {
      service.logHttpRequest('GET', '/api/users', 200);

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'GET /api/users 200',
        expect.objectContaining({
          statusCode: 200,
        }),
      );
    });

    it('should log HTTP request with context metadata', () => {
      service.logHttpRequest('POST', '/api/users', 201, {
        metadata: { duration: 150 },
      });

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'POST /api/users 201',
        expect.objectContaining({
          statusCode: 201,
          metadata: { duration: 150 },
        }),
      );
    });
  });

  describe('logPerformanceMetrics', () => {
    it('should log successful performance metrics', () => {
      service.logPerformanceMetrics({
        operation: 'database_query',
        duration: 100,
        success: true,
      });

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'Performance: database_query completed in 100ms [SUCCESS]',
        expect.objectContaining({
          operation: 'performance_metrics',
          metadata: expect.objectContaining({
            operation: 'database_query',
            duration: 100,
            success: true,
          }),
        }),
      );
    });

    it('should log failed performance metrics', () => {
      service.logPerformanceMetrics({
        operation: 'api_call',
        duration: 5000,
        success: false,
      });

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'Performance: api_call completed in 5000ms [FAILURE]',
        expect.objectContaining({
          operation: 'performance_metrics',
          metadata: expect.objectContaining({
            success: false,
          }),
        }),
      );
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security event', () => {
      service.logSecurityEvent({
        type: 'auth_failure',
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        details: { attempts: 3 },
      });

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.WARN,
        'Security Event: auth_failure',
        expect.objectContaining({
          userId: 'user-123',
          operation: 'security_event',
          metadata: expect.objectContaining({
            securityEventType: 'auth_failure',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            attempts: 3,
          }),
        }),
      );
    });

    it('should log security event with context userId override', () => {
      service.logSecurityEvent(
        {
          type: 'permission_denied',
          details: { resource: '/admin' },
        },
        { userId: 'context-user-456' },
      );

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.WARN,
        'Security Event: permission_denied',
        expect.objectContaining({
          userId: 'context-user-456',
        }),
      );
    });
  });

  describe('logBusinessEvent', () => {
    it('should log business event', () => {
      service.logBusinessEvent({
        type: 'payment_completed',
        userId: 'user-123',
        amount: 10000,
        currency: 'NGN',
        details: { transactionId: 'txn-456' },
      });

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'Business Event: payment_completed',
        expect.objectContaining({
          userId: 'user-123',
          operation: 'business_event',
          metadata: expect.objectContaining({
            businessEventType: 'payment_completed',
            amount: 10000,
            currency: 'NGN',
            transactionId: 'txn-456',
          }),
        }),
      );
    });

    it('should log business event with context userId override', () => {
      service.logBusinessEvent(
        {
          type: 'wallet_created',
          details: { walletType: 'fiat' },
        },
        { userId: 'context-user-789' },
      );

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'Business Event: wallet_created',
        expect.objectContaining({
          userId: 'context-user-789',
        }),
      );
    });
  });

  describe('logDatabaseOperation', () => {
    it('should log successful database operation', () => {
      service.logDatabaseOperation('SELECT', 'users', 50, true);

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.DEBUG,
        'DB Operation: SELECT on users - 50ms [SUCCESS]',
        expect.objectContaining({
          operation: 'database_operation',
          metadata: expect.objectContaining({
            dbOperation: 'SELECT',
            table: 'users',
            duration: 50,
            success: true,
          }),
        }),
      );
    });

    it('should log failed database operation with warn level', () => {
      service.logDatabaseOperation('INSERT', 'transactions', 200, false);

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.WARN,
        'DB Operation: INSERT on transactions - 200ms [FAILURE]',
        expect.objectContaining({
          metadata: expect.objectContaining({
            success: false,
          }),
        }),
      );
    });
  });

  describe('logExternalApiCall', () => {
    it('should log external API call', () => {
      service.logExternalApiCall('PaymentProvider', '/api/charge', 'POST', 200, 350);

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'External API: PaymentProvider POST /api/charge 200 - 350ms',
        expect.objectContaining({
          operation: 'external_api_call',
          metadata: expect.objectContaining({
            provider: 'PaymentProvider',
            endpoint: '/api/charge',
            method: 'POST',
            statusCode: 200,
            duration: 350,
          }),
        }),
      );
    });
  });

  describe('logUserAction', () => {
    it('should log user action', () => {
      service.logUserAction('login', 'user-123', { ipAddress: '192.168.1.1' });

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'User Action: login',
        expect.objectContaining({
          userId: 'user-123',
          operation: 'user_action',
          metadata: expect.objectContaining({
            action: 'login',
            ipAddress: '192.168.1.1',
          }),
        }),
      );
    });
  });

  describe('logSystemEvent', () => {
    it('should log system event with specified severity', () => {
      service.logSystemEvent('server_start', LogLevel.INFO, { port: 3000 });

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'System Event: server_start',
        expect.objectContaining({
          operation: 'system_event',
          metadata: expect.objectContaining({
            systemEvent: 'server_start',
            severity: LogLevel.INFO,
            port: 3000,
          }),
        }),
      );
    });

    it('should log system error event', () => {
      service.logSystemEvent('database_connection_failed', LogLevel.ERROR, { reason: 'timeout' });

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.ERROR,
        'System Event: database_connection_failed',
        expect.objectContaining({
          metadata: expect.objectContaining({
            severity: LogLevel.ERROR,
          }),
        }),
      );
    });
  });

  describe('logStructuredError', () => {
    it('should log structured error with correlation ID', () => {
      const error = new Error('Database connection failed');
      service.logStructuredError(error, 'corr-123', { query: 'SELECT * FROM users' });

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.ERROR,
        'Structured Error: Database connection failed',
        expect.objectContaining({
          requestId: 'corr-123',
          operation: 'structured_error',
          metadata: expect.objectContaining({
            errorType: 'Error',
            correlationId: 'corr-123',
            query: 'SELECT * FROM users',
          }),
          error: expect.objectContaining({
            name: 'Error',
            message: 'Database connection failed',
          }),
        }),
      );
    });

    it('should preserve error type in metadata', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('Custom error occurred');
      service.logStructuredError(error, 'corr-456');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.ERROR,
        'Structured Error: Custom error occurred',
        expect.objectContaining({
          metadata: expect.objectContaining({
            errorType: 'CustomError',
          }),
        }),
      );
    });
  });

  describe('createChild', () => {
    it('should create child logger with context', () => {
      const childLogger = service.createChild('ChildContext');

      childLogger.log('child message');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'child message',
        expect.objectContaining({
          context: 'ChildContext',
        }),
      );
    });

    it('should create child logger with inherited metadata', () => {
      service.setDefaultMetadata({ parentKey: 'parentValue' });
      const childLogger = service.createChild('ChildContext');

      childLogger.log('child message');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'child message',
        expect.objectContaining({
          parentKey: 'parentValue',
          context: 'ChildContext',
        }),
      );
    });

    it('should create child logger with additional metadata', () => {
      service.setDefaultMetadata({ parentKey: 'parentValue' });
      const childLogger = service.createChild('ChildContext', { childKey: 'childValue' });

      childLogger.log('child message');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'child message',
        expect.objectContaining({
          parentKey: 'parentValue',
          childKey: 'childValue',
          context: 'ChildContext',
        }),
      );
    });
  });

  describe('logWithLevel', () => {
    it('should log with custom level', () => {
      service.logWithLevel(LogLevel.WARN, 'custom level message', { module: 'TestModule' });

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.WARN,
        'custom level message',
        expect.objectContaining({
          context: 'TestModule',
        }),
      );
    });
  });

  describe('Request context integration', () => {
    it('should include request context when available', () => {
      const mockStore = {
        traceId: 'trace-123',
        userId: 'user-456',
        method: 'GET',
        url: '/api/test',
        timezone: 'UTC',
      };

      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      service.log('test message');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'test message',
        expect.objectContaining({
          requestId: 'trace-123',
          userId: 'user-456',
          method: 'GET',
          url: '/api/test',
        }),
      );
    });

    it('should use context values over request context when provided', () => {
      const mockStore = {
        traceId: 'trace-123',
        userId: 'user-456',
        timezone: 'UTC',
      };

      jest.spyOn(RequestContext, 'getStore').mockReturnValue(mockStore);

      service.logInfo('test message', { requestId: 'custom-trace', userId: 'custom-user' });

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'test message',
        expect.objectContaining({
          requestId: 'custom-trace',
          userId: 'custom-user',
        }),
      );
    });

    it('should handle undefined request context', () => {
      jest.spyOn(RequestContext, 'getStore').mockReturnValue(undefined);

      service.log('test message');

      expect(mockWinston.log).toHaveBeenCalledWith(LogLevel.INFO, 'test message', expect.any(Object));
    });
  });

  describe('Default context fallback', () => {
    it('should use Application as default context', () => {
      service.log('test message');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'test message',
        expect.objectContaining({
          context: 'Application',
        }),
      );
    });

    it('should use set context over Application default', () => {
      service.setContext('CustomContext');
      service.log('test message');

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'test message',
        expect.objectContaining({
          context: 'CustomContext',
        }),
      );
    });

    it('should use module from context over set context', () => {
      service.setContext('CustomContext');
      service.logInfo('test message', { module: 'ModuleOverride' });

      expect(mockWinston.log).toHaveBeenCalledWith(
        LogLevel.INFO,
        'test message',
        expect.objectContaining({
          context: 'ModuleOverride',
        }),
      );
    });
  });
});
