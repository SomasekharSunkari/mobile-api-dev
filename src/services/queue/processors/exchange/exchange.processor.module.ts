import { forwardRef, Module } from '@nestjs/common';
import { ExchangeAdapterModule } from '../../../../adapters/exchange/exchange.adapter.module';
import { FiatWalletAdapterModule } from '../../../../adapters/fiat-wallet/fiat-wallet.adapter.module';
import { KYCAdapterModule } from '../../../../adapters/kyc/kyc-adapter.module';
import { WaasModule } from '../../../../adapters/waas/waas.adapter.module';
import { FiatWalletConfigProvider } from '../../../../config/fiat-wallet.config';
import { UserModule } from '../../../../modules/auth/user/user.module';
import { CardModule } from '../../../../modules/card/card.module';
import { ExchangeModule } from '../../../../modules/exchange/exchange.module';
import { FiatWalletModule } from '../../../../modules/fiatWallet';
import { FiatWalletTransactionModule } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.module';
import { PagaLedgerAccountModule } from '../../../../modules/pagaLedgerAccount/pagaLedgerAccount.module';
import { PagaLedgerTransactionModule } from '../../../../modules/pagaLedgerTransaction/pagaLedgerTransaction.module';
import { RateModule } from '../../../../modules/rate/rate.module';
import { TransactionModule } from '../../../../modules/transaction';
import { VirtualAccountModule } from '../../../../modules/virtualAccount';
import { QueueModule } from '../../queue.module';
import { VirtualAccountQueueModule } from '../virtual-account/virtual-account-queue.module';
import { ExchangeProcessor } from './exchange.processor';
import { ExecuteNewNgUsdExchangeProcessor } from './execute-new-ng-usd-exchange.processor';
import { ExecuteNgUsdExchangeProcessor } from './execute-ng-usd-exchange.processor';

@Module({
  providers: [
    ExchangeProcessor,
    FiatWalletConfigProvider,
    ExecuteNgUsdExchangeProcessor,
    ExecuteNewNgUsdExchangeProcessor,
  ],
  exports: [ExchangeProcessor, ExecuteNgUsdExchangeProcessor, ExecuteNewNgUsdExchangeProcessor],
  imports: [
    QueueModule,
    TransactionModule,
    FiatWalletAdapterModule,
    ExchangeAdapterModule,
    UserModule,
    KYCAdapterModule,
    FiatWalletTransactionModule,
    WaasModule,
    TransactionModule,
    FiatWalletModule,
    PagaLedgerAccountModule,
    PagaLedgerTransactionModule,
    forwardRef(() => ExchangeModule),
    forwardRef(() => CardModule),
    VirtualAccountQueueModule,
    VirtualAccountModule,
    RateModule,
  ],
})
export class ExchangeProcessorModule {}
