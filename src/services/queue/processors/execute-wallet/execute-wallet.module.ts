import { Module } from '@nestjs/common';
import { ExternalAccountAdapterModule } from '../../../../adapters/external-account/external-account.adapter.module';
import { WaasModule } from '../../../../adapters/waas/waas.adapter.module';
import { FiatWalletTransactionModule } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.module';
import { PagaLedgerTransactionModule } from '../../../../modules/pagaLedgerTransaction/pagaLedgerTransaction.module';
import { TransactionModule } from '../../../../modules/transaction/transaction.module';
import { QueueModule } from '../../queue.module';
import { ExecuteWalletProcessor } from './execute-wallet.processor';
import { ExchangeAdapterModule } from '../../../../adapters/exchange/exchange.adapter.module';

@Module({
  imports: [
    QueueModule,
    ExternalAccountAdapterModule,
    TransactionModule,
    FiatWalletTransactionModule,
    WaasModule,
    PagaLedgerTransactionModule,
    ExchangeAdapterModule,
  ],
  providers: [ExecuteWalletProcessor],
  exports: [ExecuteWalletProcessor],
})
export class ExecuteWalletModule {}
