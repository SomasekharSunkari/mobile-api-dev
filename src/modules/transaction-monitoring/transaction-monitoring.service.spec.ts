import { Test, TestingModule } from '@nestjs/testing';
import { TransactionMonitoringAdapter } from '../../adapters/transaction-monitoring/transaction-monitoring-adapter';
import { CurrencyUtility } from '../../currencies/currencies';
import { UtilsService } from '../../utils/utils.service';
import { KycVerificationService } from '../auth/kycVerification/kycVerification.service';
import { LoginDeviceService } from '../auth/loginDevice/loginDevice.service';
import { LoginEventService } from '../auth/loginEvent/loginEvent.service';
import { UserService } from '../auth/user/user.service';
import { UserProfileService } from '../auth/userProfile/userProfile.service';
import { ExternalAccountRepository } from '../externalAccount/external-account.repository';
import { FiatWalletTransactionService } from '../fiatWalletTransactions/fiatWalletTransactions.service';
import { MonitorDepositRequest } from './transaction-monitoring.interface';
import { TransactionMonitoringService } from './transaction-monitoring.service';

describe('TransactionMonitoringService', () => {
  let service: TransactionMonitoringService;
  let mockTransactionMonitoringAdapter: jest.Mocked<TransactionMonitoringAdapter>;
  let mockUserService: jest.Mocked<UserService>;
  let mockUserProfileService: jest.Mocked<UserProfileService>;
  let mockLoginEventService: jest.Mocked<LoginEventService>;
  let mockLoginDeviceService: jest.Mocked<LoginDeviceService>;
  let mockKycVerificationService: jest.Mocked<KycVerificationService>;
  let mockFiatWalletTransactionService: jest.Mocked<FiatWalletTransactionService>;
  let mockExternalAccountRepository: jest.Mocked<ExternalAccountRepository>;

  const mockFiatWalletTransaction = {
    id: 'test-fiat-txn-id',
    user_id: 'test-user-id',
    amount: '3000', // in cents
    currency: 'USD',
    description: 'External account deposit',
    created_at: new Date('2025-09-25T02:41:37.000Z'),
  };

  const mockUser = {
    id: 'test-user-id',
    first_name: 'John',
    last_name: 'Doe',
    country: { code: 'US' },
  };

  const mockUserProfile = {
    dob: '1990-01-01',
    postal_code: '12345',
    city: 'Test City',
    state_or_province: 'CA',
    address_line1: '123 Test St',
    address_line2: null,
  };

  const mockKycVerification = {
    provider_ref: 'test-applicant-id',
  };

  const mockLoginDevice = {
    device_fingerprint: 'test-fingerprint',
  };

  const mockLoginEvent = {
    ip_address: '8.8.8.8',
  };

  const mockExternalAccount = {
    account_number: '0000',
    bank_name: 'Test Bank',
  };

  beforeEach(async () => {
    const mockAdapterModule = {
      provide: TransactionMonitoringAdapter,
      useValue: {
        submitTransaction: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionMonitoringService,
        mockAdapterModule,
        {
          provide: UserService,
          useValue: {
            findByUserId: jest.fn(),
          },
        },
        {
          provide: UserProfileService,
          useValue: {
            findByUserId: jest.fn(),
          },
        },
        {
          provide: LoginEventService,
          useValue: {
            getLastLoginEvent: jest.fn(),
          },
        },
        {
          provide: LoginDeviceService,
          useValue: {
            getLastLoginDevice: jest.fn(),
          },
        },
        {
          provide: KycVerificationService,
          useValue: {
            findByUserId: jest.fn(),
          },
        },
        {
          provide: FiatWalletTransactionService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: ExternalAccountRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionMonitoringService>(TransactionMonitoringService);
    mockTransactionMonitoringAdapter = module.get(TransactionMonitoringAdapter);
    mockUserService = module.get(UserService);
    mockUserProfileService = module.get(UserProfileService);
    mockLoginEventService = module.get(LoginEventService);
    mockLoginDeviceService = module.get(LoginDeviceService);
    mockKycVerificationService = module.get(KycVerificationService);
    mockFiatWalletTransactionService = module.get(FiatWalletTransactionService);
    mockExternalAccountRepository = module.get(ExternalAccountRepository);

    // Mock UtilsService and CurrencyUtility
    jest.spyOn(UtilsService, 'convertTo3LetterCountryCode').mockReturnValue('USA');
    jest.spyOn(CurrencyUtility, 'formatCurrencyAmountToMainUnit').mockReturnValue(30);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('monitorDeposit', () => {
    const request: MonitorDepositRequest = {
      fiatWalletTransactionId: 'test-fiat-txn-id',
    };

    beforeEach(() => {
      // Setup default mocks
      mockFiatWalletTransactionService.findById.mockResolvedValue(mockFiatWalletTransaction as any);
      mockUserService.findByUserId.mockResolvedValue(mockUser as any);
      mockUserProfileService.findByUserId.mockResolvedValue(mockUserProfile as any);
      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification as any);
      mockLoginDeviceService.getLastLoginDevice.mockResolvedValue(mockLoginDevice as any);
      mockLoginEventService.getLastLoginEvent.mockResolvedValue(mockLoginEvent as any);
      mockExternalAccountRepository.findOne.mockResolvedValue(mockExternalAccount as any);
    });

    it('should successfully monitor deposit and return GREEN approval', async () => {
      // Arrange
      const mockAdapterResponse = {
        data: {
          review: {
            reviewStatus: 'completed',
            reviewResult: {
              reviewAnswer: 'GREEN',
            },
          },
        },
      };
      mockTransactionMonitoringAdapter.submitTransaction.mockResolvedValue(mockAdapterResponse as any);

      // Act
      const result = await service.monitorDeposit(request);

      // Assert
      expect(result).toEqual({
        reviewAnswer: 'GREEN',
        reviewStatus: 'completed',
      });

      expect(mockTransactionMonitoringAdapter.submitTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          applicantId: 'test-applicant-id',
          transactionId: 'test-fiat-txn-id',
          transactionDate: '2025-09-25 02:41:37+0000',
          timeZone: 'UTC',
          transactionType: 'finance',
          direction: 'in',
          amount: 30,
          currency: 'USD',
          description: 'External account deposit',
          participant: expect.objectContaining({
            type: 'individual',
            externalUserId: 'test-user-id',
            fullName: 'John Doe',
          }),
          counterparty: expect.objectContaining({
            type: 'individual',
            externalUserId: 'test-user-id',
            fullName: 'John Doe',
            bankAccount: {
              accountType: 'account',
              accountNumber: '0000',
              countryCode: 'USA',
            },
            bankInfo: {
              bankName: 'Test Bank',
            },
          }),
        }),
      );
    });

    it('should handle onHold status with failure reasons', async () => {
      // Arrange
      const mockAdapterResponse = {
        data: {
          review: {
            reviewStatus: 'onHold',
          },
          scoringResult: {
            failedRules: [{ title: 'TM10 - Declined transactions' }, { title: 'TM08 - Velocity Rule' }],
          },
        },
      };
      mockTransactionMonitoringAdapter.submitTransaction.mockResolvedValue(mockAdapterResponse as any);

      // Act
      const result = await service.monitorDeposit(request);

      // Assert
      expect(result).toEqual({
        reviewStatus: 'onHold',
        failureReason: 'TM10 - Declined transactions; TM08 - Velocity Rule',
      });
    });

    it('should handle onHold status without failure reasons', async () => {
      // Arrange
      const mockAdapterResponse = {
        data: {
          review: {
            reviewStatus: 'onHold',
          },
          scoringResult: {
            failedRules: [],
          },
        },
      };
      mockTransactionMonitoringAdapter.submitTransaction.mockResolvedValue(mockAdapterResponse as any);

      // Act
      const result = await service.monitorDeposit(request);

      // Assert
      expect(result).toEqual({
        reviewStatus: 'onHold',
        failureReason: 'Transaction monitoring review required',
      });
    });

    it('should handle missing external account gracefully', async () => {
      // Arrange
      mockExternalAccountRepository.findOne.mockResolvedValue(null);
      const mockAdapterResponse = {
        data: {
          review: {
            reviewStatus: 'completed',
            reviewResult: {
              reviewAnswer: 'GREEN',
            },
          },
        },
      };
      mockTransactionMonitoringAdapter.submitTransaction.mockResolvedValue(mockAdapterResponse as any);

      // Act
      const result = await service.monitorDeposit(request);

      // Assert
      expect(result).toEqual({
        reviewAnswer: 'GREEN',
        reviewStatus: 'completed',
      });

      // Should call adapter with undefined bank info when external account is missing
      expect(mockTransactionMonitoringAdapter.submitTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          counterparty: expect.objectContaining({
            bankAccount: undefined,
            bankInfo: undefined,
          }),
        }),
      );
    });

    it('should throw error when fiat wallet transaction not found', async () => {
      // Arrange
      mockFiatWalletTransactionService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.monitorDeposit(request)).rejects.toThrow(
        'No fiat wallet transaction found for ID test-fiat-txn-id',
      );
    });

    it('should handle unexpected monitoring response', async () => {
      // Arrange
      const mockAdapterResponse = {
        data: {
          review: {
            reviewStatus: 'unknown',
          },
        },
      };
      mockTransactionMonitoringAdapter.submitTransaction.mockResolvedValue(mockAdapterResponse as any);

      // Act
      const result = await service.monitorDeposit(request);

      // Assert
      expect(result).toEqual({
        reviewStatus: 'unknown',
        failureReason: 'Unexpected monitoring response',
      });
    });
  });
});
