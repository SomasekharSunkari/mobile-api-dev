import { forwardRef, Module } from '@nestjs/common';
import { FireblocksAdapter } from '../../../adapters/blockchain-waas/fireblocks/fireblocks_adapter';
import { ExchangeAdapterModule } from '../../../adapters/exchange/exchange.adapter.module';
import { ExchangeProcessorModule } from '../../../services/queue/processors/exchange/exchange.processor.module';
import { VirtualAccountQueueModule } from '../../../services/queue/processors/virtual-account/virtual-account-queue.module';
import { UserModule } from '../../auth/user/user.module';
import { ExchangeModule } from '../../exchange/exchange.module';
import { FiatWalletModule } from '../../fiatWallet';
import { FiatWalletTransactionModule } from '../../fiatWalletTransactions/fiatWalletTransactions.module';
import { PagaLedgerAccountModule } from '../../pagaLedgerAccount/pagaLedgerAccount.module';
import { RateModule } from '../../rate/rate.module';
import { RateConfigModule } from '../../rateConfig/rateConfig.module';
import { TransactionModule } from '../../transaction/transaction.module';
import { VirtualAccountModule } from '../../virtualAccount';
import { ZerohashWebhookModule } from '../zerohash/zerohash-webhook.module';
import { YellowCardWebhookController } from './yellowcard-webhook.controller';
import { YellowCardWebhookService } from './yellowcard-webhook.service';

@Module({
  imports: [
    ExchangeAdapterModule,
    TransactionModule,
    FiatWalletTransactionModule,
    VirtualAccountModule,
    FiatWalletModule,
    PagaLedgerAccountModule,
    RateModule,
    UserModule,
    RateConfigModule,
    VirtualAccountQueueModule,
    ExchangeProcessorModule,
    ExchangeModule,
    forwardRef(() => ZerohashWebhookModule),
  ],
  controllers: [YellowCardWebhookController],
  providers: [YellowCardWebhookService, FireblocksAdapter],
  exports: [YellowCardWebhookService],
})
export class YellowCardWebhookModule {}
