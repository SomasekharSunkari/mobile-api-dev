import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '../../../../services/eventEmitter/eventEmitter.module';
import { LockerModule } from '../../../../services/locker';
import { TransactionPinModule } from '../../transactionPin/transactionPin.module';

import { TransactionPinGuard } from './transactionPin.guard';
import { UserModule } from '../../user/user.module';

@Global()
@Module({
  providers: [TransactionPinGuard],
  exports: [TransactionPinGuard],
  imports: [TransactionPinModule, LockerModule, EventEmitterModule, UserModule],
})
export class TransactionPinGuardModule {}
