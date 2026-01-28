import { Module } from '@nestjs/common';
import { KycStatusLogRepository } from './kycStatusLog.repository';
import { KycStatusLogService } from './kycStatusLog.service';

@Module({
  providers: [KycStatusLogRepository, KycStatusLogService],
  exports: [KycStatusLogRepository, KycStatusLogService],
})
export class KycStatusLogModule {}
