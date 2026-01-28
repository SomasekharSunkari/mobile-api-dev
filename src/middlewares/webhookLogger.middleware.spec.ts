import { Test, TestingModule } from '@nestjs/testing';
import { NextFunction, Request, Response } from 'express';
import { AppLoggerService } from '../services/logger/logger.service';
import { WebhookLoggerMiddleware } from './webhookLogger.middleware';

describe('WebhookLoggerMiddleware', () => {
  let middleware: WebhookLoggerMiddleware;
  let mockAppLoggerService: jest.Mocked<AppLoggerService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(async () => {
    mockAppLoggerService = {
      logHttpRequest: jest.fn(),
      logInfo: jest.fn(),
      logDebug: jest.fn(),
      logWarn: jest.fn(),
      logError: jest.fn(),
      setContext: jest.fn(),
    } as unknown as jest.Mocked<AppLoggerService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookLoggerMiddleware,
        {
          provide: AppLoggerService,
          useValue: mockAppLoggerService,
        },
      ],
    }).compile();

    middleware = module.get<WebhookLoggerMiddleware>(WebhookLoggerMiddleware);
    mockNext = jest.fn();
    mockResponse = {};
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('use', () => {
    it('should call next without logging for non-webhook URLs', async () => {
      mockRequest = {
        baseUrl: '/api/users',
        method: 'GET',
        originalUrl: '/api/users/123',
        body: { id: 123 },
        headers: { 'content-type': 'application/json' },
      };

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockAppLoggerService.logHttpRequest).not.toHaveBeenCalled();
    });

    it('should log and call next for webhook URLs', async () => {
      mockRequest = {
        baseUrl: '/webhooks/paga',
        method: 'POST',
        originalUrl: '/webhooks/paga/callback',
        body: { transactionId: 'TXN_123' },
        headers: { 'content-type': 'application/json', authorization: 'Basic xyz' },
      };

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAppLoggerService.logHttpRequest).toHaveBeenCalledWith('POST', '/webhooks/paga/callback', 200, {
        body: { transactionId: 'TXN_123' },
        headers: { 'content-type': 'application/json', authorization: 'Basic xyz' },
        operation: 'http_request',
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should log for URLs containing /webhooks/', async () => {
      mockRequest = {
        baseUrl: '/api/v1/webhooks',
        method: 'POST',
        originalUrl: '/api/v1/webhooks/sumsub',
        body: { applicantId: 'APP_123' },
        headers: { 'x-custom-header': 'value' },
      };

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAppLoggerService.logHttpRequest).toHaveBeenCalledWith('POST', '/api/v1/webhooks/sumsub', 200, {
        body: { applicantId: 'APP_123' },
        headers: { 'x-custom-header': 'value' },
        operation: 'http_request',
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle empty body', async () => {
      mockRequest = {
        baseUrl: '/webhooks/test',
        method: 'POST',
        originalUrl: '/webhooks/test',
        body: {},
        headers: {},
      };

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAppLoggerService.logHttpRequest).toHaveBeenCalledWith('POST', '/webhooks/test', 200, {
        body: {},
        headers: {},
        operation: 'http_request',
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle undefined body', async () => {
      mockRequest = {
        baseUrl: '/webhooks/test',
        method: 'POST',
        originalUrl: '/webhooks/test',
        body: undefined,
        headers: {},
      };

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAppLoggerService.logHttpRequest).toHaveBeenCalledWith('POST', '/webhooks/test', 200, {
        body: undefined,
        headers: {},
        operation: 'http_request',
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle various HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

      for (const method of methods) {
        mockNext.mockClear();
        mockAppLoggerService.logHttpRequest.mockClear();

        mockRequest = {
          baseUrl: '/webhooks/test',
          method,
          originalUrl: '/webhooks/test',
          body: {},
          headers: {},
        };

        await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockAppLoggerService.logHttpRequest).toHaveBeenCalledWith(method, '/webhooks/test', 200, {
          body: {},
          headers: {},
          operation: 'http_request',
        });
        expect(mockNext).toHaveBeenCalled();
      }
    });

    it('should not log for paths that do not contain /webhooks/', async () => {
      const nonWebhookPaths = ['/api/webhook', '/webhook', '/api/webhoo/test', '/api/users/callback'];

      for (const baseUrl of nonWebhookPaths) {
        mockNext.mockClear();
        mockAppLoggerService.logHttpRequest.mockClear();

        mockRequest = {
          baseUrl,
          method: 'POST',
          originalUrl: baseUrl,
          body: {},
          headers: {},
        };

        await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockAppLoggerService.logHttpRequest).not.toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalled();
      }
    });

    it('should log complex request body', async () => {
      const complexBody = {
        transactionId: 'TXN_123',
        amount: 5000,
        currency: 'NGN',
        nested: {
          level1: {
            level2: {
              value: 'deep',
            },
          },
        },
        array: [1, 2, 3],
      };

      mockRequest = {
        baseUrl: '/webhooks/payment',
        method: 'POST',
        originalUrl: '/webhooks/payment/callback',
        body: complexBody,
        headers: { 'content-type': 'application/json' },
      };

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAppLoggerService.logHttpRequest).toHaveBeenCalledWith('POST', '/webhooks/payment/callback', 200, {
        body: complexBody,
        headers: { 'content-type': 'application/json' },
        operation: 'http_request',
      });
    });

    it('should log all request headers', async () => {
      const headers = {
        'content-type': 'application/json',
        authorization: 'Bearer token123',
        'x-custom-header': 'custom-value',
        'x-request-id': 'req-123',
        'user-agent': 'TestAgent/1.0',
      };

      mockRequest = {
        baseUrl: '/webhooks/test',
        method: 'POST',
        originalUrl: '/webhooks/test',
        body: {},
        headers,
      };

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAppLoggerService.logHttpRequest).toHaveBeenCalledWith('POST', '/webhooks/test', 200, {
        body: {},
        headers,
        operation: 'http_request',
      });
    });
  });

  describe('URL matching', () => {
    it('should match case-sensitive /webhooks/', async () => {
      mockRequest = {
        baseUrl: '/WEBHOOKS/test',
        method: 'POST',
        originalUrl: '/WEBHOOKS/test',
        body: {},
        headers: {},
      };

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAppLoggerService.logHttpRequest).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should match /webhooks at any position in baseUrl', async () => {
      mockRequest = {
        baseUrl: '/api/v2/webhooks/provider',
        method: 'POST',
        originalUrl: '/api/v2/webhooks/provider/callback',
        body: {},
        headers: {},
      };

      await middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockAppLoggerService.logHttpRequest).toHaveBeenCalled();
    });
  });
});
