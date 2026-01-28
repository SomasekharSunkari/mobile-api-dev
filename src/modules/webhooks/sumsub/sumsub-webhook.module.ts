import { Module, forwardRef } from '@nestjs/common';
import { KYCAdapterModule } from '../../../adapters/kyc/kyc-adapter.module';
import { WaasModule } from '../../../adapters/waas/waas.adapter.module';
import { QueueModule } from '../../../services/queue/queue.module';
import { KycStatusLogModule } from '../../auth/kycStatusLog/kycStatusLog.module';
import { UserModule } from '../../auth/user/user.module';
import { UserProfileModule } from '../../auth/userProfile';
import { BlockChainWalletModule } from '../../blockchainWallet/blockchainWallet.module';
import { DoshPointsModule } from '../../doshPoints/doshPoints.module';
import { ExternalAccountModule } from '../../externalAccount/external-account.module';
import { FiatWalletModule } from '../../fiatWallet';
import { InAppNotificationModule } from '../../inAppNotification/inAppNotification.module';
import { ParticipantModule } from '../../participant';
import { TierConfigModule } from '../../tierConfig';
import { VirtualAccountModule } from '../../virtualAccount';
import { SumsubWebhookController } from './sumsub-webhook.controller';
import { SumsubWebhookService } from './sumsub-webhook.service';

@Module({
  controllers: [SumsubWebhookController],
  providers: [SumsubWebhookService],
  imports: [
    KycStatusLogModule,
    KYCAdapterModule,
    ParticipantModule,
    UserModule,
    UserProfileModule,
    BlockChainWalletModule,
    DoshPointsModule,
    FiatWalletModule,
    VirtualAccountModule,
    WaasModule,
    TierConfigModule,
    QueueModule,
    InAppNotificationModule,
    forwardRef(() => ExternalAccountModule),
  ],
})
export class SumsubWebhookModule {}
