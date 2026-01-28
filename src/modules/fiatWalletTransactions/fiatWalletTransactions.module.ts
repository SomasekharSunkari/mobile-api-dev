import { forwardRef, Module } from '@nestjs/common';
import { LockerModule } from '../../services/locker';
import { FiatWalletModule } from '../fiatWallet/fiatWallet.module';
import { TransactionModule } from '../transaction/transaction.module';
import { FiatWalletTransactionController } from './fiatWalletTransactions.controller';
import { FiatWalletTransactionRepository } from './fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from './fiatWalletTransactions.service';

@Module({
  imports: [LockerModule, forwardRef(() => FiatWalletModule), forwardRef(() => TransactionModule)],
  controllers: [FiatWalletTransactionController],
  providers: [FiatWalletTransactionService, FiatWalletTransactionRepository],
  exports: [FiatWalletTransactionService, FiatWalletTransactionRepository],
})
export class FiatWalletTransactionModule {}
