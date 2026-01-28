import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformStatusLogModule } from '../platformStatusLog/platformStatusLog.module';
import { PlatformStatusLogRepository } from '../platformStatusLog/platformStatusLog.repository';
import { PlatformStatusListener } from './platformStatus.listener';
import { PlatformStatusRepository } from './platformStatus.repository';
import { PlatformStatusService } from './platformStatus.service';

@Module({
  imports: [PlatformStatusLogModule],
  providers: [PlatformStatusService, PlatformStatusRepository, PlatformStatusLogRepository, PlatformStatusListener],
  exports: [PlatformStatusService],
})
export class PlatformStatusModule implements OnModuleInit {
  constructor(private readonly platformStatusService: PlatformStatusService) {}

  async onModuleInit() {
    await this.platformStatusService.initializeAllServiceStatuses();
  }
}
