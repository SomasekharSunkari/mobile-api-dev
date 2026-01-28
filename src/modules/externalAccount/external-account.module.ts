import { Module, forwardRef } from '@nestjs/common';
import { ExternalAccountAdapterModule } from '../../adapters/external-account/external-account.adapter.module';
import { LinkBankAccountAdapterModule } from '../../adapters/link-bank-account/link-bank-account.adapter.module';
import { UserProfileModule } from '../auth/userProfile/userProfile.module';
import { CountryModule } from '../country/country.module';
import { FiatWalletModule } from '../fiatWallet/fiatWallet.module';
import { FiatWalletTransactionModule } from '../fiatWalletTransactions/fiatWalletTransactions.module';
import { TransactionModule } from '../transaction/transaction.module';
import { ExternalAccountController } from './external-account.controller';
import { ExternalAccountRepository } from './external-account.repository';
import { ExternalAccountService } from './external-account.service';
import { LinkExternalAccountController } from './link/link_external_account.controller';
import { LinkExternalAccountService } from './link/link_external_account.service';

import { AccessTokenModule } from '../auth/accessToken/accessToken.module';
import { UserModule } from '../auth/user/user.module';

import { ExecuteWalletModule } from '../../services/queue/processors/execute-wallet/execute-wallet.module';
import { LocationRestrictionModule } from '../auth/locationRestriction/locationRestriction.module';
import { InAppNotificationModule } from '../inAppNotification/inAppNotification.module';
import { TierModule } from '../tier/tier.module';
import { TierConfigModule } from '../tierConfig/tierConfig.module';
import { TransactionMonitoringModule } from '../transaction-monitoring/transaction-monitoring.module';
import { TransactionSumModule } from '../transaction-sum/transaction-sum.module';

@Module({
  controllers: [ExternalAccountController, LinkExternalAccountController],
  providers: [ExternalAccountService, ExternalAccountRepository, LinkExternalAccountService],
  imports: [
    LinkBankAccountAdapterModule,
    ExternalAccountAdapterModule,
    CountryModule,
    UserProfileModule,
    UserModule,
    TransactionModule,
    forwardRef(() => FiatWalletModule),
    FiatWalletTransactionModule,
    AccessTokenModule,
    ExecuteWalletModule,
    TierModule,
    TierConfigModule,
    TransactionSumModule,
    InAppNotificationModule,
    forwardRef(() => TransactionMonitoringModule),
    LocationRestrictionModule,
  ],
  exports: [ExternalAccountRepository, ExternalAccountService],
})
export class ExternalAccountModule {}
