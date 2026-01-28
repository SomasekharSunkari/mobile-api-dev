import { Module } from '@nestjs/common';
import { TransactionMonitoringAdapterModule } from '../../../adapters/transaction-monitoring/transaction-monitoring-adapter.module';
import { ExternalAccountRepository } from '../../externalAccount/external-account.repository';
import { KycVerificationRepository } from '../kycVerification/kycVerification.repository';
import { UserProfileModule } from '../userProfile';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

@Module({
  providers: [UserRepository, UserService, KycVerificationRepository, ExternalAccountRepository],
  exports: [UserRepository, UserService],
  controllers: [UserController],
  imports: [UserProfileModule, TransactionMonitoringAdapterModule],
})
export class UserModule {}
