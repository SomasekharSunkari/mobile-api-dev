import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { KYCAdapter } from '../../../../adapters/kyc/kyc-adapter';
import { UserRepository } from '../../../../modules/auth/user/user.repository';
import { FiatWalletService } from '../../../../modules/fiatWallet';
import { UserTierRepository } from '../../../../modules/userTier/userTier.repository';
import { VirtualAccountService } from '../../../../modules/virtualAccount/virtualAccount.service';
import { QueueService } from '../../queue.service';
import { NgnAccountRetryJobData, NgnAccountRetryProcessor, NgnAccountScanJobData } from './ngn-account-retry.processor';

describe('NgnAccountRetryProcessor', () => {
  let processor: NgnAccountRetryProcessor;
  let mockVirtualAccountService: jest.Mocked<VirtualAccountService>;
  let mockFiatWalletService: jest.Mocked<FiatWalletService>;
  let mockKycAdapter: jest.Mocked<KYCAdapter>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockUserTierRepository: jest.Mocked<UserTierRepository>;
  let mockQueueService: jest.Mocked<QueueService>;
  let registeredRouterCallback: (job: Job) => Promise<any>;

  const mockUser = {
    id: 'user-123',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
  };

  const mockKycDetails = {
    userId: 'user-123',
    country: 'NGA',
    dob: '1990-01-01',
    idNumber: '12345678901',
  };

  const mockFiatWallet = {
    id: 'wallet-123',
    user_id: 'user-123',
    asset: 'NGN',
    balance: 0,
  };

  const mockVirtualAccount = {
    id: 'va-123',
    user_id: 'user-123',
    fiat_wallet_id: 'wallet-123',
    account_number: '1234567890',
    bank_name: 'Test Bank',
  };

  beforeEach(async () => {
    mockVirtualAccountService = {
      findOrCreateVirtualAccount: jest.fn(),
    } as any;

    mockFiatWalletService = {
      getUserWallet: jest.fn(),
    } as any;

    mockKycAdapter = {
      getKycDetailsByUserId: jest.fn(),
    } as any;

    mockUserRepository = {
      findById: jest.fn(),
      transaction: jest.fn(),
    } as any;

    mockUserTierRepository = {
      query: jest.fn(),
      model: {
        knex: jest.fn().mockReturnValue({
          raw: jest.fn(),
        }),
      },
    } as any;

    // Capture the router callback when processJobsWithRouter is called
    mockQueueService = {
      addJob: jest.fn(),
      addBulkJobs: jest.fn(),
      processJobsWithRouter: jest.fn().mockImplementation((_queueName, callback) => {
        registeredRouterCallback = callback;
        return {};
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NgnAccountRetryProcessor,
        { provide: VirtualAccountService, useValue: mockVirtualAccountService },
        { provide: FiatWalletService, useValue: mockFiatWalletService },
        { provide: KYCAdapter, useValue: mockKycAdapter },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: UserTierRepository, useValue: mockUserTierRepository },
        { provide: QueueService, useValue: mockQueueService },
      ],
    }).compile();

    processor = module.get<NgnAccountRetryProcessor>(NgnAccountRetryProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queueScanJob', () => {
    it('should register processors and add scan job to queue', async () => {
      const mockJob = { id: 'job-123', name: 'scan-users', data: { offset: 0 } };
      mockQueueService.addJob.mockResolvedValue(mockJob as any);

      const result = await processor.queueScanJob();

      expect(mockQueueService.processJobsWithRouter).toHaveBeenCalledTimes(1);
      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'ngn-account-retry-processor',
        'scan-users',
        { offset: 0 },
        expect.objectContaining({
          attempts: 3,
          backoff: expect.objectContaining({
            type: 'exponential',
            delay: 5000,
          }),
        }),
      );
      expect(result).toEqual(mockJob);
    });

    it('should only register processors once', async () => {
      mockQueueService.addJob.mockResolvedValue({ id: 'job-123' } as any);

      await processor.queueScanJob();
      await processor.queueScanJob();

      expect(mockQueueService.processJobsWithRouter).toHaveBeenCalledTimes(1);
    });
  });

  describe('router callback', () => {
    beforeEach(async () => {
      mockQueueService.addJob.mockResolvedValue({ id: 'job-123' } as any);
      await processor.queueScanJob();
    });

    it('should route scan-users job to processScanJob', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      mockUserTierRepository.query.mockReturnValue(mockQueryBuilder as any);

      const mockJob = { name: 'scan-users', data: { offset: 0 } } as Job<NgnAccountScanJobData>;
      const result = await registeredRouterCallback(mockJob);

      expect(result).toEqual({
        processedChunk: 0,
        queuedUsers: 0,
        hasMore: false,
      });
    });

    it('should route process-user job to processNgnAccountCreation', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser as any);
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue({ data: mockKycDetails } as any);
      mockUserRepository.transaction.mockImplementation(async (callbackOrTrx: any) => {
        if (typeof callbackOrTrx === 'function') {
          return callbackOrTrx({} as any);
        }
        return {} as any;
      });
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount as any);

      const mockJob = { name: 'process-user', data: { userId: 'user-123' } } as Job<NgnAccountRetryJobData>;
      const result = await registeredRouterCallback(mockJob);

      expect(result).toEqual({ success: true, userId: 'user-123' });
    });

    it('should return null for unknown job names', async () => {
      const mockJob = { name: 'unknown-job', data: {} } as Job;
      const result = await registeredRouterCallback(mockJob);

      expect(result).toBeNull();
    });
  });

  describe('processNgnAccountCreation (via private method testing)', () => {
    it('should create NGN account for user with KYC details', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser as any);
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue({ data: mockKycDetails } as any);
      mockUserRepository.transaction.mockImplementation(async (callbackOrTrx: any) => {
        if (typeof callbackOrTrx === 'function') {
          return callbackOrTrx({} as any);
        }
        return {} as any;
      });
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount as any);

      const processMethod = (processor as any).processNgnAccountCreation.bind(processor);
      const mockJob = {
        data: { userId: 'user-123' },
      } as Job<NgnAccountRetryJobData>;

      const result = await processMethod(mockJob);

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(mockKycAdapter.getKycDetailsByUserId).toHaveBeenCalledWith('user-123');
      expect(result).toEqual({ success: true, userId: 'user-123' });
    });

    it('should create NGN account for non-NG user without BVN', async () => {
      const nonNgKycDetails = {
        userId: 'user-123',
        country: 'USA',
        dob: '1990-01-01',
        idNumber: null,
      };
      mockUserRepository.findById.mockResolvedValue(mockUser as any);
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue({ data: nonNgKycDetails } as any);
      mockUserRepository.transaction.mockImplementation(async (callbackOrTrx: any) => {
        if (typeof callbackOrTrx === 'function') {
          return callbackOrTrx({} as any);
        }
        return {} as any;
      });
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount as any);

      const processMethod = (processor as any).processNgnAccountCreation.bind(processor);
      const mockJob = {
        data: { userId: 'user-123' },
      } as Job<NgnAccountRetryJobData>;

      const result = await processMethod(mockJob);

      expect(result).toEqual({ success: true, userId: 'user-123' });
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const processMethod = (processor as any).processNgnAccountCreation.bind(processor);
      const mockJob = {
        data: { userId: 'non-existent' },
      } as Job<NgnAccountRetryJobData>;

      await expect(processMethod(mockJob)).rejects.toThrow('User non-existent not found');
    });

    it('should throw error when KYC details not found', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser as any);
      mockKycAdapter.getKycDetailsByUserId.mockResolvedValue({ data: null } as any);

      const processMethod = (processor as any).processNgnAccountCreation.bind(processor);
      const mockJob = {
        data: { userId: 'user-123' },
      } as Job<NgnAccountRetryJobData>;

      await expect(processMethod(mockJob)).rejects.toThrow('KYC details not found for user user-123');
    });
  });

  describe('handleCreateNGNBankAccount (via private method testing)', () => {
    it('should throw error when fiat wallet creation fails', async () => {
      mockUserRepository.transaction.mockImplementation(async (callbackOrTrx: any) => {
        if (typeof callbackOrTrx === 'function') {
          return callbackOrTrx({} as any);
        }
        return {} as any;
      });
      mockFiatWalletService.getUserWallet.mockResolvedValue(null);

      const handleMethod = (processor as any).handleCreateNGNBankAccount.bind(processor);

      await expect(handleMethod(mockKycDetails, mockUser)).rejects.toThrow(
        'Failed to create/get NGN fiat wallet for user user-123',
      );
    });
  });

  describe('createNGVirtualAccount (via private method testing)', () => {
    it('should throw error when fiat wallet is null', async () => {
      const createMethod = (processor as any).createNGVirtualAccount.bind(processor);

      await expect(createMethod(mockUser, { fiatWallet: null, dob: '1990-01-01' })).rejects.toThrow(
        'Fiat wallet is required for virtual account creation',
      );
    });

    it('should throw wrapped error when virtual account creation fails', async () => {
      mockUserRepository.transaction.mockImplementation(async (callbackOrTrx: any) => {
        if (typeof callbackOrTrx === 'function') {
          return callbackOrTrx({} as any);
        }
        return {} as any;
      });
      mockVirtualAccountService.findOrCreateVirtualAccount.mockRejectedValue(new Error('Provider error'));

      const createMethod = (processor as any).createNGVirtualAccount.bind(processor);

      await expect(createMethod(mockUser, { fiatWallet: mockFiatWallet, dob: '1990-01-01' })).rejects.toThrow(
        'Error creating virtual account: Provider error',
      );
    });

    it('should include BVN in payload when provided', async () => {
      mockUserRepository.transaction.mockImplementation(async (callbackOrTrx: any) => {
        if (typeof callbackOrTrx === 'function') {
          return callbackOrTrx({} as any);
        }
        return {} as any;
      });
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount as any);

      const createMethod = (processor as any).createNGVirtualAccount.bind(processor);
      await createMethod(mockUser, { fiatWallet: mockFiatWallet, dob: '1990-01-01', bvn: '12345678901' });

      expect(mockVirtualAccountService.findOrCreateVirtualAccount).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          fiat_wallet_id: 'wallet-123',
          bvn: '12345678901',
        }),
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  describe('processScanJob (via private method testing)', () => {
    it('should return no users when none found', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      mockUserTierRepository.query.mockReturnValue(mockQueryBuilder as any);

      const processMethod = (processor as any).processScanJob.bind(processor);
      const mockJob = {
        data: { offset: 0 },
      } as Job<NgnAccountScanJobData>;

      const result = await processMethod(mockJob);

      expect(result).toEqual({
        processedChunk: 0,
        queuedUsers: 0,
        hasMore: false,
      });
    });

    it('should queue users for processing when found', async () => {
      const mockUsers = [{ id: 'user-1' }, { id: 'user-2' }];
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockUsers),
      };
      mockUserTierRepository.query.mockReturnValue(mockQueryBuilder as any);
      mockQueueService.addBulkJobs.mockResolvedValue([]);

      const processMethod = (processor as any).processScanJob.bind(processor);
      const mockJob = {
        data: { offset: 0 },
      } as Job<NgnAccountScanJobData>;

      const result = await processMethod(mockJob);

      expect(mockQueueService.addBulkJobs).toHaveBeenCalledWith(
        'ngn-account-retry-processor',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'process-user',
            data: { userId: 'user-1' },
          }),
          expect.objectContaining({
            name: 'process-user',
            data: { userId: 'user-2' },
          }),
        ]),
      );
      expect(result).toEqual({
        processedChunk: 0,
        queuedUsers: 2,
        hasMore: false,
      });
    });

    it('should queue next scan job when chunk is full', async () => {
      // Create 500 mock users (CHUNK_SIZE)
      const mockUsers = Array.from({ length: 500 }, (_, i) => ({ id: `user-${i}` }));
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockUsers),
      };
      mockUserTierRepository.query.mockReturnValue(mockQueryBuilder as any);
      mockQueueService.addBulkJobs.mockResolvedValue([]);
      mockQueueService.addJob.mockResolvedValue({} as any);

      const processMethod = (processor as any).processScanJob.bind(processor);
      const mockJob = {
        data: { offset: 0 },
      } as Job<NgnAccountScanJobData>;

      const result = await processMethod(mockJob);

      // Should queue next scan job with offset 500
      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'ngn-account-retry-processor',
        'scan-users',
        { offset: 500 },
        expect.objectContaining({
          delay: 1000,
          attempts: 3,
        }),
      );
      expect(result).toEqual({
        processedChunk: 0,
        queuedUsers: 500,
        hasMore: true,
      });
    });
  });
});
