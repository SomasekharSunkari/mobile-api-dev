import { Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, RawAxiosRequestHeaders } from 'axios';
import * as crypto from 'crypto';
import { ZerohashConfigProvider } from '../../../config/zerohash.config';
import { GenerateSignatureParams } from './zerohash.axios.interface';

export class ZerohashAxiosHelper {
  private readonly axiosLogger = new Logger(ZerohashAxiosHelper.name);
  private readonly axiosInstance: AxiosInstance;
  protected readonly configProvider = new ZerohashConfigProvider();

  constructor() {
    const { apiUrl } = this.configProvider.getConfig();

    this.axiosInstance = axios.create({
      baseURL: apiUrl,
    });
  }

  public async post<T = any, D = any>(
    path: string,
    body: D,
    options?: { headers?: RawAxiosRequestHeaders },
  ): Promise<AxiosResponse<T>> {
    // build headers
    const headers = this.buildRequestHeaders('POST', path, body, options?.headers);

    // Log request without sensitive body content for document uploads
    const isDocumentUpload = path === '/participants/documents';
    const bodyToLog = isDocumentUpload ? { ...body, document: '[REDACTED - Base64 Content]' } : body;

    this.customLog('POST', path, headers, bodyToLog);

    try {
      const response = await this.axiosInstance.post(path, body, { headers });

      this.axiosLogger.debug(`Zerohash response status: ${response.status}`);
      this.axiosLogger.debug(`Zerohash response data: ${JSON.stringify(response.data, null, 2)}`);

      return response;
    } catch (error) {
      this.axiosLogger.error(`Zerohash POST request failed: ${path}`, error);
      this.logAxiosError(error, 'POST', path);
      throw error;
    }
  }

  public async get<T>(path: string, options?: AxiosRequestConfig<any>): Promise<AxiosResponse<T>> {
    this.axiosLogger.log(`Making GET request to Zerohash: ${path}`);

    const headers = this.buildRequestHeaders('GET', path, {}, options?.headers);

    try {
      const response = await this.axiosInstance.get(path, { headers, ...options });

      this.axiosLogger.debug(`Zerohash response status: ${response.status}`);
      this.axiosLogger.debug(`Zerohash response data: ${JSON.stringify(response.data, null, 2)}`);

      return response;
    } catch (error) {
      this.logAxiosError(error, 'GET', path);
      throw error;
    }
  }

  public async patch<T = any, D = any>(
    path: string,
    body: D,
    options?: { headers?: RawAxiosRequestHeaders },
  ): Promise<AxiosResponse<T>> {
    const headers = this.buildRequestHeaders('PATCH', path, body, options?.headers);

    this.customLog('PATCH', path, headers, body);

    try {
      const response = await this.axiosInstance.patch(path, body, { headers });

      this.axiosLogger.debug(`Zerohash response status: ${response.status}`);
      this.axiosLogger.debug(`Zerohash response data: ${JSON.stringify(response.data, null, 2)}`);

      return response;
    } catch (error) {
      this.logAxiosError(error, 'PATCH', path);
      throw error;
    }
  }

  private buildRequestHeaders(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body: Record<string, any>,
    extraHeaders: RawAxiosRequestHeaders = {},
  ): RawAxiosRequestHeaders {
    const { apiKey, apiPassphrase, apiSecret } = this.configProvider.getConfig();
    const timestamp = Math.floor(Date.now() / 1000);

    const signature = this.generateSignature({ method, pathWithQuery: path, body, timestamp, secret: apiSecret });

    const headers: RawAxiosRequestHeaders = {
      'Content-Type': 'application/json',
      'X-SCX-API-KEY': apiKey,
      'X-SCX-TIMESTAMP': timestamp.toString(),
      'X-SCX-SIGNED': signature,
      'X-SCX-PASSPHRASE': apiPassphrase,
      ...extraHeaders,
    };

    return headers;
  }

