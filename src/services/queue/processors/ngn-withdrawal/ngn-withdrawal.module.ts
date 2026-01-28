import { forwardRef, Module } from '@nestjs/common';
import { WaasModule } from '../../../../adapters/waas/waas.adapter.module';
import { UserModule } from '../../../../modules/auth/user/user.module';
import { FiatWalletTransactionModule } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.module';
import { TransactionModule } from '../../../../modules/transaction/transaction.module';
import { EventEmitterModule } from '../../../eventEmitter/eventEmitter.module';
import { QueueModule } from '../../queue.module';
import { MailerModule } from '../mailer/mailer.module';
import { NgnWithdrawalStatusProcessor } from './ngn-withdrawal-status.processor';
import { FiatWalletModule } from '../../../../modules/fiatWallet';

@Module({
  imports: [
    MailerModule,
    WaasModule,
    forwardRef(() => TransactionModule),
    forwardRef(() => FiatWalletTransactionModule),
    forwardRef(() => FiatWalletModule),
    UserModule,
    EventEmitterModule,
    QueueModule,
  ],
  providers: [NgnWithdrawalStatusProcessor],
  exports: [NgnWithdrawalStatusProcessor],
})
export class NgnWithdrawalModule {}
