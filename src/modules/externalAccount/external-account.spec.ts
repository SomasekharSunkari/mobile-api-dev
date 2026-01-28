import { BadRequestException, ConflictException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExternalAccountAdapter } from '../../adapters/external-account/external-account.adapter';
import { LinkBankAccountAdapter } from '../../adapters/link-bank-account/link-bank-account.adapter';
import { ParticipantAdapter } from '../../adapters/participant/participant.adapter';
import {
  ParticipantCreateRequest,
  ParticipantCreateResponse,
} from '../../adapters/participant/participant.adapter.interface';
import { ZerohashParticipantAdapter } from '../../adapters/participant/zerohash/zerohash.adapter';
import { AdapterConfigProvider } from '../../config/adapter.config';
import { ExternalAccountStatus } from '../../database/models/externalAccount/externalAccount.interface';
import { FiatWalletTransactionType } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import { TransactionStatus } from '../../database/models/transaction';
import { UserModel } from '../../database/models/user/user.model';
import { ExternalAccountKycException } from '../../exceptions/external_account_kyc_exception';
import { ServiceUnavailableException } from '../../exceptions/service_unavailable_exception';
import { LockerService } from '../../services/locker/locker.service';
import { AppLoggerService } from '../../services/logger/logger.service';
import { ExecuteWalletProcessor } from '../../services/queue/processors/execute-wallet/execute-wallet.processor';
import { MailerService } from '../../services/queue/processors/mailer/mailer.service';
import { RedisCacheService } from '../../services/redis/redis-cache.service';
import { AccessTokenService } from '../auth/accessToken';
import { TransactionPinGuard } from '../auth/guard/transactionPinGuard/transactionPin.guard';
import { KycVerificationService } from '../auth/kycVerification/kycVerification.service';
import { LocationRestrictionService } from '../auth/locationRestriction/locationRestriction.service';
import { UserService } from '../auth/user/user.service';
import { CountryRepository } from '../country/country.repository';
import { FiatWalletService } from '../fiatWallet/fiatWallet.service';
import { FiatWalletTransactionRepository } from '../fiatWalletTransactions/fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from '../fiatWalletTransactions/fiatWalletTransactions.service';
import { InAppNotificationService } from '../inAppNotification/inAppNotification.service';

import { TierConfigService } from '../tierConfig/tierConfig.service';
import { TransactionMonitoringService } from '../transaction-monitoring/transaction-monitoring.service';
import { TransactionSumService } from '../transaction-sum/transaction-sum.service';
import { TransactionService } from '../transaction/transaction.service';
import { UserTierService } from '../userTier/userTier.service';
import { TransferDto, TransferType } from './dto/transfer.dto';
import { ExternalAccountController } from './external-account.controller';
import { ExternalAccountRepository } from './external-account.repository';
import { ExternalAccountService } from './external-account.service';

describe('ParticipantAdapter', () => {
  let adapter: ParticipantAdapter;
  let mockConfig: Partial<AdapterConfigProvider>;
  let mockZerohash: Partial<ZerohashParticipantAdapter>;

  // a minimal valid payload for createParticipant
  const basePayload: ParticipantCreateRequest = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    address: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    country: 'US',
    dob: '1990-01-01',
    kyc: 'pass',
    kycTimestamp: Date.now(),
    compliance: 'pass',
    complianceTimestamp: Date.now(),
    signedTimestamp: Date.now(),
    // US-only fields:
    zip: '62704',
    tin: '123-45-6789', // SSN for US users
    // NG-only field (won't be used here)
    passport: undefined as any,
  };

  beforeEach(async () => {
    mockConfig = {
      getConfig: jest.fn(),
    };
    mockZerohash = {
      createParticipant: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParticipantAdapter,
        // override the injected zerohash adapter
        { provide: ZerohashParticipantAdapter, useValue: mockZerohash },
      ],
    }).compile();

    adapter = module.get<ParticipantAdapter>(ParticipantAdapter);
    // override the internal adapterConfig instance:
    (adapter as any).adapterConfig = mockConfig;
    (adapter as any).zerohashParticipantAdapter = mockZerohash;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should delegate to ZerohashParticipantAdapter for supported country', async () => {
    // Arrange
    (mockConfig.getConfig as jest.Mock).mockReturnValue({
      default_participant_countries: 'US, NG',
    });
    const expected: ParticipantCreateResponse = { providerRef: 'ZXCV1234', provider: 'zerohash' };
    (mockZerohash.createParticipant as jest.Mock).mockResolvedValue(expected);

    // Act
    const res = await adapter.createParticipant(basePayload);

    // Assert
    expect(mockZerohash.createParticipant).toHaveBeenCalledWith(basePayload);
    expect(res).toBe(expected);
  });

  it('should throw BadRequestException for unsupported country', async () => {
    (mockConfig.getConfig as jest.Mock).mockReturnValue({
      default_participant_countries: 'NG', // no US
    });

    await expect(adapter.createParticipant(basePayload)).rejects.toThrow(BadRequestException);
    expect(mockZerohash.createParticipant).not.toHaveBeenCalled();
  });

  it('should bubble up errors from the underlying adapter', async () => {
    (mockConfig.getConfig as jest.Mock).mockReturnValue({
      default_participant_countries: 'US',
    });
    const boom = new Error('whoops');
    (mockZerohash.createParticipant as jest.Mock).mockRejectedValue(boom);

    await expect(adapter.createParticipant(basePayload)).rejects.toThrow('whoops');
    expect(mockZerohash.createParticipant).toHaveBeenCalled();
  });
});

