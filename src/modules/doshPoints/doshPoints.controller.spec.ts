import { Test, TestingModule } from '@nestjs/testing';
import { DoshPointsAccountStatus } from '../../database/models/doshPointsAccount/doshPointsAccount.interface';
import { DoshPointsAccountModel } from '../../database/models/doshPointsAccount/doshPointsAccount.model';
import { UserModel } from '../../database/models/user/user.model';
import { DoshPointsController } from './doshPoints.controller';
import { DoshPointsAccountService } from './doshPointsAccount/doshPointsAccount.service';
import { DoshPointsStablecoinRewardService } from './doshPointsStablecoinReward/doshPointsStablecoinReward.service';
import { DoshPointsTransactionService } from './doshPointsTransaction/doshPointsTransaction.service';

describe('DoshPointsController', () => {
  let controller: DoshPointsController;

  const mockAccountService = {
    findOrCreate: jest.fn(),
    updateUsdFiatRewardsEnabled: jest.fn(),
  };

  const mockTransactionService = {
    getTransactionHistory: jest.fn(),
  };

  const mockStablecoinRewardService = {
    handleOptIn: jest.fn(),
  };

  const mockUser: UserModel = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
  } as UserModel;

  const mockAccount: DoshPointsAccountModel = {
    id: 'account-123',
    user_id: 'user-123',
    balance: 100,
    status: DoshPointsAccountStatus.ACTIVE,
    usd_fiat_rewards_enabled: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as DoshPointsAccountModel;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DoshPointsController],
      providers: [
        { provide: DoshPointsAccountService, useValue: mockAccountService },
        { provide: DoshPointsTransactionService, useValue: mockTransactionService },
        { provide: DoshPointsStablecoinRewardService, useValue: mockStablecoinRewardService },
      ],
    }).compile();

    controller = module.get<DoshPointsController>(DoshPointsController);
  });

  describe('getAccount', () => {
    it('should return user account with success message', async () => {
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);

      const result = await controller.getAccount(mockUser);

      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Dosh Points account retrieved successfully');
      expect(result.data).toEqual(mockAccount);
      expect(result.timestamp).toBeDefined();
      expect(mockAccountService.findOrCreate).toHaveBeenCalledWith('user-123');
    });

    it('should create account if not exists', async () => {
      const newAccount = { ...mockAccount, balance: 0 };
      mockAccountService.findOrCreate.mockResolvedValue(newAccount);

      const result = await controller.getAccount(mockUser);

      expect(result.data).toEqual(newAccount);
      expect(mockAccountService.findOrCreate).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getTransactions', () => {
    it('should return paginated transactions with success message', async () => {
      const mockTransactions = {
        dosh_points_transactions: [
          { id: 'txn-1', amount: 10 },
          { id: 'txn-2', amount: 5 },
        ],
        pagination: { current_page: 1, total: 2, limit: 10 },
      };
      mockTransactionService.getTransactionHistory.mockResolvedValue(mockTransactions);

      const result = await controller.getTransactions(mockUser, { page: 1, limit: 10 });

      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Dosh Points transactions retrieved successfully');
      expect(result.data).toEqual(mockTransactions);
      expect(result.timestamp).toBeDefined();
      expect(mockTransactionService.getTransactionHistory).toHaveBeenCalledWith('user-123', { page: 1, limit: 10 });
    });

    it('should use default pagination when not provided', async () => {
      const mockTransactions = {
        dosh_points_transactions: [],
        pagination: { current_page: 1, total: 0, limit: 10 },
      };
      mockTransactionService.getTransactionHistory.mockResolvedValue(mockTransactions);

      await controller.getTransactions(mockUser, {});

      expect(mockTransactionService.getTransactionHistory).toHaveBeenCalledWith('user-123', {});
    });

    it('should return empty transactions array when user has no transactions', async () => {
      const emptyTransactions = {
        dosh_points_transactions: [],
        pagination: { current_page: 1, total: 0, limit: 10 },
      };
      mockTransactionService.getTransactionHistory.mockResolvedValue(emptyTransactions);

      const result = await controller.getTransactions(mockUser, { page: 1, limit: 10 });

      expect(result.data.dosh_points_transactions).toEqual([]);
      expect(result.data.pagination.total).toBe(0);
    });
  });

  describe('updateUsdFiatRewardsEnabled', () => {
    it('should update usd_fiat_rewards_enabled to true', async () => {
      const updatedAccount = { ...mockAccount, usd_fiat_rewards_enabled: true };
      const mockResult = {
        account: updatedAccount,
        rewardProcessed: false,
        message: 'Successfully enabled stablecoin rewards',
      };
      mockStablecoinRewardService.handleOptIn.mockResolvedValue(mockResult);

      const result = await controller.updateUsdFiatRewardsEnabled(mockUser, { enabled: true });

      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Successfully enabled stablecoin rewards');
      expect(result.data).toEqual(mockResult);
      expect(mockStablecoinRewardService.handleOptIn).toHaveBeenCalledWith('user-123', true);
    });

    it('should update usd_fiat_rewards_enabled to false', async () => {
      const updatedAccount = { ...mockAccount, usd_fiat_rewards_enabled: false };
      const mockResult = {
        account: updatedAccount,
        rewardProcessed: false,
        message: 'Successfully disabled stablecoin rewards',
      };
      mockStablecoinRewardService.handleOptIn.mockResolvedValue(mockResult);

      const result = await controller.updateUsdFiatRewardsEnabled(mockUser, { enabled: false });

      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Successfully disabled stablecoin rewards');
      expect(result.data).toEqual(mockResult);
      expect(mockStablecoinRewardService.handleOptIn).toHaveBeenCalledWith('user-123', false);
    });
  });
});
