import { BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FiatWalletConfigProvider } from '../../../config/fiat-wallet.config';
import {
  FiatWalletTransactionType,
  TransactionCategory,
  TransactionScope,
  TransactionStatus,
  TransactionType,
} from '../../../database';
import { LockerService } from '../../../services/locker/locker.service';
import { ExchangeProcessor } from '../../../services/queue/processors/exchange/exchange.processor';
import { UtilsService } from '../../../utils/utils.service';
import { KycVerificationService } from '../../auth/kycVerification/kycVerification.service';
import { ExternalAccountRepository } from '../../externalAccount/external-account.repository';
import { ExternalAccountService } from '../../externalAccount/external-account.service';
import { FiatWalletService } from '../../fiatWallet/fiatWallet.service';
import { FiatWalletTransactionService } from '../../fiatWalletTransactions/fiatWalletTransactions.service';
import { RateRepository } from '../../rate/rate.repository';
import { RateService } from '../../rate/rate.service';
import { TransactionService } from '../../transaction/transaction.service';
import { UserTierService } from '../../userTier/userTier.service';
import { VirtualAccountRepository } from '../../virtualAccount/virtualAccount.repository';
import { VirtualAccountService } from '../../virtualAccount/virtualAccount.service';
import { ExchangeFiatWalletDto } from '../dto/exchange-fiat-wallet.dto';
import { FiatExchangeService } from './fiat-exchange.service';
import { NewNgToUsdExchangeService } from './ng-to-usd-exchange.service/new-ng-to-usd-exchange.service';
import { NgToUsdExchangeService } from './ng-to-usd-exchange.service/ng-to-usd-exchange.service';

jest.mock('../../../utils/utils.service');