describe('ExternalAccountService', () => {
  let service: ExternalAccountService;
  let mockExternalAccountRepository: any;
  let mockExternalAccountAdapter: any;
  let mockLinkBankAccountAdapter: any;
  let mockTransactionService: any;
  let mockFiatWalletService: any;
  let mockFiatWalletTransactionService: any;
  let mockAccessTokenService: any;
  let mockExecuteWalletProcessor: any;
  let mockTierService: any;
  let mockTierConfigService: any;
  let mockTransactionSumService: any;
  let mockTransactionMonitoringService: any;
  let mockUserService: any;
  let mockCountryRepository: any;
  let mockLocationRestrictionService: any;
  let mockKycVerificationService: any;
  const mockUser = {
    id: 'user-123',
    country: { code: 'US' },
  } as unknown as UserModel;

  // Mock $fetchGraph to return the user itself
  mockUser.$fetchGraph = jest.fn().mockImplementation(() => {
    return Promise.resolve(mockUser);
  });

  const mockExternalAccount = {
    id: 'external-account-123',
    user_id: 'user-123',
    participant_code: 'PARTICIPANT123',
    external_account_ref: 'ext-account-ref-123',
    provider: 'zerohash',
    linked_access_token: 'access-token-123',
    linked_account_ref: 'account-ref-123',
    bank_name: 'Test Bank',
    status: 'approved',
    provider_kyc_status: 'approved',
  };

  beforeEach(async () => {
    mockExternalAccountRepository = {
      findOne: jest.fn(),
      delete: jest.fn(),
      query: jest.fn().mockReturnThis(),
    };

    mockExternalAccountAdapter = {
      executePayment: jest.fn(),
    };

    mockLinkBankAccountAdapter = {
      createLinkToken: jest.fn(),
    };

    mockTransactionService = {
      findById: jest.fn(),
      updateStatus: jest.fn(),
    };

    mockFiatWalletService = {
      getUserWallet: jest.fn(),
    };

    mockFiatWalletTransactionService = {
      findOne: jest.fn(),
      findOneOrNull: jest.fn(),
      updateStatus: jest.fn(),
    };

    mockExecuteWalletProcessor = {
      queueExecuteWalletTransaction: jest.fn().mockResolvedValue({ id: 'job-123' }),
    };

    const mockLockerService = {
      withLock: jest.fn((_key, callback) => callback()),
    };

    mockAccessTokenService = {
      create: jest.fn(),
    };

    mockTierService = {
      getUserCurrentTier: jest.fn(),
      validateLimit: jest.fn(),
    };

    mockTierConfigService = {
      findByCountryAndTier: jest.fn(),
    };

    mockTransactionSumService = {
      getPastOneDayTransactionSum: jest.fn().mockResolvedValue({
        transactionTypeTotals: {},
        status: 'completed',
        startDate: new Date(),
        endDate: new Date(),
        userId: 'user-123',
        asset: 'USD',
      }),
      getPastOneWeekTransactionSum: jest.fn().mockResolvedValue({
        transactionTypeTotals: {},
        status: 'completed',
        startDate: new Date(),
        endDate: new Date(),
        userId: 'user-123',
        asset: 'USD',
      }),
      getPastOneMonthTransactionSum: jest.fn().mockResolvedValue({
        transactionTypeTotals: {},
        status: 'completed',
        startDate: new Date(),
        endDate: new Date(),
        userId: 'user-123',
        asset: 'USD',
      }),
      getPastTransactionSum: jest.fn().mockResolvedValue({
        transactionTypeTotals: {},
        status: 'completed',
        startDate: new Date(),
        endDate: new Date(),
        userId: 'user-123',
        asset: 'USD',
      }),
    };

    mockTransactionMonitoringService = {
      monitorDeposit: jest.fn(),
    };

    mockUserService = {
      findByUserId: jest.fn(),
    };

    mockCountryRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'cma6yirpc0000w5mi97kv1ffo',
        name: 'United States',
        code: 'US',
        is_supported: true,
      }),
    };

    mockLocationRestrictionService = {
      validateLocation: jest.fn(),
    };

    mockKycVerificationService = {
      findByUserId: jest.fn().mockResolvedValue({
        provider_ref: 'test-provider-ref',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExternalAccountService,
        { provide: ExternalAccountRepository, useValue: mockExternalAccountRepository },
        { provide: ExternalAccountAdapter, useValue: mockExternalAccountAdapter },
        { provide: LinkBankAccountAdapter, useValue: mockLinkBankAccountAdapter },
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: FiatWalletService, useValue: mockFiatWalletService },
        { provide: FiatWalletTransactionService, useValue: mockFiatWalletTransactionService },
        { provide: ExecuteWalletProcessor, useValue: mockExecuteWalletProcessor },
        { provide: LockerService, useValue: mockLockerService },
        { provide: AccessTokenService, useValue: mockAccessTokenService },
        { provide: UserTierService, useValue: mockTierService },
        { provide: TierConfigService, useValue: mockTierConfigService },
        { provide: TransactionSumService, useValue: mockTransactionSumService },
        { provide: RedisCacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
        {
          provide: FiatWalletTransactionRepository,
          useValue: {
            update: jest.fn(),
            query: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              whereIn: jest.fn().mockReturnThis(),
              first: jest.fn().mockResolvedValue(null),
            })),
          },
        },
        { provide: TransactionMonitoringService, useValue: mockTransactionMonitoringService },
        { provide: UserService, useValue: mockUserService },
        { provide: CountryRepository, useValue: mockCountryRepository },
        { provide: MailerService, useValue: { send: jest.fn() } },
        { provide: InAppNotificationService, useValue: { createNotification: jest.fn() } },
        { provide: LocationRestrictionService, useValue: mockLocationRestrictionService },
        { provide: KycVerificationService, useValue: mockKycVerificationService },
      ],
    }).compile();

    service = module.get<ExternalAccountService>(ExternalAccountService);

    // Mock UserModel.transaction following the standard pattern
    jest.spyOn(UserModel, 'transaction').mockImplementation(async (callback: any) => {
      return await callback({});
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fund', () => {
    const fundRequest: TransferDto = {
      external_account_id: 'ext-account-id-123',
      currency: 'USD',
      amount: 100,
      description: 'Test funding',
      transfer_type: TransferType.DEBIT,
    };

    beforeEach(() => {
      // Setup mocks for fund method
      mockExternalAccountAdapter.evaluateRiskSignal = jest.fn();
      mockExternalAccountAdapter.requestQuote = jest.fn();
      mockTransactionService.create = jest.fn();
      mockFiatWalletTransactionService.create = jest.fn();
      mockTransactionService.updateStatus = jest.fn();
      mockFiatWalletTransactionService.updateStatus = jest.fn();
    });

    it('should successfully fund with ACCEPT signal result', async () => {
      // Arrange
      const mockSignalResponse = {
        ruleset: { result: 'ACCEPT', rulesetKey: 'test-ruleset' },
        requestRef: 'req-123',
        scores: {
          bankInitiatedReturnRisk: 0.1,
          customerInitiatedReturnRisk: 0.2,
        },
      };

      const mockQuoteResponse = {
        quoteRef: 'quote-ref-123',
        amount: '100',
      };

      const mockWallet = {
        id: 'wallet-123',
        balance: 0,
      };

      const mockTransaction = {
        id: 'transaction-123',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
      };

      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000, // $1000 in cents
            maximum_daily_deposit: 500000, // $5000 in cents
            maximum_weekly_deposit: 2000000, // $20000 in cents
            maximum_monthly_deposit: 10000000, // $100000 in cents
          },
        ],
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockTierService.validateLimit.mockResolvedValue(undefined); // Should not throw
      mockExternalAccountAdapter.evaluateRiskSignal.mockResolvedValue(mockSignalResponse);
      mockExternalAccountAdapter.requestQuote.mockResolvedValue(mockQuoteResponse);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockWallet);
      mockTransactionService.create.mockResolvedValue(mockTransaction);
      mockFiatWalletTransactionService.create.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionService.updateStatus.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.PROCESSING,
      });
      mockExecuteWalletProcessor.queueExecuteWalletTransaction.mockResolvedValue({ id: 'job-123' });
      mockTransactionMonitoringService.monitorDeposit.mockResolvedValue({
        reviewAnswer: 'GREEN',
        reviewStatus: 'completed',
      });

      // Act
      const result = await service.deposit(mockUser, fundRequest);

      // Assert
      expect(mockExternalAccountRepository.findOne).toHaveBeenCalledWith({
        id: 'ext-account-id-123',
        user_id: 'user-123',
      });
      expect(mockTierService.validateLimit).toHaveBeenCalledWith(
        mockUser.id,
        fundRequest.amount * 100, // Amount is converted to cents before validation
        fundRequest.currency,
        FiatWalletTransactionType.DEPOSIT,
      );
      expect(mockExternalAccountAdapter.evaluateRiskSignal).toHaveBeenCalled();
      expect(mockExternalAccountAdapter.requestQuote).toHaveBeenCalled();
      expect(mockTransactionService.create).toHaveBeenCalled();
      expect(mockFiatWalletTransactionService.create).toHaveBeenCalled();
      expect(mockExecuteWalletProcessor.queueExecuteWalletTransaction).toHaveBeenCalled();
      expect(result.status).toBe('processing');
    });

    it('should throw NotFoundException when external account not found', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(null);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);

      // Act & Assert
      await expect(service.deposit(mockUser, fundRequest)).rejects.toThrow(
        new NotFoundException('External account not found'),
      );
    });

    it('should throw BadRequestException when account is not linked', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const unlinkedAccount = {
        ...mockExternalAccount,
        linked_access_token: null,
        linked_account_ref: null,
      };
      mockExternalAccountRepository.findOne.mockResolvedValue(unlinkedAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);

      // Act & Assert
      await expect(service.deposit(mockUser, fundRequest)).rejects.toThrow(
        new BadRequestException('Account is not linked'),
      );
    });

    it('should throw BadRequestException when external account status is not approved or pending_disconnect', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const externalAccountNotApproved = {
        ...mockExternalAccount,
        status: 'pending', // Not approved or pending_disconnect
        linked_access_token: 'access-token-123',
        linked_account_ref: 'account-ref-123',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccountNotApproved);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);

      // Act & Assert
      await expect(service.deposit(mockUser, fundRequest)).rejects.toThrow(
        new BadRequestException(
          'Account is not available for transactions. Status: pending. Please reconnect your bank account.',
        ),
      );
    });

    it('should throw ExternalAccountKycException when provider_kyc_status is not approved', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const externalAccountNotApprovedKyc = {
        ...mockExternalAccount,
        provider_kyc_status: 'submitted', // Not approved
        status: 'approved',
        linked_access_token: 'access-token-123',
        linked_account_ref: 'account-ref-123',
      };

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      };

      (service as any).fiatWalletTransactionRepository.query = jest.fn(() => mockQuery);
      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccountNotApprovedKyc);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);

      // Act & Assert
      try {
        await service.deposit(mockUser, fundRequest);
        fail('Expected ExternalAccountKycException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ExternalAccountKycException);
      }
    });

    it('should throw ServiceUnavailableException with deposit-specific message when signal evaluation fails', async () => {
      // Arrange
      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockExternalAccountAdapter.evaluateRiskSignal.mockRejectedValue(new ServiceUnavailableException());
      mockExternalAccountAdapter.requestQuote.mockResolvedValue({
        quoteRef: 'quote-123',
        price: '1.00',
        expireTs: Date.now() + 60000,
      });

      // Act & Assert
      await expect(service.deposit(mockUser, fundRequest)).rejects.toMatchObject({
        message: 'Your deposit could not be completed. Please try again later.',
        type: 'SERVICE_UNAVAILABLE_EXCEPTION',
        statusCode: 503,
      });
    });

    it('should allow transactions when external account status is pending_disconnect', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const externalAccountPendingDisconnect = {
        ...mockExternalAccount,
        status: 'pending_disconnect', // Should be allowed for transactions
        linked_access_token: 'access-token-123',
        linked_account_ref: 'account-ref-123',
      };

      const mockSignalResponse = {
        ruleset: { result: 'ACCEPT', rulesetKey: 'test-ruleset' },
        requestRef: 'req-123',
        scores: {
          bankInitiatedReturnRisk: 0.1,
          customerInitiatedReturnRisk: 0.2,
        },
      };

      const mockQuoteResponse = {
        quoteRef: 'quote-ref-123',
        amount: '100',
      };

      const mockWallet = { id: 'wallet-123', balance: 0 };
      const mockTransaction = { id: 'transaction-123' };
      const mockFiatWalletTransaction = { id: 'fwt-123' };

      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccountPendingDisconnect);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockExternalAccountAdapter.evaluateRiskSignal.mockResolvedValue(mockSignalResponse);
      mockExternalAccountAdapter.requestQuote.mockResolvedValue(mockQuoteResponse);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockWallet);
      mockTransactionService.create.mockResolvedValue(mockTransaction);
      mockFiatWalletTransactionService.create.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionService.updateStatus.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.PROCESSING,
      });
      mockTransactionMonitoringService.monitorDeposit.mockResolvedValue({
        reviewAnswer: 'GREEN',
        reviewStatus: 'completed',
      });

      // Act
      const result = await service.deposit(mockUser, fundRequest);

      // Assert
      expect(result.status).toBe('processing');
      expect(mockExternalAccountAdapter.evaluateRiskSignal).toHaveBeenCalled();
    });

    it('should throw BadRequestException when external account status is ITEM_LOGIN_REQUIRED', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const externalAccountLoginRequired = {
        ...mockExternalAccount,
        status: ExternalAccountStatus.ITEM_LOGIN_REQUIRED, // Should be blocked for transactions
        linked_access_token: 'access-token-123',
        linked_account_ref: 'account-ref-123',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccountLoginRequired);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);

      // Act & Assert
      await expect(service.deposit(mockUser, fundRequest)).rejects.toThrow(
        new BadRequestException(
          'Account is not available for transactions. Status: item_login_required. Please reconnect your bank account.',
        ),
      );
    });

    it('should return failed status for REVIEW signal result', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const mockSignalResponse = {
        ruleset: { result: 'REVIEW', rulesetKey: 'test-ruleset' },
        requestRef: 'req-123',
        scores: {
          bankInitiatedReturnRisk: 0.8,
          customerInitiatedReturnRisk: 0.9,
        },
      };

      const mockQuoteResponse = {
        quoteRef: 'quote-ref-123',
        amount: '100',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockExternalAccountAdapter.evaluateRiskSignal.mockResolvedValue(mockSignalResponse);
      mockExternalAccountAdapter.requestQuote.mockResolvedValue(mockQuoteResponse);

      // Act
      const result = await service.deposit(mockUser, fundRequest);

      // Assert
      expect(result.status).toBe('failed');
      expect(result.message).toBe('Fund request declined');
    });

    it('should throw LimitExceededException when single transaction limit is exceeded', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 5000, // $50 in cents - lower than request amount
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);

      // Mock validateLimit to throw the expected exception
      const limitException = new (class extends Error {
        type = 'TRANSACTION_LIMIT_EXCEEDED_EXCEPTION';
        statusCode = 400;
      })();
      mockTierService.validateLimit.mockRejectedValue(limitException);

      // Act & Assert
      await expect(service.deposit(mockUser, fundRequest)).rejects.toMatchObject({
        type: 'TRANSACTION_LIMIT_EXCEEDED_EXCEPTION',
        statusCode: 400,
      });
    });

    it('should throw LimitExceededException when daily limit is exceeded', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000, // $1000 in cents
            maximum_daily_deposit: 5000, // $50 in cents - lower than current daily sum + request
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      // Mock transaction sums that would exceed daily limit
      mockTransactionSumService.getPastOneDayTransactionSum.mockResolvedValue({
        transactionTypeTotals: {
          deposit: { totalSum: 1000, totalCount: 1 }, // $10 existing
        },
        status: 'completed',
        startDate: new Date(),
        endDate: new Date(),
        userId: 'user-123',
        asset: 'USD',
      });
      mockTransactionSumService.getPastOneWeekTransactionSum.mockResolvedValue({
        transactionTypeTotals: {},
        status: 'completed',
        startDate: new Date(),
        endDate: new Date(),
        userId: 'user-123',
        asset: 'USD',
      });
      mockTransactionSumService.getPastOneMonthTransactionSum.mockResolvedValue({
        transactionTypeTotals: {},
        status: 'completed',
        startDate: new Date(),
        endDate: new Date(),
        userId: 'user-123',
        asset: 'USD',
      });
      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);

      // Mock validateLimit to throw the expected exception
      const limitException = new (class extends Error {
        type = 'DAILY_LIMIT_EXCEEDED_EXCEPTION';
        statusCode = 400;
      })();
      mockTierService.validateLimit.mockRejectedValue(limitException);

      // Act & Assert
      await expect(service.deposit(mockUser, fundRequest)).rejects.toMatchObject({
        type: 'DAILY_LIMIT_EXCEEDED_EXCEPTION',
        statusCode: 400,
      });
    });

    it('should throw BadRequestException when user has no tier configuration', async () => {
      // Arrange
      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(null);
      mockTierService.validateLimit.mockRejectedValue(new BadRequestException('User tier configuration not found'));

      // Act & Assert
      await expect(service.deposit(mockUser, fundRequest)).rejects.toThrow(
        new BadRequestException('User tier configuration not found'),
      );
    });

    it('should throw BadRequestException when US tier configuration is not found', async () => {
      // Arrange - tier with only NGN config, no US config
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yivgg0002w5micmvagf84', // NGN country ID, no US
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockTierService.validateLimit.mockRejectedValue(new BadRequestException('User tier configuration not found'));

      // Act & Assert
      await expect(service.deposit(mockUser, fundRequest)).rejects.toThrow(
        new BadRequestException('User tier configuration not found'),
      );
    });

    it('should throw BadRequestException when US country is not found', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockCountryRepository.findOne.mockResolvedValue(null); // US country not found
      mockTierService.validateLimit.mockRejectedValue(
        new BadRequestException('Country configuration not found for currency: USD'),
      );

      // Act & Assert
      await expect(service.deposit(mockUser, fundRequest)).rejects.toThrow(
        new BadRequestException('Country configuration not found for currency: USD'),
      );
    });

    it('should throw ConflictException when user has existing PENDING deposit transaction', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const existingTransaction = {
        id: 'existing-txn-123',
        user_id: 'user-123',
        transaction_type: FiatWalletTransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockTierService.validateLimit.mockResolvedValue(undefined);

      // Mock the repository query chain to return existing transaction
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingTransaction),
      };
      (service as any).fiatWalletTransactionRepository.query = jest.fn(() => mockQuery);

      // Act & Assert
      await expect(service.deposit(mockUser, fundRequest)).rejects.toThrow(ConflictException);
      await expect(service.deposit(mockUser, fundRequest)).rejects.toThrow(
        'You already have a pending transaction for this account. Please wait for it to complete.',
      );
    });

    it('should throw ConflictException when user has existing PROCESSING deposit transaction', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const existingTransaction = {
        id: 'existing-txn-123',
        user_id: 'user-123',
        transaction_type: FiatWalletTransactionType.DEPOSIT,
        status: TransactionStatus.PROCESSING,
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockTierService.validateLimit.mockResolvedValue(undefined);

      // Mock the repository query chain to return existing transaction
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingTransaction),
      };
      (service as any).fiatWalletTransactionRepository.query = jest.fn(() => mockQuery);

      // Act & Assert
      await expect(service.deposit(mockUser, fundRequest)).rejects.toThrow(ConflictException);
      await expect(service.deposit(mockUser, fundRequest)).rejects.toThrow(
        'You already have a pending transaction for this account. Please wait for it to complete.',
      );
    });

    it('should throw ConflictException when user has existing INITIATED deposit transaction', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const existingTransaction = {
        id: 'existing-txn-123',
        user_id: 'user-123',
        transaction_type: FiatWalletTransactionType.DEPOSIT,
        status: TransactionStatus.INITIATED,
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockTierService.validateLimit.mockResolvedValue(undefined);

      // Mock the repository query chain to return existing transaction
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingTransaction),
      };
      (service as any).fiatWalletTransactionRepository.query = jest.fn(() => mockQuery);

      // Act & Assert
      await expect(service.deposit(mockUser, fundRequest)).rejects.toThrow(ConflictException);
      await expect(service.deposit(mockUser, fundRequest)).rejects.toThrow(
        'You already have a pending transaction for this account. Please wait for it to complete.',
      );
    });

    it('should throw ConflictException when user has existing REVIEW deposit transaction', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const existingTransaction = {
        id: 'existing-txn-123',
        user_id: 'user-123',
        transaction_type: FiatWalletTransactionType.DEPOSIT,
        status: TransactionStatus.REVIEW,
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockTierService.validateLimit.mockResolvedValue(undefined);

      // Mock the repository query chain to return existing transaction
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingTransaction),
      };
      (service as any).fiatWalletTransactionRepository.query = jest.fn(() => mockQuery);

      // Act & Assert
      await expect(service.deposit(mockUser, fundRequest)).rejects.toThrow(ConflictException);
      await expect(service.deposit(mockUser, fundRequest)).rejects.toThrow(
        'You already have a pending transaction for this account. Please wait for it to complete.',
      );
    });

    it('should allow deposit when user has existing COMPLETED deposit transaction', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockTierService.validateLimit.mockResolvedValue(undefined);

      // Mock the repository query chain to return null (COMPLETED transactions shouldn't block)
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      };
      (service as any).fiatWalletTransactionRepository.query = jest.fn(() => mockQuery);

      mockExternalAccountAdapter.evaluateRiskSignal.mockResolvedValue({
        ruleset: { result: 'ACCEPT', rulesetKey: 'test' },
        requestRef: 'req-123',
        scores: { bankInitiatedReturnRisk: 0.1, customerInitiatedReturnRisk: 0.2 },
      });
      mockExternalAccountAdapter.requestQuote.mockResolvedValue({ quoteRef: 'quote-123', amount: '100' });
      mockFiatWalletService.getUserWallet.mockResolvedValue({ id: 'wallet-123', balance: 0 });
      mockTransactionService.create.mockResolvedValue({ id: 'txn-123' });
      mockFiatWalletTransactionService.create.mockResolvedValue({ id: 'fwt-123' });
      mockTransactionService.updateStatus.mockResolvedValue({ id: 'txn-123', status: TransactionStatus.PROCESSING });
      mockExecuteWalletProcessor.queueExecuteWalletTransaction.mockResolvedValue({ id: 'job-123' });
      mockTransactionMonitoringService.monitorDeposit.mockResolvedValue({
        reviewAnswer: 'GREEN',
        reviewStatus: 'completed',
      });

      // Act
      const result = await service.deposit(mockUser, fundRequest);

      // Assert - should not throw, transaction should proceed
      expect(result.status).toBe('processing');
    });

    it('should allow deposit when user has existing FAILED deposit transaction', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockTierService.validateLimit.mockResolvedValue(undefined);

      // Mock the repository query chain to return null (FAILED transactions shouldn't block)
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      };
      (service as any).fiatWalletTransactionRepository.query = jest.fn(() => mockQuery);

      mockExternalAccountAdapter.evaluateRiskSignal.mockResolvedValue({
        ruleset: { result: 'ACCEPT', rulesetKey: 'test' },
        requestRef: 'req-123',
        scores: { bankInitiatedReturnRisk: 0.1, customerInitiatedReturnRisk: 0.2 },
      });
      mockExternalAccountAdapter.requestQuote.mockResolvedValue({ quoteRef: 'quote-123', amount: '100' });
      mockFiatWalletService.getUserWallet.mockResolvedValue({ id: 'wallet-123', balance: 0 });
      mockTransactionService.create.mockResolvedValue({ id: 'txn-123' });
      mockFiatWalletTransactionService.create.mockResolvedValue({ id: 'fwt-123' });
      mockTransactionService.updateStatus.mockResolvedValue({ id: 'txn-123', status: TransactionStatus.PROCESSING });
      mockExecuteWalletProcessor.queueExecuteWalletTransaction.mockResolvedValue({ id: 'job-123' });
      mockTransactionMonitoringService.monitorDeposit.mockResolvedValue({
        reviewAnswer: 'GREEN',
        reviewStatus: 'completed',
      });

      // Act
      const result = await service.deposit(mockUser, fundRequest);

      // Assert - should not throw, transaction should proceed
      expect(result.status).toBe('processing');
    });
  });

  describe('getExternalAccountForTransaction', () => {
    it('should return external account when provider_kyc_status is approved', async () => {
      const mockExternalAccount = {
        id: 'ext-account-123',
        user_id: 'user-123',
        provider: 'zerohash',
        participant_code: 'PARTICIPANT123',
        provider_kyc_status: 'approved',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);

      const result = await service.getExternalAccountForTransaction('user-123', 'zerohash');

      expect(result).toEqual(mockExternalAccount);
      expect(mockExternalAccountRepository.findOne).toHaveBeenCalledWith({
        user_id: 'user-123',
        provider: 'zerohash',
      });
    });

    it('should throw NotFoundException when external account not found', async () => {
      mockExternalAccountRepository.findOne.mockResolvedValue(null);

      await expect(service.getExternalAccountForTransaction('user-123', 'zerohash')).rejects.toThrow(
        new NotFoundException('External account not found. Please complete your account setup.'),
      );
    });

    it('should throw BadRequestException when participant_code is missing', async () => {
      const mockExternalAccount = {
        id: 'ext-account-123',
        user_id: 'user-123',
        provider: 'zerohash',
        participant_code: null,
        provider_kyc_status: 'approved',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);

      await expect(service.getExternalAccountForTransaction('user-123', 'zerohash')).rejects.toThrow(
        new BadRequestException('External account is not properly configured.'),
      );
    });

    it('should throw ExternalAccountKycException when provider_kyc_status is submitted', async () => {
      const mockExternalAccount = {
        id: 'ext-account-123',
        user_id: 'user-123',
        provider: 'zerohash',
        participant_code: 'PARTICIPANT123',
        provider_kyc_status: 'submitted',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);

      try {
        await service.getExternalAccountForTransaction('user-123', 'zerohash');
        fail('Expected ExternalAccountKycException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ExternalAccountKycException);
      }
    });

    it('should throw ExternalAccountKycException when provider_kyc_status is rejected', async () => {
      const mockExternalAccount = {
        id: 'ext-account-123',
        user_id: 'user-123',
        provider: 'zerohash',
        participant_code: 'PARTICIPANT123',
        provider_kyc_status: 'rejected',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);

      try {
        await service.getExternalAccountForTransaction('user-123', 'zerohash');
        fail('Expected ExternalAccountKycException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ExternalAccountKycException);
      }
    });

    it('should throw ExternalAccountKycException when provider_kyc_status is pending', async () => {
      const mockExternalAccount = {
        id: 'ext-account-123',
        user_id: 'user-123',
        provider: 'zerohash',
        participant_code: 'PARTICIPANT123',
        provider_kyc_status: 'pending',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);

      try {
        await service.getExternalAccountForTransaction('user-123', 'zerohash');
        fail('Expected ExternalAccountKycException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ExternalAccountKycException);
      }
    });

    it('should throw ExternalAccountKycException when provider_kyc_status is null', async () => {
      const mockExternalAccount = {
        id: 'ext-account-123',
        user_id: 'user-123',
        provider: 'zerohash',
        participant_code: 'PARTICIPANT123',
        provider_kyc_status: null,
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);

      try {
        await service.getExternalAccountForTransaction('user-123', 'zerohash');
        fail('Expected ExternalAccountKycException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ExternalAccountKycException);
      }
    });

    it('should throw ExternalAccountKycException when provider_kyc_status is missing', async () => {
      const mockExternalAccount = {
        id: 'ext-account-123',
        user_id: 'user-123',
        provider: 'zerohash',
        participant_code: 'PARTICIPANT123',
        // provider_kyc_status not set at all
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount as any);

      try {
        await service.getExternalAccountForTransaction('user-123', 'zerohash');
        fail('Expected ExternalAccountKycException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ExternalAccountKycException);
      }
    });

    it('should handle provider_kyc_status case-insensitively (APPROVED)', async () => {
      const mockExternalAccount = {
        id: 'ext-account-123',
        user_id: 'user-123',
        provider: 'zerohash',
        participant_code: 'PARTICIPANT123',
        provider_kyc_status: 'APPROVED',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);

      const result = await service.getExternalAccountForTransaction('user-123', 'zerohash');

      expect(result).toEqual(mockExternalAccount);
    });
  });

  describe('withdraw', () => {
    const withdrawRequest = {
      external_account_id: 'external-account-123',
      currency: 'USD',
      amount: 50.0,
      description: 'Test withdrawal',
      transfer_type: 'CREDIT' as any,
    };

    beforeEach(() => {
      // Setup mocks for withdraw method
      mockExternalAccountAdapter.requestQuote = jest.fn();
      mockTransactionService.create = jest.fn();
      mockFiatWalletTransactionService.create = jest.fn();
      mockTransactionService.updateStatus = jest.fn();
    });

    it('should throw BadRequestException when external account status is not approved or pending_disconnect', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const externalAccountNotApproved = {
        ...mockExternalAccount,
        status: 'pending', // Not approved or pending_disconnect
        linked_access_token: 'access-token-123',
        linked_account_ref: 'account-ref-123',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccountNotApproved);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);

      // Act & Assert
      await expect(service.withdraw(mockUser, withdrawRequest)).rejects.toThrow(
        new BadRequestException(
          'Account is not available for transactions. Status: pending. Please reconnect your bank account.',
        ),
      );
    });

    it('should throw BadRequestException when external account status is ITEM_LOGIN_REQUIRED', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const externalAccountLoginRequired = {
        ...mockExternalAccount,
        status: ExternalAccountStatus.ITEM_LOGIN_REQUIRED, // Should be blocked for transactions
        linked_access_token: 'access-token-123',
        linked_account_ref: 'account-ref-123',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccountLoginRequired);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);

      // Act & Assert
      await expect(service.withdraw(mockUser, withdrawRequest)).rejects.toThrow(
        new BadRequestException(
          'Account is not available for transactions. Status: item_login_required. Please reconnect your bank account.',
        ),
      );
    });

    it('should throw ExternalAccountKycException when provider_kyc_status is not approved', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const externalAccountNotApprovedKyc = {
        ...mockExternalAccount,
        provider_kyc_status: 'rejected', // Not approved
        status: 'approved',
        linked_access_token: 'access-token-123',
        linked_account_ref: 'account-ref-123',
      };

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      };

      (service as any).fiatWalletTransactionRepository.query = jest.fn(() => mockQuery);
      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccountNotApprovedKyc);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);

      // Act & Assert
      try {
        await service.withdraw(mockUser, withdrawRequest);
        fail('Expected ExternalAccountKycException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ExternalAccountKycException);
      }
    });

    it('should throw BadRequestException when account is not linked', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const unlinkedAccount = {
        ...mockExternalAccount,
        linked_access_token: null,
        linked_account_ref: null,
      };
      mockExternalAccountRepository.findOne.mockResolvedValue(unlinkedAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);

      // Act & Assert
      await expect(service.withdraw(mockUser, withdrawRequest)).rejects.toThrow(
        new BadRequestException('Account is not linked'),
      );
    });

    it('should throw LimitExceededException when withdrawal single transaction limit is exceeded', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 500000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
            minimum_per_withdrawal: 100,
            maximum_per_withdrawal: 1000, // $10 in cents - lower than withdrawal request amount
            maximum_daily_withdrawal: 500000,
            maximum_weekly_withdrawal: 2000000,
            maximum_monthly_withdrawal: 10000000,
          },
        ],
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);

      // Mock validateLimit to throw the expected exception
      const limitException = new (class extends Error {
        type = 'TRANSACTION_LIMIT_EXCEEDED_EXCEPTION';
        statusCode = 400;
      })();
      mockTierService.validateLimit.mockRejectedValue(limitException);

      // Act & Assert
      await expect(service.withdraw(mockUser, withdrawRequest)).rejects.toMatchObject({
        type: 'TRANSACTION_LIMIT_EXCEEDED_EXCEPTION',
        statusCode: 400,
      });
    });

    it('should throw LimitExceededException when withdrawal daily limit is exceeded', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
            minimum_per_withdrawal: 100,
            maximum_per_withdrawal: 100000, // $1000 in cents
            maximum_daily_withdrawal: 1000, // $10 in cents - lower than current daily sum + request
            maximum_weekly_withdrawal: 2000000,
            maximum_monthly_withdrawal: 10000000,
          },
        ],
      };

      // Mock transaction sums that would exceed daily limit
      mockTransactionSumService.getPastOneDayTransactionSum.mockResolvedValue({
        transactionTypeTotals: {
          withdrawal: { totalSum: 500, totalCount: 1 }, // $5 existing
        },
        status: 'completed',
        startDate: new Date(),
        endDate: new Date(),
        userId: 'user-123',
        asset: 'USD',
      });
      mockTransactionSumService.getPastOneWeekTransactionSum.mockResolvedValue({
        transactionTypeTotals: {},
        status: 'completed',
        startDate: new Date(),
        endDate: new Date(),
        userId: 'user-123',
        asset: 'USD',
      });
      mockTransactionSumService.getPastOneMonthTransactionSum.mockResolvedValue({
        transactionTypeTotals: {},
        status: 'completed',
        startDate: new Date(),
        endDate: new Date(),
        userId: 'user-123',
        asset: 'USD',
      });
      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);

      // Mock validateLimit to throw the expected exception
      const limitException = new (class extends Error {
        type = 'DAILY_LIMIT_EXCEEDED_EXCEPTION';
        statusCode = 400;
      })();
      mockTierService.validateLimit.mockRejectedValue(limitException);

      // Act & Assert
      await expect(service.withdraw(mockUser, withdrawRequest)).rejects.toMatchObject({
        type: 'DAILY_LIMIT_EXCEEDED_EXCEPTION',
        statusCode: 400,
      });
    });

    it('should throw ConflictException when user has existing PENDING withdrawal transaction', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const existingTransaction = {
        id: 'existing-txn-123',
        user_id: 'user-123',
        transaction_type: FiatWalletTransactionType.WITHDRAWAL,
        status: TransactionStatus.PENDING,
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockTierService.validateLimit.mockResolvedValue(undefined);

      // Mock the repository query chain to return existing transaction
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingTransaction),
      };
      (service as any).fiatWalletTransactionRepository.query = jest.fn(() => mockQuery);

      // Act & Assert
      await expect(service.withdraw(mockUser, withdrawRequest)).rejects.toThrow(ConflictException);
      await expect(service.withdraw(mockUser, withdrawRequest)).rejects.toThrow(
        'You already have a pending transaction for this account. Please wait for it to complete.',
      );
    });

    it('should throw ConflictException when user has existing PROCESSING withdrawal transaction', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const existingTransaction = {
        id: 'existing-txn-123',
        user_id: 'user-123',
        transaction_type: FiatWalletTransactionType.WITHDRAWAL,
        status: TransactionStatus.PROCESSING,
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockTierService.validateLimit.mockResolvedValue(undefined);

      // Mock the repository query chain to return existing transaction
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingTransaction),
      };
      (service as any).fiatWalletTransactionRepository.query = jest.fn(() => mockQuery);

      // Act & Assert
      await expect(service.withdraw(mockUser, withdrawRequest)).rejects.toThrow(ConflictException);
      await expect(service.withdraw(mockUser, withdrawRequest)).rejects.toThrow(
        'You already have a pending transaction for this account. Please wait for it to complete.',
      );
    });

    it('should throw ConflictException when user has existing INITIATED withdrawal transaction', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const existingTransaction = {
        id: 'existing-txn-123',
        user_id: 'user-123',
        transaction_type: FiatWalletTransactionType.WITHDRAWAL,
        status: TransactionStatus.INITIATED,
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockTierService.validateLimit.mockResolvedValue(undefined);

      // Mock the repository query chain to return existing transaction
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingTransaction),
      };
      (service as any).fiatWalletTransactionRepository.query = jest.fn(() => mockQuery);

      // Act & Assert
      await expect(service.withdraw(mockUser, withdrawRequest)).rejects.toThrow(ConflictException);
      await expect(service.withdraw(mockUser, withdrawRequest)).rejects.toThrow(
        'You already have a pending transaction for this account. Please wait for it to complete.',
      );
    });

    it('should throw ConflictException when user has existing REVIEW withdrawal transaction', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
          },
        ],
      };

      const existingTransaction = {
        id: 'existing-txn-123',
        user_id: 'user-123',
        transaction_type: FiatWalletTransactionType.WITHDRAWAL,
        status: TransactionStatus.REVIEW,
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockTierService.validateLimit.mockResolvedValue(undefined);

      // Mock the repository query chain to return existing transaction
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingTransaction),
      };
      (service as any).fiatWalletTransactionRepository.query = jest.fn(() => mockQuery);

      // Act & Assert
      await expect(service.withdraw(mockUser, withdrawRequest)).rejects.toThrow(ConflictException);
      await expect(service.withdraw(mockUser, withdrawRequest)).rejects.toThrow(
        'You already have a pending transaction for this account. Please wait for it to complete.',
      );
    });

    it('should allow withdrawal when user has existing COMPLETED withdrawal transaction', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
            minimum_per_withdrawal: 100,
            maximum_per_withdrawal: 100000,
            maximum_daily_withdrawal: 500000,
            maximum_weekly_withdrawal: 2000000,
            maximum_monthly_withdrawal: 10000000,
          },
        ],
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockTierService.validateLimit.mockResolvedValue(undefined);

      // Mock the repository query chain to return null (COMPLETED transactions shouldn't block)
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      };
      (service as any).fiatWalletTransactionRepository.query = jest.fn(() => mockQuery);

      mockExternalAccountAdapter.requestQuote.mockResolvedValue({ quoteRef: 'quote-123', amount: '50' });
      mockFiatWalletService.getUserWallet.mockResolvedValue({ id: 'wallet-123', balance: 10000 });
      mockTransactionService.create.mockResolvedValue({ id: 'txn-123' });
      mockFiatWalletTransactionService.create.mockResolvedValue({ id: 'fwt-123' });
      mockTransactionService.updateStatus.mockResolvedValue({ id: 'txn-123', status: TransactionStatus.PROCESSING });
      mockExecuteWalletProcessor.queueExecuteWalletTransaction.mockResolvedValue({ id: 'job-123' });

      // Act
      const result = await service.withdraw(mockUser, withdrawRequest);

      // Assert - should not throw, transaction should proceed
      expect(result.status).toBe('processing');
    });

    it('should allow withdrawal when user has existing FAILED withdrawal transaction', async () => {
      // Arrange
      const mockTier = {
        level: 2,
        tierConfigs: [
          {
            id: 'tier-config-123',
            country_id: 'cma6yirpc0000w5mi97kv1ffo',
            maximum_per_deposit: 100000,
            maximum_daily_deposit: 500000,
            maximum_weekly_deposit: 2000000,
            maximum_monthly_deposit: 10000000,
            minimum_per_withdrawal: 100,
            maximum_per_withdrawal: 100000,
            maximum_daily_withdrawal: 500000,
            maximum_weekly_withdrawal: 2000000,
            maximum_monthly_withdrawal: 10000000,
          },
        ],
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount);
      mockTierService.getUserCurrentTier.mockResolvedValue(mockTier);
      mockTierService.validateLimit.mockResolvedValue(undefined);

      // Mock the repository query chain to return null (FAILED transactions shouldn't block)
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      };
      (service as any).fiatWalletTransactionRepository.query = jest.fn(() => mockQuery);

      mockExternalAccountAdapter.requestQuote.mockResolvedValue({ quoteRef: 'quote-123', amount: '50' });
      mockFiatWalletService.getUserWallet.mockResolvedValue({ id: 'wallet-123', balance: 10000 });
      mockTransactionService.create.mockResolvedValue({ id: 'txn-123' });
      mockFiatWalletTransactionService.create.mockResolvedValue({ id: 'fwt-123' });
      mockTransactionService.updateStatus.mockResolvedValue({ id: 'txn-123', status: TransactionStatus.PROCESSING });
      mockExecuteWalletProcessor.queueExecuteWalletTransaction.mockResolvedValue({ id: 'job-123' });

      // Act
      const result = await service.withdraw(mockUser, withdrawRequest);

      // Assert - should not throw, transaction should proceed
      expect(result.status).toBe('processing');
    });
  });

  describe('getLinkTokenUpdate', () => {
    let mockRedisCacheService: any;
    const user = { id: 'user-123' } as UserModel;

    beforeEach(() => {
      mockRedisCacheService = {
        get: jest.fn(),
        set: jest.fn(),
      };

      // Add redis service to the existing mocks
      (service as any).redisCacheService = mockRedisCacheService;
    });

    it('should return cached token when Redis has valid token', async () => {
      const cachedData = {
        token: 'cached-link-token',
        expiration: '2024-01-01T12:00:00Z',
        requestRef: 'cached-ref-123',
      };

      mockRedisCacheService.get.mockResolvedValue(cachedData);

      const result = await service.getLinkTokenUpdate(user);

      expect(mockRedisCacheService.get).toHaveBeenCalledWith('link_token_update:user-123:plaid');
      expect(result).toEqual({
        token: 'cached-link-token',
        expiration: '2024-01-01T12:00:00Z',
        requestRef: 'cached-ref-123',
      });
      expect(mockLinkBankAccountAdapter.createLinkToken).not.toHaveBeenCalled();
    });

    it('should create new token when no cache exists', async () => {
      mockRedisCacheService.get.mockResolvedValue(null);

      // Mock existing external account via repository
      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-123',
        user_id: 'user-123',
        linked_provider: 'plaid',
        linked_access_token: 'existing-access-token',
        linked_item_ref: 'item-123',
        status: ExternalAccountStatus.PENDING_DISCONNECT, // Allowed for updates
      });

      const newTokenResponse = {
        token: 'new-link-token',
        expiration: '2024-01-01T13:00:00Z',
        requestRef: 'new-ref-456',
      };

      mockLinkBankAccountAdapter.createLinkToken.mockResolvedValue(newTokenResponse);

      const result = await service.getLinkTokenUpdate(user);

      expect(mockExternalAccountRepository.findOne).toHaveBeenCalledWith({
        user_id: 'user-123',
        linked_provider: 'plaid',
      });

      expect(mockLinkBankAccountAdapter.createLinkToken).toHaveBeenCalledWith(
        {
          clientName: 'OneDosh',
          language: 'en',
          user: {
            userRef: 'user-123',
          },
          accessToken: 'existing-access-token',
        },
        'US',
      );

      expect(mockRedisCacheService.set).toHaveBeenCalledWith(
        'link_token_update:user-123:plaid',
        {
          token: 'new-link-token',
          expiration: '2024-01-01T13:00:00Z',
          requestRef: 'new-ref-456',
          externalAccountId: 'ext-123',
          itemId: 'item-123',
          createdAt: expect.any(String),
        },
        3600,
      );

      expect(result).toEqual(newTokenResponse);
    });

    it('should throw NotFoundException when no Plaid account exists', async () => {
      mockRedisCacheService.get.mockResolvedValue(null);

      mockExternalAccountRepository.findOne.mockResolvedValue(null);

      await expect(service.getLinkTokenUpdate(user)).rejects.toThrow(
        new NotFoundException('External account not found'),
      );

      expect(mockExternalAccountRepository.findOne).toHaveBeenCalledWith({
        user_id: 'user-123',
        linked_provider: 'plaid',
      });
      expect(mockLinkBankAccountAdapter.createLinkToken).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when Plaid account has no access token', async () => {
      mockRedisCacheService.get.mockResolvedValue(null);

      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-123',
        user_id: 'user-123',
        linked_provider: 'plaid',
        linked_access_token: null, // No access token
        status: 'pending',
      });

      await expect(service.getLinkTokenUpdate(user)).rejects.toThrow(
        new NotFoundException('No Plaid external account found that requires updating'),
      );

      expect(mockLinkBankAccountAdapter.createLinkToken).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when account status does not allow updates', async () => {
      mockRedisCacheService.get.mockResolvedValue(null);

      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-123',
        user_id: 'user-123',
        linked_provider: 'plaid',
        linked_access_token: 'existing-access-token',
        status: 'approved', // Not in allowed update statuses
      });

      await expect(service.getLinkTokenUpdate(user)).rejects.toThrow(
        new BadRequestException(
          "Bank account with status 'approved' cannot be updated. Please contact support or unlink the account and relink a new account.",
        ),
      );

      expect(mockLinkBankAccountAdapter.createLinkToken).not.toHaveBeenCalled();
    });

    it('should allow updates for PENDING_DISCONNECT status', async () => {
      mockRedisCacheService.get.mockResolvedValue(null);

      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-123',
        user_id: 'user-123',
        linked_provider: 'plaid',
        linked_access_token: 'existing-access-token',
        status: ExternalAccountStatus.PENDING_DISCONNECT,
      });

      mockLinkBankAccountAdapter.createLinkToken.mockResolvedValue({
        token: 'new-link-token',
        expiration: '2024-01-01T00:00:00Z',
        requestRef: 'req-123',
      });

      const result = await service.getLinkTokenUpdate(user);

      expect(result.token).toBe('new-link-token');
      expect(mockLinkBankAccountAdapter.createLinkToken).toHaveBeenCalled();
    });

    it('should allow updates for ITEM_LOGIN_REQUIRED status', async () => {
      mockRedisCacheService.get.mockResolvedValue(null);

      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-123',
        user_id: 'user-123',
        linked_provider: 'plaid',
        linked_access_token: 'existing-access-token',
        status: ExternalAccountStatus.ITEM_LOGIN_REQUIRED,
      });

      mockLinkBankAccountAdapter.createLinkToken.mockResolvedValue({
        token: 'new-link-token',
        expiration: '2024-01-01T00:00:00Z',
        requestRef: 'req-123',
      });

      const result = await service.getLinkTokenUpdate(user);

      expect(result.token).toBe('new-link-token');
      expect(mockLinkBankAccountAdapter.createLinkToken).toHaveBeenCalled();
    });

    it('should pass androidPackageName to adapter when provided', async () => {
      mockRedisCacheService.get.mockResolvedValue(null);
      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-123',
        user_id: 'user-123',
        linked_provider: 'plaid',
        linked_access_token: 'existing-access-token',
        status: 'pending_disconnect',
      });

      mockLinkBankAccountAdapter.createLinkToken.mockResolvedValue({
        token: 'new-link-token',
        expiration: '2024-01-01T00:00:00Z',
        requestRef: 'req-123',
      });

      const androidPackageName = 'com.onedosh.app';
      const result = await service.getLinkTokenUpdate(user, androidPackageName);

      expect(result.token).toBe('new-link-token');
      expect(mockLinkBankAccountAdapter.createLinkToken).toHaveBeenCalledWith(
        expect.objectContaining({
          androidPackageName: 'com.onedosh.app',
          accessToken: 'existing-access-token',
          user: { userRef: 'user-123' },
        }),
        'US',
      );
    });

    it('should handle createLinkToken adapter errors', async () => {
      mockRedisCacheService.get.mockResolvedValue(null);

      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-123',
        user_id: 'user-123',
        linked_provider: 'plaid',
        linked_access_token: 'existing-access-token',
        status: ExternalAccountStatus.ITEM_LOGIN_REQUIRED,
      });

      const adapterError = new Error('Plaid API Error');
      mockLinkBankAccountAdapter.createLinkToken.mockRejectedValue(adapterError);

      await expect(service.getLinkTokenUpdate(user)).rejects.toThrow(adapterError);

      expect(mockLinkBankAccountAdapter.createLinkToken).toHaveBeenCalled();
      expect(mockRedisCacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('createLinkToken', () => {
    const user = {
      id: 'user-123',
      country: { code: 'US' },
      $fetchGraph: jest.fn().mockResolvedValue({}),
      userProfile: { first_name: 'John', last_name: 'Doe' },
    } as unknown as UserModel;

    beforeEach(() => {
      mockTierService.getUserCurrentTier.mockResolvedValue({ level: 2 });
    });

    it('should throw BadRequestException when external account has PENDING_DISCONNECT status', async () => {
      // Arrange
      const externalAccountPendingDisconnect = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zerohash',
        participant_code: 'PARTICIPANT123',
        provider_kyc_status: 'approved',
        linked_provider: 'plaid',
        status: 'pending_disconnect',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccountPendingDisconnect);

      // Act & Assert
      await expect(service.createLinkToken(user)).rejects.toThrow(
        new BadRequestException(
          'Your bank account connection needs to be updated and will expire soon. Please update your account authorization to continue using your linked bank account.',
        ),
      );
    });

    it('should throw BadRequestException when external account has ITEM_LOGIN_REQUIRED status', async () => {
      // Arrange
      const externalAccountLoginRequired = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zerohash',
        participant_code: 'PARTICIPANT123',
        provider_kyc_status: 'approved',
        linked_provider: 'plaid',
        status: ExternalAccountStatus.ITEM_LOGIN_REQUIRED,
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccountLoginRequired);

      // Act & Assert
      await expect(service.createLinkToken(user)).rejects.toThrow(
        new BadRequestException(
          'Your bank account credentials have expired. Please update your account authorization or unlink your current account to add a new one.',
        ),
      );
    });

    it('should throw BadRequestException when external account is already approved', async () => {
      // Arrange
      const externalAccountApproved = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zerohash',
        participant_code: 'PARTICIPANT123',
        provider_kyc_status: 'approved',
        linked_provider: 'plaid',
        status: 'approved',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccountApproved);

      // Act & Assert
      await expect(service.createLinkToken(user)).rejects.toThrow(
        new BadRequestException(
          'You already have a linked account. Unlink it first to add a new one — only one account can be linked at a time.',
        ),
      );
    });
  });

  describe('unlinkBankAccount', () => {
    const user = { id: 'user-123', email: 'test@example.com' } as UserModel;
    let mockFiatWalletTransactionRepo: any;
    let mockRedisCacheService: any;

    beforeEach(() => {
      mockLinkBankAccountAdapter.unlinkAccount = jest.fn();
      mockLinkBankAccountAdapter.closeAccount = jest.fn();
      (service as any).update = jest.fn();
      (service as any).createDuplicateRecord = jest.fn();

      mockFiatWalletTransactionRepo = {
        query: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          whereIn: jest.fn().mockReturnThis(),
          whereNull: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null),
        }),
      };
      (service as any).fiatWalletTransactionRepository = mockFiatWalletTransactionRepo;

      mockRedisCacheService = {
        del: jest.fn(),
      };
      (service as any).redisCacheService = mockRedisCacheService;
    });

    it('should successfully unlink bank account', async () => {
      // Arrange
      const externalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        linked_provider: 'plaid',
        linked_access_token: 'access-token-123',
        external_account_ref: 'ext-ref-123',
        participant_code: 'PART123',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccount);
      mockLinkBankAccountAdapter.unlinkAccount.mockResolvedValue({
        requestRef: 'req-123',
        removed: true,
      });
      mockLinkBankAccountAdapter.closeAccount.mockResolvedValue({
        success: true,
      });

      // Act
      const result = await service.unlinkBankAccount(user);

      // Assert
      expect(mockExternalAccountRepository.findOne).toHaveBeenCalledWith({
        user_id: 'user-123',
        linked_provider: 'plaid',
      });
      expect(mockLinkBankAccountAdapter.unlinkAccount).toHaveBeenCalledWith({ accessToken: 'access-token-123' }, 'US');
      expect(mockLinkBankAccountAdapter.closeAccount).toHaveBeenCalledWith(
        {
          externalAccountRef: 'ext-ref-123',
          participantCode: 'PART123',
        },
        'US',
      );
      expect(result).toEqual({
        success: true,
        message: 'Bank account unlink initiated successfully',
      });
    });

    it('should call Plaid and ZeroHash to unlink account', async () => {
      // Arrange
      const externalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        linked_provider: 'plaid',
        linked_access_token: 'access-token-123',
        external_account_ref: 'ext-ref-123',
        participant_code: 'PART123',
        account_name: 'Checking Account',
        bank_name: 'Chase Bank',
        account_number: '1234',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccount);
      mockLinkBankAccountAdapter.unlinkAccount.mockResolvedValue({
        requestRef: 'req-123',
        removed: true,
      });
      mockLinkBankAccountAdapter.closeAccount.mockResolvedValue({ success: true });

      // Act
      await service.unlinkBankAccount(user);

      // Assert
      expect(mockLinkBankAccountAdapter.unlinkAccount).toHaveBeenCalledWith({ accessToken: 'access-token-123' }, 'US');
      expect(mockLinkBankAccountAdapter.closeAccount).toHaveBeenCalledWith(
        {
          externalAccountRef: 'ext-ref-123',
          participantCode: 'PART123',
        },
        'US',
      );
    });

    it('should throw NotFoundException when no linked bank account found', async () => {
      // Arrange
      mockExternalAccountRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.unlinkBankAccount(user)).rejects.toThrow(
        new NotFoundException('No linked bank account found to unlink'),
      );
    });

    it('should continue with ZeroHash close even if Plaid removal fails', async () => {
      // Arrange
      const externalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        linked_provider: 'plaid',
        linked_access_token: 'access-token-123',
        external_account_ref: 'ext-ref-123',
        participant_code: 'PART123',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccount);
      mockLinkBankAccountAdapter.unlinkAccount.mockRejectedValue(new Error('Plaid API Error'));
      mockLinkBankAccountAdapter.closeAccount.mockResolvedValue({ success: true });

      // Act
      const result = await service.unlinkBankAccount(user);

      // Assert
      expect(mockLinkBankAccountAdapter.closeAccount).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should throw BadRequestException when pending USD transactions exist', async () => {
      // Arrange
      const externalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        linked_provider: 'plaid',
        linked_access_token: 'access-token-123',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccount);
      mockFiatWalletTransactionRepo.query = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 'pending-txn-123', status: 'pending' }),
      });

      // Act & Assert
      await expect(service.unlinkBankAccount(user)).rejects.toThrow(
        new BadRequestException(
          'Cannot unlink bank account while you have pending or processing USD transactions. Please wait for them to complete.',
        ),
      );
    });

    it('should throw BadRequestException when processing USD transactions exist', async () => {
      // Arrange
      const externalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        linked_provider: 'plaid',
        linked_access_token: 'access-token-123',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccount);
      mockFiatWalletTransactionRepo.query = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 'processing-txn-123', status: 'processing' }),
      });

      // Act & Assert
      await expect(service.unlinkBankAccount(user)).rejects.toThrow(
        new BadRequestException(
          'Cannot unlink bank account while you have pending or processing USD transactions. Please wait for them to complete.',
        ),
      );
    });

    it('should throw error when ZeroHash closeAccount fails', async () => {
      // Arrange
      const externalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        linked_provider: 'plaid',
        linked_access_token: 'access-token-123',
        external_account_ref: 'ext-ref-123',
        participant_code: 'PART123',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccount);
      mockLinkBankAccountAdapter.unlinkAccount.mockResolvedValue({ removed: true });
      mockLinkBankAccountAdapter.closeAccount.mockRejectedValue(new Error('ZeroHash API Error'));

      // Act & Assert
      await expect(service.unlinkBankAccount(user)).rejects.toThrow('ZeroHash API Error');
    });

    it('should clear Redis cache for link token', async () => {
      // Arrange
      const externalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        linked_provider: 'plaid',
        linked_access_token: 'access-token-123',
        external_account_ref: 'ext-ref-123',
        participant_code: 'PART123',
      };

      mockExternalAccountRepository.findOne.mockResolvedValue(externalAccount);
      mockLinkBankAccountAdapter.unlinkAccount.mockResolvedValue({ removed: true });
      mockLinkBankAccountAdapter.closeAccount.mockResolvedValue({ success: true });

      // Act
      await service.unlinkBankAccount(user);

      // Assert
      expect(mockRedisCacheService.del).toHaveBeenCalledWith('link_token_update:user-123:plaid');
    });
  });

  describe('closeExternalAccount', () => {
    const externalAccountId = 'ext-123';
    const userId = 'user-123';

    beforeEach(() => {
      mockExternalAccountRepository.findById = jest.fn();
      mockUserService.findByUserId = jest.fn();
      (service as any).update = jest.fn();
      (service as any).delete = jest.fn();
      (service as any).createDuplicateRecord = jest.fn();
      (service as any).mailerService = { send: jest.fn() };
      (service as any).inAppNotificationService = { createNotification: jest.fn() };
    });

    it('should successfully close external account and send notifications', async () => {
      // Arrange
      const externalAccount = {
        id: externalAccountId,
        user_id: userId,
        account_name: 'Checking Account',
        bank_name: 'Chase Bank',
        account_number: '1234',
        account_type: 'checking',
      };

      const user = {
        id: userId,
        email: 'test@example.com',
      };

      mockExternalAccountRepository.findById.mockResolvedValue(externalAccount);
      mockUserService.findByUserId.mockResolvedValue(user);
      (service as any).update.mockResolvedValue({});
      (service as any).delete.mockResolvedValue({});
      (service as any).createDuplicateRecord.mockResolvedValue({});

      // Act
      await service.closeExternalAccount(externalAccountId);

      // Assert
      expect(mockExternalAccountRepository.findById).toHaveBeenCalledWith(externalAccountId);
      expect(mockUserService.findByUserId).toHaveBeenCalledWith(userId);
      expect((service as any).update).toHaveBeenCalledWith(
        { id: externalAccountId },
        {
          status: 'unlinked',
          linked_access_token: null,
          linked_processor_token: null,
          linked_item_ref: null,
          linked_account_ref: null,
          linked_provider: null,
          external_account_ref: null,
          participant_code: null,
          bank_ref: null,
          routing_number: null,
          nuban: null,
          swift_code: null,
          account_name: null,
          account_type: null,
          expiration_date: null,
          capabilities: null,
        },
      );
      expect((service as any).delete).toHaveBeenCalledWith({ id: externalAccountId });
      expect((service as any).createDuplicateRecord).toHaveBeenCalledWith(externalAccount);
      expect((service as any).mailerService.send).toHaveBeenCalled();
      expect((service as any).inAppNotificationService.createNotification).toHaveBeenCalled();
    });

    it('should throw NotFoundException when external account not found', async () => {
      // Arrange
      mockExternalAccountRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.closeExternalAccount(externalAccountId)).rejects.toThrow(
        new NotFoundException(`External account ${externalAccountId} not found`),
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      const externalAccount = {
        id: externalAccountId,
        user_id: userId,
      };

      mockExternalAccountRepository.findById.mockResolvedValue(externalAccount);
      mockUserService.findByUserId.mockResolvedValue(null);

      // Act & Assert
      await expect(service.closeExternalAccount(externalAccountId)).rejects.toThrow(
        new NotFoundException(`User ${userId} not found`),
      );
    });

    it('should continue even if email notification fails', async () => {
      // Arrange
      const externalAccount = {
        id: externalAccountId,
        user_id: userId,
        account_name: 'Checking Account',
        bank_name: 'Chase Bank',
        account_number: '1234',
        account_type: 'checking',
      };

      const user = {
        id: userId,
        email: 'test@example.com',
      };

      mockExternalAccountRepository.findById.mockResolvedValue(externalAccount);
      mockUserService.findByUserId.mockResolvedValue(user);
      (service as any).update.mockResolvedValue({});
      (service as any).delete.mockResolvedValue({});
      (service as any).createDuplicateRecord.mockResolvedValue({});
      (service as any).mailerService.send.mockRejectedValue(new Error('Email service error'));

      // Act
      await service.closeExternalAccount(externalAccountId);

      // Assert - should not throw
      expect((service as any).update).toHaveBeenCalled();
      expect((service as any).inAppNotificationService.createNotification).toHaveBeenCalled();
    });

    it('should continue even if in-app notification fails', async () => {
      // Arrange
      const externalAccount = {
        id: externalAccountId,
        user_id: userId,
        account_name: 'Checking Account',
        bank_name: 'Chase Bank',
        account_number: '1234',
        account_type: 'checking',
      };

      const user = {
        id: userId,
        email: 'test@example.com',
      };

      mockExternalAccountRepository.findById.mockResolvedValue(externalAccount);
      mockUserService.findByUserId.mockResolvedValue(user);
      (service as any).update.mockResolvedValue({});
      (service as any).delete.mockResolvedValue({});
      (service as any).createDuplicateRecord.mockResolvedValue({});
      (service as any).inAppNotificationService.createNotification.mockRejectedValue(
        new Error('Notification service error'),
      );

      // Act
      await service.closeExternalAccount(externalAccountId);

      // Assert - should not throw
      expect((service as any).update).toHaveBeenCalled();
      expect((service as any).mailerService.send).toHaveBeenCalled();
    });

    it('should preserve all data for auditing when closing', async () => {
      // Arrange
      const externalAccount = {
        id: externalAccountId,
        user_id: userId,
        account_name: 'Checking Account',
        bank_name: 'Chase Bank',
        account_number: '1234',
        account_type: 'checking',
        linked_access_token: 'token-123',
        linked_account_ref: 'ref-123',
      };

      const user = {
        id: userId,
        email: 'test@example.com',
      };

      mockExternalAccountRepository.findById.mockResolvedValue(externalAccount);
      mockUserService.findByUserId.mockResolvedValue(user);
      (service as any).update.mockResolvedValue({});
      (service as any).delete.mockResolvedValue({});
      (service as any).createDuplicateRecord.mockResolvedValue({});

      // Act
      await service.closeExternalAccount(externalAccountId);

      // Assert - update should change status and clear sensitive data
      expect((service as any).update).toHaveBeenCalledWith(
        { id: externalAccountId },
        {
          status: 'unlinked',
          linked_access_token: null,
          linked_processor_token: null,
          linked_item_ref: null,
          linked_account_ref: null,
          linked_provider: null,
          external_account_ref: null,
          participant_code: null,
          bank_ref: null,
          routing_number: null,
          nuban: null,
          swift_code: null,
          account_name: null,
          account_type: null,
          expiration_date: null,
          capabilities: null,
        },
      );
      // Verify that sensitive data is being cleared for security
      expect((service as any).update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          linked_access_token: null,
          linked_account_ref: null,
        }),
      );
    });
  });

  describe('createDuplicateRecord', () => {
    it('should create duplicate record with pending status', async () => {
      // Arrange
      const originalAccount = {
        id: 'original-123',
        user_id: 'user-123',
        participant_code: 'PARTICIPANT123',
        provider_kyc_status: 'approved',
        provider: 'zerohash',
      };

      const duplicateAccount = {
        id: 'duplicate-123',
        user_id: 'user-123',
        participant_code: 'PARTICIPANT123',
        provider_kyc_status: 'approved',
        status: 'pending',
        provider: 'zerohash',
      };

      (service as any).create = jest.fn().mockResolvedValue(duplicateAccount);

      // Act
      const result = await service.createDuplicateRecord(originalAccount as any);

      // Assert
      expect((service as any).create).toHaveBeenCalledWith({
        user_id: 'user-123',
        participant_code: 'PARTICIPANT123',
        provider_kyc_status: 'approved',
        status: 'pending',
        provider: 'zerohash',
      });
      expect(result).toEqual(duplicateAccount);
    });
  });
});

