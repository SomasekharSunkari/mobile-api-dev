import { Module, OnModuleInit } from '@nestjs/common';
import { EventEmitterEventsEnum } from '../../../services/eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../../services/eventEmitter/eventEmitter.service';
import { TransactionPinModule } from '../transactionPin/transactionPin.module';
import { TransactionPinRepository } from '../transactionPin/transactionPin.repository';
import { UserRepository } from '../user/user.repository';
import { ResetTransactionPinController } from './resetTransactionPin.controller';
import { ResetTransactionPinEvent } from './resetTransactionPin.event';
import { ResetTransactionPinRepository } from './resetTransactionPin.repository';
import { ResetTransactionPinService } from './resetTransactionPin.service';

@Module({
  imports: [TransactionPinModule],
  controllers: [ResetTransactionPinController],
  providers: [
    ResetTransactionPinService,
    ResetTransactionPinRepository,
    TransactionPinRepository,
    UserRepository,
    ResetTransactionPinEvent,
  ],
  exports: [ResetTransactionPinService],
})
export class ResetTransactionPinModule implements OnModuleInit {
  constructor(
    private readonly eventEmitterService: EventEmitterService,
    private readonly resetTransactionPinService: ResetTransactionPinService,
  ) {}

  onModuleInit() {
    this.eventEmitterService.on(EventEmitterEventsEnum.REQUIRE_TRANSACTION_PIN_RESET, async (userId: string) => {
      await this.resetTransactionPinService.requireTransactionPinReset(userId);
    });
  }
}
