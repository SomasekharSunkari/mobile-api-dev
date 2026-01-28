import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { RedisCacheService } from '../../services/redis/redis-cache.service';
import { HTTP_CACHE_KEY, HttpCache, HttpCacheInterceptor, HttpCacheOptions } from './index';
// Import from parent index to cover src/interceptors/index.ts
import * as InterceptorsIndex from '../index';

describe('HttpCache decorator', () => {
  it('should apply decorator and return a function', () => {
    const decorator = HttpCache({ ttl: '1h' });
    expect(typeof decorator).toBe('function');
  });

  it('should apply decorator with default empty options', () => {
    const decorator = HttpCache();
    expect(typeof decorator).toBe('function');
  });
});

describe('Index exports', () => {
  it('should export HttpCacheInterceptor from parent index', () => {
    expect(InterceptorsIndex.HttpCacheInterceptor).toBeDefined();
  });
});

describe('HttpCacheInterceptor', () => {
  let interceptor: HttpCacheInterceptor;
  let reflector: Reflector;
  let redisCacheService: jest.Mocked<RedisCacheService>;

  const mockRequest = {
    method: 'GET',
    path: '/banks',
    query: {},
    headers: {},
  };

  const mockContext = {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;

  const mockCallHandler: CallHandler = {
    handle: () => of({ statusCode: 200, message: 'Success', data: [{ id: 1 }], timestamp: new Date().toISOString() }),
  };

  // Helper function to flush all pending promises - use process.nextTick for Node.js
  const flushPromises = (): Promise<void> =>
    new Promise((resolve) => {
      process.nextTick(resolve);
    });

  beforeEach(() => {
    reflector = new Reflector();
    redisCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    } as unknown as jest.Mocked<RedisCacheService>;

    interceptor = new HttpCacheInterceptor(reflector, redisCacheService);
  });

  describe('intercept', () => {
    it('should skip caching for non-GET requests', async () => {
      const postRequest = { ...mockRequest, method: 'POST' };
      const postContext = {
        ...mockContext,
        switchToHttp: () => ({
          getRequest: () => postRequest,
        }),
      } as unknown as ExecutionContext;

      const result$ = await interceptor.intercept(postContext, mockCallHandler);
      const result = await lastValueFrom(result$);

      expect(result.statusCode).toBe(200);
      expect(redisCacheService.get).not.toHaveBeenCalled();
      expect(redisCacheService.set).not.toHaveBeenCalled();
    });

    it('should return cached response if exists', async () => {
      const cachedResponse = {
        statusCode: 200,
        message: 'Cached',
        data: [{ id: 2 }],
        timestamp: new Date().toISOString(),
      };
      redisCacheService.get.mockResolvedValue(cachedResponse);

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result$ = await interceptor.intercept(mockContext, mockCallHandler);
      const result = await lastValueFrom(result$);

      expect(result).toEqual(cachedResponse);
      expect(redisCacheService.get).toHaveBeenCalled();
    });

    it('should cache response on cache miss', async () => {
      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result$ = await interceptor.intercept(mockContext, mockCallHandler);
      await lastValueFrom(result$);

      // Wait for the async tap operation to complete
      await flushPromises();

      expect(redisCacheService.set).toHaveBeenCalled();
    });

    it('should use custom TTL from decorator options (number)', async () => {
      const options: HttpCacheOptions = { ttl: 300 };
      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockImplementation((key: string) => {
        if (key === HTTP_CACHE_KEY) return options;
        return undefined;
      });

      const result$ = await interceptor.intercept(mockContext, mockCallHandler);
      await lastValueFrom(result$);

      // Wait for the async tap operation to complete
      await flushPromises();

      expect(redisCacheService.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 300);
    });

    it('should parse human-readable TTL string (e.g., "1h")', async () => {
      const options: HttpCacheOptions = { ttl: '1h' };
      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockImplementation((key: string) => {
        if (key === HTTP_CACHE_KEY) return options;
        return undefined;
      });

      const result$ = await interceptor.intercept(mockContext, mockCallHandler);
      await lastValueFrom(result$);

      // Wait for the async tap operation to complete
      await flushPromises();

      // 1h = 3600 seconds
      expect(redisCacheService.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 3600);
    });

    it('should parse human-readable TTL string (e.g., "30m")', async () => {
      const options: HttpCacheOptions = { ttl: '30m' };
      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockImplementation((key: string) => {
        if (key === HTTP_CACHE_KEY) return options;
        return undefined;
      });

      const result$ = await interceptor.intercept(mockContext, mockCallHandler);
      await lastValueFrom(result$);

      // Wait for the async tap operation to complete
      await flushPromises();

      // 30m = 1800 seconds
      expect(redisCacheService.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 1800);
    });

    it('should parse human-readable TTL string (e.g., "2d")', async () => {
      const options: HttpCacheOptions = { ttl: '2d' };
      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockImplementation((key: string) => {
        if (key === HTTP_CACHE_KEY) return options;
        return undefined;
      });

      const result$ = await interceptor.intercept(mockContext, mockCallHandler);
      await lastValueFrom(result$);

      // Wait for the async tap operation to complete
      await flushPromises();

      // 2d = 172800 seconds
      expect(redisCacheService.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 172800);
    });

    it('should include query params in cache key by default', async () => {
      const requestWithQuery = { ...mockRequest, query: { name: 'test', country_id: '1' } };
      const contextWithQuery = {
        ...mockContext,
        switchToHttp: () => ({
          getRequest: () => requestWithQuery,
        }),
      } as unknown as ExecutionContext;

      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result$ = await interceptor.intercept(contextWithQuery, mockCallHandler);
      await lastValueFrom(result$);

      // Wait for the async tap operation to complete
      await flushPromises();

      const cacheKey = redisCacheService.set.mock.calls[0][0] as string;
      expect(cacheKey).toContain('country_id');
      expect(cacheKey).toContain('name');
    });

    it('should use custom key prefix from options', async () => {
      const options: HttpCacheOptions = { keyPrefix: 'custom_prefix' };
      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockImplementation((key: string) => {
        if (key === HTTP_CACHE_KEY) return options;
        return undefined;
      });

      const result$ = await interceptor.intercept(mockContext, mockCallHandler);
      await lastValueFrom(result$);

      // Wait for the async tap operation to complete
      await flushPromises();

      const cacheKey = redisCacheService.set.mock.calls[0][0] as string;
      expect(cacheKey).toContain('custom_prefix');
    });

    it('should not cache error responses', async () => {
      const errorHandler: CallHandler = {
        handle: () => of({ statusCode: 400, message: 'Bad Request', data: null, timestamp: new Date().toISOString() }),
      };

      redisCacheService.get.mockResolvedValue(null);

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result$ = await interceptor.intercept(mockContext, errorHandler);
      await lastValueFrom(result$);

      // Wait for potential async operations
      await flushPromises();

      expect(redisCacheService.set).not.toHaveBeenCalled();
    });

    it('should include specified headers in cache key', async () => {
      const options: HttpCacheOptions = { includeHeaders: ['x-tenant-id'] };
      const requestWithHeaders = { ...mockRequest, headers: { 'x-tenant-id': 'tenant-123' } };
      const contextWithHeaders = {
        ...mockContext,
        switchToHttp: () => ({
          getRequest: () => requestWithHeaders,
        }),
      } as unknown as ExecutionContext;

      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockImplementation((key: string) => {
        if (key === HTTP_CACHE_KEY) return options;
        return undefined;
      });

      const result$ = await interceptor.intercept(contextWithHeaders, mockCallHandler);
      await lastValueFrom(result$);

      // Wait for the async tap operation to complete
      await flushPromises();

      const cacheKey = redisCacheService.set.mock.calls[0][0] as string;
      expect(cacheKey).toContain('x-tenant-id');
      expect(cacheKey).toContain('tenant-123');
    });

    it('should handle cache read errors gracefully', async () => {
      redisCacheService.get.mockRejectedValue(new Error('Redis connection error'));
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result$ = await interceptor.intercept(mockContext, mockCallHandler);
      const result = await lastValueFrom(result$);

      expect(result.statusCode).toBe(200);
    });

    it('should handle cache write errors gracefully', async () => {
      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockRejectedValue(new Error('Redis connection error'));

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result$ = await interceptor.intercept(mockContext, mockCallHandler);
      const result = await lastValueFrom(result$);

      expect(result.statusCode).toBe(200);
    });

    it('should exclude query params when includeQuery is false', async () => {
      const options: HttpCacheOptions = { includeQuery: false };
      const requestWithQuery = { ...mockRequest, query: { name: 'test' } };
      const contextWithQuery = {
        ...mockContext,
        switchToHttp: () => ({
          getRequest: () => requestWithQuery,
        }),
      } as unknown as ExecutionContext;

      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockImplementation((key: string) => {
        if (key === HTTP_CACHE_KEY) return options;
        return undefined;
      });

      const result$ = await interceptor.intercept(contextWithQuery, mockCallHandler);
      await lastValueFrom(result$);

      // Wait for the async tap operation to complete
      await flushPromises();

      const cacheKey = redisCacheService.set.mock.calls[0][0] as string;
      expect(cacheKey).not.toContain('name');
    });

    it('should include TTL in cache key so changing TTL invalidates old cache', async () => {
      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      // First request with TTL of 1h (3600 seconds)
      const options1h: HttpCacheOptions = { ttl: '1h' };
      jest.spyOn(reflector, 'get').mockImplementation((key: string) => {
        if (key === HTTP_CACHE_KEY) return options1h;
        return undefined;
      });

      const result1$ = await interceptor.intercept(mockContext, mockCallHandler);
      await lastValueFrom(result1$);
      await flushPromises();

      const cacheKey1h = redisCacheService.set.mock.calls[0][0] as string;
      expect(cacheKey1h).toContain('ttl:3600');

      // Reset mocks
      redisCacheService.set.mockClear();

      // Second request with TTL of 30m (1800 seconds)
      const options30m: HttpCacheOptions = { ttl: '30m' };
      jest.spyOn(reflector, 'get').mockImplementation((key: string) => {
        if (key === HTTP_CACHE_KEY) return options30m;
        return undefined;
      });

      const result2$ = await interceptor.intercept(mockContext, mockCallHandler);
      await lastValueFrom(result2$);
      await flushPromises();

      const cacheKey30m = redisCacheService.set.mock.calls[0][0] as string;
      expect(cacheKey30m).toContain('ttl:1800');

      // Cache keys should be different
      expect(cacheKey1h).not.toBe(cacheKey30m);
    });

    it('should use default TTL when invalid TTL format is provided', async () => {
      const options: HttpCacheOptions = { ttl: 'invalid-format' };
      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockImplementation((key: string) => {
        if (key === HTTP_CACHE_KEY) return options;
        return undefined;
      });

      const result$ = await interceptor.intercept(mockContext, mockCallHandler);
      await lastValueFrom(result$);
      await flushPromises();

      // Default TTL is '1m' = 60 seconds
      expect(redisCacheService.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 60);
    });

    it('should cache response with statusCode 299 (edge of successful range)', async () => {
      const edgeCaseHandler: CallHandler = {
        handle: () => of({ statusCode: 299, message: 'Success', data: null, timestamp: new Date().toISOString() }),
      };

      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result$ = await interceptor.intercept(mockContext, edgeCaseHandler);
      await lastValueFrom(result$);
      await flushPromises();

      expect(redisCacheService.set).toHaveBeenCalled();
    });

    it('should not cache response with statusCode 300', async () => {
      const redirectHandler: CallHandler = {
        handle: () => of({ statusCode: 300, message: 'Redirect', data: null, timestamp: new Date().toISOString() }),
      };

      redisCacheService.get.mockResolvedValue(null);

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result$ = await interceptor.intercept(mockContext, redirectHandler);
      await lastValueFrom(result$);
      await flushPromises();

      expect(redisCacheService.set).not.toHaveBeenCalled();
    });

    it('should cache response object without statusCode field', async () => {
      const noStatusCodeHandler: CallHandler = {
        handle: () => of({ message: 'Success', data: { id: 1 } }),
      };

      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result$ = await interceptor.intercept(mockContext, noStatusCodeHandler);
      await lastValueFrom(result$);
      await flushPromises();

      expect(redisCacheService.set).toHaveBeenCalled();
    });

    it('should cache primitive response (string)', async () => {
      const primitiveHandler: CallHandler = {
        handle: () => of('plain string response'),
      };

      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result$ = await interceptor.intercept(mockContext, primitiveHandler);
      await lastValueFrom(result$);
      await flushPromises();

      expect(redisCacheService.set).toHaveBeenCalled();
    });

    it('should cache primitive response (number)', async () => {
      const numberHandler: CallHandler = {
        handle: () => of(42),
      };

      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result$ = await interceptor.intercept(mockContext, numberHandler);
      await lastValueFrom(result$);
      await flushPromises();

      expect(redisCacheService.set).toHaveBeenCalled();
    });

    it('should cache null response', async () => {
      const nullHandler: CallHandler = {
        handle: () => of(null),
      };

      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const result$ = await interceptor.intercept(mockContext, nullHandler);
      await lastValueFrom(result$);
      await flushPromises();

      expect(redisCacheService.set).toHaveBeenCalled();
    });

    it('should handle empty includeHeaders array', async () => {
      const options: HttpCacheOptions = { includeHeaders: [] };
      const requestWithHeaders = { ...mockRequest, headers: { 'x-tenant-id': 'tenant-123' } };
      const contextWithHeaders = {
        ...mockContext,
        switchToHttp: () => ({
          getRequest: () => requestWithHeaders,
        }),
      } as unknown as ExecutionContext;

      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockImplementation((key: string) => {
        if (key === HTTP_CACHE_KEY) return options;
        return undefined;
      });

      const result$ = await interceptor.intercept(contextWithHeaders, mockCallHandler);
      await lastValueFrom(result$);
      await flushPromises();

      const cacheKey = redisCacheService.set.mock.calls[0][0] as string;
      expect(cacheKey).not.toContain('x-tenant-id');
    });

    it('should handle missing header values in includeHeaders', async () => {
      const options: HttpCacheOptions = { includeHeaders: ['x-missing-header'] };
      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockImplementation((key: string) => {
        if (key === HTTP_CACHE_KEY) return options;
        return undefined;
      });

      const result$ = await interceptor.intercept(mockContext, mockCallHandler);
      await lastValueFrom(result$);
      await flushPromises();

      const cacheKey = redisCacheService.set.mock.calls[0][0] as string;
      expect(cacheKey).toContain('x-missing-header:');
    });

    it('should use default TTL when ttl option is explicitly undefined', async () => {
      const options: HttpCacheOptions = { ttl: undefined };
      redisCacheService.get.mockResolvedValue(null);
      redisCacheService.set.mockResolvedValue('OK');

      jest.spyOn(reflector, 'get').mockImplementation((key: string) => {
        if (key === HTTP_CACHE_KEY) return options;
        return undefined;
      });

      const result$ = await interceptor.intercept(mockContext, mockCallHandler);
      await lastValueFrom(result$);
      await flushPromises();

      // Default TTL is '1m' = 60 seconds
      expect(redisCacheService.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 60);
    });
  });
});
