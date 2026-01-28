import { HttpException, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { createHash } from 'crypto';
import { PagaConfig, PagaConfigProvider } from '../../../config/paga.config';

export class PagaAxiosHelper {
  private readonly adapterLogger = new Logger(PagaAxiosHelper.name);

  private readonly pagaConfig: PagaConfig;

  constructor(private readonly axiosInstance: AxiosInstance) {
    this.pagaConfig = new PagaConfigProvider().getConfig();
    this.axiosInstance = axios.create({
      baseURL: this.pagaConfig.businessApiUrl,
      auth: { username: this.pagaConfig.username, password: this.pagaConfig.credential },
    });

    this.axiosInstance.interceptors.request.use(this.authenticate.bind(this));

    // Set up the interceptor when initializing axiosInstance
    this.axiosInstance.interceptors.request.use(
      (config) => {
        return config;
      },
      (error) => Promise.reject(new HttpException(error.message, error.status)),
    );
  }

  async authenticate(config: AxiosRequestConfig) {
    const auth = Buffer.from(`${this.pagaConfig.username}:${this.pagaConfig.credential}`).toString('base64');
    config.headers = {
      ...config.headers,
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      principal: this.pagaConfig.username,
      credentials: this.pagaConfig.credential,
    };

    return config;
  }

  async post<D, R>(
    url: string,
    body: D,
    bodiesToHash?: string[],
    useBusinessUrl?: boolean,
    config?: AxiosRequestConfig,
  ) {
    this.adapterLogger.log('Making POST request to Paga', { url, body, headers: config?.headers });

    // add all the body to hash and hash it using sha256 and add it to the headers
    const bodyHash = this.generateHash(body, bodiesToHash);

    // if it's  business is true, change the instance to use the business api url
    if (useBusinessUrl) {
      this.axiosInstance.defaults.baseURL = this.pagaConfig.businessApiUrl;
    } else {
      this.axiosInstance.defaults.baseURL = this.pagaConfig.collectApiUrl;
    }

    const data = await this.axiosInstance.post<R, AxiosResponse<R>, D>(url, body, {
      ...config,
      headers: { ...config?.headers, hash: bodyHash, 'Content-Type': 'application/json', Accept: 'application/json' },
    });

    return data;
  }

  private generateHash(body: Record<string, any>, stringToHash?: string[]) {
    const referenceNumber = body.referenceNumber;
    const hmac = this.pagaConfig.hmac;

    if (!stringToHash || stringToHash.length === 0) {
      // Simple hash for endpoints like getBankList that only need referenceNumber + hmac
      const stringToHash = `${referenceNumber}${hmac}`;

      const hash = createHash('sha512');
      hash.update(stringToHash);
      return hash.digest('hex');
    }

    // Complex hash for endpoints with additional parameters
    // Filter out null/undefined values and convert to string
    const bodyInString = stringToHash
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map((value) => value.toString())
      .join('');

    const bodyToHash = `${referenceNumber}${bodyInString}${hmac}`;

    const hash = createHash('sha512');
    hash.update(bodyToHash);

    return hash.digest('hex');
  }

  async get<R, Q>(url: string, query: Q, config?: AxiosRequestConfig) {
    this.adapterLogger.log('Making GET request to Paga', { url, query, headers: config?.headers });
    const data = await this.axiosInstance.get<R, AxiosResponse<R>, Q>(url, { params: query, ...config });

    return data;
  }

  async put<D, R>(url: string, body: D, config?: AxiosRequestConfig) {
    this.adapterLogger.log('Making PUT request to Paga', { url, body, headers: config?.headers });
    const data = await this.axiosInstance.put<R, AxiosResponse<R>, D>(url, body, { ...config });

    return data;
  }

  async delete<R, Q>(url: string, query: Q, config?: AxiosRequestConfig) {
    this.adapterLogger.log('Making DELETE request to Paga', { url, query, headers: config?.headers });
    const data = await this.axiosInstance.delete<R, AxiosResponse<R>, Q>(url, { params: query, ...config });

    return data;
  }
}
