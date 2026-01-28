import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { UsdFiatRewardsProcessor, UsdFiatRewardsJobData } from './usd-fiat-rewards.processor';
import { RewardsAdapter } from '../../../../adapters/rewards/rewards.adapter';
import { DoshPointsAccountService } from '../../../../modules/doshPoints/doshPointsAccount/doshPointsAccount.service';
import { DoshPointsEventService } from '../../../../modules/doshPoints/doshPointsEvent/doshPointsEvent.service';
import { DoshPointsTransactionService } from '../../../../modules/doshPoints/doshPointsTransaction/doshPointsTransaction.service';
import { FiatWalletService } from '../../../../modules/fiatWallet/fiatWallet.service';
import { FiatWalletTransactionService } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.service';
import { TransactionService } from '../../../../modules/transaction/transaction.service';
import { QueueService } from '../../queue.service';
import { TransactionStatus } from '../../../../database/models/transaction/transaction.interface';

describe('UsdFiatRewardsProcessor', () => {
  let processor: UsdFiatRewardsProcessor;

  const mockQueueService = {
    processJobs: jest.fn(),
    addJob: jest.fn(),
  };

  const mockRewardsAdapter = {
    createReward: jest.fn(),
  };

  const mockDoshPointsAccountService = {
    findOrCreate: jest.fn(),
  };

  const mockDoshPointsTransactionService = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockTransactionService = {
    create: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockFiatWalletTransactionService = {
    create: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockFiatWalletService = {
    findById: jest.fn(),
  };

  const mockDoshPointsEventService = {
    findByCode: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsdFiatRewardsProcessor,
        { provide: QueueService, useValue: mockQueueService },
        { provide: RewardsAdapter, useValue: mockRewardsAdapter },
        { provide: DoshPointsAccountService, useValue: mockDoshPointsAccountService },
        { provide: DoshPointsTransactionService, useValue: mockDoshPointsTransactionService },
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: FiatWalletTransactionService, useValue: mockFiatWalletTransactionService },
        { provide: FiatWalletService, useValue: mockFiatWalletService },
        { provide: DoshPointsEventService, useValue: mockDoshPointsEventService },
      ],
    }).compile();

    processor = module.get<UsdFiatRewardsProcessor>(UsdFiatRewardsProcessor);
  });

  describe('queueCreditFirstDepositReward', () => {
    it('should register processors and queue a job', async () => {
      const jobData: UsdFiatRewardsJobData = {
        userId: 'user-123',
        participantCode: 'PART123',
        depositAmount: 10000,
        fiatWalletId: 'wallet-123',
        externalAccountId: 'ext-123',
      };

      const mockJob = { id: 'job-1', data: jobData } as Job<UsdFiatRewardsJobData>;
      mockQueueService.addJob.mockResolvedValue(mockJob);

      const result = await processor.queueCreditFirstDepositReward(jobData);

      expect(mockQueueService.processJobs).toHaveBeenCalledWith(
        'usd-fiat-rewards',
        'credit-first-deposit-reward',
        expect.any(Function),
        2,
      );
      expect(mockQueueService.addJob).toHaveBeenCalledWith('usd-fiat-rewards', 'credit-first-deposit-reward', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });
      expect(result).toBe(mockJob);
    });

    it('should only register processors once', async () => {
      const jobData: UsdFiatRewardsJobData = {
        userId: 'user-123',
        participantCode: 'PART123',
        depositAmount: 10000,
        fiatWalletId: 'wallet-123',
        externalAccountId: 'ext-123',
      };

      mockQueueService.addJob.mockResolvedValue({ id: 'job-1' });

      await processor.queueCreditFirstDepositReward(jobData);
      await processor.queueCreditFirstDepositReward(jobData);

      expect(mockQueueService.processJobs).toHaveBeenCalledTimes(1);
    });
  });

  describe('processCreditFirstDepositReward', () => {
    const createMockJob = (data: UsdFiatRewardsJobData): Job<UsdFiatRewardsJobData> =>
      ({
        data,
        updateProgress: jest.fn(),
      }) as unknown as Job<UsdFiatRewardsJobData>;

    it('should skip if user is not enrolled in USD fiat rewards', async () => {
      const jobData: UsdFiatRewardsJobData = {
        userId: 'user-123',
        participantCode: 'PART123',
        depositAmount: 10000,
        fiatWalletId: 'wallet-123',
        externalAccountId: 'ext-123',
      };

      mockDoshPointsAccountService.findOrCreate.mockResolvedValue({
        usd_fiat_rewards_enabled: false,
      });

      const result = await processor['processCreditFirstDepositReward'](createMockJob(jobData));

      expect(result).toEqual({ status: 'skipped', reason: 'not_enrolled' });
      expect(mockRewardsAdapter.createReward).not.toHaveBeenCalled();
    });

    it('should skip if no FIRST_DEPOSIT_USD_MATCH dosh points transaction found', async () => {
      const jobData: UsdFiatRewardsJobData = {
        userId: 'user-123',
        participantCode: 'PART123',
        depositAmount: 10000,
        fiatWalletId: 'wallet-123',
        externalAccountId: 'ext-123',
      };

      mockDoshPointsAccountService.findOrCreate.mockResolvedValue({
        usd_fiat_rewards_enabled: true,
      });
      mockDoshPointsTransactionService.findOne.mockResolvedValue(null);

      const result = await processor['processCreditFirstDepositReward'](createMockJob(jobData));

      expect(result).toEqual({ status: 'skipped', reason: 'no_dosh_points_transaction' });
    });

    it('should skip if reward was already processed', async () => {
      const jobData: UsdFiatRewardsJobData = {
        userId: 'user-123',
        participantCode: 'PART123',
        depositAmount: 10000,
        fiatWalletId: 'wallet-123',
        externalAccountId: 'ext-123',
      };

      mockDoshPointsAccountService.findOrCreate.mockResolvedValue({
        usd_fiat_rewards_enabled: true,
      });
      mockDoshPointsTransactionService.findOne.mockResolvedValue({
        id: 'dpt-123',
        metadata: { reward: { transaction_id: 'existing-tx-123' } },
      });

      const result = await processor['processCreditFirstDepositReward'](createMockJob(jobData));

      expect(result).toEqual({ status: 'skipped', reason: 'already_processed' });
    });

    it('should skip if no reward cap is configured', async () => {
      const jobData: UsdFiatRewardsJobData = {
        userId: 'user-123',
        participantCode: 'PART123',
        depositAmount: 10000,
        fiatWalletId: 'wallet-123',
        externalAccountId: 'ext-123',
      };

      mockDoshPointsAccountService.findOrCreate.mockResolvedValue({
        usd_fiat_rewards_enabled: true,
      });
      mockDoshPointsTransactionService.findOne.mockResolvedValue({
        id: 'dpt-123',
        metadata: {},
      });
      mockDoshPointsEventService.findByCode.mockResolvedValue({
        default_points: 0,
        metadata: { usd_reward_cap: 0 },
      });

      const result = await processor['processCreditFirstDepositReward'](createMockJob(jobData));

      expect(result).toEqual({ status: 'skipped', reason: 'no_reward_cap_configured' });
    });

    it('should process reward successfully', async () => {
      const jobData: UsdFiatRewardsJobData = {
        userId: 'user-123',
        participantCode: 'PART123',
        depositAmount: 10000, // $100 in cents
        fiatWalletId: 'wallet-123',
        externalAccountId: 'ext-123',
      };

      mockDoshPointsAccountService.findOrCreate.mockResolvedValue({
        usd_fiat_rewards_enabled: true,
      });
      mockDoshPointsTransactionService.findOne.mockResolvedValue({
        id: 'dpt-123',
        metadata: {},
      });
      mockDoshPointsEventService.findByCode.mockResolvedValue({
        default_points: 0,
        metadata: { usd_reward_cap: 10 },
      });
      mockRewardsAdapter.createReward.mockResolvedValue({
        providerReference: 'reward-ref-123',
        providerRequestRef: 'request-ref-123',
        providerQuoteRef: 'quote-ref-123',
        status: 'pending',
      });
      mockFiatWalletService.findById.mockResolvedValue({
        id: 'wallet-123',
        balance: 5000,
      });
      mockTransactionService.create.mockResolvedValue({
        id: 'tx-123',
      });
      mockFiatWalletTransactionService.create.mockResolvedValue({
        id: 'fwt-123',
      });
      mockDoshPointsTransactionService.update.mockResolvedValue({});

      const result = await processor['processCreditFirstDepositReward'](createMockJob(jobData));

      expect(result).toEqual({
        status: 'completed',
        transactionId: 'tx-123',
        fiatWalletTransactionId: 'fwt-123',
        rewardAmountUsd: 10, // Capped at $10
      });

      expect(mockRewardsAdapter.createReward).toHaveBeenCalled();
      expect(mockTransactionService.create).toHaveBeenCalled();
      expect(mockFiatWalletTransactionService.create).toHaveBeenCalled();
      expect(mockDoshPointsTransactionService.update).toHaveBeenCalled();
    });

    it('should mark transactions as failed on error', async () => {
      const jobData: UsdFiatRewardsJobData = {
        userId: 'user-123',
        participantCode: 'PART123',
        depositAmount: 10000,
        fiatWalletId: 'wallet-123',
        externalAccountId: 'ext-123',
      };

      mockDoshPointsAccountService.findOrCreate.mockResolvedValue({
        usd_fiat_rewards_enabled: true,
      });
      mockDoshPointsTransactionService.findOne.mockResolvedValue({
        id: 'dpt-123',
        metadata: {},
      });
      mockDoshPointsEventService.findByCode.mockResolvedValue({
        default_points: 0,
        metadata: { usd_reward_cap: 10 },
      });
      mockRewardsAdapter.createReward.mockResolvedValue({
        providerReference: 'reward-ref-123',
        providerRequestRef: 'request-ref-123',
        providerQuoteRef: 'quote-ref-123',
        status: 'pending',
      });
      mockFiatWalletService.findById.mockResolvedValue({
        id: 'wallet-123',
        balance: 5000,
      });
      mockTransactionService.create.mockResolvedValue({
        id: 'tx-123',
      });
      mockFiatWalletTransactionService.create.mockResolvedValue({
        id: 'fwt-123',
      });
      mockDoshPointsTransactionService.update.mockRejectedValue(new Error('Update failed'));

      await expect(processor['processCreditFirstDepositReward'](createMockJob(jobData))).rejects.toThrow(
        'Update failed',
      );

      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith('tx-123', TransactionStatus.FAILED, {
        failure_reason: 'USD fiat reward failed: Update failed',
      });
      expect(mockFiatWalletTransactionService.updateStatus).toHaveBeenCalledWith('fwt-123', TransactionStatus.FAILED, {
        failure_reason: 'USD fiat reward failed: Update failed',
      });
    });

    it('should cap reward at configured maximum', async () => {
      const jobData: UsdFiatRewardsJobData = {
        userId: 'user-123',
        participantCode: 'PART123',
        depositAmount: 500, // $5 in cents (less than cap)
        fiatWalletId: 'wallet-123',
        externalAccountId: 'ext-123',
      };

      mockDoshPointsAccountService.findOrCreate.mockResolvedValue({
        usd_fiat_rewards_enabled: true,
      });
      mockDoshPointsTransactionService.findOne.mockResolvedValue({
        id: 'dpt-123',
        metadata: {},
      });
      mockDoshPointsEventService.findByCode.mockResolvedValue({
        default_points: 0,
        metadata: { usd_reward_cap: 10 },
      });
      mockRewardsAdapter.createReward.mockResolvedValue({
        providerReference: 'reward-ref-123',
        providerRequestRef: 'request-ref-123',
        providerQuoteRef: 'quote-ref-123',
        status: 'pending',
      });
      mockFiatWalletService.findById.mockResolvedValue({
        id: 'wallet-123',
        balance: 5000,
      });
      mockTransactionService.create.mockResolvedValue({
        id: 'tx-123',
      });
      mockFiatWalletTransactionService.create.mockResolvedValue({
        id: 'fwt-123',
      });
      mockDoshPointsTransactionService.update.mockResolvedValue({});

      const result = await processor['processCreditFirstDepositReward'](createMockJob(jobData));

      expect(result.rewardAmountUsd).toBe(5); // Should be $5 (deposit amount), not $10 (cap)
    });
  });
});
