import axios, { AxiosInstance } from 'axios';
import { RainConfigProvider } from '../../../config/rain.config';
import { RainAxiosHelper } from './rain.axios-helper';
import { IRainResponse } from './rain.interface';

// Mock axios and config
jest.mock('axios');
jest.mock('../../../config/rain.config');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedRainConfigProvider = RainConfigProvider as jest.MockedClass<typeof RainConfigProvider>;

describe('RainAxiosHelper', () => {
  let rainAxiosHelper: RainAxiosHelper;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;
  let mockConfig: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock configuration
    mockConfig = {
      apiKey: 'test-api-key',
      apiUrl: 'https://api.test.rain.com',
      pem: 'test-pem-key',
      secret: 'test-secret-key',
    };

    // Mock axios instance
    mockAxiosInstance = {
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      head: jest.fn(),
      options: jest.fn(),
      postForm: jest.fn(),
      putForm: jest.fn(),
      patchForm: jest.fn(),
      getUri: jest.fn(),
      defaults: {} as any,
      interceptors: {
        request: { use: jest.fn(), eject: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn() },
      } as any,
    } as unknown as jest.Mocked<AxiosInstance>;

    // Mock axios.create to return our mock instance
    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Mock RainConfigProvider
    MockedRainConfigProvider.mockImplementation(() => ({
      getConfig: jest.fn().mockReturnValue(mockConfig),
    }));

    // Create instance of RainAxiosHelper
    rainAxiosHelper = new RainAxiosHelper();
  });

  describe('constructor', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: mockConfig.apiUrl,
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'API-Key': mockConfig.apiKey,
        },
      });
    });

    it('should initialize with Rain configuration', () => {
      expect(MockedRainConfigProvider).toHaveBeenCalled();
    });
  });

  describe('get method', () => {
    it('should make GET request with correct configuration', async () => {
      const mockResponse: IRainResponse = {
        data: { result: 'success' },
        status: 200,
        statusText: 'OK',
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const path = '/test-endpoint';
      const params = { page: 1, limit: 10 };
      const headers = { 'Custom-Header': 'custom-value' };

      const result = await rainAxiosHelper.get(path, params, headers);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: path,
        params,
        headers,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should make GET request without optional parameters', async () => {
      const mockResponse: IRainResponse = {
        data: { result: 'success' },
        status: 200,
        statusText: 'OK',
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const path = '/test-endpoint';
      const result = await rainAxiosHelper.get(path);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: path,
        params: undefined,
        headers: undefined,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle GET request errors', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(rainAxiosHelper.get('/test-endpoint')).rejects.toThrow('Network error');
    });
  });

  describe('post method', () => {
    it('should make POST request with correct configuration', async () => {
      const mockResponse: IRainResponse = {
        data: { id: '123', created: true },
        status: 201,
        statusText: 'Created',
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const path = '/create-user';
      const body = { name: 'John Doe', email: 'john@example.com' };
      const headers = { 'Content-Type': 'multipart/form-data' };

      const result = await rainAxiosHelper.post(path, body, headers);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: path,
        data: body,
        headers,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should make POST request without optional parameters', async () => {
      const mockResponse: IRainResponse = {
        data: { id: '123' },
        status: 201,
        statusText: 'Created',
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const path = '/create-user';
      const result = await rainAxiosHelper.post(path);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: path,
        data: undefined,
        headers: undefined,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle POST request errors', async () => {
      const error = new Error('Validation error');
      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(rainAxiosHelper.post('/create-user', { invalid: 'data' })).rejects.toThrow('Validation error');
    });
  });

  describe('put method', () => {
    it('should make PUT request with correct configuration', async () => {
      const mockResponse: IRainResponse = {
        data: { id: '123', updated: true },
        status: 200,
        statusText: 'OK',
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const path = '/update-user/123';
      const body = { name: 'Jane Doe', email: 'jane@example.com' };
      const headers = { Authorization: 'Bearer token' };

      const result = await rainAxiosHelper.put(path, body, headers);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'PUT',
        url: path,
        data: body,
        headers,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should make PUT request without optional parameters', async () => {
      const mockResponse: IRainResponse = {
        data: { id: '123', updated: true },
        status: 200,
        statusText: 'OK',
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const path = '/update-user/123';
      const result = await rainAxiosHelper.put(path);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'PUT',
        url: path,
        data: undefined,
        headers: undefined,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle PUT request errors', async () => {
      const error = new Error('Update failed');
      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(rainAxiosHelper.put('/update-user/123', { name: 'Updated' })).rejects.toThrow('Update failed');
    });
  });

  describe('patch method', () => {
    it('should make PATCH request with correct configuration', async () => {
      const mockResponse: IRainResponse = {
        data: { id: '123', patched: true },
        status: 200,
        statusText: 'OK',
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const path = '/patch-user/123';
      const body = { email: 'newemail@example.com' };
      const headers = { 'X-Custom-Header': 'value' };

      const result = await rainAxiosHelper.patch(path, body, headers);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'PATCH',
        url: path,
        data: body,
        headers,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should make PATCH request without optional parameters', async () => {
      const mockResponse: IRainResponse = {
        data: { id: '123', patched: true },
        status: 200,
        statusText: 'OK',
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const path = '/patch-user/123';
      const result = await rainAxiosHelper.patch(path);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'PATCH',
        url: path,
        data: undefined,
        headers: undefined,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle PATCH request errors', async () => {
      const error = new Error('Patch failed');
      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(rainAxiosHelper.patch('/patch-user/123', { email: 'invalid' })).rejects.toThrow('Patch failed');
    });
  });

  describe('delete method', () => {
    it('should make DELETE request with correct configuration', async () => {
      const mockResponse: IRainResponse = {
        data: { deleted: true },
        status: 200,
        statusText: 'OK',
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const path = '/delete-user/123';
      const headers = { Authorization: 'Bearer token' };

      const result = await rainAxiosHelper.delete(path, headers);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'DELETE',
        url: path,
        headers,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should make DELETE request without optional headers', async () => {
      const mockResponse: IRainResponse = {
        data: { deleted: true },
        status: 200,
        statusText: 'OK',
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const path = '/delete-user/123';
      const result = await rainAxiosHelper.delete(path);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'DELETE',
        url: path,
        headers: undefined,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle DELETE request errors', async () => {
      const error = new Error('Delete failed');
      mockAxiosInstance.request.mockRejectedValue(error);

      await expect(rainAxiosHelper.delete('/delete-user/123')).rejects.toThrow('Delete failed');
    });
  });

  describe('getAxiosInstance', () => {
    it('should return the underlying axios instance', () => {
      const instance = rainAxiosHelper.getAxiosInstance();
      expect(instance).toBe(mockAxiosInstance);
    });
  });

  describe('getConfig', () => {
    it('should return the Rain configuration', () => {
      const config = rainAxiosHelper.getConfig();
      expect(config).toEqual(mockConfig);
    });
  });

  describe('Generic typing', () => {
    it('should support generic types for request and response', async () => {
      interface TestRequest {
        name: string;
        age: number;
      }

      interface TestResponse {
        id: string;
        success: boolean;
      }

      const mockResponse: IRainResponse<TestResponse> = {
        data: { id: '123', success: true },
        status: 200,
        statusText: 'OK',
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const requestData: TestRequest = { name: 'John', age: 30 };
      const result = await rainAxiosHelper.post<TestRequest, TestResponse>('/typed-endpoint', requestData);

      expect(result.data.id).toBe('123');
      expect(result.data.success).toBe(true);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/typed-endpoint',
        data: requestData,
        headers: undefined,
      });
    });
  });

  describe('Error scenarios', () => {
    it('should handle network timeout errors', async () => {
      const timeoutError = { code: 'ECONNABORTED', message: 'timeout' };
      mockAxiosInstance.request.mockRejectedValue(timeoutError);

      await expect(rainAxiosHelper.get('/timeout-endpoint')).rejects.toMatchObject({
        code: 'ECONNABORTED',
        message: 'timeout',
      });
    });

    it('should handle server errors', async () => {
      const serverError = {
        response: {
          status: 500,
          data: { error: 'Internal Server Error' },
        },
      };
      mockAxiosInstance.request.mockRejectedValue(serverError);

      await expect(rainAxiosHelper.post('/server-error')).rejects.toMatchObject({
        response: {
          status: 500,
          data: { error: 'Internal Server Error' },
        },
      });
    });

    it('should handle authentication errors', async () => {
      const authError = {
        response: {
          status: 401,
          data: { error: 'Unauthorized' },
        },
      };
      mockAxiosInstance.request.mockRejectedValue(authError);

      await expect(rainAxiosHelper.get('/protected-endpoint')).rejects.toMatchObject({
        response: {
          status: 401,
          data: { error: 'Unauthorized' },
        },
      });
    });
  });
});
