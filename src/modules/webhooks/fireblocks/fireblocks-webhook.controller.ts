import { Body, Controller, Headers, HttpStatus, Post } from '@nestjs/common';
import { BaseController } from '../../../base/base.controller';
import { FireblocksWebhookService } from './fireblocks-webhook.service';
import {
  IFireblocksWebhookV1Payload,
  IFireblocksWebhookV2Payload,
} from '../../../adapters/blockchain-waas/fireblocks/fireblocks_interface';

@Controller('/webhooks/fireblocks')
export class FireblocksWebhookController extends BaseController {
  constructor(private readonly fireblocksWebhookService: FireblocksWebhookService) {
    super();
  }

  @Post()
  async handleWebhook(
    @Body() body: IFireblocksWebhookV1Payload | IFireblocksWebhookV2Payload,
    @Headers() headers: Record<string, string>,
  ) {
    try {
      const result = await this.fireblocksWebhookService.processWebhook(body, headers);
      return this.transformResponse('Fireblocks webhook processed successfully', result);
    } catch (error) {
      this.logger.error('Error processing Fireblocks webhook:', error.stack);
      const status =
        error.message === 'Missing required webhook signature header'
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR;
      return this.transformResponse(
        error.message || 'Error processing Fireblocks webhook',
        { error: error.message },
        status,
      );
    }
  }
}
