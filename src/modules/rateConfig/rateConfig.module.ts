import { Module } from '@nestjs/common';
import { RateConfigRepository } from './rateConfig.repository';

@Module({
  providers: [RateConfigRepository],
  exports: [RateConfigRepository],
})
export class RateConfigModule {}
