import { InternalServerErrorException, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

import { createHmac } from 'crypto';
import { EnvironmentService } from '../../../config';
import { SumsubConfig, SumsubConfigProvider } from '../../../config/sumsub.config';
import { SumsubApplicant } from './sumsub.interface';

export class SumsubKycServiceAxiosHelper {
  protected readonly logger = new Logger(SumsubKycServiceAxiosHelper.name);
  constructor(
    private readonly axiosInstance?: AxiosInstance,
    private readonly sumsubConfig?: SumsubConfig,
  ) {
    this.axiosInstance = axios.create({ baseURL: EnvironmentService.getValue('SUMSUB_API_URL') });
    this.sumsubConfig = new SumsubConfigProvider().getConfig();
  }

  private signRequest(data: {
    method: string;
    uri: string;
    body?: string | Record<any, any>;
    timestamp: string;
  }): string {
    this.logger.debug('signRequest', 'SumsubKycServiceAxiosHelper');
    const { body, method, uri, timestamp } = data;

    const bodyInString = typeof body !== 'string' ? JSON.stringify(body) : body;

    // Ensure the HTTP method is in uppercase
    const upperMethod = method.toUpperCase();

    // Concatenate the components to form the message
    let message = timestamp + upperMethod + uri;
    if (body) {
      message += bodyInString;
    }

    // Compute the HMAC SHA256 signature
    const signature = createHmac('sha256', this.sumsubConfig.secretKey)
      .update(message, 'utf8')
      .digest('hex')
      .toLowerCase();

    return signature;
  }

  private getAppAccessTimestamp() {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    return timestamp;
  }

  public async post<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig<D>,
  ): Promise<R> {
    this.logger.debug(`Making POST request to Sumsub Service: ${url}`);

    const timestamp = this.getAppAccessTimestamp();
    const signature = this.signRequest({ body: data, uri: url, method: 'POST', timestamp });

    return await this.axiosInstance.post(url, data, {
      ...config,
      headers: {
        'X-App-Token': this.sumsubConfig.appToken,
        'X-App-Access-Sig': signature,
        'X-App-Access-Ts': timestamp,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...config?.headers,
      },
    });
  }

  public async get<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R> {
    this.logger.debug(`Making GET request to Sumsub Service: ${url}`);

    const timestamp = this.getAppAccessTimestamp();
    const signature = this.signRequest({ uri: url, method: 'GET', timestamp });

    return await this.axiosInstance.get(url, {
      ...config,
      headers: {
        'X-App-Token': this.sumsubConfig.appToken,
        'X-App-Access-Sig': signature,
        'X-App-Access-Ts': timestamp,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...config?.headers,
      },
    });
  }

  public async patch<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig<D>,
  ): Promise<R> {
    this.logger.debug(`Making PATCH request to Sumsub Service: ${url}`);

    const timestamp = this.getAppAccessTimestamp();
    const signature = this.signRequest({ body: data, uri: url, method: 'PATCH', timestamp });

    return await this.axiosInstance.patch(url, data, {
      ...config,
      headers: {
        'X-App-Token': this.sumsubConfig.appToken,
        'X-App-Access-Sig': signature,
        'X-App-Access-Ts': timestamp,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...config?.headers,
      },
    });
  }

  public async getApplicantInfoWithExternalUserId(externalUserId: string): Promise<SumsubApplicant> {
    try {
      const response = await this.get<SumsubApplicant>(`/resources/applicants/-;externalUserId=${externalUserId}/one`);
      return response.data;
    } catch (error) {
      this.logger.error('SumsubKycServiceAxiosHelper.getApplicantInfoWithExternalUserId', error);
      throw new InternalServerErrorException(error?.message);
    }
  }
}
