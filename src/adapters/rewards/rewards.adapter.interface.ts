// Reward request payload
export interface RewardCreateRequest {
  userRef: string;
  amount: string;
  asset: string;
  currency?: string;
}

// Reward response payload
export interface RewardCreateResponse {
  providerRequestRef: string;
  providerReference: string;
  status: string;
  amount: string;
  assetCost: string;
  providerQuoteRef: string;
}

// Main adapter interface
export interface IRewardsAdapter {
  createReward(request: RewardCreateRequest, provider: string): Promise<RewardCreateResponse>;
}
