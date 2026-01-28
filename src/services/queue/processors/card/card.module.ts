import { forwardRef, Module } from '@nestjs/common';
import { BlockChainWalletModule } from '../../../../modules/blockchainWallet/blockchainWallet.module';
import { CardModule } from '../../../../modules/card/card.module';
import { DepositAddressModule } from '../../../../modules/depositAddress/depositAddress.module';
import { FiatWalletModule } from '../../../../modules/fiatWallet/fiatWallet.module';
import { ExchangeAdapterModule } from '../../../../adapters/exchange/exchange.adapter.module';
import { WaasModule } from '../../../../adapters/waas/waas.adapter.module';
import { QueueModule } from '../../queue.module';
import { TransactionModule } from '../../../../modules/transaction/transaction.module';
import { FiatWalletTransactionModule } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.module';
import { CardFundingProcessor } from './card-fund.processor';
import { CardFundingFromNGNProcessor } from './card-funding-from-ngn.processor';
import { ExchangeModule } from '../../../../modules/exchange/exchange.module';
import { ExchangeProcessorModule } from '../exchange/exchange.processor.module';
import { PagaLedgerAccountModule } from '../../../../modules/pagaLedgerAccount/pagaLedgerAccount.module';
import { PagaLedgerTransactionModule } from '../../../../modules/pagaLedgerTransaction/pagaLedgerTransaction.module';
import { VirtualAccountModule } from '../../../../modules/virtualAccount';
import { RateModule } from '../../../../modules/rate/rate.module';

@Module({
  imports: [
    QueueModule,
    forwardRef(() => CardModule),
    DepositAddressModule,
    FiatWalletModule,
    BlockChainWalletModule,
    ExchangeAdapterModule,
    TransactionModule,
    FiatWalletTransactionModule,
    WaasModule,
    ExchangeModule,
    forwardRef(() => ExchangeProcessorModule),
    PagaLedgerAccountModule,
    PagaLedgerTransactionModule,
    VirtualAccountModule,
    RateModule,
  ],
  providers: [CardFundingProcessor, CardFundingFromNGNProcessor],
  exports: [CardFundingProcessor, CardFundingFromNGNProcessor],
})
export class CardProcessorModule {}
