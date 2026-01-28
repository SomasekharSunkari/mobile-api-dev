import { Test, TestingModule } from '@nestjs/testing';
import { NotImplementedException } from '@nestjs/common';
import { RewardsAdapter } from './rewards.adapter';
import { ZerohashRewardsAdapter } from './zerohash/zerohash.adapter';
import { RewardCreateRequest } from './rewards.adapter.interface';

describe('RewardsAdapter', () => {
  let adapter: RewardsAdapter;
  let zerohashAdapter: ZerohashRewardsAdapter;

  const mockRewardRequest: RewardCreateRequest = {
    userRef: 'participant-123',
    amount: '100.00',
    asset: 'DOSH',
    currency: 'USD',
  };

  const mockRewardResponse = {
    providerRequestRef: 'req-456',
    providerReference: 'trade-789',
    status: 'complete',
    amount: '100.00',
    assetCost: '95.50',
    providerQuoteRef: 'quote-abc',
  };

  beforeEach(async () => {
    const mockZerohashAdapter = {
      createReward: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RewardsAdapter, { provide: ZerohashRewardsAdapter, useValue: mockZerohashAdapter }],
    }).compile();

    adapter = module.get<RewardsAdapter>(RewardsAdapter);
    zerohashAdapter = module.get<ZerohashRewardsAdapter>(ZerohashRewardsAdapter);
  });

  describe('createReward', () => {
    it('should delegate to ZerohashRewardsAdapter for zerohash provider', async () => {
      (zerohashAdapter.createReward as jest.Mock).mockResolvedValue(mockRewardResponse);

      const result = await adapter.createReward(mockRewardRequest, 'zerohash');

      expect(zerohashAdapter.createReward).toHaveBeenCalledWith(mockRewardRequest);
      expect(result).toEqual(mockRewardResponse);
    });

    it('should handle uppercase provider name', async () => {
      (zerohashAdapter.createReward as jest.Mock).mockResolvedValue(mockRewardResponse);

      const result = await adapter.createReward(mockRewardRequest, 'ZEROHASH');

      expect(zerohashAdapter.createReward).toHaveBeenCalledWith(mockRewardRequest);
      expect(result).toEqual(mockRewardResponse);
    });

    it('should handle mixed case provider name', async () => {
      (zerohashAdapter.createReward as jest.Mock).mockResolvedValue(mockRewardResponse);

      const result = await adapter.createReward(mockRewardRequest, 'ZeroHash');

      expect(zerohashAdapter.createReward).toHaveBeenCalledWith(mockRewardRequest);
      expect(result).toEqual(mockRewardResponse);
    });

    it('should throw NotImplementedException for unsupported provider', async () => {
      await expect(adapter.createReward(mockRewardRequest, 'unknown')).rejects.toThrow(NotImplementedException);
      await expect(adapter.createReward(mockRewardRequest, 'unknown')).rejects.toThrow(
        'No rewards support for provider unknown',
      );
    });

    it('should throw NotImplementedException for empty provider', async () => {
      await expect(adapter.createReward(mockRewardRequest, '')).rejects.toThrow(NotImplementedException);
      await expect(adapter.createReward(mockRewardRequest, '')).rejects.toThrow('No rewards support for provider ');
    });

    it('should bubble up errors from ZerohashRewardsAdapter', async () => {
      const error = new Error('ZeroHash API Error');
      (zerohashAdapter.createReward as jest.Mock).mockRejectedValue(error);

      await expect(adapter.createReward(mockRewardRequest, 'zerohash')).rejects.toThrow('ZeroHash API Error');
    });
  });
});
