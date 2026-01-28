import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE } from '../../../constants/constants';
import { ZerohashAxiosHelper } from '../../participant/zerohash/zerohash.axios';
import { IRewardsAdapter, RewardCreateRequest, RewardCreateResponse } from '../rewards.adapter.interface';
import { ZeroHashCreateRewardRequest, ZeroHashCreateRewardWrappedResponse } from './zerohash.interface';

@Injectable()
export class ZerohashRewardsAdapter extends ZerohashAxiosHelper implements IRewardsAdapter {
  private readonly logger = new Logger(ZerohashRewardsAdapter.name);

  /**
   * Create a reward payout for a participant
   * @param request - The reward request containing user ref and amount
   * @returns The reward response with provider reference and status
   */
  async createReward(request: RewardCreateRequest): Promise<RewardCreateResponse> {
    this.logger.log(
      `Creating reward for participant ${request.userRef}: ${request.amount} ${request.currency || 'USD'}`,
    );

    try {
      const payload: ZeroHashCreateRewardRequest = {
        participant_code: request.userRef,
        underlying: request.asset,
        quoted_currency: request.currency || 'USD',
        quantity: request.amount,
      };

      const response = await this.post<ZeroHashCreateRewardWrappedResponse, ZeroHashCreateRewardRequest>(
        '/rewards',
        payload,
      );

      this.logger.log(
        `Reward created successfully: trade_id=${response.data.message.trade_id}, status=${response.data.message.status}`,
      );

      return {
        providerRequestRef: response.data.message.request_id,
        providerReference: response.data.message.trade_id,
        status: response.data.message.status,
        amount: response.data.message.quote.quantity,
        assetCost: response.data.message.asset_cost_notional,
        providerQuoteRef: response.data.message.quote.quote_id,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create reward for participant ${request.userRef}: ${error.message}`);
      if (error.response) {
        this.logger.error(`ZeroHash response status: ${error.response.status}`);
        this.logger.error(`ZeroHash response data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      throw new BadGatewayException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }
}
