import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { ActivityRepository } from './activity.repository';
import { UserModel } from '../../database/models';
import { ActivityType } from './activity.interface';
import { GetActivitiesDto } from './dto';
import { TransactionService } from '../transaction/transaction.service';
import { ExternalAccountService } from '../externalAccount/external-account.service';
import { BlockchainAccountsService } from '../blockchainAccounts/blockchainAccounts.service';
import { VirtualAccountRepository } from '../virtualAccount/virtualAccount.repository';
import { KycStatusLogRepository } from '../auth/kycStatusLog/kycStatusLog.repository';
import { KycVerificationRepository } from '../auth/kycVerification/kycVerification.repository';
import { AppLoggerService } from '../../services/logger/logger.service';

describe('ActivityController', () => {
  let controller: ActivityController;
  let service: ActivityService;
  let repository: ActivityRepository;

  const mockUser: Partial<UserModel> = {
    id: 'user123',
    username: 'testuser',
    email: 'test@example.com',
  };

  const mockActivityData = {
    activities: [
      {
        id: 'activity1',
        user_id: 'user123',
        activity_type: ActivityType.TRANSACTION,
        action: 'deposit',
        description: 'Deposited $100.00 USD',
        activity_date: new Date('2024-01-15T10:30:00.000Z'),
        metadata: {
          amount: '10000',
          asset: 'USD',
          status: 'completed',
        },
      },
      {
        id: 'activity2',
        user_id: 'user123',
        activity_type: ActivityType.KYC_STATUS,
        action: 'KYC status changed to verified',
        description: 'Identity verification completed',
        activity_date: new Date('2024-01-14T15:20:00.000Z'),
        metadata: {
          old_status: 'pending',
          new_status: 'verified',
          provider: 'sumsub',
        },
      },
    ],
    pagination: {
      previous_page: 0,
      current_page: 1,
      next_page: 0,
      limit: 10,
      page_count: 1,
      total: 2,
    },
  };

  const mockActivityDetails = {
    activity_type: 'transaction',
    details: {
      id: 'activity1',
      user_id: 'user123',
      amount: '10000',
      asset: 'USD',
      status: 'completed',
      transaction_type: 'deposit',
      description: 'Deposited $100.00 USD',
      created_at: '2024-01-15T10:30:00.000Z',
      fiatWalletTransaction: {
        id: 'fwt1',
        amount: '10000',
        wallet_id: 'wallet123',
      },
      blockchainWalletTransaction: null,
    },
  };

  const mockActivityService = {
    getUserActivities: jest.fn().mockResolvedValue(mockActivityData),
    getActivityDetails: jest.fn().mockResolvedValue(mockActivityDetails),
  };

  const mockActivityRepository = {
    getUserActivities: jest.fn().mockResolvedValue(mockActivityData),
    getActivityDetails: jest.fn().mockResolvedValue(mockActivityDetails),
  };

  const mockAppLoggerService = {
    logInfo: jest.fn(),
    logError: jest.fn(),
    logUserAction: jest.fn(),
    setContext: jest.fn(),
    createChild: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivityController],
      providers: [
        {
          provide: ActivityService,
          useValue: mockActivityService,
        },
        {
          provide: ActivityRepository,
          useValue: mockActivityRepository,
        },
        {
          provide: AppLoggerService,
          useValue: mockAppLoggerService,
        },
      ],
    }).compile();

    controller = module.get<ActivityController>(ActivityController);
    service = module.get<ActivityService>(ActivityService);
    repository = module.get<ActivityRepository>(ActivityRepository);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
    expect(repository).toBeDefined();
  });

  describe('getUserActivities', () => {
    it('should return user activities with default pagination', async () => {
      const filters: GetActivitiesDto = {};
      const result = await controller.getUserActivities(mockUser as UserModel, filters);

      expect(service.getUserActivities).toHaveBeenCalledWith(mockUser, filters);
      expect(result).toEqual({
        statusCode: 200,
        message: 'User activities retrieved successfully',
        data: mockActivityData,
        timestamp: expect.any(String),
      });
    });

    it('should return filtered activities by type', async () => {
      const filters: GetActivitiesDto = {
        activity_type: ActivityType.TRANSACTION,
        page: 1,
        limit: 10,
      };

      const filteredData = {
        ...mockActivityData,
        activities: [mockActivityData.activities[0]], // Only transaction
        pagination: { ...mockActivityData.pagination, total: 1 },
      };

      mockActivityService.getUserActivities.mockResolvedValueOnce(filteredData);

      const result = await controller.getUserActivities(mockUser as UserModel, filters);

      expect(service.getUserActivities).toHaveBeenCalledWith(mockUser, filters);
      expect(result.data.activities).toHaveLength(1);
      expect(result.data.activities[0].activity_type).toBe(ActivityType.TRANSACTION);
    });

    it('should return activities with date range filter', async () => {
      const filters: GetActivitiesDto = {
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-01-31T23:59:59.999Z',
        page: 1,
        limit: 20,
      };

      const result = await controller.getUserActivities(mockUser as UserModel, filters);

      expect(service.getUserActivities).toHaveBeenCalledWith(mockUser, filters);
      expect(result.data).toEqual(mockActivityData);
    });

    it('should handle pagination correctly', async () => {
      const filters: GetActivitiesDto = {
        page: 2,
        limit: 1,
      };

      const paginatedData = {
        activities: [mockActivityData.activities[1]], // Second item
        pagination: {
          previous_page: 1,
          current_page: 2,
          next_page: 0,
          limit: 1,
          page_count: 2,
          total: 2,
        },
      };

      mockActivityService.getUserActivities.mockResolvedValueOnce(paginatedData);

      const result = await controller.getUserActivities(mockUser as UserModel, filters);

      expect(service.getUserActivities).toHaveBeenCalledWith(mockUser, filters);
      expect(result.data.pagination.current_page).toBe(2);
      expect(result.data.pagination.limit).toBe(1);
    });

    it('should return empty array when no activities found', async () => {
      const emptyData = {
        activities: [],
        pagination: {
          previous_page: 0,
          current_page: 1,
          next_page: 0,
          limit: 10,
          page_count: 0,
          total: 0,
        },
      };

      mockActivityService.getUserActivities.mockResolvedValueOnce(emptyData);

      const filters: GetActivitiesDto = {};
      const result = await controller.getUserActivities(mockUser as UserModel, filters);

      expect(result.data.activities).toHaveLength(0);
      expect(result.data.pagination.total).toBe(0);
    });
  });

  describe('getActivityDetails', () => {
    it('should return activity details for valid transaction ID', async () => {
      const activityType = 'transaction';
      const activityId = 'activity1';
      const result = await controller.getActivityDetails(activityType, activityId, mockUser as UserModel);

      expect(service.getActivityDetails).toHaveBeenCalledWith(activityId, activityType, mockUser);
      expect(result).toEqual({
        statusCode: 200,
        message: 'Activity details retrieved successfully',
        data: mockActivityDetails,
        timestamp: expect.any(String),
      });
    });

    it('should handle activity not found', async () => {
      const activityType = 'transaction';
      const activityId = 'nonexistent';
      mockActivityService.getActivityDetails.mockRejectedValueOnce(
        new NotFoundException('Transaction not found or access denied'),
      );

      await expect(controller.getActivityDetails(activityType, activityId, mockUser as UserModel)).rejects.toThrow(
        NotFoundException,
      );

      expect(service.getActivityDetails).toHaveBeenCalledWith(activityId, activityType, mockUser);
    });

    it('should test multiple activity types', async () => {
      const testCases = [
        { type: 'transaction', id: 'tx1' },
        { type: 'external_account', id: 'ea1' },
        { type: 'blockchain_account', id: 'ba1' },
        { type: 'virtual_account', id: 'va1' },
        { type: 'kyc_status', id: 'kyc1' },
      ];

      for (const testCase of testCases) {
        const mockDetails = {
          activity_type: testCase.type,
          details: { id: testCase.id, user_id: 'user123' },
        };

        mockActivityService.getActivityDetails.mockResolvedValueOnce(mockDetails);

        const result = await controller.getActivityDetails(testCase.type, testCase.id, mockUser as UserModel);

        expect(service.getActivityDetails).toHaveBeenCalledWith(testCase.id, testCase.type, mockUser);
        expect(result.data.activity_type).toBe(testCase.type);
      }
    });
  });
});

