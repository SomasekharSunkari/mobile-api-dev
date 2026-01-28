import { Logger as NestLogger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import * as jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';
import { FireblocksAxiosHelper } from './fireblocks_http';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');

  const MockLogger: any = jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    verbose: jest.fn(),
  }));

  // keep the static helpers Nest calls internally
  MockLogger.overrideLogger = jest.fn();
  MockLogger.log = jest.fn();
  MockLogger.error = jest.fn();
  MockLogger.warn = jest.fn();
  MockLogger.debug = jest.fn();
  MockLogger.verbose = jest.fn();

  return { ...actual, Logger: MockLogger };
});

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    randomUUID: jest.fn().mockReturnValue('test-nonce'),
    createHash: jest.fn().mockImplementation(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('test-hash'),
    })),
  };
});

jest.mock('axios');
jest.mock('jsonwebtoken');

const mockAxiosInstance = {
  interceptors: { request: { use: jest.fn() } },
  request: jest.fn(),
} as unknown as AxiosInstance;

const mockConfig = {
  baseUrl: 'https://api.fireblocks.io',
  apiKey: 'test-api-key',
  privateKey: 'test-private-key',
  timeout: 5000,
};

/* stub the config provider Nest would inject */
jest.mock('../../../config', () => ({
  FireblocksConfigProvider: jest.fn().mockImplementation(() => ({
    getConfig: jest.fn().mockReturnValue(mockConfig),
  })),
}));

