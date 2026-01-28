import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PlaidExternalAccountAdapter } from '../../../adapters/external-account/plaid/plaid.adapter';
import { PlaidWebhookService } from './plaid-webhook.service';

@ApiTags('Webhooks - Plaid')
@Controller('webhooks')
export class PlaidWebhookController {
  private readonly logger = new Logger(PlaidWebhookController.name);

  @Inject(PlaidExternalAccountAdapter)
  private readonly plaidAdapter: PlaidExternalAccountAdapter;
  @Inject(PlaidWebhookService)
  private readonly plaidWebhookService: PlaidWebhookService;

  @HttpCode(HttpStatus.OK)
  @Post('plaid')
  @ApiOperation({ summary: 'Receive Plaid webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook received successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  async handlePlaidWebhook(@Req() req: RawBodyRequest<Request>): Promise<any> {
    this.logger.log('Plaid webhook received');

    // Parse the payload
    let payload: any;
    try {
      payload = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : req.body;
    } catch (error) {
      this.logger.error('Invalid webhook payload', error);
      throw new BadRequestException('Invalid webhook payload');
    }

    // Verify signature
    try {
      const rawBody = req.rawBody || req.body;
      const isValid = await this.plaidAdapter.verifySignature(req.headers, rawBody);
      if (!isValid) {
        this.logger.error('Webhook signature verification failed');
        throw new BadRequestException('Invalid webhook signature');
      }
    } catch (error) {
      this.logger.error('Webhook signature verification failed', error);
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Plaid webhook received: type=${payload.webhook_type}, code=${payload.webhook_code}`);
    this.logger.debug('Full payload:\n' + JSON.stringify(payload, null, 2));

    // Process webhook through service
    await this.plaidWebhookService.handleWebhook(payload);

    return { message: 'Plaid webhook processed successfully' };
  }
}
