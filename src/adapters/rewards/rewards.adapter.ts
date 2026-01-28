import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import { IRewardsAdapter, RewardCreateRequest, RewardCreateResponse } from './rewards.adapter.interface';
import { ZerohashRewardsAdapter } from './zerohash/zerohash.adapter';

@Injectable()
export class RewardsAdapter implements IRewardsAdapter {
  @Inject(ZerohashRewardsAdapter)
  private readonly zerohashAdapter: ZerohashRewardsAdapter;

  async createReward(request: RewardCreateRequest, provider: string): Promise<RewardCreateResponse> {
    switch (provider.toLowerCase()) {
      case 'zerohash':
        return this.zerohashAdapter.createReward(request);
      default:
        throw new NotImplementedException(`No rewards support for provider ${provider}`);
    }
  }
}
