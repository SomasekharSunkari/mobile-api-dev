import { DoshPointsAccountStatus } from '../../../database/models/doshPointsAccount/doshPointsAccount.interface';
import { DoshPointsAccountModel } from '../../../database/models/doshPointsAccount/doshPointsAccount.model';
import { DoshPointsTransactionType } from '../../../database/models/doshPointsEvent/doshPointsEvent.interface';
import { DoshPointsEventModel } from '../../../database/models/doshPointsEvent/doshPointsEvent.model';
import { DoshPointsTransactionStatus } from '../../../database/models/doshPointsTransaction/doshPointsTransaction.interface';
import { DoshPointsTransactionModel } from '../../../database/models/doshPointsTransaction/doshPointsTransaction.model';
import { DoshPointsException, DoshPointsExceptionType } from '../../../exceptions/dosh_points_exception';
import { DoshPointsTransactionService } from './doshPointsTransaction.service';

describe('DoshPointsTransactionService', () => {
  let service: DoshPointsTransactionService;

  const mockTransactionRepository = {
    findOne: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    transaction: jest.fn(),
    query: jest.fn(),
    update: jest.fn(),
    paginateData: jest.fn(),
  };

  const mockAccountService = {
    findOrCreate: jest.fn(),
    updateBalance: jest.fn(),
  };

  const mockEventService = {
    findByCode: jest.fn(),
  };

  const mockLockerService = {
    runWithLock: jest.fn(),
  };

  const mockInAppNotificationService = {
    createNotification: jest.fn().mockResolvedValue(undefined),
  };

  const mockPushNotificationService = {
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
  };

  const mockUserProfileRepository = {
    findByUserId: jest.fn(),
  };

  const mockEvent: DoshPointsEventModel = {
    id: 'event-123',
    code: 'ONBOARDING_BONUS',
    name: 'Onboarding Bonus',
    transaction_type: DoshPointsTransactionType.CREDIT,
    default_points: 10,
    is_active: true,
    is_one_time_per_user: true,
  } as DoshPointsEventModel;

  const mockAccount: DoshPointsAccountModel = {
    id: 'account-123',
    user_id: 'user-123',
    balance: 0,
    status: DoshPointsAccountStatus.ACTIVE,
  } as DoshPointsAccountModel;

  const mockTransaction: DoshPointsTransactionModel = {
    id: 'txn-123',
    dosh_points_account_id: 'account-123',
    user_id: 'user-123',
    event_code: 'ONBOARDING_BONUS',
    transaction_type: DoshPointsTransactionType.CREDIT,
    amount: 10,
    balance_before: 0,
    balance_after: 10,
    source_reference: 'tier-456',
    status: DoshPointsTransactionStatus.COMPLETED,
  } as DoshPointsTransactionModel;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new DoshPointsTransactionService();
    (service as any).transactionRepository = mockTransactionRepository;
    (service as any).doshPointsAccountService = mockAccountService;
    (service as any).eventService = mockEventService;
    (service as any).lockerService = mockLockerService;
    (service as any).inAppNotificationService = mockInAppNotificationService;
    (service as any).pushNotificationService = mockPushNotificationService;
    (service as any).userProfileRepository = mockUserProfileRepository;
    (service as any).logger = { log: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() };

    // Default lock behavior - execute callback immediately
    mockLockerService.runWithLock.mockImplementation(async (key, callback) => callback());
  });

  describe('getTransactionHistory', () => {
    let mockQueryBuilder: any;

    beforeEach(() => {
      mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
      };
      mockTransactionRepository.query.mockReturnValue(mockQueryBuilder);
    });

    it('should return paginated transactions for user', async () => {
      const mockResult = {
        dosh_points_transactions: [mockTransaction],
        pagination: { current_page: 1, total: 1, limit: 10 },
      };
      mockTransactionRepository.paginateData.mockResolvedValue(mockResult);

      const result = await service.getTransactionHistory('user-123', { page: 1, limit: 10 });

      expect(result).toBe(mockResult);
      expect(mockTransactionRepository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('amount', '>', 0);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('created_at', 'desc');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
      expect(mockTransactionRepository.paginateData).toHaveBeenCalledWith(mockQueryBuilder, 10, 1);
    });

    it('should use default pagination when not provided', async () => {
      mockTransactionRepository.paginateData.mockResolvedValue({
        dosh_points_transactions: [],
        pagination: {},
      });

      await service.getTransactionHistory('user-123');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('amount', '>', 0);
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
    });

    it('should filter out transactions with zero amount', async () => {
      const mockResult = {
        dosh_points_transactions: [mockTransaction],
        pagination: { current_page: 1, total: 1, limit: 10 },
      };
      mockTransactionRepository.paginateData.mockResolvedValue(mockResult);

      await service.getTransactionHistory('user-123', { page: 1, limit: 10 });

      // Verify that the query filters amount > 0
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('amount', '>', 0);
    });
  });

  describe('creditPoints', () => {
    it('should acquire lock with correct key', async () => {
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 10 });

      await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect(mockLockerService.runWithLock).toHaveBeenCalledWith(
        'dosh_points_credit_user-123_ONBOARDING_BONUS_tier-456',
        expect.any(Function),
      );
    });

    it('should return existing transaction for duplicate request (idempotent)', async () => {
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect(result.transaction).toBe(mockTransaction);
      expect(result.is_duplicate).toBe(true);
      expect(result.account).toBeUndefined();
      expect(mockAccountService.findOrCreate).not.toHaveBeenCalled();
      expect(mockTransactionRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ALREADY_EARNED for one-time event with different source', async () => {
      const existingTxn = { ...mockTransaction, source_reference: 'tier-OLD' };
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(existingTxn);

      try {
        await service.creditPoints({
          user_id: 'user-123',
          event_code: 'ONBOARDING_BONUS',
          source_reference: 'tier-NEW',
        });
        fail('Expected exception to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DoshPointsException);
        expect(error.type).toBe(DoshPointsExceptionType.ALREADY_EARNED);
      }
    });

    it('should create new transaction for first-time credit', async () => {
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      const updatedAccount = { ...mockAccount, balance: 10 };
      mockAccountService.updateBalance.mockResolvedValue(updatedAccount);

      const result = await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect(result.transaction).toBe(mockTransaction);
      expect(result.account).toBe(updatedAccount);
      expect(result.is_duplicate).toBe(false);
    });

    it('should create transaction with correct data', async () => {
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 10 });

      await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
        description: 'Custom description',
        metadata: { custom: 'data' },
      });

      expect(mockTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dosh_points_account_id: 'account-123',
          user_id: 'user-123',
          event_code: 'ONBOARDING_BONUS',
          transaction_type: DoshPointsTransactionType.CREDIT,
          amount: 10,
          balance_before: 0,
          balance_after: 10,
          source_reference: 'tier-456',
          description: 'Custom description',
          metadata: { custom: 'data' },
          status: DoshPointsTransactionStatus.COMPLETED,
          idempotency_key: 'user-123_ONBOARDING_BONUS_tier-456',
        }),
        expect.anything(),
      );
    });

    it('should use event name as description when not provided', async () => {
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 10 });

      await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect(mockTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Onboarding Bonus',
        }),
        expect.anything(),
      );
    });

    it('should update account balance atomically', async () => {
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      const mockTrx = { commit: jest.fn(), rollback: jest.fn() };
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback(mockTrx));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 10 });

      await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect(mockAccountService.updateBalance).toHaveBeenCalledWith('account-123', 10, mockTrx);
    });

    it('should check by user+event for one-time events', async () => {
      mockEventService.findByCode.mockResolvedValue({ ...mockEvent, is_one_time_per_user: true });
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 10 });

      await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect(mockTransactionRepository.findOne).toHaveBeenCalledWith({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
      });
    });

    it('should check by user+event+source for multi-use events', async () => {
      mockEventService.findByCode.mockResolvedValue({ ...mockEvent, is_one_time_per_user: false });
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 10 });

      await service.creditPoints({
        user_id: 'user-123',
        event_code: 'REFERRAL_BONUS',
        source_reference: 'referral-789',
      });

      expect(mockTransactionRepository.findOne).toHaveBeenCalledWith({
        user_id: 'user-123',
        event_code: 'REFERRAL_BONUS',
        source_reference: 'referral-789',
      });
    });

    it('should convert bigint balance to number', async () => {
      const accountWithBigInt = { ...mockAccount, balance: BigInt(50) };
      mockEventService.findByCode.mockResolvedValue({ ...mockEvent, default_points: BigInt(10) });
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(accountWithBigInt);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 60 });

      await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect(mockTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10,
          balance_before: 50,
          balance_after: 60,
        }),
        expect.anything(),
      );
    });

    it('should send in-app notification with REWARDS type after successful credit', async () => {
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 10 });

      await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect(mockInAppNotificationService.createNotification).toHaveBeenCalledWith({
        user_id: 'user-123',
        type: 'rewards',
        title: 'Dosh Points Earned!',
        message: 'You earned 10 Dosh Points for Onboarding Bonus.',
      });
    });

    it('should not fail transaction if notification fails', async () => {
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 10 });
      mockInAppNotificationService.createNotification.mockRejectedValue(new Error('Notification failed'));

      const result = await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect(result.is_duplicate).toBe(false);
      expect(result.transaction).toBe(mockTransaction);
    });

    it('should not send notification for duplicate transactions', async () => {
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect(mockInAppNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should not send notification when pointsToCredit is 0', async () => {
      const zeroPointsEvent = {
        ...mockEvent,
        default_points: 0,
        name: 'First Deposit USD Match',
      };
      mockEventService.findByCode.mockResolvedValue(zeroPointsEvent);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 0 });

      await service.creditPoints({
        user_id: 'user-123',
        event_code: 'FIRST_DEPOSIT_USD_MATCH',
        source_reference: 'zerohash',
      });

      expect(mockInAppNotificationService.createNotification).not.toHaveBeenCalled();
      expect(mockPushNotificationService.sendPushNotification).not.toHaveBeenCalled();
    });

    it('should send push notification when user has notification token', async () => {
      const mockUserProfile = {
        user_id: 'user-123',
        notification_token: 'test-token-123',
      };
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 10 });
      mockUserProfileRepository.findByUserId.mockResolvedValue(mockUserProfile);

      await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect(mockUserProfileRepository.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockPushNotificationService.sendPushNotification).toHaveBeenCalledWith(['test-token-123'], {
        title: 'Dosh Points Earned!',
        body: 'You earned 10 Dosh Points for Onboarding Bonus.',
      });
    });

    it('should not send push notification when user has no notification token', async () => {
      const mockUserProfile = {
        user_id: 'user-123',
        notification_token: null,
      };
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 10 });
      mockUserProfileRepository.findByUserId.mockResolvedValue(mockUserProfile);

      await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect(mockUserProfileRepository.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockPushNotificationService.sendPushNotification).not.toHaveBeenCalled();
    });

    it('should not send push notification when user profile not found', async () => {
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 10 });
      mockUserProfileRepository.findByUserId.mockResolvedValue(null);

      await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect(mockUserProfileRepository.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockPushNotificationService.sendPushNotification).not.toHaveBeenCalled();
    });

    it('should not fail transaction if push notification fails', async () => {
      const mockUserProfile = {
        user_id: 'user-123',
        notification_token: 'test-token-123',
      };
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 10 });
      mockUserProfileRepository.findByUserId.mockResolvedValue(mockUserProfile);
      mockPushNotificationService.sendPushNotification.mockRejectedValue(new Error('Push notification failed'));

      const result = await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect(result.is_duplicate).toBe(false);
      expect(result.transaction).toBe(mockTransaction);
    });

    it('should log notification summary with both statuses', async () => {
      const mockUserProfile = {
        user_id: 'user-123',
        notification_token: 'test-token-123',
      };
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 10 });
      mockUserProfileRepository.findByUserId.mockResolvedValue(mockUserProfile);
      mockInAppNotificationService.createNotification.mockResolvedValue(undefined);
      mockPushNotificationService.sendPushNotification.mockResolvedValue(undefined);

      await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect((service as any).logger.debug).toHaveBeenCalledWith(
        'Notification summary for user user-123: In-App=✓, Push=✓',
      );
    });

    it('should log notification summary when push fails but in-app succeeds', async () => {
      const mockUserProfile = {
        user_id: 'user-123',
        notification_token: 'test-token-123',
      };
      mockEventService.findByCode.mockResolvedValue(mockEvent);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockAccountService.findOrCreate.mockResolvedValue(mockAccount);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
      mockTransactionRepository.create.mockResolvedValue(mockTransaction);
      mockAccountService.updateBalance.mockResolvedValue({ ...mockAccount, balance: 10 });
      mockUserProfileRepository.findByUserId.mockResolvedValue(mockUserProfile);
      mockInAppNotificationService.createNotification.mockResolvedValue(undefined);
      mockPushNotificationService.sendPushNotification.mockRejectedValue(new Error('Push failed'));

      await service.creditPoints({
        user_id: 'user-123',
        event_code: 'ONBOARDING_BONUS',
        source_reference: 'tier-456',
      });

      expect((service as any).logger.debug).toHaveBeenCalledWith(
        'Notification summary for user user-123: In-App=✓, Push=✗',
      );
    });
  });

  describe('findOne', () => {
    it('should find transaction by standard criteria without metadata filter', async () => {
      const mockTransaction = { id: 'tx-123', user_id: 'user-123', event_code: 'TEST_EVENT' };
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.findOne({
        user_id: 'user-123',
        event_code: 'TEST_EVENT',
      });

      expect(mockTransactionRepository.findOne).toHaveBeenCalledWith({
        user_id: 'user-123',
        event_code: 'TEST_EVENT',
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should find transaction with JSON metadata filtering', async () => {
      const mockTransaction = {
        id: 'tx-456',
        user_id: 'user-123',
        metadata: { reward: { transaction_id: 'reward-789' } },
      };
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereRaw: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockTransaction),
      };
      mockTransactionRepository.query.mockReturnValue(mockQuery);

      const result = await service.findOne(
        {
          user_id: 'user-123',
          event_code: 'REWARD_EVENT',
        },
        {
          path: 'reward.transaction_id',
          value: 'reward-789',
        },
      );

      expect(mockTransactionRepository.query).toHaveBeenCalled();
      expect(mockQuery.where).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockQuery.where).toHaveBeenCalledWith('event_code', 'REWARD_EVENT');
      expect(mockQuery.whereRaw).toHaveBeenCalledWith('metadata->reward.transaction_id = ?', ['reward-789']);
      expect(result).toEqual(mockTransaction);
    });

    it('should throw error for invalid metadata path', async () => {
      await expect(
        service.findOne(
          {
            user_id: 'user-123',
            event_code: 'REWARD_EVENT',
          },
          {
            path: 'malicious.path' as any,
            value: 'value',
          },
        ),
      ).rejects.toThrow('Invalid metadata path: malicious.path');

      expect(mockTransactionRepository.query).not.toHaveBeenCalled();
    });

    it('should handle undefined criteria values in metadata filter', async () => {
      const mockTransaction = { id: 'tx-789' };
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereRaw: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockTransaction),
      };
      mockTransactionRepository.query.mockReturnValue(mockQuery);

      await service.findOne(
        {
          user_id: 'user-123',
          source_reference: undefined,
        },
        {
          path: 'reward.fiat_wallet_transaction_id',
          value: 'test-value',
        },
      );

      expect(mockQuery.where).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockQuery.where).not.toHaveBeenCalledWith('source_reference', expect.anything());
    });
  });

  describe('update', () => {
    it('should update a transaction', async () => {
      const updateData = { status: DoshPointsTransactionStatus.COMPLETED };
      mockTransactionRepository.update.mockResolvedValue({ id: 'tx-123', ...updateData });

      const result = await service.update('tx-123', updateData);

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-123', updateData);
      expect(result).toEqual({ id: 'tx-123', ...updateData });
    });
  });
});
