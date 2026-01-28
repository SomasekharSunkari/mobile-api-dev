import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyUtility } from '../../currencies';
import { UserModel } from '../../database';
import { FiatWalletTransactionType } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import { ITier, TierStatus } from '../../database/models/tier/tier.interface';
import { ITierConfig } from '../../database/models/tierConfig/tierConfig.interface';
import { LimitExceededExceptionType } from '../../exceptions/limit_exceeded_exception';
import { UserTierController } from './userTier.controller';
import { UserTierService } from './userTier.service';

describe('UserTierService', () => {
  let service: UserTierService;

  const mockUserTierRepository = {
    findByUserWithTierDetails: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockTierRepository = {
    query: jest.fn(),
  };

  const mockTierConfigRepository = {
    query: jest.fn(),
  };

  const mockKycVerificationRepository = {
    findUserApprovedVerifications: jest.fn(),
  };

  const mockCountryRepository = {
    findOne: jest.fn(),
  };

  const mockTransactionSumService = {
    getPastOneDayTransactionSum: jest.fn(),
    getPastOneWeekTransactionSum: jest.fn(),
    getPastOneMonthTransactionSum: jest.fn(),
  };

  const mockLockerService = {
    withLock: jest.fn(),
  };

  const mockFiatWalletTransactionRepository = {
    countPendingByUserAndType: jest.fn(),
    countTransactionsByTypeInPastWeek: jest.fn(),
  };

  const mockTransactionAggregateService = {
    validateProviderPlatformWeeklyLimit: jest.fn().mockResolvedValue(undefined),
  };

  const mockUser: UserModel = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
  } as UserModel;

  const mockTier: ITier = {
    id: 'tier-1',
    name: 'Gold',
    level: 2,
    description: 'Gold tier',
    status: TierStatus.ACTIVE,
    tierConfigs: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new UserTierService();
    (service as any).userTierRepository = mockUserTierRepository;
    (service as any).tierRepository = mockTierRepository;
    (service as any).tierConfigRepository = mockTierConfigRepository;
    (service as any).kycVerificationRepository = mockKycVerificationRepository;
    (service as any).countryRepository = mockCountryRepository;
    (service as any).transactionSumService = mockTransactionSumService;
    (service as any).lockerService = mockLockerService;
    (service as any).fiatWalletTransactionRepository = mockFiatWalletTransactionRepository;
    (service as any).transactionAggregateService = mockTransactionAggregateService;
    (service as any).logger = { log: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() };
  });

  describe('getUserCurrentTier', () => {
    it('should return undefined when user has no tiers', async () => {
      mockUserTierRepository.findByUserWithTierDetails.mockResolvedValue([]);

      const result = await service.getUserCurrentTier(mockUser.id);

      expect(result).toBeUndefined();
      expect(mockUserTierRepository.findByUserWithTierDetails).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return undefined when user tiers is null', async () => {
      mockUserTierRepository.findByUserWithTierDetails.mockResolvedValue(null);

      const result = await service.getUserCurrentTier(mockUser.id);

      expect(result).toBeUndefined();
    });

    it('should return highest tier when all requirements are approved', async () => {
      const mockUserTiers = [
        {
          tier: {
            ...mockTier,
            level: 1,
            tierConfigs: [
              {
                country: { id: 'country-1' },
                tierConfigVerificationRequirements: [{ id: 'req-1' }],
              },
            ],
          },
        },
        {
          tier: {
            ...mockTier,
            id: 'tier-2',
            level: 2,
            tierConfigs: [
              {
                country: { id: 'country-1' },
                tierConfigVerificationRequirements: [{ id: 'req-2' }],
              },
            ],
          },
        },
      ];

      mockUserTierRepository.findByUserWithTierDetails.mockResolvedValue(mockUserTiers);
      mockKycVerificationRepository.findUserApprovedVerifications.mockImplementation((userId, requirementIds) => {
        return Promise.resolve(requirementIds.map((id: string) => ({ tier_config_verification_requirement_id: id })));
      });

      const result = await service.getUserCurrentTier(mockUser.id);

      expect(result).toBeDefined();
      expect(result?.level).toBe(2);
    });

    it('should skip tiers without tierConfigs', async () => {
      const mockUserTiers = [
        {
          tier: {
            ...mockTier,
            tierConfigs: null,
          },
        },
      ];

      mockUserTierRepository.findByUserWithTierDetails.mockResolvedValue(mockUserTiers);

      const result = await service.getUserCurrentTier(mockUser.id);

      expect(result).toBeUndefined();
    });

    it('should skip tier configs without country', async () => {
      const mockUserTiers = [
        {
          tier: {
            ...mockTier,
            tierConfigs: [
              {
                country: null,
                tierConfigVerificationRequirements: [{ id: 'req-1' }],
              },
            ],
          },
        },
      ];

      mockUserTierRepository.findByUserWithTierDetails.mockResolvedValue(mockUserTiers);

      const result = await service.getUserCurrentTier(mockUser.id);

      expect(result).toBeUndefined();
    });

    it('should skip tier configs without verification requirements', async () => {
      const mockUserTiers = [
        {
          tier: {
            ...mockTier,
            tierConfigs: [
              {
                country: { id: 'country-1' },
                tierConfigVerificationRequirements: [],
              },
            ],
          },
        },
      ];

      mockUserTierRepository.findByUserWithTierDetails.mockResolvedValue(mockUserTiers);

      const result = await service.getUserCurrentTier(mockUser.id);

      expect(result).toBeUndefined();
    });

    it('should handle undefined tierConfigVerificationRequirements', async () => {
      const mockUserTiers = [
        {
          tier: {
            ...mockTier,
            tierConfigs: [
              {
                country: { id: 'country-1' },
                tierConfigVerificationRequirements: undefined,
              },
            ],
          },
        },
      ];

      mockUserTierRepository.findByUserWithTierDetails.mockResolvedValue(mockUserTiers);

      const result = await service.getUserCurrentTier(mockUser.id);

      expect(result).toBeUndefined();
    });

    it('should return undefined when not all requirements are approved', async () => {
      const mockUserTiers = [
        {
          tier: {
            ...mockTier,
            tierConfigs: [
              {
                country: { id: 'country-1' },
                tierConfigVerificationRequirements: [{ id: 'req-1' }, { id: 'req-2' }],
              },
            ],
          },
        },
      ];

      mockUserTierRepository.findByUserWithTierDetails.mockResolvedValue(mockUserTiers);
      mockKycVerificationRepository.findUserApprovedVerifications.mockResolvedValue([
        { tier_config_verification_requirement_id: 'req-1' },
      ]);

      const result = await service.getUserCurrentTier(mockUser.id);

      expect(result).toBeUndefined();
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockUserTierRepository.findByUserWithTierDetails.mockRejectedValue(new Error('DB error'));

      await expect(service.getUserCurrentTier(mockUser.id)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('create', () => {
    it('should create user tier successfully', async () => {
      const createDto = { tier_id: 'tier-1' };
      const expectedResult = { id: 'user-tier-1', user_id: mockUser.id, tier_id: 'tier-1' };
      mockUserTierRepository.create.mockResolvedValue(expectedResult);

      const result = await service.create(mockUser.id, createDto);

      expect(result).toEqual(expectedResult);
      expect(mockUserTierRepository.create).toHaveBeenCalledWith({ ...createDto, user_id: mockUser.id });
    });

    it('should throw InternalServerErrorException on create error', async () => {
      mockUserTierRepository.create.mockRejectedValue(new Error('DB error'));

      await expect(service.create(mockUser.id, { tier_id: 'tier-1' })).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findOrCreate', () => {
    it('should return existing user tier', async () => {
      const existingUserTier = { id: 'user-tier-1', user_id: mockUser.id, tier_id: 'tier-1' };
      mockUserTierRepository.findOne.mockResolvedValue(existingUserTier);

      const result = await service.findOrCreate(mockUser.id, 'tier-1');

      expect(result).toEqual(existingUserTier);
      expect(mockUserTierRepository.create).not.toHaveBeenCalled();
    });

    it('should create new user tier if not found', async () => {
      const newUserTier = { id: 'user-tier-1', user_id: mockUser.id, tier_id: 'tier-1' };
      mockUserTierRepository.findOne.mockResolvedValue(null);
      mockUserTierRepository.create.mockResolvedValue(newUserTier);

      const result = await service.findOrCreate(mockUser.id, 'tier-1');

      expect(result).toEqual(newUserTier);
      expect(mockUserTierRepository.create).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockUserTierRepository.findOne.mockRejectedValue(new Error('DB error'));

      await expect(service.findOrCreate(mockUser.id, 'tier-1')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getUserTransactionLimits', () => {
    const mockTierConfig = {
      id: 'tier-config-1',
      maximum_per_deposit: 100000,
      maximum_daily_deposit: 500000,
      maximum_weekly_deposit: 2000000,
      maximum_monthly_deposit: 10000000,
      maximum_per_withdrawal: 50000,
      maximum_daily_withdrawal: 250000,
      maximum_weekly_withdrawal: 1000000,
      maximum_monthly_withdrawal: 5000000,
    };

    const mockTransactionSumsEmpty = {
      transactionTypeTotals: {},
    };

    beforeEach(() => {
      mockTransactionSumService.getPastOneDayTransactionSum.mockResolvedValue(mockTransactionSumsEmpty);
      mockTransactionSumService.getPastOneWeekTransactionSum.mockResolvedValue(mockTransactionSumsEmpty);
      mockTransactionSumService.getPastOneMonthTransactionSum.mockResolvedValue(mockTransactionSumsEmpty);
    });

    it('should return limits for all supported currencies', async () => {
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(mockTierConfig as ITierConfig);

      const result = await service.getUserTransactionLimits(mockUser.id);

      expect(result).toBeDefined();
      expect(result.limits).toBeInstanceOf(Array);
      expect(result.limits.length).toBeGreaterThan(0);
    });

    it('should return correct structure for each currency limit', async () => {
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(mockTierConfig as any);

      const result = await service.getUserTransactionLimits(mockUser.id);

      const usdLimit = result.limits.find((l) => l.currency === 'USD');
      expect(usdLimit).toBeDefined();
      expect(usdLimit).toMatchObject({
        currency: 'USD',
        send: {
          single_transaction_limit: mockTierConfig.maximum_per_withdrawal,
          daily: expect.objectContaining({ limit: mockTierConfig.maximum_daily_withdrawal }),
          weekly: expect.objectContaining({ limit: mockTierConfig.maximum_weekly_withdrawal }),
          monthly: expect.objectContaining({ limit: mockTierConfig.maximum_monthly_withdrawal }),
        },
        receive: {
          single_transaction_limit: mockTierConfig.maximum_per_deposit,
          daily: expect.objectContaining({ limit: mockTierConfig.maximum_daily_deposit }),
          weekly: expect.objectContaining({ limit: mockTierConfig.maximum_weekly_deposit }),
          monthly: expect.objectContaining({ limit: mockTierConfig.maximum_monthly_deposit }),
        },
      });
    });

    it('should calculate remaining correctly when no transactions', async () => {
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(mockTierConfig as any);

      const result = await service.getUserTransactionLimits(mockUser.id);

      const usdLimit = result.limits.find((l) => l.currency === 'USD');
      expect(usdLimit?.send.daily.spent).toBe(0);
      expect(usdLimit?.send.daily.remaining).toBe(mockTierConfig.maximum_daily_withdrawal);
      expect(usdLimit?.receive.daily.spent).toBe(0);
      expect(usdLimit?.receive.daily.remaining).toBe(mockTierConfig.maximum_daily_deposit);
    });

    it('should calculate spent and remaining correctly with existing transactions', async () => {
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(mockTierConfig as any);
      const completedSums = {
        transactionTypeTotals: {
          deposit: { totalSum: 10000 },
          withdrawal: { totalSum: -5000 },
        },
      };
      const pendingSums = {
        transactionTypeTotals: {},
      };

      // Mock completed and pending separately (6 calls: day, week, month for each status)
      mockTransactionSumService.getPastOneDayTransactionSum
        .mockResolvedValueOnce(completedSums)
        .mockResolvedValueOnce(pendingSums);
      mockTransactionSumService.getPastOneWeekTransactionSum
        .mockResolvedValueOnce(completedSums)
        .mockResolvedValueOnce(pendingSums);
      mockTransactionSumService.getPastOneMonthTransactionSum
        .mockResolvedValueOnce(completedSums)
        .mockResolvedValueOnce(pendingSums);

      const result = await service.getUserTransactionLimits(mockUser.id);

      const usdLimit = result.limits.find((l) => l.currency === 'USD');
      // Withdrawal spent should be absolute value of negative withdrawal sum
      expect(usdLimit?.send.daily.spent).toBe(5000);
      expect(usdLimit?.send.daily.remaining).toBe(mockTierConfig.maximum_daily_withdrawal - 5000);
      // Deposit spent should be the positive deposit sum
      expect(usdLimit?.receive.daily.spent).toBe(10000);
      expect(usdLimit?.receive.daily.remaining).toBe(mockTierConfig.maximum_daily_deposit - 10000);
    });

    it('should return remaining as 0 when spent exceeds limit', async () => {
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(mockTierConfig as any);
      const exceededTransactionSums = {
        transactionTypeTotals: {
          deposit: { totalSum: 600000 }, // Exceeds daily limit of 500000
          withdrawal: { totalSum: -300000 }, // Exceeds daily limit of 250000
        },
      };
      const emptySums = { transactionTypeTotals: {} };

      mockTransactionSumService.getPastOneDayTransactionSum
        .mockResolvedValueOnce(exceededTransactionSums)
        .mockResolvedValueOnce(emptySums);
      mockTransactionSumService.getPastOneWeekTransactionSum
        .mockResolvedValueOnce(emptySums)
        .mockResolvedValueOnce(emptySums);
      mockTransactionSumService.getPastOneMonthTransactionSum
        .mockResolvedValueOnce(emptySums)
        .mockResolvedValueOnce(emptySums);

      const result = await service.getUserTransactionLimits(mockUser.id);

      const usdLimit = result.limits.find((l) => l.currency === 'USD');
      expect(usdLimit?.send.daily.remaining).toBe(0);
      expect(usdLimit?.receive.daily.remaining).toBe(0);
    });

    it('should filter out currencies without tier config', async () => {
      jest.spyOn(service, 'getAssetLimits').mockImplementation(async (_userId, currency) => {
        if (currency === 'USD') return mockTierConfig as any;
        return null;
      });

      const result = await service.getUserTransactionLimits(mockUser.id);

      expect(result.limits.length).toBe(1);
      expect(result.limits[0].currency).toBe('USD');
    });

    it('should return empty limits array when no tier configs exist', async () => {
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(null);

      const result = await service.getUserTransactionLimits(mockUser.id);

      expect(result.limits).toEqual([]);
    });

    it('should handle null tier config values with defaults', async () => {
      const tierConfigWithNulls = {
        id: 'tier-config-1',
        maximum_per_withdrawal: null,
        maximum_daily_withdrawal: undefined,
        maximum_weekly_withdrawal: null,
        maximum_monthly_withdrawal: undefined,
        maximum_per_deposit: null,
        maximum_daily_deposit: undefined,
        maximum_weekly_deposit: null,
        maximum_monthly_deposit: undefined,
      };
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(tierConfigWithNulls as any);

      const result = await service.getUserTransactionLimits(mockUser.id);

      const usdLimit = result.limits.find((l) => l.currency === 'USD');
      expect(usdLimit?.send.single_transaction_limit).toBe(0);
      expect(usdLimit?.send.daily.limit).toBe(0);
      expect(usdLimit?.send.weekly.limit).toBe(0);
      expect(usdLimit?.send.monthly.limit).toBe(0);
      expect(usdLimit?.receive.single_transaction_limit).toBe(0);
      expect(usdLimit?.receive.daily.limit).toBe(0);
      expect(usdLimit?.receive.weekly.limit).toBe(0);
      expect(usdLimit?.receive.monthly.limit).toBe(0);
    });

    it('should handle null transaction totals', async () => {
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(mockTierConfig as any);
      const nullTransactionSums = {
        transactionTypeTotals: {
          deposit: { totalSum: null },
          withdrawal: null,
        },
      };
      const emptySums = { transactionTypeTotals: {} };

      mockTransactionSumService.getPastOneDayTransactionSum
        .mockResolvedValueOnce(nullTransactionSums)
        .mockResolvedValueOnce(emptySums);
      mockTransactionSumService.getPastOneWeekTransactionSum
        .mockResolvedValueOnce(emptySums)
        .mockResolvedValueOnce(emptySums);
      mockTransactionSumService.getPastOneMonthTransactionSum
        .mockResolvedValueOnce(emptySums)
        .mockResolvedValueOnce(emptySums);

      const result = await service.getUserTransactionLimits(mockUser.id);

      const usdLimit = result.limits.find((l) => l.currency === 'USD');
      expect(usdLimit?.send.daily.spent).toBe(0);
      expect(usdLimit?.receive.daily.spent).toBe(0);
    });

    it('should include count limits when configured', async () => {
      const tierConfigWithCountLimits = {
        ...mockTierConfig,
        maximum_pending_deposits_count: 3,
        maximum_pending_withdrawals_count: 2,
        maximum_weekly_deposit_count: 3,
        maximum_weekly_withdrawal_count: 5,
      };
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(tierConfigWithCountLimits as any);
      mockFiatWalletTransactionRepository.countPendingByUserAndType.mockResolvedValue(1);
      mockFiatWalletTransactionRepository.countTransactionsByTypeInPastWeek.mockResolvedValue(2);

      const result = await service.getUserTransactionLimits(mockUser.id);

      const usdLimit = result.limits.find((l) => l.currency === 'USD');
      expect(usdLimit?.send.pending_count).toEqual({
        limit: 2,
        current: 1,
        remaining: 1,
      });
      expect(usdLimit?.receive.pending_count).toEqual({
        limit: 3,
        current: 1,
        remaining: 2,
      });
      expect(usdLimit?.send.weekly_count).toEqual({
        limit: 5,
        current: 2,
        remaining: 3,
      });
      expect(usdLimit?.receive.weekly_count).toEqual({
        limit: 3,
        current: 2,
        remaining: 1,
      });
    });

    it('should not include count limits when not configured', async () => {
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(mockTierConfig as any);
      mockFiatWalletTransactionRepository.countPendingByUserAndType.mockResolvedValue(0);
      mockFiatWalletTransactionRepository.countTransactionsByTypeInPastWeek.mockResolvedValue(0);

      const result = await service.getUserTransactionLimits(mockUser.id);

      const usdLimit = result.limits.find((l) => l.currency === 'USD');
      expect(usdLimit?.send.pending_count).toBeUndefined();
      expect(usdLimit?.receive.pending_count).toBeUndefined();
      expect(usdLimit?.send.weekly_count).toBeUndefined();
      expect(usdLimit?.receive.weekly_count).toBeUndefined();
    });

    it('should handle count limits at maximum', async () => {
      const tierConfigWithCountLimits = {
        ...mockTierConfig,
        maximum_pending_deposits_count: 2,
        maximum_pending_withdrawals_count: 1,
        maximum_weekly_deposit_count: 3,
        maximum_weekly_withdrawal_count: 5,
      };
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(tierConfigWithCountLimits as any);
      mockFiatWalletTransactionRepository.countPendingByUserAndType
        .mockResolvedValueOnce(2) // deposits
        .mockResolvedValueOnce(1); // withdrawals
      mockFiatWalletTransactionRepository.countTransactionsByTypeInPastWeek
        .mockResolvedValueOnce(3) // deposits
        .mockResolvedValueOnce(5); // withdrawals

      const result = await service.getUserTransactionLimits(mockUser.id);

      const usdLimit = result.limits.find((l) => l.currency === 'USD');
      expect(usdLimit?.send.pending_count?.remaining).toBe(0);
      expect(usdLimit?.receive.pending_count?.remaining).toBe(0);
      expect(usdLimit?.send.weekly_count?.remaining).toBe(0);
      expect(usdLimit?.receive.weekly_count?.remaining).toBe(0);
    });

    it('should combine COMPLETED and PENDING transaction sums', async () => {
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(mockTierConfig as any);
      const completedSums = {
        transactionTypeTotals: {
          deposit: { totalSum: 5000 },
          withdrawal: { totalSum: -3000 },
        },
      };
      const pendingSums = {
        transactionTypeTotals: {
          deposit: { totalSum: 2000 },
          withdrawal: { totalSum: -1000 },
        },
      };

      // Mock returns alternating completed and pending sums
      mockTransactionSumService.getPastOneDayTransactionSum
        .mockResolvedValueOnce(completedSums) // completed
        .mockResolvedValueOnce(pendingSums); // pending

      mockTransactionSumService.getPastOneWeekTransactionSum
        .mockResolvedValueOnce(completedSums)
        .mockResolvedValueOnce(pendingSums);

      mockTransactionSumService.getPastOneMonthTransactionSum
        .mockResolvedValueOnce(completedSums)
        .mockResolvedValueOnce(pendingSums);

      const result = await service.getUserTransactionLimits(mockUser.id);

      const usdLimit = result.limits.find((l) => l.currency === 'USD');
      // Should combine: 5000 + 2000 = 7000 for deposits
      expect(usdLimit?.receive.daily.spent).toBe(7000);
      // Should combine: abs(-3000) + abs(-1000) = 4000 for withdrawals
      expect(usdLimit?.send.daily.spent).toBe(4000);
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      jest.spyOn(service, 'getAssetLimits').mockRejectedValue(new Error('Unexpected error'));

      await expect(service.getUserTransactionLimits(mockUser.id)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('validateLimit - pending transaction count limits', () => {
    const mockTierConfig = {
      id: 'tier-config-1',
      maximum_per_deposit: 100000,
      maximum_daily_deposit: 500000,
      maximum_weekly_deposit: 2000000,
      maximum_monthly_deposit: 10000000,
      maximum_per_withdrawal: 100000,
      maximum_daily_withdrawal: 500000,
      maximum_weekly_withdrawal: 2000000,
      maximum_monthly_withdrawal: 10000000,
      maximum_transaction_amount: 100000,
      maximum_daily_transaction: 500000,
      maximum_weekly_transaction: 2000000,
      maximum_monthly_transaction: 10000000,
      maximum_pending_deposits_count: 2,
      maximum_pending_withdrawals_count: 1,
    };

    const mockTransactionSums = {
      transactionTypeTotals: {
        deposit: { totalSum: 0 },
        withdrawal: { totalSum: 0 },
      },
    };

    beforeEach(() => {
      // Mock getAssetLimits to return tier config with pending limits
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(mockTierConfig as any);

      // Mock transaction sums to return 0 (no existing transactions)
      mockTransactionSumService.getPastOneDayTransactionSum.mockResolvedValue(mockTransactionSums);
      mockTransactionSumService.getPastOneWeekTransactionSum.mockResolvedValue(mockTransactionSums);
      mockTransactionSumService.getPastOneMonthTransactionSum.mockResolvedValue(mockTransactionSums);

      // Mock locker to execute callback immediately
      mockLockerService.withLock.mockImplementation((_key: string, callback: () => Promise<void>) => callback());
    });

    it('should throw LimitExceededException when deposit pending limit is reached', async () => {
      mockFiatWalletTransactionRepository.countPendingByUserAndType.mockResolvedValue(2);

      await expect(
        service.validateLimit(mockUser.id, 100, 'USD', FiatWalletTransactionType.DEPOSIT),
      ).rejects.toMatchObject({
        type: LimitExceededExceptionType.PENDING_LIMIT_EXCEEDED_EXCEPTION,
        message: expect.stringContaining('deposit limit'),
      });

      expect(mockFiatWalletTransactionRepository.countPendingByUserAndType).toHaveBeenCalledWith(
        mockUser.id,
        FiatWalletTransactionType.DEPOSIT,
        'USD',
      );
    });

    it('should throw LimitExceededException when withdrawal pending limit is reached', async () => {
      mockFiatWalletTransactionRepository.countPendingByUserAndType.mockResolvedValue(1);

      await expect(
        service.validateLimit(mockUser.id, 100, 'USD', FiatWalletTransactionType.WITHDRAWAL),
      ).rejects.toMatchObject({
        type: LimitExceededExceptionType.PENDING_LIMIT_EXCEEDED_EXCEPTION,
        message: expect.stringContaining('withdrawal limit'),
      });

      expect(mockFiatWalletTransactionRepository.countPendingByUserAndType).toHaveBeenCalledWith(
        mockUser.id,
        FiatWalletTransactionType.WITHDRAWAL,
        'USD',
      );
    });

    it('should pass validation when deposit pending count is below limit', async () => {
      mockFiatWalletTransactionRepository.countPendingByUserAndType.mockResolvedValue(1);

      await expect(
        service.validateLimit(mockUser.id, 100, 'USD', FiatWalletTransactionType.DEPOSIT),
      ).resolves.not.toThrow();
    });

    it('should pass validation when withdrawal pending count is below limit', async () => {
      mockFiatWalletTransactionRepository.countPendingByUserAndType.mockResolvedValue(0);

      await expect(
        service.validateLimit(mockUser.id, 100, 'USD', FiatWalletTransactionType.WITHDRAWAL),
      ).resolves.not.toThrow();
    });

    it('should skip pending check when maximum_pending_deposits_count is not set', async () => {
      const tierConfigWithoutPendingLimits = {
        ...mockTierConfig,
        maximum_pending_deposits_count: undefined,
        maximum_pending_withdrawals_count: undefined,
      };
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(tierConfigWithoutPendingLimits as any);

      await expect(
        service.validateLimit(mockUser.id, 100, 'USD', FiatWalletTransactionType.DEPOSIT),
      ).resolves.not.toThrow();

      expect(mockFiatWalletTransactionRepository.countPendingByUserAndType).not.toHaveBeenCalled();
    });

    it('should not check pending limits for TRANSFER_IN transactions', async () => {
      await expect(
        service.validateLimit(mockUser.id, 100, 'USD', FiatWalletTransactionType.TRANSFER_IN),
      ).resolves.not.toThrow();

      expect(mockFiatWalletTransactionRepository.countPendingByUserAndType).not.toHaveBeenCalled();
    });
  });

  describe('validateLimit - weekly count limits', () => {
    const mockTierConfig = {
      id: 'tier-config-1',
      maximum_per_deposit: 100000,
      maximum_daily_deposit: 500000,
      maximum_weekly_deposit: 2000000,
      maximum_monthly_deposit: 10000000,
      maximum_per_withdrawal: 100000,
      maximum_daily_withdrawal: 500000,
      maximum_weekly_withdrawal: 2000000,
      maximum_monthly_withdrawal: 10000000,
      maximum_transaction_amount: 100000,
      maximum_daily_transaction: 500000,
      maximum_weekly_transaction: 2000000,
      maximum_monthly_transaction: 10000000,
      maximum_weekly_deposit_count: 3,
      maximum_weekly_withdrawal_count: 5,
    };

    const mockTransactionSums = {
      transactionTypeTotals: {
        deposit: { totalSum: 0 },
        withdrawal: { totalSum: 0 },
      },
    };

    beforeEach(() => {
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(mockTierConfig as any);
      mockTransactionSumService.getPastOneDayTransactionSum.mockResolvedValue(mockTransactionSums);
      mockTransactionSumService.getPastOneWeekTransactionSum.mockResolvedValue(mockTransactionSums);
      mockTransactionSumService.getPastOneMonthTransactionSum.mockResolvedValue(mockTransactionSums);
      mockLockerService.withLock.mockImplementation((_key: string, callback: () => Promise<void>) => callback());
      mockFiatWalletTransactionRepository.countPendingByUserAndType.mockResolvedValue(0);
    });

    it('should throw LimitExceededException when deposit weekly count limit is reached', async () => {
      mockFiatWalletTransactionRepository.countTransactionsByTypeInPastWeek.mockResolvedValue(3);

      await expect(
        service.validateLimit(mockUser.id, 100, 'USD', FiatWalletTransactionType.DEPOSIT),
      ).rejects.toMatchObject({
        type: LimitExceededExceptionType.WEEKLY_COUNT_LIMIT_EXCEEDED_EXCEPTION,
        message: expect.stringContaining('weekly deposit limit'),
      });

      expect(mockFiatWalletTransactionRepository.countTransactionsByTypeInPastWeek).toHaveBeenCalledWith(
        mockUser.id,
        FiatWalletTransactionType.DEPOSIT,
        'USD',
      );
    });

    it('should throw LimitExceededException when withdrawal weekly count limit is reached', async () => {
      mockFiatWalletTransactionRepository.countTransactionsByTypeInPastWeek.mockResolvedValue(5);

      await expect(
        service.validateLimit(mockUser.id, 100, 'USD', FiatWalletTransactionType.WITHDRAWAL),
      ).rejects.toMatchObject({
        type: LimitExceededExceptionType.WEEKLY_COUNT_LIMIT_EXCEEDED_EXCEPTION,
        message: expect.stringContaining('weekly withdrawal limit'),
      });

      expect(mockFiatWalletTransactionRepository.countTransactionsByTypeInPastWeek).toHaveBeenCalledWith(
        mockUser.id,
        FiatWalletTransactionType.WITHDRAWAL,
        'USD',
      );
    });

    it('should pass validation when deposit weekly count is below limit', async () => {
      mockFiatWalletTransactionRepository.countTransactionsByTypeInPastWeek.mockResolvedValue(2);

      await expect(
        service.validateLimit(mockUser.id, 100, 'USD', FiatWalletTransactionType.DEPOSIT),
      ).resolves.not.toThrow();
    });

    it('should pass validation when withdrawal weekly count is below limit', async () => {
      mockFiatWalletTransactionRepository.countTransactionsByTypeInPastWeek.mockResolvedValue(4);

      await expect(
        service.validateLimit(mockUser.id, 100, 'USD', FiatWalletTransactionType.WITHDRAWAL),
      ).resolves.not.toThrow();
    });

    it('should skip weekly count check when maximum_weekly_deposit_count is not set', async () => {
      const tierConfigWithoutWeeklyCountLimits = {
        ...mockTierConfig,
        maximum_weekly_deposit_count: undefined,
        maximum_weekly_withdrawal_count: undefined,
      };
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(tierConfigWithoutWeeklyCountLimits as any);

      await expect(
        service.validateLimit(mockUser.id, 100, 'USD', FiatWalletTransactionType.DEPOSIT),
      ).resolves.not.toThrow();

      expect(mockFiatWalletTransactionRepository.countTransactionsByTypeInPastWeek).not.toHaveBeenCalled();
    });

    it('should not check weekly count limits for TRANSFER_IN transactions', async () => {
      await expect(
        service.validateLimit(mockUser.id, 100, 'USD', FiatWalletTransactionType.TRANSFER_IN),
      ).resolves.not.toThrow();

      expect(mockFiatWalletTransactionRepository.countTransactionsByTypeInPastWeek).not.toHaveBeenCalled();
    });
  });

  describe('validateLimit - all transaction types and limits', () => {
    const mockTierConfig = {
      id: 'tier-config-1',
      maximum_per_deposit: 100000,
      maximum_daily_deposit: 500000,
      maximum_weekly_deposit: 2000000,
      maximum_monthly_deposit: 10000000,
      maximum_per_withdrawal: 100000,
      maximum_daily_withdrawal: 500000,
      maximum_weekly_withdrawal: 2000000,
      maximum_monthly_withdrawal: 10000000,
      maximum_transaction_amount: 100000,
      maximum_daily_transaction: 500000,
      maximum_weekly_transaction: 2000000,
      maximum_monthly_transaction: 10000000,
    };

    const mockEmptyTransactionSums = {
      transactionTypeTotals: {
        deposit: { totalSum: 0 },
        withdrawal: { totalSum: 0 },
        exchange: { totalSum: 0 },
      },
    };

    beforeEach(() => {
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(mockTierConfig as any);
      mockTransactionSumService.getPastOneDayTransactionSum.mockResolvedValue(mockEmptyTransactionSums);
      mockTransactionSumService.getPastOneWeekTransactionSum.mockResolvedValue(mockEmptyTransactionSums);
      mockTransactionSumService.getPastOneMonthTransactionSum.mockResolvedValue(mockEmptyTransactionSums);
      mockLockerService.withLock.mockImplementation((_key: string, callback: () => Promise<void>) => callback());
      mockFiatWalletTransactionRepository.countPendingByUserAndType.mockResolvedValue(0);
    });

    it('should throw BadRequestException when tier config not found', async () => {
      jest.spyOn(service, 'getAssetLimits').mockResolvedValue(null);

      await expect(service.validateLimit(mockUser.id, 100, 'USD', FiatWalletTransactionType.DEPOSIT)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw LimitExceededException when single transaction limit exceeded for DEPOSIT', async () => {
      await expect(
        service.validateLimit(mockUser.id, 200000, 'USD', FiatWalletTransactionType.DEPOSIT),
      ).rejects.toMatchObject({
        type: LimitExceededExceptionType.TRANSACTION_LIMIT_EXCEEDED_EXCEPTION,
      });
    });

    it('should throw LimitExceededException when single transaction limit exceeded for WITHDRAWAL', async () => {
      await expect(
        service.validateLimit(mockUser.id, 200000, 'USD', FiatWalletTransactionType.WITHDRAWAL),
      ).rejects.toMatchObject({
        type: LimitExceededExceptionType.TRANSACTION_LIMIT_EXCEEDED_EXCEPTION,
      });
    });

    it('should throw LimitExceededException when single transaction limit exceeded for TRANSFER_OUT', async () => {
      await expect(
        service.validateLimit(mockUser.id, 200000, 'USD', FiatWalletTransactionType.TRANSFER_OUT),
      ).rejects.toMatchObject({
        type: LimitExceededExceptionType.TRANSACTION_LIMIT_EXCEEDED_EXCEPTION,
      });
    });

    it('should throw LimitExceededException when single transaction limit exceeded for EXCHANGE', async () => {
      await expect(
        service.validateLimit(mockUser.id, 200000, 'USD', FiatWalletTransactionType.EXCHANGE),
      ).rejects.toMatchObject({
        type: LimitExceededExceptionType.TRANSACTION_LIMIT_EXCEEDED_EXCEPTION,
      });
    });

    it('should throw LimitExceededException when daily limit exceeded', async () => {
      const highDailySums = {
        transactionTypeTotals: {
          deposit: { totalSum: 490000 },
        },
      };
      mockTransactionSumService.getPastOneDayTransactionSum.mockResolvedValue(highDailySums);

      await expect(
        service.validateLimit(mockUser.id, 20000, 'USD', FiatWalletTransactionType.DEPOSIT),
      ).rejects.toMatchObject({
        type: LimitExceededExceptionType.DAILY_LIMIT_EXCEEDED_EXCEPTION,
      });
    });

    it('should throw LimitExceededException when weekly limit exceeded', async () => {
      const highWeeklySums = {
        transactionTypeTotals: {
          deposit: { totalSum: 1990000 },
        },
      };
      mockTransactionSumService.getPastOneDayTransactionSum.mockResolvedValue(mockEmptyTransactionSums);
      mockTransactionSumService.getPastOneWeekTransactionSum.mockResolvedValue(highWeeklySums);

      await expect(
        service.validateLimit(mockUser.id, 20000, 'USD', FiatWalletTransactionType.DEPOSIT),
      ).rejects.toMatchObject({
        type: LimitExceededExceptionType.WEEKLY_LIMIT_EXCEEDED_EXCEPTION,
      });
    });

    it('should throw LimitExceededException when monthly limit exceeded', async () => {
      const highMonthlySums = {
        transactionTypeTotals: {
          deposit: { totalSum: 9990000 },
        },
      };
      mockTransactionSumService.getPastOneDayTransactionSum.mockResolvedValue(mockEmptyTransactionSums);
      mockTransactionSumService.getPastOneWeekTransactionSum.mockResolvedValue(mockEmptyTransactionSums);
      mockTransactionSumService.getPastOneMonthTransactionSum.mockResolvedValue(highMonthlySums);

      await expect(
        service.validateLimit(mockUser.id, 20000, 'USD', FiatWalletTransactionType.DEPOSIT),
      ).rejects.toMatchObject({
        type: LimitExceededExceptionType.MONTHLY_LIMIT_EXCEEDED_EXCEPTION,
      });
    });

    it('should handle withdrawal amounts with absolute values for limit checking', async () => {
      const withdrawalSums = {
        transactionTypeTotals: {
          withdrawal: { totalSum: -490000 },
        },
      };
      mockTransactionSumService.getPastOneDayTransactionSum.mockResolvedValue(withdrawalSums);

      await expect(
        service.validateLimit(mockUser.id, 20000, 'USD', FiatWalletTransactionType.WITHDRAWAL),
      ).rejects.toMatchObject({
        type: LimitExceededExceptionType.DAILY_LIMIT_EXCEEDED_EXCEPTION,
      });
    });

    it('should handle exchange amounts with absolute values for limit checking', async () => {
      const exchangeSums = {
        transactionTypeTotals: {
          exchange: { totalSum: -490000 },
        },
      };
      mockTransactionSumService.getPastOneDayTransactionSum.mockResolvedValue(exchangeSums);

      await expect(
        service.validateLimit(mockUser.id, 20000, 'USD', FiatWalletTransactionType.EXCHANGE),
      ).rejects.toMatchObject({
        type: LimitExceededExceptionType.DAILY_LIMIT_EXCEEDED_EXCEPTION,
      });
    });

    it('should skip validation for unknown transaction type', async () => {
      await expect(
        service.validateLimit(mockUser.id, 100, 'USD', 'UNKNOWN_TYPE' as FiatWalletTransactionType),
      ).resolves.not.toThrow();
    });

    it('should pass validation when all limits are within bounds', async () => {
      await expect(
        service.validateLimit(mockUser.id, 1000, 'USD', FiatWalletTransactionType.DEPOSIT),
      ).resolves.not.toThrow();
    });
  });

  describe('getUserPendingKYCInTier', () => {
    beforeEach(() => {
      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(null),
        }),
      });
    });

    it('should throw NotFoundException when tier not found', async () => {
      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.getUserPendingKYCInTier(mockUser.id, 'tier-1', 'country-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when tier config not found for country', async () => {
      const tierWithoutCountryConfig = {
        id: 'tier-1',
        tierConfigs: [{ country_id: 'other-country' }],
      };

      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierWithoutCountryConfig),
        }),
      });

      await expect(service.getUserPendingKYCInTier(mockUser.id, 'tier-1', 'country-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return empty array when no verification requirements exist', async () => {
      const tierWithEmptyRequirements = {
        id: 'tier-1',
        tierConfigs: [
          {
            country_id: 'country-1',
            tierConfigVerificationRequirements: [],
          },
        ],
      };

      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierWithEmptyRequirements),
        }),
      });

      const result = await service.getUserPendingKYCInTier(mockUser.id, 'tier-1', 'country-1');

      expect(result).toEqual([]);
    });

    it('should handle undefined tierConfigVerificationRequirements', async () => {
      const tierWithUndefinedReqs = {
        id: 'tier-1',
        tierConfigs: [
          {
            country_id: 'country-1',
            tierConfigVerificationRequirements: undefined,
          },
        ],
      };

      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierWithUndefinedReqs),
        }),
      });

      const result = await service.getUserPendingKYCInTier(mockUser.id, 'tier-1', 'country-1');

      expect(result).toEqual([]);
    });

    it('should return pending verification requirements', async () => {
      const mockVerificationRequirement = { id: 'ver-req-1', name: 'ID Verification' };
      const tierWithRequirements = {
        id: 'tier-1',
        tierConfigs: [
          {
            country_id: 'country-1',
            tierConfigVerificationRequirements: [
              { id: 'tcvr-1', verificationRequirement: mockVerificationRequirement },
              { id: 'tcvr-2', verificationRequirement: { id: 'ver-req-2', name: 'Address Proof' } },
            ],
          },
        ],
      };

      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierWithRequirements),
        }),
      });
      mockKycVerificationRepository.findUserApprovedVerifications.mockResolvedValue([
        { tier_config_verification_requirement_id: 'tcvr-1' },
      ]);

      const result = await service.getUserPendingKYCInTier(mockUser.id, 'tier-1', 'country-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Address Proof');
    });

    it('should return empty array when all requirements are approved', async () => {
      const tierWithRequirements = {
        id: 'tier-1',
        tierConfigs: [
          {
            country_id: 'country-1',
            tierConfigVerificationRequirements: [
              { id: 'tcvr-1', verificationRequirement: { id: 'ver-req-1', name: 'ID Verification' } },
            ],
          },
        ],
      };

      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierWithRequirements),
        }),
      });
      mockKycVerificationRepository.findUserApprovedVerifications.mockResolvedValue([
        { tier_config_verification_requirement_id: 'tcvr-1' },
      ]);

      const result = await service.getUserPendingKYCInTier(mockUser.id, 'tier-1', 'country-1');

      expect(result).toEqual([]);
    });

    it('should filter out undefined verification requirements', async () => {
      const tierWithUndefinedReq = {
        id: 'tier-1',
        tierConfigs: [
          {
            country_id: 'country-1',
            tierConfigVerificationRequirements: [
              { id: 'tcvr-1', verificationRequirement: undefined },
              { id: 'tcvr-2', verificationRequirement: { id: 'ver-req-2', name: 'Address Proof' } },
            ],
          },
        ],
      };

      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierWithUndefinedReq),
        }),
      });
      mockKycVerificationRepository.findUserApprovedVerifications.mockResolvedValue([]);

      const result = await service.getUserPendingKYCInTier(mockUser.id, 'tier-1', 'country-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Address Proof');
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockRejectedValue(new Error('DB error')),
        }),
      });

      await expect(service.getUserPendingKYCInTier(mockUser.id, 'tier-1', 'country-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getTierVerifications', () => {
    it('should throw NotFoundException when tier not found', async () => {
      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.getTierVerifications('tier-1')).rejects.toThrow(NotFoundException);
    });

    it('should return empty object when tier has no configs', async () => {
      const tierWithoutConfigs = {
        id: 'tier-1',
        tierConfigs: null,
      };

      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierWithoutConfigs),
        }),
      });

      const result = await service.getTierVerifications('tier-1');

      expect(result).toEqual({});
    });

    it('should skip tier configs without country', async () => {
      const tierWithoutCountry = {
        id: 'tier-1',
        tierConfigs: [
          {
            country: null,
            tierConfigVerificationRequirements: [{ verificationRequirement: { id: 'ver-1' } }],
          },
        ],
      };

      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierWithoutCountry),
        }),
      });

      const result = await service.getTierVerifications('tier-1');

      expect(result).toEqual({});
    });

    it('should return verifications grouped by country', async () => {
      const tierWithVerifications = {
        id: 'tier-1',
        tierConfigs: [
          {
            country: { id: 'country-1' },
            tierConfigVerificationRequirements: [
              { verificationRequirement: { id: 'ver-1', name: 'ID' } },
              { verificationRequirement: { id: 'ver-2', name: 'Address' } },
            ],
          },
          {
            country: { id: 'country-2' },
            tierConfigVerificationRequirements: [{ verificationRequirement: { id: 'ver-3', name: 'BVN' } }],
          },
        ],
      };

      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierWithVerifications),
        }),
      });

      const result = await service.getTierVerifications('tier-1');

      expect(result['country-1']).toHaveLength(2);
      expect(result['country-2']).toHaveLength(1);
    });

    it('should filter out undefined verification requirements', async () => {
      const tierWithUndefined = {
        id: 'tier-1',
        tierConfigs: [
          {
            country: { id: 'country-1' },
            tierConfigVerificationRequirements: [
              { verificationRequirement: undefined },
              { verificationRequirement: { id: 'ver-1', name: 'ID' } },
            ],
          },
        ],
      };

      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierWithUndefined),
        }),
      });

      const result = await service.getTierVerifications('tier-1');

      expect(result['country-1']).toHaveLength(1);
    });

    it('should not include country with empty requirements after filtering', async () => {
      const tierWithEmptyAfterFilter = {
        id: 'tier-1',
        tierConfigs: [
          {
            country: { id: 'country-1' },
            tierConfigVerificationRequirements: [{ verificationRequirement: undefined }],
          },
        ],
      };

      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierWithEmptyAfterFilter),
        }),
      });

      const result = await service.getTierVerifications('tier-1');

      expect(result['country-1']).toBeUndefined();
    });

    it('should handle undefined tierConfigVerificationRequirements', async () => {
      const tierWithUndefinedReqs = {
        id: 'tier-1',
        tierConfigs: [
          {
            country: { id: 'country-1' },
            tierConfigVerificationRequirements: undefined,
          },
        ],
      };

      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierWithUndefinedReqs),
        }),
      });

      const result = await service.getTierVerifications('tier-1');

      expect(result['country-1']).toBeUndefined();
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockTierRepository.query.mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockRejectedValue(new Error('DB error')),
        }),
      });

      await expect(service.getTierVerifications('tier-1')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('isTierCompleted', () => {
    it('should return false when tier config not found', async () => {
      mockTierConfigRepository.query.mockReturnValue({
        findOne: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.isTierCompleted(mockUser.id, 'tier-1', 'country-1');

      expect(result).toBe(false);
    });

    it('should return false when no verification requirements exist', async () => {
      const tierConfigNoReqs = {
        id: 'tc-1',
        tierConfigVerificationRequirements: [],
      };

      mockTierConfigRepository.query.mockReturnValue({
        findOne: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierConfigNoReqs),
        }),
      });

      const result = await service.isTierCompleted(mockUser.id, 'tier-1', 'country-1');

      expect(result).toBe(false);
    });

    it('should return false when tierConfigVerificationRequirements is undefined', async () => {
      const tierConfigUndefinedReqs = {
        id: 'tc-1',
        tierConfigVerificationRequirements: undefined,
      };

      mockTierConfigRepository.query.mockReturnValue({
        findOne: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierConfigUndefinedReqs),
        }),
      });

      const result = await service.isTierCompleted(mockUser.id, 'tier-1', 'country-1');

      expect(result).toBe(false);
    });

    it('should return true when all requirements are approved', async () => {
      const tierConfig = {
        id: 'tc-1',
        tierConfigVerificationRequirements: [{ id: 'tcvr-1' }, { id: 'tcvr-2' }],
      };

      mockTierConfigRepository.query.mockReturnValue({
        findOne: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierConfig),
        }),
      });
      mockKycVerificationRepository.findUserApprovedVerifications.mockResolvedValue([
        { tier_config_verification_requirement_id: 'tcvr-1' },
        { tier_config_verification_requirement_id: 'tcvr-2' },
      ]);

      const result = await service.isTierCompleted(mockUser.id, 'tier-1', 'country-1');

      expect(result).toBe(true);
    });

    it('should return false when not all requirements are approved', async () => {
      const tierConfig = {
        id: 'tc-1',
        tierConfigVerificationRequirements: [{ id: 'tcvr-1' }, { id: 'tcvr-2' }],
      };

      mockTierConfigRepository.query.mockReturnValue({
        findOne: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierConfig),
        }),
      });
      mockKycVerificationRepository.findUserApprovedVerifications.mockResolvedValue([
        { tier_config_verification_requirement_id: 'tcvr-1' },
      ]);

      const result = await service.isTierCompleted(mockUser.id, 'tier-1', 'country-1');

      expect(result).toBe(false);
    });

    it('should return false when approved verifications do not match requirements', async () => {
      const tierConfig = {
        id: 'tc-1',
        tierConfigVerificationRequirements: [{ id: 'tcvr-1' }],
      };

      mockTierConfigRepository.query.mockReturnValue({
        findOne: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tierConfig),
        }),
      });
      mockKycVerificationRepository.findUserApprovedVerifications.mockResolvedValue([
        { tier_config_verification_requirement_id: 'tcvr-other' },
      ]);

      const result = await service.isTierCompleted(mockUser.id, 'tier-1', 'country-1');

      expect(result).toBe(false);
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockTierConfigRepository.query.mockReturnValue({
        findOne: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockRejectedValue(new Error('DB error')),
        }),
      });

      await expect(service.isTierCompleted(mockUser.id, 'tier-1', 'country-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getAssetLimits', () => {
    it('should return null for unsupported crypto asset', async () => {
      const result = await service.getAssetLimits(mockUser.id, 'BTC');

      expect(result).toBeNull();
    });

    it('should throw NotFoundException when country code cannot be determined', async () => {
      // Mock CurrencyUtility to return true for supported but undefined for country code
      const isSupportedSpy = jest.spyOn(CurrencyUtility, 'isSupportedCurrency').mockReturnValue(true);
      const getCountryCodeSpy = jest.spyOn(CurrencyUtility, 'getCurrencyCountryCode').mockReturnValue(undefined);

      await expect(service.getAssetLimits(mockUser.id, 'FAKE_CURRENCY')).rejects.toThrow(NotFoundException);

      isSupportedSpy.mockRestore();
      getCountryCodeSpy.mockRestore();
    });

    it('should throw NotFoundException when country not found in database', async () => {
      mockCountryRepository.findOne.mockResolvedValue(null);

      await expect(service.getAssetLimits(mockUser.id, 'USD')).rejects.toThrow(NotFoundException);
    });

    it('should return null when user has no current tier', async () => {
      mockCountryRepository.findOne.mockResolvedValue({ id: 'country-1', code: 'US' });
      jest.spyOn(service, 'getUserCurrentTier').mockResolvedValue(undefined);

      const result = await service.getAssetLimits(mockUser.id, 'USD');

      expect(result).toBeNull();
    });

    it('should return null when tier config not found', async () => {
      mockCountryRepository.findOne.mockResolvedValue({ id: 'country-1', code: 'US' });
      jest.spyOn(service, 'getUserCurrentTier').mockResolvedValue(mockTier);
      mockTierConfigRepository.query.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      });

      const result = await service.getAssetLimits(mockUser.id, 'USD');

      expect(result).toBeNull();
    });

    it('should return tier config when found', async () => {
      const expectedTierConfig = {
        id: 'tc-1',
        maximum_daily_deposit: 100000,
      };

      mockCountryRepository.findOne.mockResolvedValue({ id: 'country-1', code: 'US' });
      jest.spyOn(service, 'getUserCurrentTier').mockResolvedValue(mockTier);
      mockTierConfigRepository.query.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(expectedTierConfig),
      });

      const result = await service.getAssetLimits(mockUser.id, 'USD');

      expect(result).toEqual(expectedTierConfig);
    });

    it('should normalize asset to uppercase', async () => {
      const expectedTierConfig = { id: 'tc-1' };

      mockCountryRepository.findOne.mockResolvedValue({ id: 'country-1', code: 'US' });
      jest.spyOn(service, 'getUserCurrentTier').mockResolvedValue(mockTier);
      mockTierConfigRepository.query.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(expectedTierConfig),
      });

      const result = await service.getAssetLimits(mockUser.id, 'usd');

      expect(result).toEqual(expectedTierConfig);
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockCountryRepository.findOne.mockRejectedValue(new Error('DB error'));

      await expect(service.getAssetLimits(mockUser.id, 'USD')).rejects.toThrow(InternalServerErrorException);
    });

    it('should re-throw NotFoundException errors', async () => {
      mockCountryRepository.findOne.mockResolvedValue(null);

      await expect(service.getAssetLimits(mockUser.id, 'USD')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserTransactionLimits - error handling', () => {
    it('should re-throw NotFoundException', async () => {
      jest.spyOn(service, 'getAssetLimits').mockRejectedValue(new NotFoundException('Not found'));

      await expect(service.getUserTransactionLimits(mockUser.id)).rejects.toThrow(NotFoundException);
    });
  });
});

