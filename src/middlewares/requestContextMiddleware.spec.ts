import { Test, TestingModule } from '@nestjs/testing';
import { NextFunction, Request, Response } from 'express';
import { RequestContext } from '../config/request-context.config';
import { RequestContextMiddleware } from './requestContextMiddleware';

describe('RequestContextMiddleware', () => {
  let middleware: RequestContextMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let capturedContext: any;
  let headersStore: Record<string, string>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RequestContextMiddleware],
    }).compile();

    middleware = module.get<RequestContextMiddleware>(RequestContextMiddleware);

    headersStore = {};

    mockRequest = {
      headers: headersStore,
      header: jest.fn((name: string) => headersStore[name.toLowerCase()]) as any,
      method: 'GET',
      originalUrl: '/api/test',
      url: '/api/test',
      protocol: 'https',
      get: jest.fn((name: string) => {
        if (name === 'host') return 'localhost:3000';
        return undefined;
      }) as any,
    };

    mockResponse = {
      locals: {},
      setHeader: jest.fn(),
    };

    capturedContext = null;
    nextFunction = jest.fn(() => {
      capturedContext = RequestContext.getStore();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('use', () => {
    it('should set default timezone to UTC when x-timezone header is not provided', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(capturedContext.timezone).toBe('UTC');
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should use provided x-timezone header', () => {
      headersStore['x-timezone'] = 'America/New_York';

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(capturedContext.timezone).toBe('America/New_York');
    });

    it('should generate a UUID for traceId when x-trace-id header is not provided', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      // Verify traceId is a valid UUID format
      expect(capturedContext.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should use provided x-trace-id header', () => {
      headersStore['x-trace-id'] = 'custom-trace-id';

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(capturedContext.traceId).toBe('custom-trace-id');
    });

    it('should set x-trace-id in response headers', () => {
      headersStore['x-trace-id'] = 'response-trace-id';

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-trace-id', 'response-trace-id');
    });

    it('should set generated x-trace-id in response headers when not provided', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-trace-id', expect.any(String));
    });

    it('should set userId from res.locals when available', () => {
      mockResponse.locals = { userId: 'user-123' };

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(capturedContext.userId).toBe('user-123');
    });

    it('should set userId to undefined when not in res.locals', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(capturedContext.userId).toBeUndefined();
    });

    it('should capture HTTP method from request', () => {
      mockRequest.method = 'POST';

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(capturedContext.method).toBe('POST');
    });

    it('should use originalUrl for path when available', () => {
      mockRequest.originalUrl = '/api/v1/users';
      mockRequest.url = '/users';

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(capturedContext.path).toBe('/api/v1/users');
    });

    it('should fallback to url when originalUrl is empty', () => {
      mockRequest.originalUrl = '';
      mockRequest.url = '/fallback/path';

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(capturedContext.path).toBe('/fallback/path');
    });

    it('should construct full URL correctly', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(capturedContext.url).toBe('https://localhost:3000/api/test');
    });

    it('should capture x-app-version header when provided', () => {
      headersStore['x-app-version'] = '1.2.3';

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(capturedContext.appVersion).toBe('1.2.3');
    });

    it('should set appVersion to undefined when x-app-version header is not provided', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(capturedContext.appVersion).toBeUndefined();
    });

    it('should capture x-device-type header when provided', () => {
      headersStore['x-device-type'] = 'iOS';

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(capturedContext.deviceType).toBe('iOS');
    });

    it('should set deviceType to undefined when x-device-type header is not provided', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(capturedContext.deviceType).toBeUndefined();
    });

    it('should capture all headers together', () => {
      headersStore['x-timezone'] = 'Europe/London';
      headersStore['x-trace-id'] = 'trace-456';
      headersStore['x-app-version'] = '2.0.0';
      headersStore['x-device-type'] = 'Android';
      mockResponse.locals = { userId: 'user-789' };
      mockRequest.method = 'PUT';
      mockRequest.originalUrl = '/api/v2/resource';

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(capturedContext).toEqual({
        timezone: 'Europe/London',
        traceId: 'trace-456',
        userId: 'user-789',
        method: 'PUT',
        path: '/api/v2/resource',
        url: 'https://localhost:3000/api/v2/resource',
        appVersion: '2.0.0',
        deviceType: 'Android',
      });
    });

    it('should call next function', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledTimes(1);
    });
  });
});
