import { forwardRef, Module } from '@nestjs/common';
import { FiatWalletAdapterModule } from '../../adapters/fiat-wallet/fiat-wallet.adapter.module';
import { WaasModule } from '../../adapters/waas/waas.adapter.module';
import { FiatWalletConfigProvider } from '../../config/fiat-wallet.config';
import { LockerModule } from '../../services/locker';
import { PushNotificationModule } from '../../services/pushNotification/pushNotification.module';
import { MailerModule } from '../../services/queue/processors/mailer/mailer.module';
import { NgnWithdrawalModule } from '../../services/queue/processors/ngn-withdrawal/ngn-withdrawal.module';
import { QueueModule } from '../../services/queue/queue.module';
import { StreamModule } from '../../services/streams/stream.module';
import { LocationRestrictionModule } from '../auth/locationRestriction/locationRestriction.module';
import { UserModule } from '../auth/user/user.module';
import { UserRepository } from '../auth/user/user.repository';
import { UserProfileModule } from '../auth/userProfile';
import { BankModule } from '../bank';
import { ExternalAccountModule } from '../externalAccount/external-account.module';
import { ExternalAccountRepository } from '../externalAccount/external-account.repository';
import { FiatWalletTransactionModule } from '../fiatWalletTransactions/fiatWalletTransactions.module';
import { FiatWalletTransactionRepository } from '../fiatWalletTransactions/fiatWalletTransactions.repository';
import { InAppNotificationModule } from '../inAppNotification/inAppNotification.module';
import { TransactionModule } from '../transaction/transaction.module';
import { UserTierModule } from '../userTier';
import { VirtualAccountModule } from '../virtualAccount/virtualAccount.module';
import { CircuitBreakerService } from './circuitBreaker.service';
import { FiatWalletController } from './fiatWallet.controller';
import { FiatWalletRepository } from './fiatWallet.repository';
import { FiatWalletService } from './fiatWallet.service';
import { FiatWalletEscrowService } from './fiatWalletEscrow.service';
import { FiatWalletExchangeService } from './fiatWalletExchange.service';
import { FiatWalletWithdrawalService } from './fiatWalletWithdrawal.service';
import { WithdrawalCounterService } from './withdrawalCounter.service';
import { WithdrawalSessionService } from './withdrawalSession.service';

@Module({
  imports: [
    LockerModule,
    forwardRef(() => FiatWalletTransactionModule),
    forwardRef(() => TransactionModule),
    UserModule,
    forwardRef(() => ExternalAccountModule),
    FiatWalletAdapterModule,
    forwardRef(() => VirtualAccountModule),
    BankModule,
    WaasModule,
    StreamModule,
    UserProfileModule,
    PushNotificationModule,
    MailerModule,
    LocationRestrictionModule,
    InAppNotificationModule,
    QueueModule,
    forwardRef(() => UserTierModule),
    forwardRef(() => NgnWithdrawalModule),
  ],
  controllers: [FiatWalletController],
  providers: [
    FiatWalletRepository,
    FiatWalletService,
    FiatWalletWithdrawalService,
    FiatWalletExchangeService,
    FiatWalletTransactionRepository,
    ExternalAccountRepository,
    UserRepository,
    FiatWalletConfigProvider,
    WithdrawalCounterService,
    WithdrawalSessionService,
    CircuitBreakerService,
    FiatWalletEscrowService,
  ],
  exports: [
    FiatWalletRepository,
    FiatWalletService,
    FiatWalletWithdrawalService,
    FiatWalletExchangeService,
    FiatWalletConfigProvider,
    FiatWalletEscrowService,
  ],
})
export class FiatWalletModule {}