describe('FiatExchangeService', () => {
  let service: FiatExchangeService;

  const mockKycVerificationService = {
    findByUserId: jest.fn(),
  };

  const mockFiatWalletConfig = {
    getConfig: jest.fn(),
  };

  const mockExternalAccountRepository = {
    findOne: jest.fn(),
  };

  const mockExternalAccountService = {
    getExternalAccountForTransaction: jest.fn(),
  };

  const mockFiatWalletService = {
    getUserWallet: jest.fn(),
  };

  const mockFiatWalletTransactionService = {
    create: jest.fn(),
    findOneOrNull: jest.fn(),
  };

  const mockTransactionService = {
    create: jest.fn(),
  };

  const mockLockerService = {
    withLock: jest.fn(),
  };

  const mockVirtualAccountRepository = {
    findOne: jest.fn(),
  };

  const mockVirtualAccountService = {
    findOrCreateVirtualAccount: jest.fn(),
  };

  const mockExchangeProcessor = {
    queueExchange: jest.fn(),
  };

  const mockRateRepository = {
    findOne: jest.fn(),
    transaction: jest.fn(),
  };

  const mockRateService = {
    validateRateOrThrow: jest.fn(),
  };

  const mockNgToUsdExchangeService = {
    executeExchange: jest.fn(),
  };

  const mockUserTierService = {
    validateLimit: jest.fn(),
  };

  const mockNewNgToUsdExchangeService = {
    executeExchange: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    (UtilsService.generateTransactionReference as jest.Mock).mockReturnValue('TXN123456789');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FiatExchangeService,
        { provide: KycVerificationService, useValue: mockKycVerificationService },
        { provide: FiatWalletConfigProvider, useValue: mockFiatWalletConfig },
        { provide: ExternalAccountRepository, useValue: mockExternalAccountRepository },
        { provide: ExternalAccountService, useValue: mockExternalAccountService },
        { provide: FiatWalletService, useValue: mockFiatWalletService },
        { provide: FiatWalletTransactionService, useValue: mockFiatWalletTransactionService },
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: LockerService, useValue: mockLockerService },
        { provide: VirtualAccountRepository, useValue: mockVirtualAccountRepository },
        { provide: VirtualAccountService, useValue: mockVirtualAccountService },
        { provide: ExchangeProcessor, useValue: mockExchangeProcessor },
        { provide: RateRepository, useValue: mockRateRepository },
        { provide: RateService, useValue: mockRateService },
        { provide: NgToUsdExchangeService, useValue: mockNgToUsdExchangeService },
        { provide: UserTierService, useValue: mockUserTierService },
        { provide: NewNgToUsdExchangeService, useValue: mockNewNgToUsdExchangeService },
      ],
    }).compile();

    service = module.get<FiatExchangeService>(FiatExchangeService);
  });

  describe('onModuleInit', () => {
    it('should successfully initialize with valid config', async () => {
      mockFiatWalletConfig.getConfig.mockReturnValue({
        default_usd_fiat_wallet_provider: 'zero_hash',
        default_underlying_currency: 'USDC',
      });

      await expect(service.onModuleInit()).resolves.not.toThrow();
      expect(mockFiatWalletConfig.getConfig).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when default_usd_fiat_wallet_provider is missing', async () => {
      mockFiatWalletConfig.getConfig.mockReturnValue({
        default_usd_fiat_wallet_provider: null,
        default_underlying_currency: 'USDC',
      });

      await expect(service.onModuleInit()).rejects.toThrow(
        new InternalServerErrorException('Default fiat wallet provider not configured'),
      );
    });

    it('should throw InternalServerErrorException when default_underlying_currency is missing', async () => {
      mockFiatWalletConfig.getConfig.mockReturnValue({
        default_usd_fiat_wallet_provider: 'zero_hash',
        default_underlying_currency: null,
      });

      await expect(service.onModuleInit()).rejects.toThrow(
        new InternalServerErrorException('Default underlying currency not configured'),
      );
    });
  });

  describe('exchange', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
    };

    const exchangeDto: ExchangeFiatWalletDto = {
      from: 'USD',
      to: 'NGN',
      amount: 100,
      rate_id: 'rate-123',
    };

    beforeEach(async () => {
      mockFiatWalletConfig.getConfig.mockReturnValue({
        default_usd_fiat_wallet_provider: 'zero_hash',
        default_underlying_currency: 'USDC',
      });
      await service.onModuleInit();
    });

    it('should successfully initiate exchange transaction', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockVirtualAccount = {
        id: 'virtual-123',
        user_id: 'user-123',
        account_number: '1234567890',
        account_name: 'Test User',
        type: 'exchange_account',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 1000000,
        currency: 'USD',
      };

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 1500,
        provider: 'provider-123',
        provider_rate_ref: 'rate-ref-123',
      };

      const mockTransaction = {
        id: 'txn-123',
        transaction_type: TransactionType.EXCHANGE,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        status: TransactionStatus.INITIATED,
        amount: 10000,
        asset: 'USD',
        balance_before: 1000000,
        balance_after: 990000,
        reference: 'TXN123456789-OUT',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        transaction_id: 'txn-123',
        fiat_wallet_id: 'wallet-123',
        transaction_type: FiatWalletTransactionType.EXCHANGE,
        amount: -10000,
        status: TransactionStatus.INITIATED,
      };

      const mockJob = {
        id: 'job-123',
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);
      mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
      mockTransactionService.create.mockResolvedValue(mockTransaction);
      mockFiatWalletTransactionService.create.mockResolvedValue(mockFiatWalletTransaction);
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount);
      mockExchangeProcessor.queueExchange.mockResolvedValue(mockJob);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      const result = await service.exchange(mockUser as any, exchangeDto);

      expect(result).toEqual({
        status: 'processing',
        transactionRef: 'txn-123',
        message: 'Exchange transaction initiated successfully',
        jobId: 'job-123',
      });

      expect(mockKycVerificationService.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockUserTierService.validateLimit).toHaveBeenCalled();
      expect(mockRateService.validateRateOrThrow).toHaveBeenCalled();
      expect(mockExternalAccountService.getExternalAccountForTransaction).toHaveBeenCalledWith('user-123', 'zero_hash');
      expect(mockVirtualAccountService.findOrCreateVirtualAccount).toHaveBeenCalled();
      expect(mockExchangeProcessor.queueExchange).toHaveBeenCalled();
    });

    it('should create transaction and fiat wallet transaction with correct description format', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockVirtualAccount = {
        id: 'virtual-123',
        user_id: 'user-123',
        account_number: '1234567890',
        account_name: 'Test User',
        type: 'exchange_account',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 1000000,
        currency: 'USD',
      };

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 1500,
        provider: 'provider-123',
        provider_rate_ref: 'rate-ref-123',
      };

      const mockTransaction = {
        id: 'txn-123',
        transaction_type: TransactionType.EXCHANGE,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        status: TransactionStatus.INITIATED,
        amount: 10000,
        asset: 'USD',
        balance_before: 1000000,
        balance_after: 990000,
        reference: 'TXN123456789-OUT',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        transaction_id: 'txn-123',
        fiat_wallet_id: 'wallet-123',
        transaction_type: FiatWalletTransactionType.EXCHANGE,
        amount: -10000,
        status: TransactionStatus.INITIATED,
      };

      const mockJob = {
        id: 'job-123',
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);
      mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
      mockTransactionService.create.mockResolvedValue(mockTransaction);
      mockFiatWalletTransactionService.create.mockResolvedValue(mockFiatWalletTransaction);
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount);
      mockExchangeProcessor.queueExchange.mockResolvedValue(mockJob);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await service.exchange(mockUser as any, exchangeDto);

      // Verify transaction is created with correct description format
      expect(mockTransactionService.create).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          description: 'Exchange from US Wallet',
        }),
        expect.anything(),
      );

      // Verify fiat wallet transaction is created with correct description format
      expect(mockFiatWalletTransactionService.create).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          description: 'Exchange from US Wallet',
        }),
        expect.anything(),
      );
    });

    it('should delegate to NgToUsdExchangeService for NGN to USD exchange with transaction_id', async () => {
      const ngnToUsdDto: ExchangeFiatWalletDto = {
        from: 'NGN',
        to: 'USD',
        amount: 10000,
        rate_id: 'rate-123',
        transaction_id: 'txn-existing-123',
      };

      const mockResult = {
        status: 'processing',
        transactionRef: 'txn-ngn-123',
        message: 'Exchange transaction initiated successfully',
        jobId: 'job-ngn-123',
      };

      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockNgToUsdExchangeService.executeExchange.mockResolvedValue(mockResult);

      const result = await service.exchange(mockUser as any, ngnToUsdDto);

      expect(result).toEqual(mockResult);
      expect(mockNgToUsdExchangeService.executeExchange).toHaveBeenCalledWith(mockUser, ngnToUsdDto);
      expect(mockKycVerificationService.findByUserId).toHaveBeenCalledWith('user-123');
    });

    it('should throw InternalServerErrorException for NGN to USD exchange without transaction_id', async () => {
      const ngnToUsdDto: ExchangeFiatWalletDto = {
        from: 'NGN',
        to: 'USD',
        amount: 10000,
        rate_id: 'rate-123',
      };

      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);

      await expect(service.exchange(mockUser as any, ngnToUsdDto)).rejects.toThrow(
        new InternalServerErrorException(
          'Please Update to the latest version of the app to continue with this feature',
        ),
      );

      expect(mockKycVerificationService.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockNewNgToUsdExchangeService.executeExchange).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when KYC verification not found', async () => {
      mockKycVerificationService.findByUserId.mockResolvedValue(null);

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new BadRequestException('KYC verification required for exchange transactions'),
      );
    });

    it('should throw BadRequestException when KYC verification is incomplete', async () => {
      const incompleteKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: null,
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(incompleteKycVerification);

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new BadRequestException('KYC verification is incomplete. Please complete your verification to continue'),
      );
    });

    it('should throw BadRequestException when external account not found', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const { NotFoundException } = await import('@nestjs/common');

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockRejectedValue(
        new NotFoundException('External account not found for provider zero_hash. Please complete your account setup.'),
      );

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when external account has no participant_code', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockRejectedValue(
        new BadRequestException('External account is not properly configured for provider zero_hash.'),
      );

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when virtual account not found', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 1000000,
        currency: 'USD',
      };

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 1500,
        provider: 'provider-123',
        provider_rate_ref: 'rate-ref-123',
      };

      const mockTransaction = {
        id: 'txn-123',
        transaction_type: TransactionType.EXCHANGE,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        status: TransactionStatus.INITIATED,
        amount: 10000,
        asset: 'USD',
        balance_before: 1000000,
        balance_after: 990000,
        reference: 'TXN123456789-OUT',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        transaction_id: 'txn-123',
        fiat_wallet_id: 'wallet-123',
        transaction_type: FiatWalletTransactionType.EXCHANGE,
        amount: -10000,
        status: TransactionStatus.INITIATED,
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);
      mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
      mockTransactionService.create.mockResolvedValue(mockTransaction);
      mockFiatWalletTransactionService.create.mockResolvedValue(mockFiatWalletTransaction);
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(null);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new BadRequestException('failed to create exchange virtual account'),
      );
    });

    it('should throw BadRequestException when virtual account has no account_number', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockVirtualAccount = {
        id: 'virtual-123',
        user_id: 'user-123',
        account_number: null,
        account_name: 'Test User',
        type: 'exchange_account',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 1000000,
        currency: 'USD',
      };

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 1500,
        provider: 'provider-123',
        provider_rate_ref: 'rate-ref-123',
      };

      const mockTransaction = {
        id: 'txn-123',
        transaction_type: TransactionType.EXCHANGE,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        status: TransactionStatus.INITIATED,
        amount: 10000,
        asset: 'USD',
        balance_before: 1000000,
        balance_after: 990000,
        reference: 'TXN123456789-OUT',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        transaction_id: 'txn-123',
        fiat_wallet_id: 'wallet-123',
        transaction_type: FiatWalletTransactionType.EXCHANGE,
        amount: -10000,
        status: TransactionStatus.INITIATED,
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);
      mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
      mockTransactionService.create.mockResolvedValue(mockTransaction);
      mockFiatWalletTransactionService.create.mockResolvedValue(mockFiatWalletTransaction);
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new BadRequestException('Virtual account number is missing'),
      );
    });

    it('should throw BadRequestException when virtual account has no account_name', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockVirtualAccount = {
        id: 'virtual-123',
        user_id: 'user-123',
        account_number: '1234567890',
        account_name: null,
        type: 'exchange_account',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 1000000,
        currency: 'USD',
      };

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 1500,
        provider: 'provider-123',
        provider_rate_ref: 'rate-ref-123',
      };

      const mockTransaction = {
        id: 'txn-123',
        transaction_type: TransactionType.EXCHANGE,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        status: TransactionStatus.INITIATED,
        amount: 10000,
        asset: 'USD',
        balance_before: 1000000,
        balance_after: 990000,
        reference: 'TXN123456789-OUT',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        transaction_id: 'txn-123',
        fiat_wallet_id: 'wallet-123',
        transaction_type: FiatWalletTransactionType.EXCHANGE,
        amount: -10000,
        status: TransactionStatus.INITIATED,
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);
      mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
      mockTransactionService.create.mockResolvedValue(mockTransaction);
      mockFiatWalletTransactionService.create.mockResolvedValue(mockFiatWalletTransaction);
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new BadRequestException('Virtual account name is missing'),
      );
    });

    it('should throw ConflictException when pending exchange transaction exists', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockPendingTransaction = {
        id: 'pending-txn-123',
        status: TransactionStatus.PENDING,
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockPendingTransaction);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new ConflictException(
          'You already have a pending exchange transaction. Please wait for it to complete or contact support.',
        ),
      );
    });

    it('should throw BadRequestException when wallet not found', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(null);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new BadRequestException('Wallet not found for currency USD'),
      );
    });

    it('should throw InternalServerErrorException when wallet balance is invalid', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 'invalid',
        currency: 'USD',
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new InternalServerErrorException('Invalid wallet balance format'),
      );
    });

    it('should throw InternalServerErrorException when wallet balance is negative', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: -1000,
        currency: 'USD',
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new InternalServerErrorException('Invalid wallet state'),
      );
    });

    it('should throw BadRequestException for insufficient balance', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 5000,
        currency: 'USD',
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new BadRequestException('Insufficient balance for exchange'),
      );
    });

    it('should throw BadRequestException when exchange rate not found', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 1000000,
        currency: 'USD',
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);
      mockRateRepository.findOne.mockResolvedValue(null);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new BadRequestException('Exchange rate not found'),
      );
    });

    it('should throw BadRequestException when exchange rate is invalid', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 1000000,
        currency: 'USD',
      };

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 0,
        provider: 'provider-123',
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);
      mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new BadRequestException('Invalid exchange rate'),
      );
    });

    it('should throw InternalServerErrorException when exchange rate provider is missing', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 1000000,
        currency: 'USD',
      };

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 1500,
        provider: null,
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);
      mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new InternalServerErrorException('Exchange rate provider is missing'),
      );
    });

    it('should throw InternalServerErrorException when job queue fails', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockVirtualAccount = {
        id: 'virtual-123',
        user_id: 'user-123',
        account_number: '1234567890',
        account_name: 'Test User',
        type: 'exchange_account',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 1000000,
        currency: 'USD',
      };

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 1500,
        provider: 'provider-123',
        provider_rate_ref: 'rate-ref-123',
      };

      const mockTransaction = {
        id: 'txn-123',
        transaction_type: TransactionType.EXCHANGE,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        status: TransactionStatus.INITIATED,
        amount: 10000,
        asset: 'USD',
        balance_before: 1000000,
        balance_after: 990000,
        reference: 'TXN123456789-OUT',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        transaction_id: 'txn-123',
        fiat_wallet_id: 'wallet-123',
        transaction_type: FiatWalletTransactionType.EXCHANGE,
        amount: -10000,
        status: TransactionStatus.INITIATED,
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);
      mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
      mockTransactionService.create.mockResolvedValue(mockTransaction);
      mockFiatWalletTransactionService.create.mockResolvedValue(mockFiatWalletTransaction);
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount);
      mockExchangeProcessor.queueExchange.mockResolvedValue(null);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new InternalServerErrorException('Failed to initiate exchange transaction'),
      );
    });

    it('should throw InternalServerErrorException when job has no id', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockVirtualAccount = {
        id: 'virtual-123',
        user_id: 'user-123',
        account_number: '1234567890',
        account_name: 'Test User',
        type: 'exchange_account',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 1000000,
        currency: 'USD',
      };

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 1500,
        provider: 'provider-123',
        provider_rate_ref: 'rate-ref-123',
      };

      const mockTransaction = {
        id: 'txn-123',
        transaction_type: TransactionType.EXCHANGE,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        status: TransactionStatus.INITIATED,
        amount: 10000,
        asset: 'USD',
        balance_before: 1000000,
        balance_after: 990000,
        reference: 'TXN123456789-OUT',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        transaction_id: 'txn-123',
        fiat_wallet_id: 'wallet-123',
        transaction_type: FiatWalletTransactionType.EXCHANGE,
        amount: -10000,
        status: TransactionStatus.INITIATED,
      };

      const mockJob = {
        id: null,
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);
      mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
      mockTransactionService.create.mockResolvedValue(mockTransaction);
      mockFiatWalletTransactionService.create.mockResolvedValue(mockFiatWalletTransaction);
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount);
      mockExchangeProcessor.queueExchange.mockResolvedValue(mockJob);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new InternalServerErrorException('Failed to initiate exchange transaction'),
      );
    });

    it('should throw BadRequestException for unsupported destination currency', async () => {
      const unsupportedCurrencyDto: ExchangeFiatWalletDto = {
        from: 'USD',
        to: 'XYZ',
        amount: 100,
        rate_id: 'rate-123',
      };

      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockVirtualAccount = {
        id: 'virtual-123',
        user_id: 'user-123',
        account_number: '1234567890',
        account_name: 'Test User',
        type: 'exchange_account',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 1000000,
        currency: 'USD',
      };

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 1500,
        provider: 'provider-123',
        provider_rate_ref: 'rate-ref-123',
      };

      const mockTransaction = {
        id: 'txn-123',
        transaction_type: TransactionType.EXCHANGE,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        status: TransactionStatus.INITIATED,
        amount: 10000,
        asset: 'USD',
        balance_before: 1000000,
        balance_after: 990000,
        reference: 'TXN123456789-OUT',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        transaction_id: 'txn-123',
        fiat_wallet_id: 'wallet-123',
        transaction_type: FiatWalletTransactionType.EXCHANGE,
        amount: -10000,
        status: TransactionStatus.INITIATED,
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);
      mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
      mockTransactionService.create.mockResolvedValue(mockTransaction);
      mockFiatWalletTransactionService.create.mockResolvedValue(mockFiatWalletTransaction);
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, unsupportedCurrencyDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when virtual account type mismatch', async () => {
      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockVirtualAccount = {
        id: 'virtual-123',
        user_id: 'user-123',
        account_number: '1234567890',
        account_name: 'Test User',
        type: 'main_account',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 1000000,
        currency: 'USD',
      };

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 1500,
        provider: 'provider-123',
        provider_rate_ref: 'rate-ref-123',
      };

      const mockTransaction = {
        id: 'txn-123',
        transaction_type: TransactionType.EXCHANGE,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        status: TransactionStatus.INITIATED,
        amount: 10000,
        asset: 'USD',
        balance_before: 1000000,
        balance_after: 990000,
        reference: 'TXN123456789-OUT',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        transaction_id: 'txn-123',
        fiat_wallet_id: 'wallet-123',
        transaction_type: FiatWalletTransactionType.EXCHANGE,
        amount: -10000,
        status: TransactionStatus.INITIATED,
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);
      mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
      mockTransactionService.create.mockResolvedValue(mockTransaction);
      mockFiatWalletTransactionService.create.mockResolvedValue(mockFiatWalletTransaction);
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, exchangeDto)).rejects.toThrow(
        new BadRequestException('Virtual account type mismatch. Expected exchange_account but got main_account'),
      );
    });

    it('should throw BadRequestException for invalid transaction amount (zero)', async () => {
      const zeroAmountDto: ExchangeFiatWalletDto = {
        from: 'USD',
        to: 'NGN',
        amount: 0,
        rate_id: 'rate-123',
      };

      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 1000000,
        currency: 'USD',
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, zeroAmountDto)).rejects.toThrow(
        new BadRequestException('Invalid transaction amount'),
      );
    });

    it('should throw BadRequestException for negative transaction amount', async () => {
      const negativeAmountDto: ExchangeFiatWalletDto = {
        from: 'USD',
        to: 'NGN',
        amount: -100,
        rate_id: 'rate-123',
      };

      const mockKycVerification = {
        id: 'kyc-123',
        user_id: 'user-123',
        provider_ref: 'ref-123',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        provider: 'zero_hash',
        participant_code: 'participant-123',
      };

      const mockSourceWallet = {
        id: 'wallet-123',
        balance: 1000000,
        currency: 'USD',
      };

      mockKycVerificationService.findByUserId.mockResolvedValue(mockKycVerification);
      mockUserTierService.validateLimit.mockResolvedValue(undefined);
      mockRateService.validateRateOrThrow.mockResolvedValue(undefined);
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockSourceWallet);

      mockLockerService.withLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      mockRateRepository.transaction.mockImplementation(async (callback) => {
        return await callback({});
      });

      await expect(service.exchange(mockUser as any, negativeAmountDto)).rejects.toThrow(
        new BadRequestException('Invalid transaction amount'),
      );
    });
  });

  describe('getValidatedVirtualAccount', () => {
    beforeEach(async () => {
      mockFiatWalletConfig.getConfig.mockReturnValue({
        default_usd_fiat_wallet_provider: 'zero_hash',
        default_underlying_currency: 'USDC',
      });
      await service.onModuleInit();
    });

    it('should return virtual account when valid', async () => {
      const mockVirtualAccount = {
        id: 'virtual-123',
        user_id: 'user-123',
        account_number: '1234567890',
        account_name: 'Test User',
        type: 'exchange_account',
      };

      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount);

      const result = await service.getValidatedVirtualAccount('user-123', 'exchange_account' as any, 'txn-123');

      expect(result).toEqual(mockVirtualAccount);
    });

    it('should throw BadRequestException when virtual account is null', async () => {
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(null);

      await expect(
        service.getValidatedVirtualAccount('user-123', 'exchange_account' as any, 'txn-123'),
      ).rejects.toThrow(new BadRequestException('failed to create exchange virtual account'));
    });

    it('should throw BadRequestException when type mismatch', async () => {
      const mockVirtualAccount = {
        id: 'virtual-123',
        user_id: 'user-123',
        account_number: '1234567890',
        account_name: 'Test User',
        type: 'main_account',
      };

      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount);

      await expect(
        service.getValidatedVirtualAccount('user-123', 'exchange_account' as any, 'txn-123'),
      ).rejects.toThrow(
        new BadRequestException('Virtual account type mismatch. Expected exchange_account but got main_account'),
      );
    });

    it('should throw BadRequestException when account number is missing', async () => {
      const mockVirtualAccount = {
        id: 'virtual-123',
        user_id: 'user-123',
        account_number: null,
        account_name: 'Test User',
        type: 'exchange_account',
      };

      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount);

      await expect(
        service.getValidatedVirtualAccount('user-123', 'exchange_account' as any, 'txn-123'),
      ).rejects.toThrow(new BadRequestException('Virtual account number is missing'));
    });

    it('should throw BadRequestException when account name is missing', async () => {
      const mockVirtualAccount = {
        id: 'virtual-123',
        user_id: 'user-123',
        account_number: '1234567890',
        account_name: null,
        type: 'exchange_account',
      };

      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue(mockVirtualAccount);

      await expect(
        service.getValidatedVirtualAccount('user-123', 'exchange_account' as any, 'txn-123'),
      ).rejects.toThrow(new BadRequestException('Virtual account name is missing'));
    });
  });
});
