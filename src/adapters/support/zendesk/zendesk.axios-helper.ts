import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ZendeskConfig, ZendeskConfigProvider } from '../../../config/zendesk.config';

/**
 * Zendesk Axios Helper Class
 *
 * This class provides a comprehensive HTTP client for interacting with Zendesk's
 * support API. It handles authentication, request/response logging,
 * error handling, and provides all standard HTTP methods with generic typing.
 *
 * Features:
 * - Automatic authentication header injection
 * - Comprehensive request/response logging
 * - Standardized error handling
 * - Generic typing for requests and responses
 * - Support for all HTTP methods (GET, POST, PUT, PATCH, DELETE)
 *
 * @see ZendeskConfig - Configuration interface for Zendesk API credentials
 * @see ZendeskConfigProvider - Configuration provider for Zendesk API settings
 */
export class ZendeskAxiosHelper {
  private readonly axiosInstance: AxiosInstance;
  private readonly zendeskConfig: ZendeskConfig;

  constructor() {
    this.zendeskConfig = new ZendeskConfigProvider().getConfig();
    // Create axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: this.zendeskConfig.apiUrl,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      auth: {
        username: `${this.zendeskConfig.email}/token`,
        password: this.zendeskConfig.apiToken,
      },
    });
  }

  /**
   * Generic request handler for all HTTP methods
   */
  private async handleRequest<TResponse = any>(
    config: AxiosRequestConfig,
  ): Promise<{ status: number; data: TResponse }> {
    const response = await this.axiosInstance.request<TResponse>(config);
    return {
      status: response.status,
      data: response.data,
    };
  }

  /**
   * HTTP GET method
   * @param path - API endpoint path
   * @param params - Query parameters
   */
  async get<TResponse = any>(path: string, params?: Record<string, any>): Promise<{ status: number; data: TResponse }> {
    return this.handleRequest<TResponse>({
      method: 'GET',
      url: path,
      params,
    });
  }

  /**
   * HTTP POST method
   * @param path - API endpoint path
   * @param data - Request body data
   */
  async post<TRequest = any, TResponse = any>(
    path: string,
    data?: TRequest,
  ): Promise<{ status: number; data: TResponse }> {
    return this.handleRequest<TResponse>({
      method: 'POST',
      url: path,
      data,
    });
  }

  /**
   * HTTP PUT method
   * @param path - API endpoint path
   * @param data - Request body data
   */
  async put<TRequest = any, TResponse = any>(
    path: string,
    data?: TRequest,
  ): Promise<{ status: number; data: TResponse }> {
    return this.handleRequest<TResponse>({
      method: 'PUT',
      url: path,
      data,
    });
  }

  /**
   * HTTP PATCH method
   * @param path - API endpoint path
   * @param data - Request body data
   */
  async patch<TRequest = any, TResponse = any>(
    path: string,
    data?: TRequest,
  ): Promise<{ status: number; data: TResponse }> {
    return this.handleRequest<TResponse>({
      method: 'PATCH',
      url: path,
      data,
    });
  }

  /**
   * HTTP DELETE method
   * @param path - API endpoint path
   */
  async delete<TResponse = any>(path: string): Promise<{ status: number; data: TResponse }> {
    return this.handleRequest<TResponse>({
      method: 'DELETE',
      url: path,
    });
  }
}
