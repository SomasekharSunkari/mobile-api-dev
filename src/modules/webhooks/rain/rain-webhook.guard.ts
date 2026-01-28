import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { Observable } from 'rxjs';
import { RainConfigProvider } from '../../../config/rain.config';

@Injectable()
export class RainWebhookAuthGuard implements CanActivate {
  private readonly logger = new Logger(RainWebhookAuthGuard.name);

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    return this.validateRequest(request);
  }

  validateRequest(request: Request): boolean {
    const signature = request.headers['signature'] || request.headers['Signature'];

    if (!signature) {
      this.logger.warn('Missing required webhook signature header');
      return false;
    }

    return this.validateWebhookSignature(signature as string, request.body);
  }

  validateWebhookSignature(signature: string, body: any): boolean {
    const rainConfig = new RainConfigProvider().getConfig();
    const webhookSecret = rainConfig.webhookSigningKey;

    if (!webhookSecret) {
      this.logger.error('RAIN_API_KEY is not configured in Rain config');
      return false;
    }

    try {
      // Convert body to JSON string for signature computation
      const payload = JSON.stringify(body);

      // Create expected signature using HMAC-SHA256
      const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');

      // Validate buffer lengths before comparison to prevent timingSafeEqual from throwing
      // timingSafeEqual throws if buffers have different lengths, which could crash the endpoint
      if (signature.length !== expectedSignature.length) {
        this.logger.warn('Webhook signature validation failed: signature length mismatch');
        return false;
      }

      // Use timing-safe comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));

      if (!isValid) {
        this.logger.warn('Webhook signature validation failed');
      }

      return isValid;
    } catch (error) {
      // Log error without exposing sensitive signature data
      this.logger.error('Error validating webhook signature', {
        message: error instanceof Error ? error.message : 'Unknown error',
        // Do not log error object directly as it may contain signature data
      });
      return false;
    }
  }
}
