import { Global, Module } from '@nestjs/common';
import { VerificationTokenRepository } from './verificationToken.repository';
import { VerificationTokenService } from './verificationToken.service';

@Global()
@Module({
  providers: [VerificationTokenRepository, VerificationTokenService],
  exports: [VerificationTokenService, VerificationTokenRepository],
})
export class VerificationTokenModule {}
