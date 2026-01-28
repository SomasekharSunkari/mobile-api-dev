import { Module } from '@nestjs/common';
import { KycStatusLogModule } from '../auth/kycStatusLog/kycStatusLog.module';
import { BlockchainAccountsModule } from '../blockchainAccounts/blockchainAccounts.module';
import { ExternalAccountModule } from '../externalAccount/external-account.module';
import { TransactionModule } from '../transaction/transaction.module';
import { VirtualAccountModule } from '../virtualAccount/virtualAccount.module';
import { VirtualAccountRepository } from '../virtualAccount/virtualAccount.repository';
import { ActivityController } from './activity.controller';
import { ActivityRepository } from './activity.repository';
import { ActivityService } from './activity.service';

@Module({
  imports: [
    TransactionModule,
    ExternalAccountModule,
    BlockchainAccountsModule,
    VirtualAccountModule,
    KycStatusLogModule,
  ],
  controllers: [ActivityController],
  providers: [ActivityService, ActivityRepository, VirtualAccountRepository],
  exports: [ActivityService],
})
export class ActivityModule {}
