import { Module } from '@nestjs/common';
import { KYCAdapterModule } from '../../../../adapters/kyc/kyc-adapter.module';
import { UserModule } from '../../../../modules/auth/user/user.module';
import { FiatWalletModule } from '../../../../modules/fiatWallet';
import { UserTierModule } from '../../../../modules/userTier';
import { VirtualAccountModule } from '../../../../modules/virtualAccount';
import { QueueModule } from '../../queue.module';
import { NgnAccountRetryProcessor } from './ngn-account-retry.processor';

@Module({
  imports: [QueueModule, VirtualAccountModule, FiatWalletModule, KYCAdapterModule, UserModule, UserTierModule],
  providers: [NgnAccountRetryProcessor],
  exports: [NgnAccountRetryProcessor],
})
export class NgnAccountRetryModule {}
