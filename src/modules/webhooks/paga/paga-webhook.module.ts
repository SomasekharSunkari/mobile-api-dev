import { forwardRef, Module } from '@nestjs/common';
import { ExchangeAdapterModule } from '../../../adapters/exchange/exchange.adapter.module';
import { WaasModule } from '../../../adapters/waas/waas.adapter.module';
import { PushNotificationModule } from '../../../services/pushNotification/pushNotification.module';
import { UserModule } from '../../auth/user/user.module';
import { UserProfileModule } from '../../auth/userProfile';
import { ExternalAccountModule } from '../../externalAccount/external-account.module';
import { FiatWalletModule } from '../../fiatWallet';
import { FiatWalletTransactionModule } from '../../fiatWalletTransactions/fiatWalletTransactions.module';
import { PagaLedgerAccountModule } from '../../pagaLedgerAccount/pagaLedgerAccount.module';
import { PagaLedgerTransactionModule } from '../../pagaLedgerTransaction/pagaLedgerTransaction.module';
import { RateModule } from '../../rate/rate.module';
import { RateConfigModule } from '../../rateConfig/rateConfig.module';
import { TransactionModule } from '../../transaction';
import { VirtualAccountModule } from '../../virtualAccount';
import { ZerohashWebhookModule } from '../zerohash/zerohash-webhook.module';
import { PagaWebhookController } from './paga-webhook.controller';
import { PagaWebhookService } from './paga-webhook.service';

@Module({
  controllers: [PagaWebhookController],
  providers: [PagaWebhookService],
  imports: [
    WaasModule,
    TransactionModule,
    FiatWalletModule,
    PagaLedgerAccountModule,
    PagaLedgerTransactionModule,
    TransactionModule,
    FiatWalletTransactionModule,
    VirtualAccountModule,
    ExternalAccountModule,
    PushNotificationModule,
    UserModule,
    UserProfileModule,
    RateModule,
    RateConfigModule,
    ExchangeAdapterModule,
    forwardRef(() => ZerohashWebhookModule),
  ],
})
export class PagaWebhookModule {}
