import { Module } from '@nestjs/common';
import { SystemConfigController } from './systemConfig.controller';
import { SystemConfigRepository } from './systemConfig.repository';
import { SystemConfigService } from './systemConfig.service';

@Module({
  controllers: [SystemConfigController],
  providers: [SystemConfigService, SystemConfigRepository],
  exports: [SystemConfigService, SystemConfigRepository],
})
export class SystemConfigModule {}
