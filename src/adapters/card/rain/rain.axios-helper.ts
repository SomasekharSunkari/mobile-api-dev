import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { RainConfig, RainConfigProvider } from '../../../config/rain.config';
import { IRainResponse } from './rain.interface';

/**
 * Rain Axios Helper Class
 *
 * This class provides a comprehensive HTTP client for interacting with Rain's
 * card management API. It handles authentication, request/response logging,
 * error handling, and provides all standard HTTP methods with generic typing.
 *
 * Features:
 * - Automatic authentication header injection
 * - Comprehensive request/response logging
 * - Standardized error handling
 * - Generic typing for requests and responses
 * - Support for all HTTP methods (GET, POST, PUT, PATCH, DELETE)
 *
 * @see RainConfig - Configuration interface for Rain API credentials
 * @see RainConfigProvider - Configuration provider for Rain API settings
 */
export class RainAxiosHelper {
  private readonly axiosInstance: AxiosInstance;
  private readonly rainConfig: RainConfig;

  constructor() {
    this.rainConfig = new RainConfigProvider().getConfig();
    // Create axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: this.rainConfig.apiUrl,
      timeout: 60000, // 60 seconds timeout
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'API-Key': this.rainConfig.apiKey,
      },
    });
  }

  /**
   * Generic request handler for all HTTP methods
   */
  private async handleRequest<TResponse = any>(config: AxiosRequestConfig): Promise<IRainResponse<TResponse>> {
    return this.axiosInstance.request<TResponse>(config);
  }

  /**
   * HTTP GET method
   * @param path - API endpoint path
   * @param params - Query parameters
   * @param headers - Additional headers
   */
  public async get<TResponse = any>(
    path: string,
    params?: Record<string, any>,
    headers?: Record<string, string>,
  ): Promise<IRainResponse<TResponse>> {
    const config: AxiosRequestConfig = {
      method: 'GET',
      url: path,
      params,
      headers,
    };

    return this.handleRequest<TResponse>(config);
  }

  /**
   * HTTP POST method
   * @param path - API endpoint path
   * @param body - Request payload
   * @param headers - Additional headers
   */
  public async post<TRequest = any, TResponse = any>(
    path: string,
    body?: TRequest,
    headers?: Record<string, string>,
  ): Promise<IRainResponse<TResponse>> {
    const config: AxiosRequestConfig = {
      method: 'POST',
      url: path,
      data: body,
      headers,
    };

    return this.handleRequest<TResponse>(config);
  }

  /**
   * HTTP PUT method
   * @param path - API endpoint path
   * @param body - Request payload
   * @param headers - Additional headers
   */
  public async put<TRequest = any, TResponse = any>(
    path: string,
    body?: TRequest,
    headers?: Record<string, string>,
  ): Promise<IRainResponse<TResponse>> {
    const config: AxiosRequestConfig = {
      method: 'PUT',
      url: path,
      data: body,
      headers,
    };

    return this.handleRequest<TResponse>(config);
  }

  /**
   * HTTP PATCH method
   * @param path - API endpoint path
   * @param body - Request payload
   * @param headers - Additional headers
   */
  public async patch<TRequest = any, TResponse = any>(
    path: string,
    body?: TRequest,
    headers?: Record<string, string>,
  ): Promise<IRainResponse<TResponse>> {
    const config: AxiosRequestConfig = {
      method: 'PATCH',
      url: path,
      data: body,
      headers,
    };

    return this.handleRequest<TResponse>(config);
  }

  /**
   * HTTP DELETE method
   * @param path - API endpoint path
   * @param headers - Additional headers
   */
  public async delete<TResponse = any>(
    path: string,
    headers?: Record<string, string>,
  ): Promise<IRainResponse<TResponse>> {
    const config: AxiosRequestConfig = {
      method: 'DELETE',
      url: path,
      headers,
    };

    return this.handleRequest<TResponse>(config);
  }

  /**
   * Get the underlying axios instance for advanced usage
   * @returns AxiosInstance
   */
  public getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  /**
   * Get the current Rain configuration
   * @returns RainConfig
   */
  public getConfig(): RainConfig {
    return this.rainConfig;
  }
}
