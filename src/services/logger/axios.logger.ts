import { Injectable } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { AppLoggerService } from './logger.service';

@Injectable()
export class AxiosLogger {
  constructor(private readonly logger: AppLoggerService) {}

  logRequest(adapter: string, axiosInstance: AxiosInstance) {
    axiosInstance.interceptors.request.use((config) => {
      this.logger.logHttpRequest(config.method, config.url, 200, {
        adapter,
        body: config.data,
        headers: config.headers,
        operation: 'http_request',
        params: config.params,
        responseType: config.responseType,
        timeout: config.timeout,
        withCredentials: config.withCredentials,
        auth: config.auth,
      });

      return config;
    });

    axiosInstance.interceptors.response.use((response) => {
      this.logger.logHttpRequest(response.config.method, response.config.url, response.status, {
        operation: 'http_response',
        data: response.data,
        statusCode: response.status,
        headers: response.headers,
        config: response.config,
        status: response.status,
        statusText: response.statusText,
        adapter,
      });
      return response;
    });
  }
}
