import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitterEventsEnum, ServiceStatusEventPayload } from '../../services/eventEmitter/eventEmitter.interface';
import { PlatformStatusService } from './platformStatus.service';

@Injectable()
export class PlatformStatusListener implements OnModuleInit {
  private readonly logger = new Logger(PlatformStatusListener.name);

  @Inject(PlatformStatusService)
  private readonly platformStatusService: PlatformStatusService;

  onModuleInit() {
    this.logger.log('PlatformStatusListener initialized');
  }

  @OnEvent(EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS)
  async handleServiceSuccess(payload: ServiceStatusEventPayload): Promise<void> {
    this.logger.log(`Handling service success event for: ${payload.serviceKey}`);

    try {
      await this.platformStatusService.reportServiceSuccess(payload.serviceKey);
    } catch (error) {
      this.logger.error(`Failed to update service status for ${payload.serviceKey}: ${error.message}`, error.stack);
    }
  }

  @OnEvent(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE)
  async handleServiceFailure(payload: ServiceStatusEventPayload): Promise<void> {
    this.logger.log(`Handling service failure event for: ${payload.serviceKey}, reason: ${payload.reason}`);

    try {
      await this.platformStatusService.reportServiceFailure(payload.serviceKey, payload.reason || 'Unknown error');
    } catch (error) {
      this.logger.error(`Failed to update service status for ${payload.serviceKey}: ${error.message}`, error.stack);
    }
  }
}
