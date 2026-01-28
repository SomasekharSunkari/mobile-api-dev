import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { YellowCardConfig, YellowCardConfigProvider } from '../../../config/yellowcard.config';

@Injectable()
export class YellowCardWebhookGuard implements CanActivate {
  private readonly yellowCardConfig: YellowCardConfig = new YellowCardConfigProvider().getConfig();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-yc-signature'];

    const payload = request.body;

    if (!signature) {
      throw new UnauthorizedException('Signature is required');
    }

    // The apiKey is expected to be in the payload
    const apiKey = payload?.apiKey;
    if (!apiKey) {
      throw new UnauthorizedException('apiKey is required in payload');
    }

    // TODO: Replace this with your actual method to retrieve the secretKey for the apiKey
    // For example, you might have a service to fetch the secretKey from DB or config
    const secretKey = this.yellowCardConfig.secretKey;

    // Compute the expected signature

    const computedHash = createHmac('sha256', secretKey).update(JSON.stringify(payload)).digest('base64');

    if (computedHash !== signature) {
      throw new UnauthorizedException('Invalid signature');
    }

    return true;
  }

  // Helper method to retrieve secretKey for a given apiKey
  // Replace this with your actual implementation (e.g., inject a service)
}
