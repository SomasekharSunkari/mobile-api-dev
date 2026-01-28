import { Body, Controller, Post, Headers, UseGuards, Inject } from '@nestjs/common';
import { BaseController } from '../../../base/base.controller';
import { RainWebhookService } from './rain-webhook.service';
import { RainWebhookAuthGuard } from './rain-webhook.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';

@ApiTags('Webhooks')
@Controller('webhooks')
@UseGuards(RainWebhookAuthGuard)
export class RainWebhookController extends BaseController {
  @Inject(RainWebhookService)
  private readonly rainWebhookService: RainWebhookService;

  @Post('rain')
  @ApiOperation({ summary: 'Handle Rain webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized webhook request' })
  @ApiHeader({ name: 'Signature', description: 'Rain webhook HMAC SHA256 signature', required: true })
  public async handleWebhook(@Body() body: any, @Headers() headers: Record<string, string>): Promise<any> {
    const safeMetadata = {
      resource: body?.resource || 'unknown',
      action: body?.action || 'unknown',
      webhookId: body?.id || 'N/A',
    };
    this.logger.log('Rain webhook received', safeMetadata);

    try {
      const result = await this.rainWebhookService.processWebhook(body, headers);

      return this.transformResponse('Rain webhook processed successfully', result);
    } catch (error) {
      // Log error without exposing sensitive webhook data
      this.logger.error('Failed to process Rain webhook', {
        message: error instanceof Error ? error.message : 'Unknown error',
        resource: body?.resource || 'unknown',
        action: body?.action || 'unknown',
        webhookId: body?.id || 'N/A',
        // Do not log error object directly as it may contain sensitive webhook data
      });
      return this.transformResponse('Failed to process Rain webhook', null, 500);
    }
  }
}
