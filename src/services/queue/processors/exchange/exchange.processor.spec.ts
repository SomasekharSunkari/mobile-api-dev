jest.mock('../../../../config/environment/environment.service', () => ({
  EnvironmentService: {
    getValue: jest.fn(),
    getValues: jest.fn(() => ({
      db_host: 'localhost',
      db_password: 'test',
      db_user: 'test',
      db_name: 'test',
      db_port: 5432,
      db_ssl: false,
    })),
    isProduction: jest.fn(() => false),
  },
}));

jest.mock('../../../../database/database.connection', () => ({
  KnexDB: {
    connection: jest.fn(() => ({
      raw: jest.fn(),
      destroy: jest.fn(),
    })),
  },
}));

import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { ExchangeAdapter } from '../../../../adapters/exchange/exchange.adapter';
import { FiatWalletAdapter } from '../../../../adapters/fiat-wallet/fiat-wallet.adapter';
import { KYCAdapter } from '../../../../adapters/kyc/kyc-adapter';
import { IdentityDocType } from '../../../../adapters/kyc/kyc-adapter.interface';
import { EnvironmentService } from '../../../../config/environment/environment.service';
import { FiatWalletConfigProvider } from '../../../../config/fiat-wallet.config';
import { TransactionStatus } from '../../../../database/models/transaction';
import { UserRepository } from '../../../../modules/auth/user/user.repository';
import { FiatWalletTransactionRepository } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.repository';
import { RateService } from '../../../../modules/rate/rate.service';
import { TransactionRepository } from '../../../../modules/transaction';
import { EventEmitterService } from '../../../eventEmitter/eventEmitter.service';
import { QueueService } from '../../queue.service';
import { VirtualAccountRepository } from '../../../../modules/virtualAccount/virtualAccount.repository';
import { ExchangeJobData, ExchangeProcessor } from './exchange.processor';

