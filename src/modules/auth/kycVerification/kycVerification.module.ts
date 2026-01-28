import { forwardRef, Global, Module } from '@nestjs/common';

import { KYCAdapterModule } from '../../../adapters/kyc/kyc-adapter.module';
import { ParticipantAdapterModule } from '../../../adapters/participant/participant.adapter.module';
import { ExternalAccountModule } from '../../../modules/externalAccount/external-account.module';
import { TierModule } from '../../tier/tier.module';
import { TierConfigModule } from '../../tierConfig';
import { KycStatusLogRepository } from '../kycStatusLog/kycStatusLog.repository';
import { KycStatusLogService } from '../kycStatusLog/kycStatusLog.service';
import { UserModule } from '../user/user.module';
import { UserProfileModule } from '../userProfile/userProfile.module';
import { KycVerificationController } from './kycVerification.controller';
import { KycVerificationRepository } from './kycVerification.repository';
import { KycVerificationService } from './kycVerification.service';

@Global()
@Module({
  controllers: [KycVerificationController],
  providers: [KycVerificationRepository, KycVerificationService, KycStatusLogService, KycStatusLogRepository],
  exports: [KycVerificationRepository, KycVerificationService],
  imports: [
    UserModule,
    UserProfileModule,
    KYCAdapterModule,
    TierConfigModule,
    ParticipantAdapterModule,
    forwardRef(() => TierModule),
    forwardRef(() => ExternalAccountModule),
  ],
})
export class KycVerificationModule {}
