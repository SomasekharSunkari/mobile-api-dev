import { forwardRef, Module } from '@nestjs/common';
import { ExchangeAdapterModule } from '../../../adapters/exchange/exchange.adapter.module';
import { FiatWalletAdapterModule } from '../../../adapters/fiat-wallet/fiat-wallet.adapter.module';
import { KYCAdapterModule } from '../../../adapters/kyc/kyc-adapter.module';
import { ParticipantAdapterModule } from '../../../adapters/participant/participant.adapter.module';
import { KycStatusLogModule } from '../../../modules/auth/kycStatusLog/kycStatusLog.module';
import { UserModule } from '../../../modules/auth/user/user.module';
import { UserProfileModule } from '../../../modules/auth/userProfile/userProfile.module';
import { BlockchainWalletTransactionModule } from '../../../modules/blockchainWalletTransaction/blockchainWalletTransaction.module';
import { DoshPointsModule } from '../../../modules/doshPoints/doshPoints.module';
import { ExternalAccountModule } from '../../../modules/externalAccount/external-account.module';
import { FiatWalletModule } from '../../../modules/fiatWallet/fiatWallet.module';
import { FiatWalletTransactionModule } from '../../../modules/fiatWalletTransactions/fiatWalletTransactions.module';
import { RateModule } from '../../../modules/rate/rate.module';
import { RateConfigModule } from '../../../modules/rateConfig/rateConfig.module';
import { TransactionModule } from '../../../modules/transaction/transaction.module';
import { TransactionAggregateModule } from '../../../modules/transactionAggregate/transactionAggregate.module';
import { VirtualAccountModule } from '../../../modules/virtualAccount';
import { LockerModule } from '../../../services/locker';
import { UsdFiatRewardsModule } from '../../../services/queue/processors/usd-fiat-rewards/usd-fiat-rewards.module';
import { VirtualAccountQueueModule } from '../../../services/queue/processors/virtual-account/virtual-account-queue.module';
import { YellowCardWebhookModule } from '../yellowcard/yellowcard-webhook.module';
import { ZerohashWebhookController } from './zerohash-webhook.controller';
import { ZerohashWebhookService } from './zerohash-webhook.service';

@Module({
  imports: [
    KycStatusLogModule,
    KYCAdapterModule,
    UserModule,
    UserProfileModule,
    ExternalAccountModule,
    TransactionModule,
    TransactionAggregateModule,
    FiatWalletTransactionModule,
    FiatWalletModule,
    FiatWalletAdapterModule,
    ParticipantAdapterModule,
    BlockchainWalletTransactionModule,
    LockerModule,
    forwardRef(() => YellowCardWebhookModule),
    DoshPointsModule,
    UsdFiatRewardsModule,
    RateModule,
    RateConfigModule,
    ExchangeAdapterModule,
    VirtualAccountModule,
    VirtualAccountQueueModule,
  ],
  controllers: [ZerohashWebhookController],
  providers: [ZerohashWebhookService],
  exports: [ZerohashWebhookService],
})
export class ZerohashWebhookModule {}
