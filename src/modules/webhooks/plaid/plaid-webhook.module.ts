import { Module } from '@nestjs/common';
import { ExternalAccountAdapterModule } from '../../../adapters/external-account/external-account.adapter.module';
import { LinkBankAccountAdapterModule } from '../../../adapters/link-bank-account/link-bank-account.adapter.module';
import { UserModule } from '../../auth/user/user.module';
import { ExternalAccountModule } from '../../externalAccount/external-account.module';
import { InAppNotificationModule } from '../../inAppNotification/inAppNotification.module';
import { PlaidWebhookController } from './plaid-webhook.controller';
import { PlaidWebhookService } from './plaid-webhook.service';

@Module({
  imports: [
    ExternalAccountModule,
    LinkBankAccountAdapterModule,
    UserModule,
    ExternalAccountAdapterModule,
    InAppNotificationModule,
  ],
  controllers: [PlaidWebhookController],
  providers: [PlaidWebhookService],
})
export class PlaidWebhookModule {}
