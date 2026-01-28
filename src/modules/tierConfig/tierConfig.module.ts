import { Module } from '@nestjs/common';
import { TierConfigController } from './tierConfig.controller';
import { TierConfigRepository } from './tierConfig.repository';
import { TierConfigService } from './tierConfig.service';

@Module({
  providers: [TierConfigRepository, TierConfigService],
  exports: [TierConfigService, TierConfigRepository],
  controllers: [TierConfigController],
})
export class TierConfigModule {}
