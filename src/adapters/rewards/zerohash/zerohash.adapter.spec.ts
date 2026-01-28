import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RewardCreateRequest } from '../rewards.adapter.interface';
import { ZerohashRewardsAdapter } from './zerohash.adapter';
import { ZeroHashCreateRewardRequest, ZeroHashCreateRewardWrappedResponse } from './zerohash.interface';
import { ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE } from '../../../constants/constants';

// Mock the ZerohashAxiosHelper parent class
jest.mock('../../participant/zerohash/zerohash.axios');

describe('ZerohashRewardsAdapter', () => {
  let adapter: ZerohashRewardsAdapter;

  const mockPost = jest.fn();
  const mockGet = jest.fn();
  const mockPatch = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ZerohashRewardsAdapter],
    }).compile();

    adapter = module.get<ZerohashRewardsAdapter>(ZerohashRewardsAdapter);

    // Mock the parent class methods
    adapter['post'] = mockPost;
    adapter['get'] = mockGet;
    adapter['patch'] = mockPatch;
  });

  describe('createReward', () => {
    const mockRequest: RewardCreateRequest = {
      userRef: 'participant-123',
      amount: '100.00',
      asset: 'DOSH',
      currency: 'USD',
    };

    const mockZeroHashResponse: ZeroHashCreateRewardWrappedResponse = {
      message: {
        request_id: 'req-456',
        quote: {
          request_id: 'req-456',
          participant_code: 'participant-123',
          quoted_currency: 'USD',
          side: 'buy',
          quantity: '100.00',
          price: '1.00',
          quote_id: 'quote-abc',
          expire_ts: 1640995200,
          account_group: 'default',
          account_label: 'main',
          obo_participant_code: 'obo-123',
          obo_account_group: 'obo-default',
          obo_account_label: 'obo-main',
          underlying: 'DOSH',
          transaction_timestamp: 1640995200,
        },
        trade_id: 'trade-789',
        status: 'complete',
        trade_ids_list: ['trade-789'],
        asset_cost_notional: '95.50',
      },
    };

    it('should create a reward successfully with default currency', async () => {
      mockPost.mockResolvedValue({ data: mockZeroHashResponse });

      const result = await adapter.createReward(mockRequest);

      expect(mockPost).toHaveBeenCalledWith('/rewards', {
        participant_code: 'participant-123',
        underlying: 'DOSH',
        quoted_currency: 'USD',
        quantity: '100.00',
      });

      expect(result).toEqual({
        providerRequestRef: 'req-456',
        providerReference: 'trade-789',
        status: 'complete',
        amount: '100.00',
        assetCost: '95.50',
        providerQuoteRef: 'quote-abc',
      });
    });

    it('should create a reward successfully without currency (defaults to USD)', async () => {
      const requestWithoutCurrency = { ...mockRequest };
      delete requestWithoutCurrency.currency;

      mockPost.mockResolvedValue({ data: mockZeroHashResponse });

      const result = await adapter.createReward(requestWithoutCurrency);

      expect(mockPost).toHaveBeenCalledWith('/rewards', {
        participant_code: 'participant-123',
        underlying: 'DOSH',
        quoted_currency: 'USD',
        quantity: '100.00',
      });

      expect(result).toEqual({
        providerRequestRef: 'req-456',
        providerReference: 'trade-789',
        status: 'complete',
        amount: '100.00',
        assetCost: '95.50',
        providerQuoteRef: 'quote-abc',
      });
    });

    it('should create a reward with different currency', async () => {
      const requestWithEUR = { ...mockRequest, currency: 'EUR' };
      const responseWithEUR = {
        ...mockZeroHashResponse,
        message: {
          ...mockZeroHashResponse.message,
          quote: {
            ...mockZeroHashResponse.message.quote,
            quoted_currency: 'EUR',
          },
        },
      };

      mockPost.mockResolvedValue({ data: responseWithEUR });

      const result = await adapter.createReward(requestWithEUR);

      expect(mockPost).toHaveBeenCalledWith('/rewards', {
        participant_code: 'participant-123',
        underlying: 'DOSH',
        quoted_currency: 'EUR',
        quantity: '100.00',
      });

      expect(result.providerReference).toBe('trade-789');
    });

    it('should log request details', async () => {
      const loggerSpy = jest.spyOn(adapter['logger'], 'log');
      mockPost.mockResolvedValue({ data: mockZeroHashResponse });

      await adapter.createReward(mockRequest);

      expect(loggerSpy).toHaveBeenCalledWith('Creating reward for participant participant-123: 100.00 USD');
    });

    it('should log successful response details', async () => {
      const loggerSpy = jest.spyOn(adapter['logger'], 'log');
      mockPost.mockResolvedValue({ data: mockZeroHashResponse });

      await adapter.createReward(mockRequest);

      expect(loggerSpy).toHaveBeenCalledWith('Reward created successfully: trade_id=trade-789, status=complete');
    });

    it('should throw BadGatewayException on API error with status', async () => {
      const error = {
        message: 'API Error',
        response: {
          status: 500,
          data: { error: 'Internal Server Error' },
        },
      };

      mockPost.mockRejectedValue(error);

      await expect(adapter.createReward(mockRequest)).rejects.toThrow(BadGatewayException);
      await expect(adapter.createReward(mockRequest)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });

    it('should throw BadGatewayException on API error without status', async () => {
      const error = new Error('Network Error');
      mockPost.mockRejectedValue(error);

      await expect(adapter.createReward(mockRequest)).rejects.toThrow(BadGatewayException);
      await expect(adapter.createReward(mockRequest)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });

    it('should log error details when API call fails', async () => {
      const loggerErrorSpy = jest.spyOn(adapter['logger'], 'error');
      const error = {
        message: 'API Error',
        response: {
          status: 400,
          data: { error: 'Bad Request', details: 'Invalid participant' },
        },
      };

      mockPost.mockRejectedValue(error);

      await expect(adapter.createReward(mockRequest)).rejects.toThrow();

      expect(loggerErrorSpy).toHaveBeenCalledWith('Failed to create reward for participant participant-123: API Error');
      expect(loggerErrorSpy).toHaveBeenCalledWith('ZeroHash response status: 400');
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ZeroHash response data:'));
    });

    it('should handle error without response object', async () => {
      const loggerErrorSpy = jest.spyOn(adapter['logger'], 'error');
      const error = new Error('Connection timeout');
      mockPost.mockRejectedValue(error);

      await expect(adapter.createReward(mockRequest)).rejects.toThrow();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to create reward for participant participant-123: Connection timeout',
      );
      expect(loggerErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('ZeroHash response status:'));
    });

    it('should handle different asset types', async () => {
      const btcRequest = { ...mockRequest, asset: 'BTC' };
      const btcResponse = {
        ...mockZeroHashResponse,
        message: {
          ...mockZeroHashResponse.message,
          quote: {
            ...mockZeroHashResponse.message.quote,
            underlying: 'BTC',
          },
        },
      };

      mockPost.mockResolvedValue({ data: btcResponse });

      await adapter.createReward(btcRequest);

      expect(mockPost).toHaveBeenCalledWith('/rewards', {
        participant_code: 'participant-123',
        underlying: 'BTC',
        quoted_currency: 'USD',
        quantity: '100.00',
      });
    });

    it('should handle different participant codes', async () => {
      const differentRequest = { ...mockRequest, userRef: 'participant-999' };
      mockPost.mockResolvedValue({ data: mockZeroHashResponse });

      await adapter.createReward(differentRequest);

      expect(mockPost).toHaveBeenCalledWith(
        '/rewards',
        expect.objectContaining({
          participant_code: 'participant-999',
        }),
      );
    });

    it('should handle different amounts', async () => {
      const largeAmountRequest = { ...mockRequest, amount: '50000.99' };
      mockPost.mockResolvedValue({ data: mockZeroHashResponse });

      await adapter.createReward(largeAmountRequest);

      expect(mockPost).toHaveBeenCalledWith(
        '/rewards',
        expect.objectContaining({
          quantity: '50000.99',
        }),
      );
    });

    it('should correctly map all response fields', async () => {
      mockPost.mockResolvedValue({ data: mockZeroHashResponse });

      const result = await adapter.createReward(mockRequest);

      expect(result.providerRequestRef).toBe(mockZeroHashResponse.message.request_id);
      expect(result.providerReference).toBe(mockZeroHashResponse.message.trade_id);
      expect(result.status).toBe(mockZeroHashResponse.message.status);
      expect(result.amount).toBe(mockZeroHashResponse.message.quote.quantity);
      expect(result.assetCost).toBe(mockZeroHashResponse.message.asset_cost_notional);
      expect(result.providerQuoteRef).toBe(mockZeroHashResponse.message.quote.quote_id);
    });

    it('should handle pending status', async () => {
      const pendingResponse = {
        ...mockZeroHashResponse,
        message: {
          ...mockZeroHashResponse.message,
          status: 'pending',
        },
      };

      mockPost.mockResolvedValue({ data: pendingResponse });

      const result = await adapter.createReward(mockRequest);

      expect(result.status).toBe('pending');
    });

    it('should handle failed status', async () => {
      const failedResponse = {
        ...mockZeroHashResponse,
        message: {
          ...mockZeroHashResponse.message,
          status: 'failed',
        },
      };

      mockPost.mockResolvedValue({ data: failedResponse });

      const result = await adapter.createReward(mockRequest);

      expect(result.status).toBe('failed');
    });

    it('should create payload with correct field mapping', async () => {
      mockPost.mockResolvedValue({ data: mockZeroHashResponse });

      await adapter.createReward(mockRequest);

      const expectedPayload: ZeroHashCreateRewardRequest = {
        participant_code: mockRequest.userRef,
        underlying: mockRequest.asset,
        quoted_currency: mockRequest.currency || 'USD',
        quantity: mockRequest.amount,
      };

      expect(mockPost).toHaveBeenCalledWith('/rewards', expectedPayload);
    });
  });
});