describe('UserTierController', () => {
  let controller: UserTierController;
  let service: UserTierService;

  const mockUserTierService = {
    getUserCurrentTier: jest.fn(),
    getUserTransactionLimits: jest.fn(),
  };

  const mockReflector = {
    get: jest.fn().mockReturnValue([]),
  };

  const mockUser: UserModel = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
  } as UserModel;

  const mockTier: ITier = {
    id: 'tier-1',
    name: 'Gold',
    level: 2,
    description: 'Gold tier',
    status: TierStatus.ACTIVE,
    tierConfigs: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserTierController],
      providers: [
        { provide: UserTierService, useValue: mockUserTierService },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    controller = module.get<UserTierController>(UserTierController);
    service = module.get<UserTierService>(UserTierService);
  });

  describe('getUserTier', () => {
    it('should return user tier and transformed response', async () => {
      mockUserTierService.getUserCurrentTier.mockResolvedValue(mockTier);

      const result = await controller.getUserTier(mockUser);

      expect(service.getUserCurrentTier).toHaveBeenCalledWith(mockUser.id);
      expect(result).toMatchObject({
        message: 'User tier fetched successfully',
        data: mockTier,
        statusCode: 200,
      });
    });

    it('should return undefined tier when user has no tier', async () => {
      mockUserTierService.getUserCurrentTier.mockResolvedValue(undefined);

      const result = await controller.getUserTier(mockUser);

      expect(service.getUserCurrentTier).toHaveBeenCalledWith(mockUser.id);
      expect(result).toMatchObject({
        message: 'User tier fetched successfully',
        data: undefined,
        statusCode: 200,
      });
    });
  });

  describe('getUserTransactionLimits', () => {
    const mockLimitsResponse = {
      limits: [
        {
          currency: 'USD',
          send: {
            single_transaction_limit: 50000,
            daily: { limit: 250000, spent: 10000, remaining: 240000 },
            weekly: { limit: 1000000, spent: 50000, remaining: 950000 },
            monthly: { limit: 5000000, spent: 100000, remaining: 4900000 },
          },
          receive: {
            single_transaction_limit: 100000,
            daily: { limit: 500000, spent: 20000, remaining: 480000 },
            weekly: { limit: 2000000, spent: 100000, remaining: 1900000 },
            monthly: { limit: 10000000, spent: 200000, remaining: 9800000 },
          },
        },
        {
          currency: 'NGN',
          send: {
            single_transaction_limit: 5000000,
            daily: { limit: 25000000, spent: 0, remaining: 25000000 },
            weekly: { limit: 100000000, spent: 0, remaining: 100000000 },
            monthly: { limit: 500000000, spent: 0, remaining: 500000000 },
          },
          receive: {
            single_transaction_limit: 10000000,
            daily: { limit: 50000000, spent: 0, remaining: 50000000 },
            weekly: { limit: 200000000, spent: 0, remaining: 200000000 },
            monthly: { limit: 1000000000, spent: 0, remaining: 1000000000 },
          },
        },
      ],
    };

    it('should return transaction limits for all currencies', async () => {
      mockUserTierService.getUserTransactionLimits.mockResolvedValue(mockLimitsResponse);

      const result = await controller.getUserTransactionLimits(mockUser);

      expect(service.getUserTransactionLimits).toHaveBeenCalledWith(mockUser.id);
      expect(result).toMatchObject({
        message: 'User transaction limits fetched successfully',
        data: mockLimitsResponse,
        statusCode: 200,
      });
    });

    it('should return empty limits when user has no tier config', async () => {
      mockUserTierService.getUserTransactionLimits.mockResolvedValue({ limits: [] });

      const result = await controller.getUserTransactionLimits(mockUser);

      expect(service.getUserTransactionLimits).toHaveBeenCalledWith(mockUser.id);
      expect(result).toMatchObject({
        message: 'User transaction limits fetched successfully',
        data: { limits: [] },
        statusCode: 200,
      });
    });
  });
});
