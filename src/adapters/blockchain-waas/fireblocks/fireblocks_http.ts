import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';
import { IFireblocksPaginatedResponse, IFireblocksResponse } from './fireblocks_interface';
import { FireblocksConfigProvider, IFireblocksConfig } from '../../../config';
import { Logger } from '@nestjs/common';

export class FireblocksAxiosHelper {
  private readonly axiosInstance: AxiosInstance;
  private readonly fireblocksConfig: IFireblocksConfig;
  private readonly hlogger = new Logger(FireblocksAxiosHelper.name);

  constructor() {
    this.fireblocksConfig = new FireblocksConfigProvider().getConfig();
    this.axiosInstance = axios.create({
      baseURL: this.fireblocksConfig.baseUrl,
      timeout: this.fireblocksConfig.timeout,
    });

    this.axiosInstance.interceptors.request.use(this.signRequest.bind(this));
  }

  private signRequest(config: AxiosRequestConfig): AxiosRequestConfig {
    try {
      const now = Math.floor(Date.now() / 1000);
      const nonce = randomUUID();
      let uri = config.url || '';
      if (config.params && Object.keys(config.params).length > 0) {
        const queryString = new URLSearchParams(config.params).toString();
        uri += (uri.includes('?') ? '&' : '?') + queryString;
      }
      const body = config.data || '';

      const bodyHash = createHash('sha256')
        .update(typeof body === 'string' ? body : JSON.stringify(body))
        .digest('hex');

      const payload = {
        uri,
        nonce,
        iat: now,
        exp: now + 30,
        sub: this.fireblocksConfig.apiKey,
        bodyHash,
      };

      const token = jwt.sign(payload, this.fireblocksConfig.privateKey, {
        algorithm: 'RS256',
      });

      config.headers = {
        ...config.headers,
        'X-API-Key': this.fireblocksConfig.apiKey,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      return config;
    } catch (error) {
      this.hlogger.error('Error while signing Fireblocks request', error.stack);
      throw error;
    }
  }

  private async handleRequest<T>(config: AxiosRequestConfig, retryCount = 0): Promise<IFireblocksResponse<T>> {
    const maxRetries = 2; // Maximum 2 retries for timeout scenarios

    try {
      this.hlogger.debug(
        `Making request to Fireblocks: ${config.method?.toUpperCase()} ${config.url}${retryCount > 0 ? ` (retry ${retryCount})` : ''}`,
      );
      const response = await this.axiosInstance.request<T>(config);
      this.hlogger.debug(`Received response with status ${response.status} from ${config.url}`);
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        let message = 'Fireblocks HTTP Error';

        // Handle timeout specifically
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          message = 'Fireblocks request timed out. Please try again.';
          this.hlogger.error(`Fireblocks timeout error: ${error.message}`, error.stack);
        } else if (error.response?.data?.message && error.response?.data?.code) {
          message = `${error.response.data.message}-${error.response.data.code}`;
          this.hlogger.error(`Fireblocks API error: ${message}`, error.stack);
        } else if (error.response?.data?.message) {
          message = error.response.data.message;
          this.hlogger.error(`Fireblocks API error: ${message}`, error.stack);
        } else {
          this.hlogger.error(`Fireblocks HTTP error: ${error.message}`, error.stack);
        }

        // Retry on timeout if we haven't exceeded max retries
        if ((error.code === 'ECONNABORTED' || error.message.includes('timeout')) && retryCount < maxRetries) {
          this.hlogger.warn(`Fireblocks request timed out, retrying... (${retryCount + 1}/${maxRetries})`);
          // Wait 2 seconds before retrying
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return this.handleRequest<T>(config, retryCount + 1);
        }

        throw {
          message,
          response: {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
          },
        };
      }

      this.hlogger.error('Unexpected error during Fireblocks request', error.stack);
      throw error;
    }
  }

  private async handlePaginatedRequest<T>(config: AxiosRequestConfig): Promise<IFireblocksPaginatedResponse<T>> {
    try {
      this.hlogger.debug(`Making paginated request to Fireblocks: ${config.method?.toUpperCase()} ${config.url}`);
      const response = await this.axiosInstance.request<T>(config);
      this.hlogger.debug(`Received paginated response with status ${response.status} from ${config.url}`);

      return {
        data: {
          transactions: response.data,
          pageDetails: {
            prevPage: response.headers['prev-page'],
            nextPage: response.headers['next-page'],
          },
        },
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      this.hlogger.error('Error in paginated request', error.stack);
      throw error;
    }
  }

  public async get<T>(path: string, params?: any, idempotencyKey?: string): Promise<IFireblocksResponse<T>> {
    const config: AxiosRequestConfig = {
      method: 'GET',
      url: path,
      params,
    };
    if (idempotencyKey) {
      config.headers = { 'Idempotency-Key': idempotencyKey };
    }
    return this.handleRequest<T>(config);
  }

  public async getPaginated<T>(
    path: string,
    params?: any,
    idempotencyKey?: string,
  ): Promise<IFireblocksPaginatedResponse<T>> {
    const config: AxiosRequestConfig = {
      method: 'GET',
      url: path,
      params,
    };
    if (idempotencyKey) {
      config.headers = { 'Idempotency-Key': idempotencyKey };
    }
    return this.handlePaginatedRequest<T>(config);
  }

  public async post<T>(path: string, body?: any, idempotencyKey?: string): Promise<IFireblocksResponse<T>> {
    const config: AxiosRequestConfig = {
      method: 'POST',
      url: path,
      data: body,
    };
    if (idempotencyKey) {
      config.headers = { 'Idempotency-Key': idempotencyKey };
    }
    return this.handleRequest<T>(config);
  }

  public async put<T>(path: string, body?: any, idempotencyKey?: string): Promise<IFireblocksResponse<T>> {
    const config: AxiosRequestConfig = {
      method: 'PUT',
      url: path,
      data: body,
    };
    if (idempotencyKey) {
      config.headers = { 'Idempotency-Key': idempotencyKey };
    }
    return this.handleRequest<T>(config);
  }

  public async patch<T>(path: string, body?: any, idempotencyKey?: string): Promise<IFireblocksResponse<T>> {
    const config: AxiosRequestConfig = {
      method: 'PATCH',
      url: path,
      data: body,
    };
    if (idempotencyKey) {
      config.headers = { 'Idempotency-Key': idempotencyKey };
    }
    return this.handleRequest<T>(config);
  }

  public async delete<T>(path: string, idempotencyKey?: string): Promise<IFireblocksResponse<T>> {
    const config: AxiosRequestConfig = {
      method: 'DELETE',
      url: path,
    };
    if (idempotencyKey) {
      config.headers = { 'Idempotency-Key': idempotencyKey };
    }
    return this.handleRequest<T>(config);
  }
}
