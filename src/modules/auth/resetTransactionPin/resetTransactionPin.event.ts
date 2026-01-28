import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitterEventsEnum } from '../../../services/eventEmitter/eventEmitter.interface';
import { ResetTransactionPinService } from './resetTransactionPin.service';

@Injectable()
export class ResetTransactionPinEvent {
  @Inject(ResetTransactionPinService)
  private readonly resetTransactionPinService: ResetTransactionPinService;

  private readonly logger = new Logger(ResetTransactionPinEvent.name);

  @OnEvent(EventEmitterEventsEnum.REQUIRE_TRANSACTION_PIN_RESET)
  async handleRequireTransactionPinReset(userId: string) {
    this.logger.log('Require transaction pin reset for userId=', userId);
    this.logger.log(`Handling require transaction pin reset for userId=${userId}`);

    // lock the user account
    await this.resetTransactionPinService.requireTransactionPinReset(userId);
  }
}
