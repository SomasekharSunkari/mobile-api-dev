import { forwardRef, Module } from '@nestjs/common';
import { RewardsAdapterModule } from '../../../../adapters/rewards/rewards.adapter.module';
import { DoshPointsModule } from '../../../../modules/doshPoints/doshPoints.module';
import { FiatWalletModule } from '../../../../modules/fiatWallet/fiatWallet.module';
import { FiatWalletTransactionModule } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.module';
import { InAppNotificationModule } from '../../../../modules/inAppNotification/inAppNotification.module';
import { TransactionModule } from '../../../../modules/transaction/transaction.module';
import { QueueModule } from '../../queue.module';
import { UsdFiatRewardsProcessor } from './usd-fiat-rewards.processor';

@Module({
  imports: [
    QueueModule,
    RewardsAdapterModule,
    forwardRef(() => DoshPointsModule),
    TransactionModule,
    FiatWalletTransactionModule,
    FiatWalletModule,
    InAppNotificationModule,
  ],
  providers: [UsdFiatRewardsProcessor],
  exports: [UsdFiatRewardsProcessor],
})
export class UsdFiatRewardsModule {}
