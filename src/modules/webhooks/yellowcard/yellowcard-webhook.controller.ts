import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { YellowCardWebhookProcessResponse } from '../../../adapters/exchange/yellowcard/yellowcard.interface';
import { YellowCardWebhookGuard } from './yellowcard-webhook.guard';
import { YellowCardWebhookService } from './yellowcard-webhook.service';

@Controller('/webhooks/yellowcard')
@UseGuards(YellowCardWebhookGuard)
export class YellowCardWebhookController {
  constructor(private readonly yellowCardWebhookService: YellowCardWebhookService) {}

  @Post()
  async handleWebhook(@Body() payload: any): Promise<YellowCardWebhookProcessResponse> {
    const response = await this.yellowCardWebhookService.processWebhook(payload);

    return response;
  }
}
