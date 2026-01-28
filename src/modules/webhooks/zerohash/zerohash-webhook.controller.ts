import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ZerohashParticipantAdapter } from '../../../adapters/participant/zerohash/zerohash.adapter';
import { BaseController } from '../../../base';
import { ZeroHashWebhookEventType } from './zerohash-webhook.interface';
import { ZerohashWebhookService } from './zerohash-webhook.service';

@ApiTags('Webhooks - Zerohash')
@Controller('webhooks')
export class ZerohashWebhookController extends BaseController {
  private readonly webhookLogger = new Logger(ZerohashWebhookController.name);

  @Inject(ZerohashWebhookService)
  private readonly zerohashWebhookService: ZerohashWebhookService;

  @Inject(ZerohashParticipantAdapter)
  private readonly zerohashAdapter: ZerohashParticipantAdapter;

  @HttpCode(HttpStatus.OK)
  @Post('zerohash')
  @ApiOperation({ summary: 'Receive and verify Zerohash webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload or signature' })
  async handleWebhook(@Req() req: Request): Promise<any> {
    try {
      // Log all incoming headers for debugging
      // this.webhookLogger.log('=== ZeroHash Webhook Headers ===');
      //this.webhookLogger.log(JSON.stringify(req.headers, null, 2));
      // this.webhookLogger.log('=== End Headers ===');

      let payload: any;
      if (Buffer.isBuffer(req.body)) {
        payload = JSON.parse(req.body.toString('utf8'));
      } else {
        payload = req.body;
      }

      const eventTypeHeader = req.headers['x-zh-hook-payload-type'] as string;

      this.webhookLogger.debug('EVENT_TYPE:', eventTypeHeader);

      if (!eventTypeHeader) {
        this.webhookLogger.warn('Missing x-zh-hook-payload-type header');
        throw new BadRequestException('Missing event type in webhook headers');
      }

      // Log if we receive an unknown event type, but still process it
      const validEventTypes = Object.values(ZeroHashWebhookEventType);
      if (!validEventTypes.includes(eventTypeHeader as ZeroHashWebhookEventType)) {
        this.webhookLogger.warn(`Unknown event type received: ${eventTypeHeader} - will process as unhandled event`);
      }

      const eventType = eventTypeHeader as ZeroHashWebhookEventType;

      // Log the ZeroHash webhook payload (only event type in production, full payload in debug)
      this.webhookLogger.log(`ZeroHash webhook received: ${eventType}`);

      if (payload) {
        this.webhookLogger.debug(
          `Payload summary: participant_code=${payload.participant_code}, asset=${payload.asset}, movements_count=${payload.movements?.length || 0}`,
        );
      }

      // Verify webhook signature before processing
      const isValidSignature = this.zerohashAdapter.verifyWebhookSignature(req.headers, payload);
      if (!isValidSignature) {
        this.webhookLogger.error('ZeroHash webhook signature verification failed');
        throw new BadRequestException('Invalid webhook signature');
      }

      this.webhookLogger.log('ZeroHash webhook signature verification passed');

      await this.zerohashWebhookService.processWebhook(payload, eventType);

      return await this.transformResponse('Webhook processed successfully', {}, HttpStatus.OK);
    } catch (error) {
      this.webhookLogger.error(`Error processing webhook: ${error.message}`);
      this.webhookLogger.error(`Error stack: ${error.stack}`);
      throw new InternalServerErrorException('Failed to process ZeroHash webhook');
    }
  }

  @Post('zerohash/local')
  async handleLocalWebhook(@Req() req: Request): Promise<any> {
    return this.handleWebhook(req);
  }
}