  private generateSignature(params: GenerateSignatureParams): string {
    const { method, pathWithQuery, body, timestamp, secret } = params;

    const isDocumentUpload = pathWithQuery === '/participants/documents';
    const rawBody = isDocumentUpload ? '{}' : JSON.stringify(body ?? {});
    const payload = `${timestamp}${method}${pathWithQuery}${rawBody}`;
    const decodedSecret = Buffer.from(secret, 'base64');
    return crypto.createHmac('sha256', decodedSecret).update(payload).digest('base64');
  }

  private customLog(method: string, path: string, headers: RawAxiosRequestHeaders, body: Record<string, any> = {}) {
    this.axiosLogger.debug(` Zerohash ${method} Request:
      URL: ${path}
      Method: ${method}
      Headers: ${JSON.stringify(headers, null, 2)}
      Body: ${JSON.stringify(body, null, 2)}`);
  }

  private logAxiosError(error: any, method: string, path: string) {
    this.axiosLogger.error(`Zerohash ${method} ${path} failed:`, error.response?.data || error.message);
  }

  public verifyWebhookSignature(headers: Record<string, any>, payload: any): boolean {
    // Extract required headers
    const zhSignature = headers['x-zh-hook-rsa-signature'];
    const zhSignature256 = headers['x-zh-hook-rsa-signature-256'];
    const zhTimestamp = headers['x-zh-hook-timestamp'];

    // Check for required headers
    if (!zhTimestamp || (!zhSignature && !zhSignature256)) {
      return false;
    }

    // Verify timestamp is within 5 minutes
    if (!this.checkTimestamp(zhTimestamp)) {
      return false;
    }

    // Prefer SHA-256 signature if available, fallback to SHA-1
    const signature = zhSignature256 || zhSignature;
    const hashAlgorithm = zhSignature256 ? 'SHA256' : 'SHA1';

    // Reconstruct the signed message (compact JSON payload)
    const message = JSON.stringify(payload);

    return this.verifyRSASignature(message, signature, hashAlgorithm);
  }

  private checkTimestamp(zhTimestamp: string): boolean {
    const webhookTimestampMs = Number.parseInt(zhTimestamp, 10);
    const currentTimestampMs = Date.now();
    const timeDifferenceMs = Math.abs(currentTimestampMs - webhookTimestampMs);
    const fiveMinutesInMs = 5 * 60 * 1000;

    return timeDifferenceMs <= fiveMinutesInMs;
  }

  private verifyRSASignature(message: string, signature: string, hashAlgorithm: string = 'SHA256'): boolean {
    if (!signature) return false;

    try {
      const { rsaPublicKey } = this.configProvider.getConfig();
      if (!rsaPublicKey) return false;

      // Convert RSA PUBLIC KEY to standard PUBLIC KEY format if needed
      let publicKeyFormatted = rsaPublicKey;
      if (rsaPublicKey.includes('-----BEGIN RSA PUBLIC KEY-----')) {
        try {
          const keyObject = crypto.createPublicKey({
            key: rsaPublicKey,
            format: 'pem',
            type: 'pkcs1',
          });
          publicKeyFormatted = keyObject.export({
            format: 'pem',
            type: 'spki',
          }) as string;
        } catch {
          publicKeyFormatted = rsaPublicKey;
        }
      }

      const signatureBuffer = Buffer.from(signature, 'hex');
      const messageBuffer = Buffer.from(message, 'utf8');
      const algorithmName = hashAlgorithm === 'SHA256' ? 'RSA-SHA256' : 'RSA-SHA1';

      // Try PSS padding first (this is what works for ZeroHash)
      try {
        const verifier = crypto.createVerify(algorithmName);
        verifier.write(messageBuffer);
        verifier.end();

        return verifier.verify(
          {
            key: publicKeyFormatted,
            padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
          },
          signatureBuffer,
        );
      } catch {
        // Fallback to PKCS1 padding
        const verifier = crypto.createVerify(algorithmName);
        verifier.write(messageBuffer);
        verifier.end();

        return verifier.verify(publicKeyFormatted, signatureBuffer);
      }
    } catch {
      return false;
    }
  }
}