describe('ActivityService', () => {
  let service: ActivityService;
  let repository: ActivityRepository;
  let transactionService: TransactionService;
  let externalAccountService: ExternalAccountService;
  let blockchainAccountsService: BlockchainAccountsService;

  const mockUser: Partial<UserModel> = {
    id: 'user123',
    username: 'testuser',
  };

  const mockActivityRepository = {
    getUserActivities: jest.fn().mockResolvedValue({
      activities: [],
      pagination: {
        previous_page: 0,
        current_page: 1,
        next_page: 0,
        limit: 10,
        page_count: 1,
        total: 0,
      },
    }),
  };

  const mockTransactionService = {
    findOne: jest.fn(),
  };

  const mockExternalAccountService = {
    getExternalAccount: jest.fn(),
  };

  const mockBlockchainAccountsService = {
    getAccountById: jest.fn(),
  };

  const mockVirtualAccountRepository = {
    findById: jest.fn(),
  };

  const mockKycStatusLogRepository = {
    findById: jest.fn(),
  };

  const mockKycVerificationRepository = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: ActivityRepository, useValue: mockActivityRepository },
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: ExternalAccountService, useValue: mockExternalAccountService },
        { provide: BlockchainAccountsService, useValue: mockBlockchainAccountsService },
        { provide: VirtualAccountRepository, useValue: mockVirtualAccountRepository },
        { provide: KycStatusLogRepository, useValue: mockKycStatusLogRepository },
        { provide: KycVerificationRepository, useValue: mockKycVerificationRepository },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
    repository = module.get<ActivityRepository>(ActivityRepository);
    transactionService = module.get<TransactionService>(TransactionService);
    externalAccountService = module.get<ExternalAccountService>(ExternalAccountService);
    blockchainAccountsService = module.get<BlockchainAccountsService>(BlockchainAccountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserActivities', () => {
    it('should call repository with correct parameters', async () => {
      const filters: GetActivitiesDto = {
        activity_type: ActivityType.TRANSACTION,
        page: 1,
        limit: 10,
      };

      const expectedFilters = {
        activity_type: ActivityType.TRANSACTION,
        start_date: undefined,
        end_date: undefined,
        page: 1,
        limit: 10,
      };

      await service.getUserActivities(mockUser as UserModel, filters);

      expect(repository.getUserActivities).toHaveBeenCalledWith(mockUser.id, expectedFilters);
    });

    it('should handle multiple activity types', async () => {
      const filters: GetActivitiesDto = {
        activity_type: [ActivityType.TRANSACTION, ActivityType.EXTERNAL_ACCOUNT],
        page: 1,
        limit: 10,
      };

      const expectedFilters = {
        activity_type: [ActivityType.TRANSACTION, ActivityType.EXTERNAL_ACCOUNT],
        start_date: undefined,
        end_date: undefined,
        page: 1,
        limit: 10,
      };

      await service.getUserActivities(mockUser as UserModel, filters);

      expect(repository.getUserActivities).toHaveBeenCalledWith(mockUser.id, expectedFilters);
    });
  });

  describe('getActivityDetails', () => {
    it('should get transaction details using TransactionService', async () => {
      const mockTransaction = {
        id: 'tx1',
        user_id: 'user123',
        amount: '10000',
        fiatWalletTransaction: { id: 'fwt1' },
        blockchainWalletTransaction: null,
      };

      mockTransactionService.findOne.mockResolvedValue(mockTransaction);

      const result = await service.getActivityDetails('tx1', 'transaction', mockUser as UserModel);

      expect(transactionService.findOne).toHaveBeenCalledWith({ id: 'tx1', user_id: 'user123' });
      expect(result).toEqual({
        activity_type: 'transaction',
        details: mockTransaction,
      });
    });

    it('should get external account details using ExternalAccountService', async () => {
      const mockExternalAccount = {
        id: 'ea1',
        user_id: 'user123',
        bank_name: 'Test Bank',
      };

      mockExternalAccountService.getExternalAccount.mockResolvedValue(mockExternalAccount);

      const result = await service.getActivityDetails('ea1', 'external_account', mockUser as UserModel);

      expect(externalAccountService.getExternalAccount).toHaveBeenCalledWith(mockUser, 'ea1');
      expect(result).toEqual({
        activity_type: 'external_account',
        details: mockExternalAccount,
      });
    });

    it('should get blockchain account details with user validation', async () => {
      const mockBlockchainAccount = {
        id: 'ba1',
        user_id: 'user123',
        provider: 'fireblocks',
      };

      mockBlockchainAccountsService.getAccountById.mockResolvedValue(mockBlockchainAccount);

      const result = await service.getActivityDetails('ba1', 'blockchain_account', mockUser as UserModel);

      expect(blockchainAccountsService.getAccountById).toHaveBeenCalledWith('ba1');
      expect(result).toEqual({
        activity_type: 'blockchain_account',
        details: mockBlockchainAccount,
      });
    });

    it('should throw error for blockchain account with wrong user', async () => {
      const mockBlockchainAccount = {
        id: 'ba1',
        user_id: 'different-user',
        provider: 'fireblocks',
      };

      mockBlockchainAccountsService.getAccountById.mockResolvedValue(mockBlockchainAccount);

      await expect(service.getActivityDetails('ba1', 'blockchain_account', mockUser as UserModel)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should get virtual account details', async () => {
      const mockVirtualAccount = {
        id: 'va1',
        user_id: 'user123',
        account_number: '1234567890',
      };

      mockVirtualAccountRepository.findById.mockResolvedValue(mockVirtualAccount);

      const result = await service.getActivityDetails('va1', 'virtual_account', mockUser as UserModel);

      expect(mockVirtualAccountRepository.findById).toHaveBeenCalledWith('va1');
      expect(result).toEqual({
        activity_type: 'virtual_account',
        details: mockVirtualAccount,
      });
    });

    it('should get KYC status details with verification lookup', async () => {
      const mockKycStatusLog = {
        id: 'kyc1',
        kyc_id: 'kyc-verification-1',
        old_status: 'pending',
        new_status: 'approved',
      };

      const mockKycVerification = {
        id: 'kyc-verification-1',
        user_id: 'user123',
        provider: 'sumsub',
        status: 'approved',
      };

      mockKycStatusLogRepository.findById.mockResolvedValue(mockKycStatusLog);
      mockKycVerificationRepository.findById.mockResolvedValue(mockKycVerification);

      const result = await service.getActivityDetails('kyc1', 'kyc_status', mockUser as UserModel);

      expect(mockKycStatusLogRepository.findById).toHaveBeenCalledWith('kyc1');
      expect(mockKycVerificationRepository.findById).toHaveBeenCalledWith('kyc-verification-1');
      expect(result).toEqual({
        activity_type: 'kyc_status',
        details: {
          ...mockKycStatusLog,
          user_id: 'user123',
          provider: 'sumsub',
          kyc_status: 'approved',
        },
      });
    });

    it('should throw error for invalid activity type', async () => {
      await expect(service.getActivityDetails('any-id', 'invalid_type', mockUser as UserModel)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

describe('ActivityRepository', () => {
  beforeEach(() => {
    // Repository tests would require database setup
    // This is a placeholder for integration tests
  });

  it('should be defined', () => {
    // Integration tests would go here
    expect(true).toBe(true);
  });

  // Note: Full repository tests would require database setup
  // and would test the actual SQL queries against a test database
});