describe('ExternalAccountController', () => {
  let controller: ExternalAccountController;
  let service: ExternalAccountService;

  const mockAppLoggerService = {
    logInfo: jest.fn(),
    logError: jest.fn(),
    logUserAction: jest.fn(),
    setContext: jest.fn(),
    createChild: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ExternalAccountController],
      providers: [
        {
          provide: ExternalAccountService,
          useValue: {
            deposit: jest.fn(),
            withdraw: jest.fn(),
            createLinkToken: jest.fn(),
            getExternalAccounts: jest.fn(),
            getExternalAccount: jest.fn(),
            unlinkBankAccount: jest.fn(),
            getLinkTokenUpdate: jest.fn(),
          },
        },
        {
          provide: AppLoggerService,
          useValue: mockAppLoggerService,
        },
        {
          provide: LocationRestrictionService,
          useValue: {
            validateRegionalAccess: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(TransactionPinGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(ExternalAccountController);
    service = module.get(ExternalAccountService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fund', () => {
    it('should successfully fund and return CREATED status', async () => {
      const fundDto = {
        external_account_id: 'ext-account-id-123',
        currency: 'USD',
        amount: 100.0,
        description: 'Test funding',
        transfer_type: TransferType.DEBIT,
      };
      const user = { id: 'user-123' } as UserModel;
      const serviceResult = {
        status: 'processing',
        transactionRef: 'transaction-123',
        jobId: 'job-123',
        message: 'Transaction created and queued for processing',
      };

      (service.deposit as jest.Mock).mockResolvedValue(serviceResult);

      const result = await controller.fund(user, fundDto);

      expect(service.deposit).toHaveBeenCalledWith(user, fundDto);
      expect(result).toMatchObject({
        message: serviceResult.message,
        data: serviceResult,
        statusCode: HttpStatus.CREATED,
        timestamp: expect.any(String),
      });
    });

    it('should handle service errors and let them propagate', async () => {
      const fundDto = {
        external_account_id: 'ext-account-id-123',
        currency: 'USD',
        amount: 100.0,
        description: 'Test funding',
        transfer_type: TransferType.DEBIT,
      };
      const user = { id: 'user-123' } as UserModel;
      const error = new BadRequestException('Account is not linked');

      (service.deposit as jest.Mock).mockRejectedValue(error);

      await expect(controller.fund(user, fundDto)).rejects.toThrow(error);
      expect(service.deposit).toHaveBeenCalledWith(user, fundDto);
    });

    it('should successfully fund without description', async () => {
      const fundDto = {
        external_account_id: 'ext-account-id-123',
        currency: 'USD',
        amount: 100,
        transfer_type: TransferType.DEBIT,
      };
      const user = { id: 'user-123' } as UserModel;
      const serviceResult = {
        status: 'processing',
        transactionRef: 'transaction-123',
        jobId: 'job-123',
        message: 'Transaction created and queued for processing',
      };

      (service.deposit as jest.Mock).mockResolvedValue(serviceResult);

      const result = await controller.fund(user, fundDto as TransferDto);

      expect(service.deposit).toHaveBeenCalledWith(user, fundDto);
      expect(result).toMatchObject({
        message: serviceResult.message,
        data: serviceResult,
        statusCode: HttpStatus.CREATED,
        timestamp: expect.any(String),
      });
    });

    it('should successfully fund with empty description', async () => {
      const fundDto = {
        external_account_id: 'ext-account-id-123',
        currency: 'USD',
        amount: 100,
        description: '',
        transfer_type: TransferType.DEBIT,
      };
      const user = { id: 'user-123' } as UserModel;
      const serviceResult = {
        status: 'processing',
        transactionRef: 'transaction-123',
        jobId: 'job-123',
        message: 'Transaction created and queued for processing',
      };

      (service.deposit as jest.Mock).mockResolvedValue(serviceResult);

      const result = await controller.fund(user, fundDto);

      expect(service.deposit).toHaveBeenCalledWith(user, fundDto);
      expect(result).toMatchObject({
        message: serviceResult.message,
        data: serviceResult,
        statusCode: HttpStatus.CREATED,
        timestamp: expect.any(String),
      });
    });

    it('should successfully fund with undefined description', async () => {
      const fundDto = {
        external_account_id: 'ext-account-id-123',
        currency: 'USD',
        amount: 100,
        description: undefined,
        transfer_type: TransferType.DEBIT,
      };
      const user = { id: 'user-123' } as UserModel;
      const serviceResult = {
        status: 'processing',
        transactionRef: 'transaction-123',
        jobId: 'job-123',
        message: 'Transaction created and queued for processing',
      };

      (service.deposit as jest.Mock).mockResolvedValue(serviceResult);

      const result = await controller.fund(user, fundDto);

      expect(service.deposit).toHaveBeenCalledWith(user, fundDto);
      expect(result).toMatchObject({
        message: serviceResult.message,
        data: serviceResult,
        statusCode: HttpStatus.CREATED,
        timestamp: expect.any(String),
      });
    });
  });

  describe('unlinkBankAccount', () => {
    it('should successfully unlink bank account and return OK status', async () => {
      const user = { id: 'user-123' } as UserModel;
      const serviceResult = {
        success: true,
        message: 'Bank account unlinked successfully',
      };

      (service.unlinkBankAccount as jest.Mock).mockResolvedValue(serviceResult);

      const result = await controller.unlinkBankAccount(user);

      expect(service.unlinkBankAccount).toHaveBeenCalledWith(user);
      expect(result).toMatchObject({
        message: 'Bank account unlinked successfully',
        data: serviceResult,
        statusCode: HttpStatus.OK,
        timestamp: expect.any(String),
      });
    });

    it('should handle service errors and let them propagate', async () => {
      const user = { id: 'user-123' } as UserModel;
      const error = new NotFoundException('No linked bank account found to unlink');

      (service.unlinkBankAccount as jest.Mock).mockRejectedValue(error);

      await expect(controller.unlinkBankAccount(user)).rejects.toThrow(error);
      expect(service.unlinkBankAccount).toHaveBeenCalledWith(user);
    });
  });
});
