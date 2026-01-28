import { Inject, Injectable, Logger } from '@nestjs/common';
import { NgnAccountRetryProcessor } from '../../services/queue/processors/ngn-account-retry/ngn-account-retry.processor';
import { TriggerNgnAccountRetryResponseDto } from './dtos/triggerRetry.dto';

@Injectable()
export class NgnAccountRetryService {
  private readonly logger = new Logger(NgnAccountRetryService.name);

  @Inject(NgnAccountRetryProcessor)
  private readonly ngnAccountRetryProcessor: NgnAccountRetryProcessor;

  /**
   * Trigger NGN account retry for eligible users
   * Queues a scan job that processes users in chunks of 500
   */
  async triggerRetry(): Promise<TriggerNgnAccountRetryResponseDto> {
    this.logger.log('Triggering NGN account retry via queue scan');

    await this.ngnAccountRetryProcessor.queueScanJob();

    this.logger.log('NGN account retry scan job queued successfully');

    return {
      message: 'Scan job queued. Users will be processed in chunks of 500.',
    };
  }
}
