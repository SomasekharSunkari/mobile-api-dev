import { forwardRef, Module } from '@nestjs/common';
import { CardController } from './card.controller';
import { CardService } from './card.service';
import { CardUserRepository } from './repository/cardUser.repository';
import { CardRepository } from './repository/card.repository';
import { CardTransactionDisputeRepository } from './repository/cardTransactionDispute.repository';
import { CardTransactionDisputeEventRepository } from './repository/cardTransactionDisputeEvent.repository';
import { CardTransactionRepository } from './repository/cardTransaction.repository';
import { UserProfileModule } from '../auth/userProfile/userProfile.module';
import { UserModule } from '../auth/user/user.module';
import { LocationRestrictionModule } from '../auth/locationRestriction/locationRestriction.module';
import { KYCAdapterModule } from '../../adapters/kyc/kyc-adapter.module';
import { CardAdapterModule } from '../../adapters/card/card.adapter.module';
import { KycVerificationModule } from '../auth/kycVerification/kycVerification.module';
import { BlockChainWalletModule } from '../blockchainWallet/blockchainWallet.module';
import { DepositAddressModule } from '../depositAddress/depositAddress.module';
import { FiatWalletModule } from '../fiatWallet/fiatWallet.module';
import { InAppNotificationModule } from '../inAppNotification/inAppNotification.module';
import { TransactionModule } from '../transaction/transaction.module';
import { MailerModule } from '../../services/queue/processors/mailer/mailer.module';
import { CardProcessorModule } from '../../services/queue/processors/card/card.module';
import { StreamModule } from '../../services/streams/stream.module';
import { CountryModule } from '../country/country.module';
import { PushNotificationModule } from '../../services/pushNotification/pushNotification.module';
import { ExchangeModule } from '../exchange/exchange.module';

@Module({
  controllers: [CardController],
  providers: [
    CardService,
    CardUserRepository,
    CardRepository,
    CardTransactionRepository,
    CardTransactionDisputeRepository,
    CardTransactionDisputeEventRepository,
  ],
  exports: [
    CardUserRepository,
    CardRepository,
    CardTransactionRepository,
    CardTransactionDisputeRepository,
    CardTransactionDisputeEventRepository,
    CardService,
  ],
  imports: [
    UserProfileModule,
    UserModule,
    LocationRestrictionModule,
    KYCAdapterModule,
    CardAdapterModule,
    KycVerificationModule,
    BlockChainWalletModule,
    DepositAddressModule,
    FiatWalletModule,
    InAppNotificationModule,
    TransactionModule,
    MailerModule,
    StreamModule,
    CountryModule,
    PushNotificationModule,
    forwardRef(() => CardProcessorModule),
    ExchangeModule,
  ],
})
export class CardModule {}
