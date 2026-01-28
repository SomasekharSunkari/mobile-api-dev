import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

import { Observable } from 'rxjs';
import { PagaPersistentAccountWebhookPayload } from '../../../adapters/waas/paga/paga.interface';
import { PagaConfigProvider } from '../../../config/paga.config';
import { AppLoggerService } from '../../../services/logger/logger.service';

@Injectable()
export class PagaWebhookAuthGuard implements CanActivate {
  constructor(private readonly logger: AppLoggerService) {
    this.logger.setContext('PagaWebhookAuthGuard');
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    this.logger.logInfo('Starting Paga webhook authentication');
    return this.validateRequest(request);
  }

  validateRequest(request: Request): boolean {
    const header = request.headers['authorization'];
    this.logger.logDebug('Extracting authorization header', {
      metadata: { hasAuthHeader: !!header },
    });

    const tokenType = header?.split(' ')[0];
    const token = header?.split(' ')[1];

    if (!token || tokenType !== 'Basic') {
      this.logger.logWarn('Invalid authorization header format', {
        metadata: { tokenType, hasToken: !!token },
      });
      return false;
    }

    this.logger.logDebug('Authorization header parsed successfully, proceeding to validate webhook header');
    return this.validateWebhookHeader(token, request.body as unknown as PagaPersistentAccountWebhookPayload);
  }

  validateWebhookHeader(encryptedData: string, body: PagaPersistentAccountWebhookPayload): boolean {
    this.logger.logDebug('Decoding base64 credentials');
    const decryptedData = atob(encryptedData);
    const [username, password] = decryptedData.split(':');
    const pagaConfig = new PagaConfigProvider().getConfig();

    const webhookUsername = pagaConfig.webhookUsername;
    const webhookPassword = pagaConfig.webhookPassword;

    this.logger.logDebug('Validating webhook credentials');
    if (username?.toLowerCase() !== webhookUsername && password?.toLowerCase() !== webhookPassword) {
      this.logger.logWarn('Webhook credentials validation failed');
      return false;
    }

    this.logger.logDebug('Webhook credentials validated, proceeding to validate hash', {
      metadata: { accountNumber: body.accountNumber, statusCode: body.statusCode },
    });

    const hash = crypto
      .createHash('sha512')
      .update(body.statusCode + body.accountNumber + body.amount + body.clearingFeeAmount + pagaConfig.hmac)
      .digest('hex');

    if (hash !== body.hash) {
      this.logger.logWarn('Webhook hash validation failed', {
        metadata: { accountNumber: body.accountNumber, statusCode: body.statusCode },
      });
      return false;
    }

    this.logger.logInfo('Paga webhook authentication successful', {
      metadata: { accountNumber: body.accountNumber, statusCode: body.statusCode },
    });
    return true;
  }
}
