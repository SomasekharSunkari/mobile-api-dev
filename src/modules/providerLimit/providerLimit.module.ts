import { Module } from '@nestjs/common';
import { ProviderLimitRepository } from './providerLimit.repository';
import { ProviderLimitService } from './providerLimit.service';

@Module({
  providers: [ProviderLimitService, ProviderLimitRepository],
  exports: [ProviderLimitService, ProviderLimitRepository],
})
export class ProviderLimitModule {}
