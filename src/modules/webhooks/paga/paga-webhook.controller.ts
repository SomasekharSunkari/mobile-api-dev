import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { BaseController } from '../../../base';
import { PagaWebhookAuthGuard } from './paga-webhook.guard';
import { PagaWebhookService } from './paga-webhook.service';

@Controller('/webhooks/paga')
export class PagaWebhookController extends BaseController {
  @Inject(PagaWebhookService)
  private readonly pagaWebhookService: PagaWebhookService;

  @UseGuards(PagaWebhookAuthGuard)
  @Post('persistent-account/notify')
  async handlePersistentAccountWebhook(@Body() payload: any): Promise<any> {
    this.logger.log('🚀 ~~ PagaWebhookController ~~ handlePersistentAccountWebhook ~~ payload:', payload);
    const result = await this.pagaWebhookService.handlePersistentAccountWebhook(payload);
    return this.transformResponse('Paga webhook received', result);
  }
}