describe('FireblocksAxiosHelper', () => {
  let helper: FireblocksAxiosHelper;
  const MockLogger = NestLogger as unknown as jest.Mock;

  const mockLogger = { debug: jest.fn(), error: jest.fn() };

  beforeEach(() => {
    MockLogger.mockReturnValue(mockLogger);
    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
    helper = new FireblocksAxiosHelper();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize axios instance with correct config', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: mockConfig.baseUrl,
        timeout: mockConfig.timeout,
      });
    });

    it('should set up request interceptor', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });
  });

  describe('signRequest', () => {
    const mockRequestConfig: AxiosRequestConfig = {
      url: '/test',
      method: 'GET',
      data: { test: 'data' },
    };

    beforeEach(() => {
      (randomUUID as jest.Mock).mockReturnValue('test-nonce');
      (createHash as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('test-hash'),
      });
      (jwt.sign as jest.Mock).mockReturnValue('test-token');
    });

    it('should sign the request correctly', () => {
      const now = Math.floor(Date.now() / 1000);
      const result = helper['signRequest'](mockRequestConfig);

      expect(randomUUID).toHaveBeenCalled();
      expect(createHash).toHaveBeenCalledWith('sha256');
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          uri: '/test',
          nonce: 'test-nonce',
          iat: now,
          exp: now + 30,
          sub: mockConfig.apiKey, // Use mockConfig instead of config
          bodyHash: 'test-hash',
        },
        mockConfig.privateKey, // Use mockConfig instead of config
        { algorithm: 'RS256' },
      );

      expect(result.headers).toEqual({
        'X-API-Key': mockConfig.apiKey,
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      });
    });

    it('should handle string data correctly', () => {
      const stringConfig: AxiosRequestConfig = {
        url: '/test',
        method: 'GET',
        data: 'test-string',
      };

      helper['signRequest'](stringConfig);
      expect(createHash).toHaveBeenCalledWith('sha256');
    });

    it('should handle empty data correctly', () => {
      const emptyConfig: AxiosRequestConfig = {
        url: '/test',
        method: 'GET',
      };

      helper['signRequest'](emptyConfig);
      expect(createHash).toHaveBeenCalledWith('sha256');
    });

    it('should log and rethrow errors', () => {
      const error = new Error('Signing error');
      (jwt.sign as jest.Mock).mockImplementation(() => {
        throw error;
      });

      expect(() => helper['signRequest'](mockConfig)).toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith('Error while signing Fireblocks request', expect.any(String));
    });
  });

  describe('handleRequest', () => {
    const okRes: AxiosResponse = {
      data: { test: 'data' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} } as InternalAxiosRequestConfig,
    };

    beforeEach(() => {
      (mockAxiosInstance.request as jest.Mock).mockResolvedValue(okRes);
    });

    it('should make request and return response', async () => {
      const cfg: AxiosRequestConfig = { url: '/test', method: 'GET' };
      const res = await helper['handleRequest'](cfg);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(cfg);
      expect(mockLogger.debug).toHaveBeenCalledWith('Making request to Fireblocks: GET /test');
      expect(mockLogger.debug).toHaveBeenCalledWith('Received response with status 200 from /test');
      expect(res).toEqual({ data: okRes.data, status: 200, statusText: 'OK' });
    });

    it('should handle axios error with response data', async () => {
      const err = {
        isAxiosError: true,
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: { message: 'Invalid request', code: 'VALIDATION_ERROR' },
        },
        stack: 'error stack',
      };
      (mockAxiosInstance.request as jest.Mock).mockRejectedValue(err);

      await expect(helper['handleRequest']({ url: '/test' })).rejects.toMatchObject({
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: { message: 'Invalid request', code: 'VALIDATION_ERROR' },
        },
      });
    });

    it('should handle axios error without code', async () => {
      const err = {
        isAxiosError: true,
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: { message: 'Invalid request' },
        },
        stack: 'error stack',
      };
      (mockAxiosInstance.request as jest.Mock).mockRejectedValue(err);

      await expect(helper['handleRequest']({ url: '/test' })).rejects.toMatchObject({
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: { message: 'Invalid request' },
        },
      });
    });

    it('should handle axios error without response data', async () => {
      const err = {
        isAxiosError: true,
        response: { status: 500, statusText: 'Server Error' },
        stack: 'error stack',
      };
      (mockAxiosInstance.request as jest.Mock).mockRejectedValue(err);

      await expect(helper['handleRequest']({ url: '/test' })).rejects.toMatchObject({
        response: { status: 500, statusText: 'Server Error' },
      });
    });

    it('should handle non-axios errors', async () => {
      const err = new Error('Unexpected');
      (mockAxiosInstance.request as jest.Mock).mockRejectedValue(err);

      await expect(helper['handleRequest']({ url: '/test' })).rejects.toThrow(err);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('HTTP methods', () => {
    const mockResponse = {
      data: { test: 'data' },
      status: 200,
      statusText: 'OK',
    };

    beforeEach(() => {
      jest.spyOn(helper as any, 'handleRequest').mockResolvedValue(mockResponse);
    });

    describe('get', () => {
      it('should make GET request without idempotency key', async () => {
        const result = await helper.get('/test', { param: 'value' });
        expect(helper['handleRequest']).toHaveBeenCalledWith({
          method: 'GET',
          url: '/test',
          params: { param: 'value' },
        });
        expect(result).toEqual(mockResponse);
      });

      it('should make GET request with idempotency key', async () => {
        const result = await helper.get('/test', { param: 'value' }, 'test-key');
        expect(helper['handleRequest']).toHaveBeenCalledWith({
          method: 'GET',
          url: '/test',
          params: { param: 'value' },
          headers: { 'Idempotency-Key': 'test-key' },
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('post', () => {
      it('should make POST request without idempotency key', async () => {
        const result = await helper.post('/test', { test: 'data' });
        expect(helper['handleRequest']).toHaveBeenCalledWith({
          method: 'POST',
          url: '/test',
          data: { test: 'data' },
        });
        expect(result).toEqual(mockResponse);
      });

      it('should make POST request with idempotency key', async () => {
        const result = await helper.post('/test', { test: 'data' }, 'test-key');
        expect(helper['handleRequest']).toHaveBeenCalledWith({
          method: 'POST',
          url: '/test',
          data: { test: 'data' },
          headers: { 'Idempotency-Key': 'test-key' },
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('put', () => {
      it('should make PUT request without idempotency key', async () => {
        const result = await helper.put('/test', { test: 'data' });
        expect(helper['handleRequest']).toHaveBeenCalledWith({
          method: 'PUT',
          url: '/test',
          data: { test: 'data' },
        });
        expect(result).toEqual(mockResponse);
      });

      it('should make PUT request with idempotency key', async () => {
        const result = await helper.put('/test', { test: 'data' }, 'test-key');
        expect(helper['handleRequest']).toHaveBeenCalledWith({
          method: 'PUT',
          url: '/test',
          data: { test: 'data' },
          headers: { 'Idempotency-Key': 'test-key' },
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('patch', () => {
      it('should make PATCH request without idempotency key', async () => {
        const result = await helper.patch('/test', { test: 'data' });
        expect(helper['handleRequest']).toHaveBeenCalledWith({
          method: 'PATCH',
          url: '/test',
          data: { test: 'data' },
        });
        expect(result).toEqual(mockResponse);
      });

      it('should make PATCH request with idempotency key', async () => {
        const result = await helper.patch('/test', { test: 'data' }, 'test-key');
        expect(helper['handleRequest']).toHaveBeenCalledWith({
          method: 'PATCH',
          url: '/test',
          data: { test: 'data' },
          headers: { 'Idempotency-Key': 'test-key' },
        });
        expect(result).toEqual(mockResponse);
      });
    });

    describe('delete', () => {
      it('should make DELETE request without idempotency key', async () => {
        const result = await helper.delete('/test');
        expect(helper['handleRequest']).toHaveBeenCalledWith({
          method: 'DELETE',
          url: '/test',
        });
        expect(result).toEqual(mockResponse);
      });

      it('should make DELETE request with idempotency key', async () => {
        const result = await helper.delete('/test', 'test-key');
        expect(helper['handleRequest']).toHaveBeenCalledWith({
          method: 'DELETE',
          url: '/test',
          headers: { 'Idempotency-Key': 'test-key' },
        });
        expect(result).toEqual(mockResponse);
      });
    });
  });

  describe('signRequest (URI parameter handling)', () => {
    const mockRequestConfig: AxiosRequestConfig = {
      url: '/test',
      method: 'GET',
      data: { test: 'data' },
    };

    beforeEach(() => {
      (randomUUID as jest.Mock).mockReturnValue('test-nonce');
      (createHash as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('test-hash'),
      });
      (jwt.sign as jest.Mock).mockReturnValue('test-token');
    });

    it('should include query parameters in the signed URI', () => {
      const configWithParams = {
        ...mockRequestConfig,
        params: { param1: 'value1', param2: 'value2' },
      };

      helper['signRequest'](configWithParams);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: '/test?param1=value1&param2=value2',
        }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should handle existing query parameters in URL', () => {
      const configWithExistingParams = {
        ...mockRequestConfig,
        url: '/test?existing=param',
        params: { newParam: 'value' },
      };

      helper['signRequest'](configWithExistingParams);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: '/test?existing=param&newParam=value',
        }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should handle empty parameters object', () => {
      const configWithEmptyParams = {
        ...mockRequestConfig,
        params: {},
      };

      helper['signRequest'](configWithEmptyParams);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: '/test',
        }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should handle undefined parameters', () => {
      const configWithUndefinedParams = {
        ...mockRequestConfig,
        params: undefined,
      };

      helper['signRequest'](configWithUndefinedParams);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: '/test',
        }),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('handlePaginatedRequest', () => {
    const mockPaginatedResponse = {
      data: [{ id: 'tx1' }, { id: 'tx2' }],
      status: 200,
      statusText: 'OK',
      headers: {
        'prev-page': 'prev-page-token',
        'next-page': 'next-page-token',
      },
    };

    beforeEach(() => {
      (mockAxiosInstance.request as jest.Mock).mockResolvedValue(mockPaginatedResponse);
    });

    it('should make paginated request and return response with page details', async () => {
      const cfg: AxiosRequestConfig = { url: '/test', method: 'GET' };
      const res = await helper['handlePaginatedRequest'](cfg);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(cfg);
      expect(mockLogger.debug).toHaveBeenCalledWith('Making paginated request to Fireblocks: GET /test');
      expect(mockLogger.debug).toHaveBeenCalledWith('Received paginated response with status 200 from /test');
      expect(res).toEqual({
        data: {
          transactions: mockPaginatedResponse.data,
          pageDetails: {
            prevPage: 'prev-page-token',
            nextPage: 'next-page-token',
          },
        },
        status: 200,
        statusText: 'OK',
      });
    });

    it('should handle error in paginated request', async () => {
      const error = new Error('Paginated request failed');
      (mockAxiosInstance.request as jest.Mock).mockRejectedValue(error);

      await expect(helper['handlePaginatedRequest']({ url: '/test' })).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith('Error in paginated request', expect.any(String));
    });
  });

  describe('getPaginated', () => {
    const mockPaginatedResponse = {
      data: {
        transactions: [{ id: 'tx1' }, { id: 'tx2' }],
        pageDetails: {
          prevPage: 'prev-page-token',
          nextPage: 'next-page-token',
        },
      },
      status: 200,
      statusText: 'OK',
    };

    beforeEach(() => {
      jest.spyOn(helper as any, 'handlePaginatedRequest').mockResolvedValue(mockPaginatedResponse);
    });

    it('should make GET request for paginated data without idempotency key', async () => {
      const result = await helper.getPaginated('/test', { param: 'value' });
      expect(helper['handlePaginatedRequest']).toHaveBeenCalledWith({
        method: 'GET',
        url: '/test',
        params: { param: 'value' },
      });
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should make GET request for paginated data with idempotency key', async () => {
      const result = await helper.getPaginated('/test', { param: 'value' }, 'test-key');
      expect(helper['handlePaginatedRequest']).toHaveBeenCalledWith({
        method: 'GET',
        url: '/test',
        params: { param: 'value' },
        headers: { 'Idempotency-Key': 'test-key' },
      });
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should handle missing pagination headers', async () => {
      const responseWithoutHeaders = {
        data: {
          transactions: [{ id: 'tx1' }, { id: 'tx2' }],
          pageDetails: {
            prevPage: undefined,
            nextPage: undefined,
          },
        },
        status: 200,
        statusText: 'OK',
      };
      jest.spyOn(helper as any, 'handlePaginatedRequest').mockResolvedValue(responseWithoutHeaders);

      const result = await helper.getPaginated('/test');
      expect(result.data.pageDetails).toEqual({
        prevPage: undefined,
        nextPage: undefined,
      });
    });
  });
});
