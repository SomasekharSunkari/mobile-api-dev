import { Module } from '@nestjs/common';
import { TierController } from './tier.controller';
import { TierRepository } from './tier.repository';
import { TierService } from './tier.service';

@Module({
  controllers: [TierController],
  providers: [TierService, TierRepository],
  exports: [TierService, TierRepository],
})
export class TierModule {}
