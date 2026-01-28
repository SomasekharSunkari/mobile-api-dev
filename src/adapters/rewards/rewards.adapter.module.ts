import { Module } from '@nestjs/common';
import { RewardsAdapter } from './rewards.adapter';
import { ZerohashRewardsAdapter } from './zerohash/zerohash.adapter';

@Module({
  providers: [RewardsAdapter, ZerohashRewardsAdapter],
  exports: [RewardsAdapter],
})
export class RewardsAdapterModule {}
