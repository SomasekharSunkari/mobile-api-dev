import { Module } from '@nestjs/common';
import { CardAdapterModule } from '../../../adapters/card/card.adapter.module';
import { CardUserRepository } from '../../card/repository/cardUser.repository';
import { CardRepository } from '../../card/repository/card.repository';
import { CardTransactionRepository } from '../../card/repository/cardTransaction.repository';
import { CardTransactionDisputeRepository } from '../../card/repository/cardTransactionDispute.repository';
import { CardModule } from '../../card/card.module';
import { DepositAddressRepository } from '../../depositAddress/depositAddress.repository';
import { UserProfileRepository } from '../../auth/userProfile/userProfile.repository';
import { UserRepository } from '../../auth/user/user.repository';
import { BlockchainWalletRepository } from '../../blockchainWallet/blockchainWallet.repository';
import { TransactionRepository } from '../../transaction/transaction.repository';
import { InAppNotificationModule } from '../../inAppNotification/inAppNotification.module';
import { MailerModule } from '../../../services/queue/processors/mailer/mailer.module';
import { UserModule } from '../../auth/user/user.module';
import { RainWebhookController } from './rain-webhook.controller';
import { RainWebhookService } from './rain-webhook.service';

@Module({
  imports: [CardAdapterModule, InAppNotificationModule, MailerModule, UserModule, CardModule],
  controllers: [RainWebhookController],
  providers: [
    RainWebhookService,
    CardUserRepository,
    CardRepository,
    CardTransactionRepository,
    CardTransactionDisputeRepository,
    DepositAddressRepository,
    UserProfileRepository,
    UserRepository,
    BlockchainWalletRepository,
    TransactionRepository,
  ],
  exports: [RainWebhookService],
})
export class RainWebhookModule {}