describe('ExchangeProcessor', () => {
  let exchangeProcessor: ExchangeProcessor;
  let queueService: jest.Mocked<QueueService>;
  let fiatWalletAdapter: jest.Mocked<FiatWalletAdapter>;
  let exchangeAdapter: jest.Mocked<ExchangeAdapter>;
  let transactionRepository: jest.Mocked<TransactionRepository>;
  let fiatWalletTransactionRepository: jest.Mocked<FiatWalletTransactionRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let kycAdapter: jest.Mocked<KYCAdapter>;
  let rateService: jest.Mocked<RateService>;

  const mockJob: Partial<Job<ExchangeJobData>> = {
    id: 'test-job-id',
    data: {
      userId: 'user-123',
      participantCode: 'participant-code-123',
      sourceTransaction: {
        id: 'txn-123',
        reference: 'ref-123',
        metadata: {},
      } as any,
      amount: 100,
      destinationCountryCode: 'NG',
      virtualAccount: {
        id: 'va-123',
        account_number: '1234567890',
        account_name: 'Test Account',
      } as any,
      sourceFiatWalletTransaction: {
        id: 'fwt-123',
      } as any,
      rateId: 'rate-123',
    },
    updateProgress: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    phone_number: '+2348012345678',
    country: {
      code: 'NG',
      name: 'Nigeria',
    },
    userProfile: {
      address_line1: '123 Test Street',
      dob: '1990-01-01',
    },
  };

  const mockKycDetails = {
    data: {
      idDocument: {
        type: 'drivers_license',
        number: 'DL123456',
      },
      idNumber: 'BVN123456',
    },
  };

  const mockChannels = [
    {
      ref: 'channel-123',
      status: 'active',
      rampType: 'withdraw',
      countryCode: 'NG',
    },
  ];

  const mockBanks = [
    {
      ref: '3d4d08c1-4811-4fee-9349-a302328e55c1',
      status: 'active',
      channelRefs: ['channel-123'],
      name: 'Stanbic',
      code: '221',
    },
  ];

  const mockPayOutResponse = {
    ref: 'payout-123',
    sequenceRef: 'seq-123',
    cryptoInfo: {
      walletAddress: 'test-wallet-address-123',
    },
  };

  const mockWithdrawalRequest = {
    providerRef: 'withdrawal-req-123',
    clientWithdrawalRequestRef: 'ref-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeProcessor,
        {
          provide: QueueService,
          useValue: {
            processJobs: jest.fn(),
            addJob: jest.fn(),
          },
        },
        {
          provide: FiatWalletAdapter,
          useValue: {
            createWithdrawalRequest: jest.fn(),
          },
        },
        {
          provide: ExchangeAdapter,
          useValue: {
            getChannels: jest.fn(),
            getBanks: jest.fn(),
            createPayOutRequest: jest.fn(),
          },
        },
        {
          provide: TransactionRepository,
          useValue: {
            update: jest.fn(),
          },
        },
        {
          provide: FiatWalletTransactionRepository,
          useValue: {
            update: jest.fn(),
          },
        },
        {
          provide: UserRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: KYCAdapter,
          useValue: {
            getKycDetailsByUserId: jest.fn(),
          },
        },
        {
          provide: FiatWalletConfigProvider,
          useValue: {
            getConfig: jest.fn().mockReturnValue({
              default_usd_fiat_wallet_provider: 'zerohash',
              default_underlying_currency: 'USDC.ETH',
            }),
          },
        },
        {
          provide: EventEmitterService,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: VirtualAccountRepository,
          useValue: {
            update: jest.fn(),
          },
        },
        {
          provide: RateService,
          useValue: {
            validateRateOrThrow: jest.fn(),
          },
        },
      ],
    }).compile();

    exchangeProcessor = module.get<ExchangeProcessor>(ExchangeProcessor);
    queueService = module.get(QueueService) as jest.Mocked<QueueService>;
    fiatWalletAdapter = module.get(FiatWalletAdapter) as jest.Mocked<FiatWalletAdapter>;
    exchangeAdapter = module.get(ExchangeAdapter) as jest.Mocked<ExchangeAdapter>;
    transactionRepository = module.get(TransactionRepository) as jest.Mocked<TransactionRepository>;
    fiatWalletTransactionRepository = module.get(
      FiatWalletTransactionRepository,
    ) as jest.Mocked<FiatWalletTransactionRepository>;
    userRepository = module.get(UserRepository) as jest.Mocked<UserRepository>;
    kycAdapter = module.get(KYCAdapter) as jest.Mocked<KYCAdapter>;
    rateService = module.get(RateService) as jest.Mocked<RateService>;

    await exchangeProcessor.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset isProduction to default false value to prevent test pollution
    (EnvironmentService.isProduction as jest.Mock).mockReturnValue(false);
  });

  describe('onModuleInit', () => {
    it('should initialize with default fiat wallet provider and currency', async () => {
      expect(exchangeProcessor['defaultFiatWalletProvider']).toBe('zerohash');
      expect(exchangeProcessor['defaultUnderlyingCurrency']).toBe('USDC.ETH');
    });

    it('should throw error if default fiat wallet provider is not configured', async () => {
      const mockConfigProvider = {
        getConfig: jest.fn().mockReturnValue({
          default_usd_fiat_wallet_provider: null,
          default_underlying_currency: 'USDC.ETH',
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          ExchangeProcessor,
          { provide: QueueService, useValue: { processJobs: jest.fn(), addJob: jest.fn() } },
          { provide: FiatWalletAdapter, useValue: {} },
          { provide: ExchangeAdapter, useValue: {} },
          { provide: TransactionRepository, useValue: {} },
          { provide: FiatWalletTransactionRepository, useValue: {} },
          { provide: UserRepository, useValue: {} },
          { provide: KYCAdapter, useValue: {} },
          { provide: FiatWalletConfigProvider, useValue: mockConfigProvider },
          { provide: EventEmitterService, useValue: { emit: jest.fn() } },
          { provide: VirtualAccountRepository, useValue: { update: jest.fn() } },
          { provide: RateService, useValue: { validateRateOrThrow: jest.fn() } },
        ],
      }).compile();

      const processor = module.get<ExchangeProcessor>(ExchangeProcessor);

      await expect(processor.onModuleInit()).rejects.toThrow(InternalServerErrorException);
      await expect(processor.onModuleInit()).rejects.toThrow('Default fiat wallet provider not configured');
    });

    it('should throw error if default underlying currency is not configured', async () => {
      const mockConfigProvider = {
        getConfig: jest.fn().mockReturnValue({
          default_usd_fiat_wallet_provider: 'zerohash',
          default_underlying_currency: null,
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          ExchangeProcessor,
          { provide: QueueService, useValue: { processJobs: jest.fn(), addJob: jest.fn() } },
          { provide: FiatWalletAdapter, useValue: {} },
          { provide: ExchangeAdapter, useValue: {} },
          { provide: TransactionRepository, useValue: {} },
          { provide: FiatWalletTransactionRepository, useValue: {} },
          { provide: UserRepository, useValue: {} },
          { provide: KYCAdapter, useValue: {} },
          { provide: FiatWalletConfigProvider, useValue: mockConfigProvider },
          { provide: EventEmitterService, useValue: { emit: jest.fn() } },
          { provide: VirtualAccountRepository, useValue: { update: jest.fn() } },
          { provide: RateService, useValue: { validateRateOrThrow: jest.fn() } },
        ],
      }).compile();

      const processor = module.get<ExchangeProcessor>(ExchangeProcessor);

      await expect(processor.onModuleInit()).rejects.toThrow(InternalServerErrorException);
      await expect(processor.onModuleInit()).rejects.toThrow('Default underlying currency not configured');
    });
  });

  describe('validateExchangeJobData', () => {
    it('should throw error if job data is null', () => {
      expect(() => exchangeProcessor['validateExchangeJobData'](null as any)).toThrow(BadRequestException);
      expect(() => exchangeProcessor['validateExchangeJobData'](null as any)).toThrow('Exchange job data is required');
    });

    it('should throw error if userId is missing', () => {
      const invalidData = { ...mockJob.data, userId: null } as any;
      expect(() => exchangeProcessor['validateExchangeJobData'](invalidData)).toThrow('User ID is required');
    });

    it('should throw error if participantCode is missing', () => {
      const invalidData = { ...mockJob.data, participantCode: null } as any;
      expect(() => exchangeProcessor['validateExchangeJobData'](invalidData)).toThrow('Participant code is required');
    });

    it('should throw error if sourceTransaction is missing', () => {
      const invalidData = { ...mockJob.data, sourceTransaction: null } as any;
      expect(() => exchangeProcessor['validateExchangeJobData'](invalidData)).toThrow('Source transaction is required');
    });

    it('should throw error if sourceTransaction id is missing', () => {
      const invalidData = { ...mockJob.data, sourceTransaction: { reference: 'ref-123', metadata: {} } } as any;
      expect(() => exchangeProcessor['validateExchangeJobData'](invalidData)).toThrow(
        'Source transaction ID is required',
      );
    });

    it('should throw error if sourceTransaction reference is missing', () => {
      const invalidData = { ...mockJob.data, sourceTransaction: { id: 'txn-123', metadata: {} } } as any;
      expect(() => exchangeProcessor['validateExchangeJobData'](invalidData)).toThrow(
        'Source transaction reference is required',
      );
    });

    it('should throw error if amount is zero', () => {
      const invalidData = { ...mockJob.data, amount: 0 };
      expect(() => exchangeProcessor['validateExchangeJobData'](invalidData)).toThrow(
        'Valid amount greater than 0 is required',
      );
    });

    it('should throw error if amount is negative', () => {
      const invalidData = { ...mockJob.data, amount: -100 };
      expect(() => exchangeProcessor['validateExchangeJobData'](invalidData)).toThrow(
        'Valid amount greater than 0 is required',
      );
    });

    it('should throw error if destinationCountryCode is missing', () => {
      const invalidData = { ...mockJob.data, destinationCountryCode: null } as any;
      expect(() => exchangeProcessor['validateExchangeJobData'](invalidData)).toThrow(
        'Destination country code is required',
      );
    });

    it('should throw error if virtualAccount is missing', () => {
      const invalidData = { ...mockJob.data, virtualAccount: null } as any;
      expect(() => exchangeProcessor['validateExchangeJobData'](invalidData)).toThrow('Virtual account is required');
    });

    it('should throw error if virtual account number is missing', () => {
      const invalidData = { ...mockJob.data, virtualAccount: { account_name: 'Test' } } as any;
      expect(() => exchangeProcessor['validateExchangeJobData'](invalidData)).toThrow(
        'Virtual account number is required',
      );
    });

    it('should pass validation with valid data', () => {
      expect(() => exchangeProcessor['validateExchangeJobData'](mockJob.data)).not.toThrow();
    });
  });

  describe('registerProcessors', () => {
    it('should register processors on first call', async () => {
      queueService.addJob.mockResolvedValue({} as any);

      await exchangeProcessor.queueExchange(mockJob.data);

      expect(queueService.processJobs).toHaveBeenCalledWith('exchange', 'exchange', expect.any(Function), 2);
    });

    it('should not register processors multiple times', async () => {
      queueService.addJob.mockResolvedValue({} as any);

      await exchangeProcessor.queueExchange(mockJob.data);
      await exchangeProcessor.queueExchange(mockJob.data);

      expect(queueService.processJobs).toHaveBeenCalledTimes(1);
    });
  });

  describe('queueExchange', () => {
    it('should queue exchange job with correct parameters', async () => {
      const jobData: ExchangeJobData = mockJob.data;

      queueService.addJob.mockResolvedValue({} as any);

      await exchangeProcessor.queueExchange(jobData);

      expect(queueService.addJob).toHaveBeenCalledWith('exchange', 'exchange', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });
    });

    it('should register processors before queueing', async () => {
      queueService.addJob.mockResolvedValue({} as any);

      await exchangeProcessor.queueExchange(mockJob.data);

      expect(queueService.processJobs).toHaveBeenCalled();
      expect(queueService.addJob).toHaveBeenCalled();
    });

    it('should return the queued job', async () => {
      const mockQueuedJob = { id: 'job-123', data: mockJob.data } as any;
      queueService.addJob.mockResolvedValue(mockQueuedJob);

      const result = await exchangeProcessor.queueExchange(mockJob.data);

      expect(result).toEqual(mockQueuedJob);
    });

    it('should configure retry with exponential backoff', async () => {
      queueService.addJob.mockResolvedValue({} as any);

      await exchangeProcessor.queueExchange(mockJob.data);

      expect(queueService.addJob).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          attempts: 3,
          backoff: expect.objectContaining({
            type: 'exponential',
            delay: 2000,
          }),
        }),
      );
    });
  });

  describe('processExchange', () => {
    beforeEach(() => {
      exchangeAdapter.getChannels.mockResolvedValue(mockChannels as any);
      exchangeAdapter.getBanks.mockResolvedValue(mockBanks as any);
      exchangeAdapter.createPayOutRequest.mockResolvedValue(mockPayOutResponse as any);
      fiatWalletAdapter.createWithdrawalRequest.mockResolvedValue(mockWithdrawalRequest as any);
      userRepository.findOne.mockResolvedValue(mockUser as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      transactionRepository.update.mockResolvedValue({} as any);
      fiatWalletTransactionRepository.update.mockResolvedValue({} as any);
      rateService.validateRateOrThrow.mockResolvedValue(undefined);
    });

    it('should successfully process exchange', async () => {
      await exchangeProcessor['processExchange']({ data: mockJob.data });

      expect(rateService.validateRateOrThrow).toHaveBeenCalledWith('rate-123', 100, 'buy');
      expect(exchangeAdapter.getChannels).toHaveBeenCalledWith({ countryCode: 'NG' });
      expect(exchangeAdapter.getBanks).toHaveBeenCalledWith({ countryCode: 'NG' });
      expect(exchangeAdapter.createPayOutRequest).toHaveBeenCalled();
      expect(fiatWalletAdapter.createWithdrawalRequest).toHaveBeenCalled();
      expect(transactionRepository.update).toHaveBeenCalledWith(
        'txn-123',
        expect.objectContaining({
          status: TransactionStatus.PROCESSING,
        }),
      );
    });

    it('should throw error if rate validation fails', async () => {
      rateService.validateRateOrThrow.mockRejectedValue(new BadRequestException('Rate expired'));

      await expect(exchangeProcessor['processExchange']({ data: mockJob.data })).rejects.toThrow('Rate expired');

      expect(transactionRepository.update).toHaveBeenCalledWith(
        'txn-123',
        expect.objectContaining({
          status: TransactionStatus.FAILED,
        }),
      );
    });

    it('should not throw and mark transaction as failed if no channels found (permanent failure)', async () => {
      exchangeAdapter.getChannels.mockResolvedValue([]);

      await expect(exchangeProcessor['processExchange']({ data: mockJob.data })).resolves.toBeUndefined();

      expect(transactionRepository.update).toHaveBeenCalledWith(
        'txn-123',
        expect.objectContaining({
          status: TransactionStatus.FAILED,
          failure_reason: 'No channels found for NG',
        }),
      );
    });

    it('should not throw and mark transaction as failed if no active withdrawal channel found (permanent failure)', async () => {
      const inactiveChannels = [{ ...mockChannels[0], status: 'inactive' }];
      exchangeAdapter.getChannels.mockResolvedValue(inactiveChannels as any);

      await expect(exchangeProcessor['processExchange']({ data: mockJob.data })).resolves.toBeUndefined();

      expect(transactionRepository.update).toHaveBeenCalledWith(
        'txn-123',
        expect.objectContaining({
          status: TransactionStatus.FAILED,
          failure_reason: 'No active withdrawal channel found for NG',
        }),
      );
    });

    it('should not throw and mark transaction as failed if no banks found (permanent failure)', async () => {
      exchangeAdapter.getBanks.mockResolvedValue([]);

      await expect(exchangeProcessor['processExchange']({ data: mockJob.data })).resolves.toBeUndefined();

      expect(transactionRepository.update).toHaveBeenCalledWith(
        'txn-123',
        expect.objectContaining({
          status: TransactionStatus.FAILED,
          failure_reason: 'No banks found for NG',
        }),
      );
    });

    it('should not throw and mark transaction as failed if Paga does not support the withdrawal channel (permanent failure)', async () => {
      const invalidBank = [{ ...mockBanks[0], channelRefs: ['different-channel'] }];
      exchangeAdapter.getBanks.mockResolvedValue(invalidBank as any);

      await expect(exchangeProcessor['processExchange']({ data: mockJob.data })).resolves.toBeUndefined();

      expect(transactionRepository.update).toHaveBeenCalledWith(
        'txn-123',
        expect.objectContaining({
          status: TransactionStatus.FAILED,
          failure_reason: 'Channel not found: Paga does not support the withdrawal channel',
        }),
      );
    });

    it('should throw error if YellowCard wallet address is missing', async () => {
      exchangeAdapter.createPayOutRequest.mockResolvedValue({ cryptoInfo: {} } as any);

      await expect(exchangeProcessor['processExchange']({ data: mockJob.data })).rejects.toThrow(
        'YellowCard wallet address not found in payout response',
      );
    });

    it('should update transaction status to FAILED on error', async () => {
      exchangeAdapter.getChannels.mockRejectedValue(new Error('API Error'));

      await expect(exchangeProcessor['processExchange']({ data: mockJob.data })).rejects.toThrow();

      expect(transactionRepository.update).toHaveBeenCalledWith(
        'txn-123',
        expect.objectContaining({
          status: TransactionStatus.FAILED,
        }),
      );
    });

    it('should update fiat wallet transaction status to FAILED on error', async () => {
      exchangeAdapter.getChannels.mockRejectedValue(new Error('API Error'));

      await expect(exchangeProcessor['processExchange']({ data: mockJob.data })).rejects.toThrow();

      expect(fiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-123',
        expect.objectContaining({
          status: TransactionStatus.FAILED,
        }),
      );
    });
  });

  describe('parseExchangeError', () => {
    it('should parse error with response data errors array', () => {
      const error = {
        response: {
          data: {
            errors: ['Insufficient balance'],
          },
        },
      };

      const result = exchangeProcessor['parseExchangeError'](error);

      expect(result.failureReason).toContain('Insufficient balance');
      expect(result.userFriendlyMessage).toContain('Insufficient balance');
    });

    it('should parse error with message', () => {
      const error = {
        message: 'API timeout',
      };

      const result = exchangeProcessor['parseExchangeError'](error);

      expect(result.failureReason).toBe('API timeout');
      expect(result.userFriendlyMessage).toBe('API timeout');
    });

    it('should return default message for unknown error', () => {
      const error = {};

      const result = exchangeProcessor['parseExchangeError'](error);

      expect(result.failureReason).toBe('Withdrawal request failed');
      expect(result.userFriendlyMessage).toBe('Exchange failed to initiate');
    });

    it('should handle insufficient balance error specifically', () => {
      const error = {
        message: 'Insufficient balance for withdrawal',
      };

      const result = exchangeProcessor['parseExchangeError'](error);

      expect(result.failureReason).toContain('Insufficient balance');
      expect(result.userFriendlyMessage).toContain('Insufficient balance');
    });
  });

  describe('isPermanentFailure', () => {
    it('should return true for Paga bank not found error', () => {
      expect(exchangeProcessor['isPermanentFailure']('Paga bank not found or inactive')).toBe(true);
    });

    it('should return true for Paga does not support error', () => {
      expect(exchangeProcessor['isPermanentFailure']('Paga does not support the withdrawal channel')).toBe(true);
    });

    it('should return true for no channels found error', () => {
      expect(exchangeProcessor['isPermanentFailure']('No channels found for NG')).toBe(true);
    });

    it('should return true for no active withdrawal channel error', () => {
      expect(exchangeProcessor['isPermanentFailure']('No active withdrawal channel found for NG')).toBe(true);
    });

    it('should return true for no banks found error', () => {
      expect(exchangeProcessor['isPermanentFailure']('No banks found for NG')).toBe(true);
    });

    it('should return true for channel not found error', () => {
      expect(exchangeProcessor['isPermanentFailure']('Channel not found: some reason')).toBe(true);
    });

    it('should return true for user not found error', () => {
      expect(exchangeProcessor['isPermanentFailure']('User not found')).toBe(true);
    });

    it('should return true for user KYC related errors', () => {
      expect(exchangeProcessor['isPermanentFailure']('User KYC details are required')).toBe(true);
    });

    it('should return true for BVN required error', () => {
      expect(exchangeProcessor['isPermanentFailure']('BVN information is required for Nigerian users')).toBe(true);
    });

    it('should return false for transient API errors', () => {
      expect(exchangeProcessor['isPermanentFailure']('API Error')).toBe(false);
    });

    it('should return false for network timeout errors', () => {
      expect(exchangeProcessor['isPermanentFailure']('Network timeout')).toBe(false);
    });

    it('should return false for generic withdrawal failed errors', () => {
      expect(exchangeProcessor['isPermanentFailure']('Withdrawal failed')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(exchangeProcessor['isPermanentFailure']('PAGA BANK NOT FOUND')).toBe(true);
      expect(exchangeProcessor['isPermanentFailure']('paga bank not found')).toBe(true);
    });
  });

  describe('validateUserDetailsForExchange', () => {
    it('should return user with valid details', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any);

      const result = await exchangeProcessor['validateUserDetailsForExchange']('user-123');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith(
        { id: 'user-123' },
        {},
        { graphFetch: '[userProfile,country]' },
      );
    });

    it('should throw error if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(exchangeProcessor['validateUserDetailsForExchange']('user-123')).rejects.toThrow('User not found');
    });

    it('should throw error if user country is missing', async () => {
      const userWithoutCountry = { ...mockUser, country: null };
      userRepository.findOne.mockResolvedValue(userWithoutCountry as any);

      await expect(exchangeProcessor['validateUserDetailsForExchange']('user-123')).rejects.toThrow(
        'User country information is required for exchange operations',
      );
    });

    it('should throw error if user country code is missing', async () => {
      const userWithoutCountryCode = { ...mockUser, country: { name: 'Nigeria' } };
      userRepository.findOne.mockResolvedValue(userWithoutCountryCode as any);

      await expect(exchangeProcessor['validateUserDetailsForExchange']('user-123')).rejects.toThrow(
        'User country code is required for exchange operations',
      );
    });

    it('should throw error if user profile is missing', async () => {
      const userWithoutProfile = { ...mockUser, userProfile: null };
      userRepository.findOne.mockResolvedValue(userWithoutProfile as any);

      await expect(exchangeProcessor['validateUserDetailsForExchange']('user-123')).rejects.toThrow(
        'User profile is required for exchange operations',
      );
    });

    it('should throw error if first name is missing', async () => {
      const userWithoutFirstName = { ...mockUser, first_name: null };
      userRepository.findOne.mockResolvedValue(userWithoutFirstName as any);

      await expect(exchangeProcessor['validateUserDetailsForExchange']('user-123')).rejects.toThrow(
        'User first name is required for exchange operations',
      );
    });
  });

  describe('validateKycDetailsForExchange', () => {
    it('should return KYC details for valid user', async () => {
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);

      const result = await exchangeProcessor['validateKycDetailsForExchange'](mockUser as any);

      expect(result).toEqual(mockKycDetails);
    });

    it('should throw error if KYC details not found', async () => {
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(null);

      await expect(exchangeProcessor['validateKycDetailsForExchange'](mockUser as any)).rejects.toThrow(
        'User KYC details are required for exchange operations',
      );
    });

    it('should throw error if ID document number is missing', async () => {
      const invalidKyc = {
        data: {
          idDocument: {
            type: 'drivers_license',
          },
        },
      };
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(invalidKyc as any);

      await expect(exchangeProcessor['validateKycDetailsForExchange'](mockUser as any)).rejects.toThrow(
        'User KYC ID document number is required for exchange operations',
      );
    });

    it('should throw error if ID document type is missing', async () => {
      const invalidKyc = {
        data: {
          idDocument: {
            number: 'DL123456',
          },
        },
      };
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(invalidKyc as any);

      await expect(exchangeProcessor['validateKycDetailsForExchange'](mockUser as any)).rejects.toThrow(
        'User KYC ID document type is required for exchange operations',
      );
    });

    it('should require BVN for Nigerian users', async () => {
      const kycWithoutBvn = {
        data: {
          idDocument: {
            type: 'drivers_license',
            number: 'DL123',
          },
        },
      };
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(kycWithoutBvn as any);

      await expect(exchangeProcessor['validateKycDetailsForExchange'](mockUser as any)).rejects.toThrow(
        'BVN information is required for Nigerian users',
      );
    });
  });

  describe('getBankAccountAndName', () => {
    it('should return test account number in non-production', () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(false);

      const result = exchangeProcessor['getBankAccountAndName'](mockJob.data.virtualAccount);

      expect(result.accountNumber).toBe('1111111111');
      expect(result.accountName).toBe('Test Account');
    });

    it('should return actual account number in production', () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(true);

      const result = exchangeProcessor['getBankAccountAndName'](mockJob.data.virtualAccount);

      expect(result.accountNumber).toBe('1234567890');
      expect(result.accountName).toBe('Test Account');
    });
  });

  describe('createYellowCardPayoutRequest', () => {
    beforeEach(() => {
      userRepository.findOne.mockResolvedValue(mockUser as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      exchangeAdapter.createPayOutRequest.mockResolvedValue(mockPayOutResponse as any);
    });

    it('should create payout request with valid data', async () => {
      const result = await exchangeProcessor['createYellowCardPayoutRequest'](
        'user-123',
        { accountNumber: '1234567890', accountName: 'Test Account' },
        mockChannels[0] as any,
        mockBanks[0] as any,
        'ref-123',
        'NG',
        100,
      );

      expect(result).toEqual(mockPayOutResponse);
      expect(exchangeAdapter.createPayOutRequest).toHaveBeenCalled();
    });

    it('should include BVN for Nigerian users', async () => {
      await exchangeProcessor['createYellowCardPayoutRequest'](
        'user-123',
        { accountNumber: '1234567890', accountName: 'Test Account' },
        mockChannels[0] as any,
        mockBanks[0] as any,
        'ref-123',
        'NG',
        100,
      );

      const callArgs = exchangeAdapter.createPayOutRequest.mock.calls[0][0];
      expect(callArgs.sender.additionalIdNumber).toBe('BVN123456');
      expect(callArgs.sender.additionalIdType).toBe(IdentityDocType.BVN);
    });

    it('should not include BVN for non-Nigerian users', async () => {
      const nonNigerianUser = { ...mockUser, country: { code: 'US', name: 'USA' } };
      userRepository.findOne.mockResolvedValue(nonNigerianUser as any);

      await exchangeProcessor['createYellowCardPayoutRequest'](
        'user-123',
        { accountNumber: '1234567890', accountName: 'Test Account' },
        mockChannels[0] as any,
        mockBanks[0] as any,
        'ref-123',
        'US',
        100,
      );

      const callArgs = exchangeAdapter.createPayOutRequest.mock.calls[0][0];
      expect(callArgs.sender.additionalIdNumber).toBeUndefined();
    });

    it('should map ETH to ERC20 for crypto network', async () => {
      await exchangeProcessor['createYellowCardPayoutRequest'](
        'user-123',
        { accountNumber: '1234567890', accountName: 'Test Account' },
        mockChannels[0] as any,
        mockBanks[0] as any,
        'ref-123',
        'NG',
        100,
      );

      const callArgs = exchangeAdapter.createPayOutRequest.mock.calls[0][0];
      expect(callArgs.cryptoInfo.cryptoNetwork).toBe('ERC20');
    });

    it('should throw error for invalid currency format', async () => {
      exchangeProcessor['defaultUnderlyingCurrency'] = 'INVALID';

      await expect(
        exchangeProcessor['createYellowCardPayoutRequest'](
          'user-123',
          { accountNumber: '1234567890', accountName: 'Test Account' },
          mockChannels[0] as any,
          mockBanks[0] as any,
          'ref-123',
          'NG',
          100,
        ),
      ).rejects.toThrow('Invalid underlying currency format');
    });

    it('should format date of birth correctly', async () => {
      await exchangeProcessor['createYellowCardPayoutRequest'](
        'user-123',
        { accountNumber: '1234567890', accountName: 'Test Account' },
        mockChannels[0] as any,
        mockBanks[0] as any,
        'ref-123',
        'NG',
        100,
      );

      const callArgs = exchangeAdapter.createPayOutRequest.mock.calls[0][0];
      expect(callArgs.sender.dob).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    it('should handle SOL network correctly', async () => {
      exchangeProcessor['defaultUnderlyingCurrency'] = 'USDC.SOL';
      userRepository.findOne.mockResolvedValue(mockUser as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      exchangeAdapter.createPayOutRequest.mockResolvedValue(mockPayOutResponse as any);

      await exchangeProcessor['createYellowCardPayoutRequest'](
        'user-123',
        { accountNumber: '1234567890', accountName: 'Test Account' },
        mockChannels[0] as any,
        mockBanks[0] as any,
        'ref-123',
        'NG',
        100,
      );

      const callArgs = exchangeAdapter.createPayOutRequest.mock.calls[0][0];
      expect(callArgs.cryptoInfo.cryptoNetwork).toBe('SOL');
    });

    it('should handle unknown network correctly', async () => {
      exchangeProcessor['defaultUnderlyingCurrency'] = 'USDC.ARB';
      userRepository.findOne.mockResolvedValue(mockUser as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      exchangeAdapter.createPayOutRequest.mockResolvedValue(mockPayOutResponse as any);

      await exchangeProcessor['createYellowCardPayoutRequest'](
        'user-123',
        { accountNumber: '1234567890', accountName: 'Test Account' },
        mockChannels[0] as any,
        mockBanks[0] as any,
        'ref-123',
        'NG',
        100,
      );

      const callArgs = exchangeAdapter.createPayOutRequest.mock.calls[0][0];
      expect(callArgs.cryptoInfo.cryptoNetwork).toBe('ARB');
    });
  });

  describe('processExchange - additional scenarios', () => {
    beforeEach(() => {
      exchangeAdapter.getChannels.mockResolvedValue(mockChannels as any);
      exchangeAdapter.getBanks.mockResolvedValue(mockBanks as any);
      exchangeAdapter.createPayOutRequest.mockResolvedValue(mockPayOutResponse as any);
      fiatWalletAdapter.createWithdrawalRequest.mockResolvedValue(mockWithdrawalRequest as any);
      userRepository.findOne.mockResolvedValue(mockUser as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      transactionRepository.update.mockResolvedValue({} as any);
      fiatWalletTransactionRepository.update.mockResolvedValue({} as any);
      rateService.validateRateOrThrow.mockResolvedValue(undefined);
    });

    it('should not throw and mark transaction as failed when Paga bank is inactive (permanent failure)', async () => {
      const inactiveBanks = [{ ...mockBanks[0], status: 'inactive' }];
      exchangeAdapter.getBanks.mockResolvedValue(inactiveBanks as any);

      await expect(exchangeProcessor['processExchange']({ data: mockJob.data })).resolves.toBeUndefined();

      expect(transactionRepository.update).toHaveBeenCalledWith(
        'txn-123',
        expect.objectContaining({
          status: TransactionStatus.FAILED,
          failure_reason: 'Paga bank not found or inactive',
        }),
      );
    });

    it('should handle withdrawal request failure', async () => {
      fiatWalletAdapter.createWithdrawalRequest.mockRejectedValue(new Error('Withdrawal failed'));

      await expect(exchangeProcessor['processExchange']({ data: mockJob.data })).rejects.toThrow();

      expect(transactionRepository.update).toHaveBeenCalledWith(
        'txn-123',
        expect.objectContaining({
          status: TransactionStatus.FAILED,
        }),
      );
    });

    it('should update metadata with exchange references', async () => {
      await exchangeProcessor['processExchange']({ data: mockJob.data });

      expect(transactionRepository.update).toHaveBeenCalledWith(
        'txn-123',
        expect.objectContaining({
          metadata: expect.objectContaining({
            destination_provider_ref: 'payout-123',
            destination_provider_request_ref: 'withdrawal-req-123',
            destination_wallet_address: 'test-wallet-address-123',
          }),
        }),
      );
    });
  });

  describe('parseExchangeError - additional scenarios', () => {
    it('should handle error with errors object (non-array)', () => {
      const error = {
        response: {
          data: {
            errors: { message: 'Invalid request' },
          },
        },
      };

      const result = exchangeProcessor['parseExchangeError'](error);

      expect(result.failureReason).toBeDefined();
    });

    it('should handle error with nested response', () => {
      const error = {
        response: {
          data: {
            errors: ['Rate limit exceeded', 'Try again later'],
          },
        },
      };

      const result = exchangeProcessor['parseExchangeError'](error);

      expect(result.failureReason).toContain('Rate limit exceeded');
    });

    it('should handle error with empty errors array', () => {
      const error = {
        response: {
          data: {
            errors: [],
          },
        },
      };

      const result = exchangeProcessor['parseExchangeError'](error);

      expect(result.failureReason).toBe('Withdrawal request failed');
      expect(result.userFriendlyMessage).toBe('Exchange failed to initiate');
    });
  });

  describe('validateUserDetailsForExchange - additional scenarios', () => {
    it('should throw error if last name is missing', async () => {
      const userWithoutLastName = { ...mockUser, last_name: null };
      userRepository.findOne.mockResolvedValue(userWithoutLastName as any);

      await expect(exchangeProcessor['validateUserDetailsForExchange']('user-123')).rejects.toThrow(
        'User last name is required for exchange operations',
      );
    });

    it('should throw error if email is missing', async () => {
      const userWithoutEmail = { ...mockUser, email: null };
      userRepository.findOne.mockResolvedValue(userWithoutEmail as any);

      await expect(exchangeProcessor['validateUserDetailsForExchange']('user-123')).rejects.toThrow(
        'User email is required for exchange operations',
      );
    });

    it('should throw error if phone number is missing', async () => {
      const userWithoutPhone = { ...mockUser, phone_number: null };
      userRepository.findOne.mockResolvedValue(userWithoutPhone as any);

      await expect(exchangeProcessor['validateUserDetailsForExchange']('user-123')).rejects.toThrow(
        'User phone number is required for exchange operations',
      );
    });

    it('should throw error if address is missing', async () => {
      const userWithoutAddress = {
        ...mockUser,
        userProfile: { ...mockUser.userProfile, address_line1: null },
      };
      userRepository.findOne.mockResolvedValue(userWithoutAddress as any);

      await expect(exchangeProcessor['validateUserDetailsForExchange']('user-123')).rejects.toThrow(
        'User address information is required for exchange operations',
      );
    });

    it('should throw error if date of birth is missing', async () => {
      const userWithoutDob = {
        ...mockUser,
        userProfile: { ...mockUser.userProfile, dob: null },
      };
      userRepository.findOne.mockResolvedValue(userWithoutDob as any);

      await expect(exchangeProcessor['validateUserDetailsForExchange']('user-123')).rejects.toThrow(
        'User date of birth information is required for exchange operations',
      );
    });
  });

  describe('validateKycDetailsForExchange - additional scenarios', () => {
    it('should pass validation for non-Nigerian users without BVN', async () => {
      const nonNigerianUser = { ...mockUser, country: { code: 'GH', name: 'Ghana' } };
      const kycWithoutBvn = {
        data: {
          idDocument: {
            type: 'passport',
            number: 'PASS123',
          },
        },
      };
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(kycWithoutBvn as any);

      const result = await exchangeProcessor['validateKycDetailsForExchange'](nonNigerianUser as any);

      expect(result).toEqual(kycWithoutBvn);
    });

    it('should throw error for Nigerian users with empty BVN', async () => {
      const kycWithEmptyBvn = {
        data: {
          idDocument: {
            type: 'drivers_license',
            number: 'DL123',
          },
          idNumber: '',
        },
      };
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(kycWithEmptyBvn as any);

      await expect(exchangeProcessor['validateKycDetailsForExchange'](mockUser as any)).rejects.toThrow(
        'BVN information is required for Nigerian users',
      );
    });
  });

  describe('validateExchangeJobData - additional scenarios', () => {
    it('should throw error if virtual account name is missing', () => {
      const invalidData = {
        ...mockJob.data,
        virtualAccount: { account_number: '1234567890', account_name: '' },
      } as any;
      expect(() => exchangeProcessor['validateExchangeJobData'](invalidData)).toThrow(
        'Virtual account name is required',
      );
    });
  });

  describe('getBankAccountAndName', () => {
    it('should return production account when isProduction is true', () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(true);

      const virtualAccount = {
        account_number: '1234567890',
        account_name: 'Test Account',
      } as any;

      const result = exchangeProcessor['getBankAccountAndName'](virtualAccount);

      expect(result.accountNumber).toBe('1234567890');
      expect(result.accountName).toBe('Test Account');
    });

    it('should return test account when isProduction is false', () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(false);

      const virtualAccount = {
        account_number: '1234567890',
        account_name: 'Test Account',
      } as any;

      const result = exchangeProcessor['getBankAccountAndName'](virtualAccount);

      expect(result.accountName).toBe('Test Account');
    });
  });

  describe('createYellowCardPayoutRequest - additional scenarios', () => {
    it('should add BVN for Nigerian users', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      exchangeAdapter.createPayOutRequest.mockResolvedValue(mockPayOutResponse as any);

      await exchangeProcessor['createYellowCardPayoutRequest'](
        'user-123',
        { accountNumber: '1234567890', accountName: 'Test Account' },
        mockChannels[0] as any,
        mockBanks[0] as any,
        'ref-123',
        'NG',
        100,
      );

      expect(exchangeAdapter.createPayOutRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: expect.objectContaining({
            additionalIdNumber: 'BVN123456',
            additionalIdType: IdentityDocType.BVN,
          }),
        }),
      );
    });

    it('should not add BVN for non-Nigerian users', async () => {
      const ghanaUser = { ...mockUser, country: { code: 'GH', name: 'Ghana' } };
      userRepository.findOne.mockResolvedValue(ghanaUser as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      exchangeAdapter.createPayOutRequest.mockResolvedValue(mockPayOutResponse as any);

      await exchangeProcessor['createYellowCardPayoutRequest'](
        'user-123',
        { accountNumber: '1234567890', accountName: 'Test Account' },
        mockChannels[0] as any,
        mockBanks[0] as any,
        'ref-123',
        'GH',
        100,
      );

      expect(exchangeAdapter.createPayOutRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: expect.not.objectContaining({
            additionalIdNumber: expect.anything(),
          }),
        }),
      );
    });

    it('should throw error for invalid underlying currency format', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);

      // Temporarily change the defaultUnderlyingCurrency
      const originalCurrency = exchangeProcessor['defaultUnderlyingCurrency'];
      exchangeProcessor['defaultUnderlyingCurrency'] = 'INVALID';

      await expect(
        exchangeProcessor['createYellowCardPayoutRequest'](
          'user-123',
          { accountNumber: '1234567890', accountName: 'Test Account' },
          mockChannels[0] as any,
          mockBanks[0] as any,
          'ref-123',
          'NG',
          100,
        ),
      ).rejects.toThrow(InternalServerErrorException);

      // Restore the original currency
      exchangeProcessor['defaultUnderlyingCurrency'] = originalCurrency;
    });
  });

  describe('processExchange - failure scenarios', () => {
    beforeEach(() => {
      userRepository.findOne.mockResolvedValue(mockUser as any);
      kycAdapter.getKycDetailsByUserId.mockResolvedValue(mockKycDetails as any);
      exchangeAdapter.getChannels.mockResolvedValue(mockChannels as any);
      exchangeAdapter.getBanks.mockResolvedValue(mockBanks as any);
      rateService.validateRateOrThrow.mockResolvedValue(undefined);
    });

    it('should throw error when payout response is null', async () => {
      exchangeAdapter.createPayOutRequest.mockResolvedValue(null as any);

      await expect(exchangeProcessor['processExchange'](mockJob as Job<ExchangeJobData>)).rejects.toThrow(
        BadRequestException,
      );

      expect(transactionRepository.update).toHaveBeenCalledWith(
        'txn-123',
        expect.objectContaining({
          status: TransactionStatus.FAILED,
        }),
      );
    });

    it('should throw error when wallet address is missing', async () => {
      exchangeAdapter.createPayOutRequest.mockResolvedValue({
        ...mockPayOutResponse,
        cryptoInfo: { walletAddress: null },
      } as any);

      await expect(exchangeProcessor['processExchange'](mockJob as Job<ExchangeJobData>)).rejects.toThrow(
        BadRequestException,
      );

      expect(transactionRepository.update).toHaveBeenCalledWith(
        'txn-123',
        expect.objectContaining({
          status: TransactionStatus.FAILED,
        }),
      );
    });

    it('should handle withdrawal request failure', async () => {
      exchangeAdapter.createPayOutRequest.mockResolvedValue(mockPayOutResponse as any);
      fiatWalletAdapter.createWithdrawalRequest.mockRejectedValue(new Error('Withdrawal request failed'));

      await expect(exchangeProcessor['processExchange'](mockJob as Job<ExchangeJobData>)).rejects.toThrow(
        BadRequestException,
      );

      expect(transactionRepository.update).toHaveBeenCalledWith(
        'txn-123',
        expect.objectContaining({
          status: TransactionStatus.FAILED,
        }),
      );
    });

    it('should handle insufficient balance error', async () => {
      exchangeAdapter.createPayOutRequest.mockResolvedValue(mockPayOutResponse as any);
      fiatWalletAdapter.createWithdrawalRequest.mockRejectedValue(new Error('insufficient balance for withdrawal'));

      await expect(exchangeProcessor['processExchange'](mockJob as Job<ExchangeJobData>)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should schedule virtual account deletion when exchange account fails', async () => {
      const virtualAccountRepository = exchangeProcessor['virtualAccountRepository'];
      const mockJobWithExchangeAccount = {
        ...mockJob,
        data: {
          ...mockJob.data,
          virtualAccount: {
            id: 'va-123',
            account_number: '1234567890',
            account_name: 'Test Account',
            type: 'exchange_account',
          },
        },
      };

      exchangeAdapter.createPayOutRequest.mockResolvedValue(mockPayOutResponse as any);
      fiatWalletAdapter.createWithdrawalRequest.mockRejectedValue(new Error('Withdrawal failed'));

      await expect(
        exchangeProcessor['processExchange'](mockJobWithExchangeAccount as Job<ExchangeJobData>),
      ).rejects.toThrow(BadRequestException);

      expect(virtualAccountRepository.update).toHaveBeenCalledWith('va-123', {
        scheduled_deletion_at: expect.any(Date),
      });
    });
  });

  describe('parseExchangeError - additional cases', () => {
    it('should handle error with response data errors array with multiple items', () => {
      const error = {
        response: {
          data: {
            errors: ['First error', 'Second error'],
          },
        },
      };

      const result = exchangeProcessor['parseExchangeError'](error);

      expect(result.failureReason).toBe('First error');
      expect(result.userFriendlyMessage).toBe('First error');
    });

    it('should handle insufficient balance message in failure reason', () => {
      const error = {
        message: 'Insufficient balance for this operation',
      };

      const result = exchangeProcessor['parseExchangeError'](error);

      expect(result.failureReason).toContain('Insufficient balance');
    });
  });

  describe('queueExchange', () => {
    it('should queue exchange job successfully', async () => {
      queueService.addJob.mockResolvedValue({ id: 'job-123' } as any);

      const data: ExchangeJobData = {
        userId: 'user-123',
        participantCode: 'part-123',
        sourceTransaction: {} as any,
        amount: 100,
        destinationCountryCode: 'NG',
        virtualAccount: {} as any,
        sourceFiatWalletTransaction: {} as any,
        rateId: 'rate-123',
      };

      await exchangeProcessor.queueExchange(data);

      expect(queueService.addJob).toHaveBeenCalledWith(
        'exchange',
        'exchange',
        data,
        expect.objectContaining({
          attempts: 3,
          backoff: expect.objectContaining({
            type: 'exponential',
            delay: 2000,
          }),
        }),
      );
    });
  });
});
