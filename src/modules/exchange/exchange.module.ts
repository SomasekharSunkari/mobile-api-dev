import { forwardRef, Module } from '@nestjs/common';
import { ExchangeAdapterModule } from '../../adapters/exchange/exchange.adapter.module';
import { FiatWalletAdapterModule } from '../../adapters/fiat-wallet/fiat-wallet.adapter.module';
import { KYCAdapterModule } from '../../adapters/kyc/kyc-adapter.module';
import { ParticipantAdapterModule } from '../../adapters/participant/participant.adapter.module';
import { WaasModule } from '../../adapters/waas/waas.adapter.module';
import { LockerModule } from '../../services/locker';
import { ExchangeProcessorModule } from '../../services/queue/processors/exchange/exchange.processor.module';
import { ExecuteWalletModule } from '../../services/queue/processors/execute-wallet/execute-wallet.module';
import { AuthModule } from '../auth/auth.module';
import { LocationRestrictionModule } from '../auth/locationRestriction/locationRestriction.module';
import { UserModule } from '../auth/user/user.module';
import { SystemUsersBeneficiaryModule } from '../beneficiaries/systemUsersBeneficiary';
import { DepositAddressModule } from '../depositAddress/depositAddress.module';
import { ExternalAccountModule } from '../externalAccount/external-account.module';
import { FiatWalletModule } from '../fiatWallet';
import { FiatWalletTransactionModule } from '../fiatWalletTransactions/fiatWalletTransactions.module';
import { PagaLedgerAccountModule } from '../pagaLedgerAccount/pagaLedgerAccount.module';
import { RateModule } from '../rate/rate.module';
import { RateConfigModule } from '../rateConfig/rateConfig.module';
import { RateTransactionModule } from '../rateTransaction/rateTransaction.module';
import { TransactionModule } from '../transaction/transaction.module';
import { UserTierModule } from '../userTier';
import { VirtualAccountModule } from '../virtualAccount';
import { ExchangeRetryService } from './exchange-retry.service';
import { ExchangeController } from './exchange.controller';
import { FiatExchangeService } from './fiat-exchange/fiat-exchange.service';
import { NewNgToUsdExchangeService } from './fiat-exchange/ng-to-usd-exchange.service/new-ng-to-usd-exchange.service';
import { NgToUsdExchangeEscrowService } from './fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.escrow.service';
import { NgToUsdExchangeService } from './fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.service';

@Module({
  controllers: [ExchangeController],
  providers: [
    FiatExchangeService,
    NgToUsdExchangeService,
    NewNgToUsdExchangeService,
    NgToUsdExchangeEscrowService,
    ExchangeRetryService,
  ],
  exports: [
    FiatExchangeService,
    NgToUsdExchangeService,
    NewNgToUsdExchangeService,
    NgToUsdExchangeEscrowService,
    ExchangeRetryService,
  ],
  imports: [
    AuthModule,
    FiatWalletModule,
    KYCAdapterModule,
    ExchangeAdapterModule,
    UserModule,
    VirtualAccountModule,
    ParticipantAdapterModule,
    ExternalAccountModule,
    LockerModule,
    TransactionModule,
    FiatWalletTransactionModule,
    RateTransactionModule,
    SystemUsersBeneficiaryModule,
    DepositAddressModule,
    FiatWalletAdapterModule,
    forwardRef(() => ExchangeProcessorModule),
    RateModule,
    WaasModule,
    ExecuteWalletModule,
    LocationRestrictionModule,
    UserTierModule,
    RateConfigModule,
    PagaLedgerAccountModule,
  ],
})
export class ExchangeModule {}
