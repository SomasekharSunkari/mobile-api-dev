import { Module } from '@nestjs/common';
import { LockerModule } from '../../../services/locker';
import { UserRepository } from '../user/user.repository';
import { TransactionPinController } from './transactionPin.controller';
import { TransactionPinRepository } from './transactionPin.repository';
import { TransactionPinService } from './transactionPin.service';

@Module({
  controllers: [TransactionPinController],
  providers: [TransactionPinRepository, TransactionPinService, UserRepository],
  exports: [TransactionPinRepository, TransactionPinService],
  imports: [LockerModule],
})
export class TransactionPinModule {}
