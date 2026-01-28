import { DoshPointsEventCode } from '../../../database/models/doshPointsEvent/doshPointsEvent.interface';
import { DoshPointsStablecoinRewardService } from './doshPointsStablecoinReward.service';

// Mock EnvironmentService
jest.mock('../../../config', () => ({
  EnvironmentService: {
    getValue: jest.fn(() => 'zerohash'),
  },
}));

describe('DoshPointsStablecoinRewardService', () => {
  let service: DoshPointsStablecoinRewardService;

  const mockDoshPointsAccountService = {
    findOrCreate: jest.fn(),
    updateUsdFiatRewardsEnabled: jest.fn(),
  };

  const mockDoshPointsTransactionService = {
    findOne: jest.fn(),
    creditPoints: jest.fn(),
  };

  const mockUsdFiatRewardsProcessor = {
    queueCreditFirstDepositReward: jest.fn(),
  };

  const mockAccount = {
    id: 'account-123',
    user_id: 'user-123',
    balance: 100,
    usd_fiat_rewards_enabled: null,
  };

  const mockUpdatedAccount = {
    ...mockAccount,
    usd_fiat_rewards_enabled: true,
  };

  const mockFirstDepositTransaction = {
    id: 'dosh-tx-123',
    user_id: 'user-123',
    event_code: DoshPointsEventCode.FIRST_DEPOSIT_USD,
    metadata: {
      deposit: {
        amount: '10000',
        fiat_wallet_id: 'wallet-123',
        external_account_id: 'ext-123',
        participant_code: 'PART123',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new DoshPointsStablecoinRewardService();
    (service as any).doshPointsAccountService = mockDoshPointsAccountService;
    (service as any).doshPointsTransactionService = mockDoshPointsTransactionService;
    (service as any).usdFiatRewardsProcessor = mockUsdFiatRewardsProcessor;
    (service as any).logger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
  });

  describe('handleOptIn', () => {
    describe('when user toggles setting (not first time)', () => {
      it('should allow toggling from true to false without processing reward', async () => {
        const alreadyOptedInAccount = { ...mockAccount, usd_fiat_rewards_enabled: true };
        const toggledAccount = { ...mockAccount, usd_fiat_rewards_enabled: false };
        mockDoshPointsAccountService.findOrCreate.mockResolvedValue(alreadyOptedInAccount);
        mockDoshPointsAccountService.updateUsdFiatRewardsEnabled.mockResolvedValue(toggledAccount);

        const result = await service.handleOptIn('user-123', false);

        expect(result.rewardProcessed).toBe(false);
        expect(result.message).toBe('Successfully disabled stablecoin rewards');
        expect(mockDoshPointsTransactionService.findOne).not.toHaveBeenCalled();
      });

      it('should allow toggling from false to true without processing reward', async () => {
        const alreadyOptedOutAccount = { ...mockAccount, usd_fiat_rewards_enabled: false };
        const toggledAccount = { ...mockAccount, usd_fiat_rewards_enabled: true };
        mockDoshPointsAccountService.findOrCreate.mockResolvedValue(alreadyOptedOutAccount);
        mockDoshPointsAccountService.updateUsdFiatRewardsEnabled.mockResolvedValue(toggledAccount);

        const result = await service.handleOptIn('user-123', true);

        expect(result.rewardProcessed).toBe(false);
        expect(result.message).toBe('Successfully enabled stablecoin rewards');
        expect(mockDoshPointsTransactionService.findOne).not.toHaveBeenCalled();
      });
    });

    describe('when user opts out for the first time (null -> false)', () => {
      it('should update account and not process reward', async () => {
        const optedOutAccount = { ...mockAccount, usd_fiat_rewards_enabled: false };
        mockDoshPointsAccountService.findOrCreate.mockResolvedValue(mockAccount);
        mockDoshPointsAccountService.updateUsdFiatRewardsEnabled.mockResolvedValue(optedOutAccount);

        const result = await service.handleOptIn('user-123', false);

        expect(mockDoshPointsAccountService.updateUsdFiatRewardsEnabled).toHaveBeenCalledWith('user-123', false);
        expect(result.rewardProcessed).toBe(false);
        expect(result.message).toBe('Successfully disabled stablecoin rewards');
        expect(mockDoshPointsTransactionService.findOne).not.toHaveBeenCalled();
      });
    });

    describe('when user opts in for first time without first deposit (null -> true, no deposit)', () => {
      it('should update account and not process reward', async () => {
        mockDoshPointsAccountService.findOrCreate.mockResolvedValue(mockAccount);
        mockDoshPointsAccountService.updateUsdFiatRewardsEnabled.mockResolvedValue(mockUpdatedAccount);
        mockDoshPointsTransactionService.findOne.mockResolvedValue(null);

        const result = await service.handleOptIn('user-123', true);

        expect(mockDoshPointsAccountService.updateUsdFiatRewardsEnabled).toHaveBeenCalledWith('user-123', true);
        expect(result.rewardProcessed).toBe(false);
        expect(result.message).toBe(
          'Successfully opted in to stablecoin rewards. First deposit match will be applied when you make your first deposit.',
        );
        expect(mockUsdFiatRewardsProcessor.queueCreditFirstDepositReward).not.toHaveBeenCalled();
      });
    });

    describe('when user opts in for first time with existing first deposit (null -> true, has deposit)', () => {
      beforeEach(() => {
        mockDoshPointsAccountService.findOrCreate.mockResolvedValue(mockAccount);
        mockDoshPointsAccountService.updateUsdFiatRewardsEnabled.mockResolvedValue(mockUpdatedAccount);
        mockDoshPointsTransactionService.findOne.mockResolvedValue(mockFirstDepositTransaction);
      });

      it('should process retroactive reward successfully', async () => {
        mockDoshPointsTransactionService.creditPoints.mockResolvedValue({
          is_duplicate: false,
          transaction: { id: 'match-tx-123' },
        });

        const result = await service.handleOptIn('user-123', true);

        expect(mockDoshPointsTransactionService.findOne).toHaveBeenCalledWith({
          user_id: 'user-123',
          event_code: DoshPointsEventCode.FIRST_DEPOSIT_USD,
          source_reference: 'zerohash',
        });

        expect(mockDoshPointsTransactionService.creditPoints).toHaveBeenCalledWith({
          user_id: 'user-123',
          event_code: DoshPointsEventCode.FIRST_DEPOSIT_USD_MATCH,
          source_reference: 'zerohash',
          description: 'First USD deposit match reward',
        });

        expect(mockUsdFiatRewardsProcessor.queueCreditFirstDepositReward).toHaveBeenCalledWith({
          userId: 'user-123',
          participantCode: 'PART123',
          depositAmount: 10000,
          fiatWalletId: 'wallet-123',
          externalAccountId: 'ext-123',
        });

        expect(result.rewardProcessed).toBe(true);
        expect(result.message).toBe(
          'Successfully opted in to stablecoin rewards. Your first deposit match is being processed!',
        );
      });

      it('should not queue reward if FIRST_DEPOSIT_USD_MATCH is duplicate', async () => {
        mockDoshPointsTransactionService.creditPoints.mockResolvedValue({
          is_duplicate: true,
          transaction: { id: 'match-tx-123' },
        });

        const result = await service.handleOptIn('user-123', true);

        expect(mockDoshPointsTransactionService.creditPoints).toHaveBeenCalled();
        expect(mockUsdFiatRewardsProcessor.queueCreditFirstDepositReward).not.toHaveBeenCalled();
        expect(result.rewardProcessed).toBe(true);
        expect(result.message).toBe(
          'Successfully opted in to stablecoin rewards. Your first deposit match is being processed!',
        );
      });

      it('should throw error if deposit metadata is missing', async () => {
        mockDoshPointsTransactionService.findOne.mockResolvedValue({
          ...mockFirstDepositTransaction,
          metadata: null,
        });

        await expect(service.handleOptIn('user-123', true)).rejects.toThrow(
          'First deposit data is incomplete. Please contact support.',
        );
      });

      it('should throw error if deposit metadata is incomplete (missing amount)', async () => {
        mockDoshPointsTransactionService.findOne.mockResolvedValue({
          ...mockFirstDepositTransaction,
          metadata: {
            deposit: {
              fiat_wallet_id: 'wallet-123',
              external_account_id: 'ext-123',
              participant_code: 'PART123',
            },
          },
        });

        await expect(service.handleOptIn('user-123', true)).rejects.toThrow(
          'First deposit data is incomplete. Please contact support.',
        );
      });

      it('should throw error if deposit metadata is incomplete (missing fiat_wallet_id)', async () => {
        mockDoshPointsTransactionService.findOne.mockResolvedValue({
          ...mockFirstDepositTransaction,
          metadata: {
            deposit: {
              amount: '10000',
              external_account_id: 'ext-123',
              participant_code: 'PART123',
            },
          },
        });

        await expect(service.handleOptIn('user-123', true)).rejects.toThrow(
          'First deposit data is incomplete. Please contact support.',
        );
      });
    });

    describe('logging', () => {
      it('should log key steps during opt-in process', async () => {
        mockDoshPointsAccountService.findOrCreate.mockResolvedValue(mockAccount);
        mockDoshPointsAccountService.updateUsdFiatRewardsEnabled.mockResolvedValue(mockUpdatedAccount);
        mockDoshPointsTransactionService.findOne.mockResolvedValue(mockFirstDepositTransaction);
        mockDoshPointsTransactionService.creditPoints.mockResolvedValue({
          is_duplicate: false,
          transaction: { id: 'match-tx-123' },
        });

        await service.handleOptIn('user-123', true);

        expect((service as any).logger.log).toHaveBeenCalledWith(
          'Handling stablecoin rewards preference update for user user-123: true',
        );
        expect((service as any).logger.log).toHaveBeenCalledWith(
          'User user-123 opted in for the first time, checking for first deposit to match',
        );
        expect((service as any).logger.log).toHaveBeenCalledWith(
          'Found first deposit for user user-123, processing match reward',
        );
        expect((service as any).logger.log).toHaveBeenCalledWith(
          'Created FIRST_DEPOSIT_USD_MATCH transaction for user user-123',
        );
        expect((service as any).logger.log).toHaveBeenCalledWith(
          'Queued stablecoin reward for user user-123 based on first deposit',
        );
      });
    });
  });
});
