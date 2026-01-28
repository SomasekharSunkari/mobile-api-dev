import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { SumsubWebhookPayload } from '../../../adapters/kyc/sumsub/sumsub.interface';
import { BaseController } from '../../../base';
import { SumsubWebhookAuthGuard } from './sumsub-webhook.guard';
import { SumsubWebhookService } from './sumsub-webhook.service';

@Controller('/webhooks/sumsub')
@UseGuards(SumsubWebhookAuthGuard)
export class SumsubWebhookController extends BaseController {
  @Inject(SumsubWebhookService)
  private readonly sumsubWebhookService: SumsubWebhookService;

  @Post()
  async processWebhook(@Body() payload: SumsubWebhookPayload) {
    const response = await this.sumsubWebhookService.processWebhook(payload);

    return this.transformResponse('Successfully Processed Webhook', response);
  }
}
