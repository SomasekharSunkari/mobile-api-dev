import { Test, TestingModule } from '@nestjs/testing';
import axios, { AxiosInstance } from 'axios';
import { ZendeskAxiosHelper } from './zendesk.axios-helper';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ZendeskAxiosHelper', () => {
  let helper: ZendeskAxiosHelper;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;

  beforeEach(async () => {
    // Ensure Zendesk environment variables are set for config resolution
    process.env.ZENDESK_API_URL = '';
    process.env.ZENDESK_SUBDOMAIN = 'example';
    process.env.ZENDESK_EMAIL = 'test@example.com';
    process.env.ZENDESK_API_TOKEN = 'test-token';

    mockAxiosInstance = {
      request: jest.fn(),
    } as any;

    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ZendeskAxiosHelper],
    }).compile();

    helper = module.get<ZendeskAxiosHelper>(ZendeskAxiosHelper);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: expect.any(String),
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          auth: expect.objectContaining({
            username: expect.stringContaining('/token'),
          }),
        }),
      );
    });
  });

  describe('get', () => {
    it('should make GET request with path', async () => {
      const mockResponse = {
        status: 200,
        data: { result: 'success' },
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse as any);

      const result = await helper.get('/tickets/123.json');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/tickets/123.json',
        params: undefined,
      });

      expect(result).toEqual({
        status: 200,
        data: { result: 'success' },
      });
    });

    it('should make GET request with query parameters', async () => {
      const mockResponse = {
        status: 200,
        data: { result: 'success' },
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse as any);

      const params = { page: 1, per_page: 10 };
      const result = await helper.get('/tickets.json', params);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/tickets.json',
        params,
      });

      expect(result).toEqual({
        status: 200,
        data: { result: 'success' },
      });
    });
  });

  describe('post', () => {
    it('should make POST request with path and data', async () => {
      const mockResponse = {
        status: 201,
        data: { id: 123 },
      };

      const requestData = { ticket: { subject: 'Test' } };

      mockAxiosInstance.request.mockResolvedValue(mockResponse as any);

      const result = await helper.post('/tickets.json', requestData);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/tickets.json',
        data: requestData,
      });

      expect(result).toEqual({
        status: 201,
        data: { id: 123 },
      });
    });

    it('should make POST request without data', async () => {
      const mockResponse = {
        status: 201,
        data: { result: 'success' },
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse as any);

      const result = await helper.post('/tickets.json');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/tickets.json',
        data: undefined,
      });

      expect(result).toEqual({
        status: 201,
        data: { result: 'success' },
      });
    });
  });

  describe('put', () => {
    it('should make PUT request with path and data', async () => {
      const mockResponse = {
        status: 200,
        data: { id: 123 },
      };

      const requestData = { ticket: { status: 'solved' } };

      mockAxiosInstance.request.mockResolvedValue(mockResponse as any);

      const result = await helper.put('/tickets/123.json', requestData);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'PUT',
        url: '/tickets/123.json',
        data: requestData,
      });

      expect(result).toEqual({
        status: 200,
        data: { id: 123 },
      });
    });
  });

  describe('patch', () => {
    it('should make PATCH request with path and data', async () => {
      const mockResponse = {
        status: 200,
        data: { id: 123 },
      };

      const requestData = { ticket: { priority: 'high' } };

      mockAxiosInstance.request.mockResolvedValue(mockResponse as any);

      const result = await helper.patch('/tickets/123.json', requestData);

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'PATCH',
        url: '/tickets/123.json',
        data: requestData,
      });

      expect(result).toEqual({
        status: 200,
        data: { id: 123 },
      });
    });
  });

  describe('delete', () => {
    it('should make DELETE request with path', async () => {
      const mockResponse = {
        status: 204,
        data: null,
      };

      mockAxiosInstance.request.mockResolvedValue(mockResponse as any);

      const result = await helper.delete('/tickets/123.json');

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'DELETE',
        url: '/tickets/123.json',
      });

      expect(result).toEqual({
        status: 204,
        data: null,
      });
    });
  });
});
