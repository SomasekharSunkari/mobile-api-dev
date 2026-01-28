import { Module } from '@nestjs/common';
import { PlatformStatusLogRepository } from './platformStatusLog.repository';

@Module({
  providers: [PlatformStatusLogRepository],
  exports: [PlatformStatusLogRepository],
})
export class PlatformStatusLogModule {}
