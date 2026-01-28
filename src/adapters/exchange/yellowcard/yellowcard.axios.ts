import { Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as crypto from 'crypto';

import { YellowCardConfig, YellowCardConfigProvider } from '../../../config/yellowcard.config';
import { YellowCardSignRequest } from './yellowcard.interface';

export class YellowCardServiceAxiosHelper {
  protected readonly logger = new Logger(YellowCardServiceAxiosHelper.name);
  constructor(
    private readonly axiosInstance: AxiosInstance,
    private readonly yellowCardConfig: YellowCardConfig,
  ) {
    this.yellowCardConfig = new YellowCardConfigProvider().getConfig();
    this.axiosInstance = axios.create({ baseURL: this.yellowCardConfig.apiUrl });
  }

  private signRequest(data: YellowCardSignRequest): {
    'X-YC-Timestamp': string;
    Authorization: string;
  } {
    this.logger.log('signRequest', 'YellowCardServiceAxiosHelper');
    const { body, method, path, timestamp } = data;

    // Create HMAC instance with SHA256 and the secret key
    const hmac = crypto.createHmac('sha256', this.yellowCardConfig.secretKey);

    // Update HMAC with timestamp, path, and method
    hmac.update(timestamp, 'utf8');
    hmac.update(path, 'utf8');
    hmac.update(method, 'utf8');

    // If body exists, compute SHA256 of JSON-stringified body and update HMAC
    if (body) {
      const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
      const bodyHash = crypto.createHash('sha256').update(bodyString).digest('base64');
      hmac.update(bodyHash);
    }

    // Finalize HMAC and encode to Base64
    const signature = hmac.digest('base64');

    return {
      'X-YC-Timestamp': timestamp,
      Authorization: `YcHmacV1 ${this.yellowCardConfig.apiKey}:${signature}`,
    };
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  public async post<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig<D>,
  ): Promise<R> {
    this.logger.log('Making POST request to YellowCard Service', {
      url,
      data,
      headers: {
        ...config?.headers,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    const timestamp = this.getTimestamp();
    const authHeaders = this.signRequest({
      body: data,
      path: url,
      method: 'POST',
      timestamp,
    });

    return await this.axiosInstance.post(url, data, {
      ...config,
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...config?.headers,
      },
    });
  }

  public async get<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R> {
    this.logger.log('Making GET request to YellowCard Service', {
      url,
      headers: {
        ...config?.headers,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    const timestamp = this.getTimestamp();
    const authHeaders = this.signRequest({
      path: url,
      method: 'GET',
      timestamp,
    });

    return await this.axiosInstance.get(url, {
      ...config,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...config?.headers,
        ...authHeaders,
      },
    });
  }

  public async put<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig<D>,
  ): Promise<R> {
    this.logger.log('Making PUT request to YellowCard Service', {
      url,
      data,
      headers: {
        ...config?.headers,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    const timestamp = this.getTimestamp();
    const authHeaders = this.signRequest({
      body: data,
      path: url,
      method: 'PUT',
      timestamp,
    });

    return await this.axiosInstance.put(url, data, {
      ...config,
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...config?.headers,
      },
    });
  }

  public async delete<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R> {
    this.logger.log('Making DELETE request to YellowCard Service', {
      url,
      headers: {
        ...config?.headers,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    const timestamp = this.getTimestamp();
    const authHeaders = this.signRequest({
      path: url,
      method: 'DELETE',
      timestamp,
    });

    return await this.axiosInstance.delete(url, {
      ...config,
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...config?.headers,
      },
    });
  }
}
