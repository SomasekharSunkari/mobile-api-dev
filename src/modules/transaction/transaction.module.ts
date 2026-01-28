import { forwardRef, Module } from '@nestjs/common';
import { LockerModule } from '../../services/locker';
import { PushNotificationModule } from '../../services/pushNotification/pushNotification.module';
import { MailerModule } from '../../services/queue/processors/mailer/mailer.module';
import { UserModule } from '../auth/user/user.module';
import { UserProfileModule } from '../auth/userProfile/userProfile.module';
import { FiatWalletModule } from '../fiatWallet/fiatWallet.module';
import { FiatWalletTransactionModule } from '../fiatWalletTransactions/fiatWalletTransactions.module';
import { InAppNotificationModule } from '../inAppNotification/inAppNotification.module';
import { TransactionController } from './transaction.controller';
import { TransactionRepository } from './transaction.repository';
import { TransactionService } from './transaction.service';

@Module({
  controllers: [TransactionController],
  providers: [TransactionService, TransactionRepository],
  exports: [TransactionService, TransactionRepository],
  imports: [
    LockerModule,
    InAppNotificationModule,
    UserModule,
    PushNotificationModule,
    UserProfileModule,
    MailerModule,
    forwardRef(() => FiatWalletModule),
    forwardRef(() => FiatWalletTransactionModule),
  ],
})
export class TransactionModule {}
