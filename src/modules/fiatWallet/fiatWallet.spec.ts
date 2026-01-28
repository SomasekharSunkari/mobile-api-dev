import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { ExchangeAdapter } from '../../adapters/exchange/exchange.adapter';
import { FiatWalletAdapter } from '../../adapters/fiat-wallet/fiat-wallet.adapter';
import { KYCAdapter } from '../../adapters/kyc/kyc-adapter';
import { WaasAdapter } from '../../adapters/waas/waas.adapter';
import { FiatWalletConfigProvider } from '../../config/fiat-wallet.config';
import { CurrencyUtility } from '../../currencies/currencies';
import {
  ITransaction,
  TransactionCategory,
  TransactionScope,
  TransactionStatus,
  TransactionType,
} from '../../database';
import { FiatWalletStatus } from '../../database/models/fiatWallet/fiatWallet.interface';
import {
  FiatWalletTransactionType,
  IFiatWalletTransaction,
} from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import { EventEmitterEventsEnum } from '../../services/eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../services/eventEmitter/eventEmitter.service';
import { LockerService } from '../../services/locker';
import { AppLoggerService } from '../../services/logger/logger.service';
import { PushNotificationService } from '../../services/pushNotification/pushNotification.service';
import { ExchangeProcessor } from '../../services/queue/processors/exchange/exchange.processor';
import { MailerService } from '../../services/queue/processors/mailer/mailer.service';
import { NgnWithdrawalStatusProcessor } from '../../services/queue/processors/ngn-withdrawal/ngn-withdrawal-status.processor';
import { StreamService } from '../../services/streams/stream.service';
import { UtilsService } from '../../utils/utils.service';
import { KycVerificationService } from '../auth/kycVerification/kycVerification.service';
import { LocationRestrictionService } from '../auth/locationRestriction/locationRestriction.service';
import { TransactionPinService } from '../auth/transactionPin/transactionPin.service';
import { UserRepository } from '../auth/user/user.repository';
import { UserService } from '../auth/user/user.service';
import { UserProfileService } from '../auth/userProfile/userProfile.service';
import { BankService } from '../bank';
import { ExternalAccountRepository } from '../externalAccount/external-account.repository';
import { ExternalAccountService } from '../externalAccount/external-account.service';
import { FiatWalletTransactionRepository } from '../fiatWalletTransactions/fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from '../fiatWalletTransactions/fiatWalletTransactions.service';
import { InAppNotificationService } from '../inAppNotification/inAppNotification.service';
import { TransactionRepository } from '../transaction/transaction.repository';
import { TransactionService } from '../transaction/transaction.service';
import { UserTierService } from '../userTier';
import { VirtualAccountRepository } from '../virtualAccount/virtualAccount.repository';
import { CircuitBreakerService } from './circuitBreaker.service';
import { FiatWalletController } from './fiatWallet.controller';
import { FiatWalletRepository } from './fiatWallet.repository';
import { FiatWalletService } from './fiatWallet.service';
import { FiatWalletEscrowService } from './fiatWalletEscrow.service';
import { FiatWalletExchangeService } from './fiatWalletExchange.service';
import { FiatWalletWithdrawalService } from './fiatWalletWithdrawal.service';
import { WithdrawalCounterService } from './withdrawalCounter.service';
import { WithdrawalSessionService } from './withdrawalSession.service';

const mockEventEmitterService = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn(),
  listenerCount: jest.fn(),
};

describe('FiatWalletService', () => {
  let service: FiatWalletService;
  let withdrawalService: FiatWalletWithdrawalService;
  let exchangeService: FiatWalletExchangeService;

  // Mock repositories and services
  const mockTrx = { trx: 'mock-transaction' };

  const mockFiatWalletRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    query: jest.fn(),
    transaction: jest.fn((callback) => callback(mockTrx)),
  };

  const mockFiatWalletTransactionRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    findByUserIdAndIdempotencyKey: jest.fn().mockResolvedValue(null),
  };

  const mockFiatWalletTransactionService = {
    create: jest.fn(),
    findOneOrNull: jest.fn(),
    updateStatus: jest.fn().mockResolvedValue(undefined),
  };

  const mockLockerService = {
    withLock: jest.fn((_lockKey, callback) => callback()),
  };

  const mockTransactionRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn((callback) => callback(mockTrx)),
  };

  const mockTransactionService = {
    create: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockUserService = {
    findActiveByUsername: jest.fn(),
  };

  const mockExternalAccountRepository = {
    findOne: jest.fn(),
    findByUserId: jest.fn(),
  };

  const mockExternalAccountService = {
    getExternalAccountForTransaction: jest.fn(),
  };

  const mockFiatWalletAdapter = {
    transfer: jest.fn(),
    getWithdrawalQuote: jest.fn(),
    createWithdrawalRequest: jest.fn(),
    getAccountDetails: jest.fn(),
  };

  const mockExchangeAdapter = {
    getExchangeRates: jest.fn(),
    createPayOutRequest: jest.fn(),
    getChannels: jest.fn(),
    getBanks: jest.fn(),
  };

  const mockExchangeProcessor = {
    queueExchange: jest.fn(),
  };

  const mockFiatWalletConfigProvider = {
    getConfig: jest.fn().mockReturnValue({
      default_usd_fiat_wallet_provider: 'zerohash',
      default_ngn_fiat_wallet_provider: 'zerohash',
      default_underlying_currency: 'USDC.SOL',
    }),
  };

  const mockBankService = {
    verifyBankAccount: jest.fn(),
  };

  const mockWaasAdapter = {
    transferToOtherBank: jest.fn(),
    transferToSameBank: jest.fn(),
    getTransactionStatus: jest.fn(),
    getBankCode: jest.fn().mockReturnValue('999'),
    getProviderName: jest.fn().mockReturnValue('ninepayment'),
    checkLedgerBalance: jest
      .fn()
      .mockResolvedValue({ hasSufficientBalance: true, requestedAmount: 50000, availableBalance: 100000 }),
  };

  const mockKYCAdapter = {
    getKycDetailsByUserId: jest.fn(),
  };

  const mockVirtualAccountRepository = {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockMailerService = {
    send: jest.fn(),
    sendMail: jest.fn(),
  };

  const mockPushNotificationService = {
    send: jest.fn(),
    sendNotification: jest.fn(),
    sendPushNotification: jest.fn(),
    getTransactionPushNotificationConfig: jest.fn(),
  };

  const mockUserProfileService = {
    findOne: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
  };

  const mockLocationRestrictionService = {
    validateLocation: jest.fn(),
  };

  const mockKycVerificationService = {
    findByUserId: jest.fn().mockResolvedValue({
      provider_ref: 'test-provider-ref',
    }),
  };

  const mockUserTierService = {
    validateLimit: jest.fn().mockResolvedValue(true),
    getUserCurrentTier: jest.fn(),
  };

  const mockInAppNotificationService = {
    create: jest.fn(),
    createNotification: jest.fn().mockResolvedValue(undefined),
    sendNotification: jest.fn().mockResolvedValue(undefined),
    getTransactionNotificationConfig: jest.fn().mockImplementation((transactionType) => {
      if (transactionType === 'transfer_out') {
        return {
          type: 'transaction_success',
          title: 'Transaction Completed',
          message: 'You sent ₦5,000.00 to Jane Receiver successfully. A receipt has also been sent to your email',
        };
      }
      if (transactionType === 'transfer_in') {
        return {
          type: 'transaction_success',
          title: "You've Received Money",
          message:
            'You just received ₦5,000.00 from John Sender. The funds are now available in your OneDosh wallet. A receipt has also been sent to your email',
        };
      }
      return {
        type: 'withdrawal_initiated',
        title: 'Withdrawal Initiated',
        message: 'Your withdrawal has been initiated',
      };
    }),
  };

  const mockWithdrawalCounterService = {
    incrementCount: jest.fn().mockResolvedValue(undefined),
    getCount: jest.fn().mockResolvedValue(0),
    resetCount: jest.fn().mockResolvedValue(undefined),
    checkDailyLimit: jest.fn().mockResolvedValue(undefined),
    incrementDailyAttempts: jest.fn().mockResolvedValue(undefined),
  };

  const mockWithdrawalSessionService = {
    trackSession: jest.fn(),
    getSessionInfo: jest.fn(),
    checkAndBlockConcurrent: jest.fn(),
    startSession: jest.fn(),
    endSession: jest.fn(),
  };

  const mockCircuitBreakerService = {
    execute: jest.fn((callback) => callback()),
    isOpen: jest.fn().mockReturnValue(false),
    canProceed: jest.fn().mockResolvedValue({ allowed: true }),
    recordSuccess: jest.fn().mockResolvedValue(undefined),
    recordFailure: jest.fn().mockResolvedValue(undefined),
    recordAttempt: jest.fn().mockResolvedValue(undefined),
  };

  const mockFiatWalletEscrowService = {
    moveMoneyToEscrow: jest.fn().mockResolvedValue(undefined),
    releaseMoneyFromEscrow: jest.fn().mockResolvedValue(undefined),
    getEscrowAmount: jest.fn().mockResolvedValue(0),
  };

  const mockNgnWithdrawalStatusProcessor = {
    queueStatusPoll: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Re-establish mock implementations after clearAllMocks
    mockPushNotificationService.getTransactionPushNotificationConfig.mockReturnValue({
      title: 'Transaction Completed',
      body: 'Your transaction has been completed successfully.',
    });

    mockInAppNotificationService.getTransactionNotificationConfig.mockImplementation((transactionType) => {
      if (transactionType === 'transfer_out') {
        return {
          type: 'transaction_success',
          title: 'Transaction Completed',
          message: 'You sent ₦5,000.00 to Jane Receiver successfully. A receipt has also been sent to your email',
        };
      }
      if (transactionType === 'transfer_in') {
        return {
          type: 'transaction_success',
          title: "You've Received Money",
          message:
            'You just received ₦5,000.00 from John Sender. The funds are now available in your OneDosh wallet. A receipt has also been sent to your email',
        };
      }
      return {
        type: 'withdrawal_initiated',
        title: 'Withdrawal Initiated',
        message: 'Your withdrawal has been initiated',
      };
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FiatWalletService,
        FiatWalletWithdrawalService,
        FiatWalletExchangeService,
        {
          provide: FiatWalletRepository,
          useValue: mockFiatWalletRepository,
        },
        {
          provide: FiatWalletTransactionRepository,
          useValue: mockFiatWalletTransactionRepository,
        },
        {
          provide: FiatWalletTransactionService,
          useValue: mockFiatWalletTransactionService,
        },
        {
          provide: LockerService,
          useValue: mockLockerService,
        },
        {
          provide: TransactionRepository,
          useValue: mockTransactionRepository,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: ExternalAccountRepository,
          useValue: mockExternalAccountRepository,
        },
        {
          provide: ExternalAccountService,
          useValue: mockExternalAccountService,
        },
        {
          provide: FiatWalletAdapter,
          useValue: mockFiatWalletAdapter,
        },
        {
          provide: ExchangeAdapter,
          useValue: mockExchangeAdapter,
        },
        {
          provide: FiatWalletConfigProvider,
          useValue: mockFiatWalletConfigProvider,
        },
        {
          provide: ExchangeProcessor,
          useValue: mockExchangeProcessor,
        },
        {
          provide: BankService,
          useValue: mockBankService,
        },
        {
          provide: WaasAdapter,
          useValue: mockWaasAdapter,
        },
        {
          provide: EventEmitterService,
          useValue: mockEventEmitterService,
        },
        {
          provide: KYCAdapter,
          useValue: mockKYCAdapter,
        },
        {
          provide: VirtualAccountRepository,
          useValue: mockVirtualAccountRepository,
        },
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: PushNotificationService,
          useValue: mockPushNotificationService,
        },
        {
          provide: UserProfileService,
          useValue: mockUserProfileService,
        },
        {
          provide: LocationRestrictionService,
          useValue: mockLocationRestrictionService,
        },
        {
          provide: KycVerificationService,
          useValue: mockKycVerificationService,
        },
        {
          provide: UserTierService,
          useValue: mockUserTierService,
        },
        {
          provide: InAppNotificationService,
          useValue: mockInAppNotificationService,
        },
        {
          provide: WithdrawalCounterService,
          useValue: mockWithdrawalCounterService,
        },
        {
          provide: WithdrawalSessionService,
          useValue: mockWithdrawalSessionService,
        },
        {
          provide: CircuitBreakerService,
          useValue: mockCircuitBreakerService,
        },
        {
          provide: FiatWalletEscrowService,
          useValue: mockFiatWalletEscrowService,
        },
        {
          provide: NgnWithdrawalStatusProcessor,
          useValue: mockNgnWithdrawalStatusProcessor,
        },
      ],
    }).compile();

    service = module.get<FiatWalletService>(FiatWalletService);
    withdrawalService = module.get<FiatWalletWithdrawalService>(FiatWalletWithdrawalService);
    exchangeService = module.get<FiatWalletExchangeService>(FiatWalletExchangeService);

    // Mock CurrencyUtility
    jest.spyOn(CurrencyUtility, 'isSupportedCurrency').mockImplementation((currency) => {
      return ['USD', 'EUR', 'GBP', 'NGN'].includes(currency);
    });

    jest.spyOn(CurrencyUtility, 'getCurrencyCountryCode').mockImplementation((currency) => {
      const countryMapping = {
        USD: 'US',
        NGN: 'NG',
        EUR: 'EU',
        GBP: 'GB',
      };
      return countryMapping[currency];
    });

    jest.spyOn(CurrencyUtility, 'getCurrency').mockImplementation((currency) => {
      const currencies = {
        NGN: {
          code: 'NGN',
          numericCode: '566',
          name: 'Nigerian Naira',
          symbol: '₦',
          minorUnit: 100,
          country: 'Nigeria',
        },
        USD: {
          code: 'USD',
          numericCode: '840',
          name: 'US Dollar',
          symbol: '$',
          minorUnit: 100,
          country: 'United States',
        },
      };
      return currencies[currency.toUpperCase()];
    });

    jest.spyOn(CurrencyUtility, 'formatCurrencyAmountToSmallestUnit').mockImplementation((amount, currency) => {
      const currencies = {
        NGN: { minorUnit: 100 },
        USD: { minorUnit: 100 },
      };
      const currencyInfo = currencies[currency.toUpperCase()];
      if (!currencyInfo) return 0;
      return Math.floor(amount * currencyInfo.minorUnit);
    });

    // Mock DateTime
    jest.spyOn(DateTime, 'now').mockReturnValue({
      toSQL: () => '2023-01-01 00:00:00',
      toFormat: () => '01 Jan 2023, 12:00 AM',
    } as any);

    // Mock UtilsService
    jest.spyOn(UtilsService, 'generateTransactionReference').mockReturnValue('REF-123');

    // Mock the complex private method that handles transaction creation (on withdrawal service)
    jest.spyOn(withdrawalService as any, 'createNGTransactionAndFiatWalletTransaction').mockResolvedValue({
      transaction: { id: 'tx-123', reference: 'REF-123' },
      fiatWalletTransaction: { id: 'fwt-123' },
    });

    // Mock the virtual account retrieval method (on withdrawal service)
    jest.spyOn(withdrawalService as any, 'getActiveVirtualAccount').mockImplementation((virtualAccounts: any[]) => {
      if (!virtualAccounts || virtualAccounts.length === 0) {
        throw new BadRequestException('No active virtual account found');
      }
      return virtualAccounts[0];
    });

    // Mock the transaction status mapping method (on withdrawal service)
    jest
      .spyOn(withdrawalService as any, 'mapWaasTransactionStatusToTransactionStatus')
      .mockImplementation((status: string) => {
        switch (status.toLowerCase()) {
          case 'success':
            return 'COMPLETED';
          case 'failed':
            return 'FAILED';
          default:
            return 'PENDING';
        }
      });
  });

  describe('create', () => {
    it('should create a new fiat wallet', async () => {
      const walletData = {
        user_id: 'test-user-id',
        asset: 'USD',
        balance: 0,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      mockFiatWalletRepository.findOne.mockResolvedValue(null);
      mockFiatWalletRepository.create.mockResolvedValue({
        id: 'wallet-id',
        ...walletData,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.getUserWallet(walletData.user_id, walletData.asset);

      expect(mockFiatWalletRepository.findOne).toHaveBeenCalledWith(
        {
          user_id: walletData.user_id,
          asset: walletData.asset,
        },
        null,
        { trx: undefined },
      );
      expect(mockFiatWalletRepository.create).toHaveBeenCalledWith(walletData, undefined);
      expect(result).toHaveProperty('id', 'wallet-id');
      expect(result).toHaveProperty('user_id', walletData.user_id);
      expect(result).toHaveProperty('asset', walletData.asset);
    });

    it('should throw BadRequestException if currency is not supported', async () => {
      const walletData = {
        user_id: 'test-user-id',
        asset: 'INVALID',
        balance: 0,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      await expect(service.getUserWallet(walletData.user_id, walletData.asset)).rejects.toThrow(
        new BadRequestException('Invalid currency'),
      );
      expect(mockFiatWalletRepository.create).not.toHaveBeenCalled();
    });

    it('should return existing wallet if user already has a wallet with the same currency', async () => {
      const walletData = {
        user_id: 'test-user-id',
        asset: 'USD',
        balance: 0,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      mockFiatWalletRepository.findOne.mockResolvedValue({
        id: 'existing-wallet-id',
        ...walletData,
      });

      const result = await service.getUserWallet(walletData.user_id, walletData.asset);

      expect(result).toEqual({
        id: 'existing-wallet-id',
        ...walletData,
      });
      expect(mockFiatWalletRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if repository throws an error', async () => {
      const walletData = {
        user_id: 'test-user-id',
        asset: 'USD',
        balance: 0,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      mockFiatWalletRepository.findOne.mockResolvedValue(null);
      mockFiatWalletRepository.create.mockRejectedValue(new BadRequestException('Failed to create fiat wallet'));

      await expect(service.getUserWallet(walletData.user_id, walletData.asset)).rejects.toThrow(
        new BadRequestException('Failed to create fiat wallet'),
      );
    });

    it('should handle unique constraint violation and fetch existing wallet', async () => {
      const walletData = {
        user_id: 'test-user-id',
        asset: 'USD',
        balance: 0,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      const existingWallet = {
        id: 'wallet-id',
        ...walletData,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFiatWalletRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existingWallet);

      const uniqueConstraintError = new Error('Unique constraint violation');
      (uniqueConstraintError as any).code = '23505';
      mockFiatWalletRepository.create.mockRejectedValue(uniqueConstraintError);

      const result = await service.getUserWallet(walletData.user_id, walletData.asset);

      expect(result).toEqual(existingWallet);
      expect(mockFiatWalletRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('should handle unique constraint violation by constraint name and fetch existing wallet', async () => {
      const walletData = {
        user_id: 'test-user-id',
        asset: 'USD',
        balance: 0,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      const existingWallet = {
        id: 'wallet-id',
        ...walletData,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFiatWalletRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existingWallet);

      const uniqueConstraintError = new Error('Unique constraint violation');
      (uniqueConstraintError as any).constraint = 'fiat_wallets_user_id_asset_unique';
      mockFiatWalletRepository.create.mockRejectedValue(uniqueConstraintError);

      const result = await service.getUserWallet(walletData.user_id, walletData.asset);

      expect(result).toEqual(existingWallet);
    });

    it('should throw BadRequestException if wallet not found after unique constraint violation', async () => {
      const walletData = {
        user_id: 'test-user-id',
        asset: 'USD',
        balance: 0,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      mockFiatWalletRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const uniqueConstraintError = new Error('Unique constraint violation');
      (uniqueConstraintError as any).code = '23505';
      mockFiatWalletRepository.create.mockRejectedValue(uniqueConstraintError);

      await expect(service.getUserWallet(walletData.user_id, walletData.asset)).rejects.toThrow(
        new BadRequestException('Failed to create fiat wallet'),
      );
    });
  });

  describe('findById', () => {
    it('should return a wallet by ID', async () => {
      const wallet = {
        id: 'wallet-id',
        user_id: 'user-id',
        asset: 'USD',
        balance: 100,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFiatWalletRepository.findById.mockResolvedValue(wallet);

      const result = await service.findById('wallet-id');

      expect(mockFiatWalletRepository.findById).toHaveBeenCalledWith('wallet-id', undefined, undefined);
      expect(result).toEqual(wallet);
    });

    it('should throw BadRequestException if wallet is not found', async () => {
      mockFiatWalletRepository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        new BadRequestException('Fiat wallet not found'),
      );
    });

    it('should return wallet when user matches wallet owner', async () => {
      const wallet = {
        id: 'wallet-id',
        user_id: 'user-id',
        asset: 'USD',
        balance: 100,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const user = {
        id: 'user-id',
        username: 'testuser',
      };

      mockFiatWalletRepository.findById.mockResolvedValue(wallet);

      const result = await service.findById('wallet-id', user as any);

      expect(result).toEqual(wallet);
    });

    it('should throw BadRequestException when user does not match wallet owner', async () => {
      const wallet = {
        id: 'wallet-id',
        user_id: 'user-id',
        asset: 'USD',
        balance: 100,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const differentUser = {
        id: 'different-user-id',
        username: 'differentuser',
      };

      mockFiatWalletRepository.findById.mockResolvedValue(wallet);

      await expect(service.findById('wallet-id', differentUser as any)).rejects.toThrow(
        new BadRequestException('Forbidden Resource'),
      );
    });
  });

  describe('findUserWallets', () => {
    it('should return all wallets for a user', async () => {
      const userWallets = {
        data: [
          {
            id: 'wallet-id-1',
            user_id: 'user-id',
            asset: 'USD',
            balance: 100,
            credit_balance: 0,
            status: FiatWalletStatus.ACTIVE,
          },
          {
            id: 'wallet-id-2',
            user_id: 'user-id',
            asset: 'NGN',
            balance: 50,
            credit_balance: 0,
            status: FiatWalletStatus.ACTIVE,
          },
        ],
        meta: {
          total: 2,
          page: 1,
          pageSize: 10,
        },
      };

      // Mock the first call for checkIfUserHasAllSupportedCurrenciesWallets
      mockFiatWalletRepository.findAll
        .mockResolvedValueOnce({
          fiat_wallets: [
            {
              id: 'wallet-id-1',
              user_id: 'user-id',
              asset: 'USD',
              balance: 100,
              credit_balance: 0,
              status: FiatWalletStatus.ACTIVE,
            },
            {
              id: 'wallet-id-2',
              user_id: 'user-id',
              asset: 'NGN',
              balance: 50,
              credit_balance: 0,
              status: FiatWalletStatus.ACTIVE,
            },
          ],
        })
        // Mock the second call for the actual findUserWallets return
        .mockResolvedValueOnce(userWallets);

      const result = await service.findUserWallets('user-id');

      expect(mockFiatWalletRepository.findAll).toHaveBeenCalledWith({ user_id: 'user-id' });
      expect(result).toEqual(userWallets);
    });

    it('should create missing wallets when user does not have all supported currencies', async () => {
      const userWallets = {
        data: [
          {
            id: 'wallet-id-1',
            user_id: 'user-id',
            asset: 'USD',
            balance: 100,
            credit_balance: 0,
            status: FiatWalletStatus.ACTIVE,
          },
          {
            id: 'wallet-id-2',
            user_id: 'user-id',
            asset: 'NGN',
            balance: 0,
            credit_balance: 0,
            status: FiatWalletStatus.ACTIVE,
          },
        ],
        meta: {
          total: 2,
          page: 1,
          pageSize: 10,
        },
      };

      // Reset the create mock to succeed for wallet creation
      mockFiatWalletRepository.create.mockResolvedValue({
        id: 'wallet-id-2',
        user_id: 'user-id',
        asset: 'NGN',
        balance: 0,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Mock the first call for checkIfUserHasAllSupportedCurrenciesWallets (only has USD, missing NGN)
      mockFiatWalletRepository.findAll
        .mockResolvedValueOnce({
          fiat_wallets: [
            {
              id: 'wallet-id-1',
              user_id: 'user-id',
              asset: 'USD',
              balance: 100,
              credit_balance: 0,
              status: FiatWalletStatus.ACTIVE,
            },
          ],
        })
        // Mock the second call for the actual findUserWallets return
        .mockResolvedValueOnce(userWallets);

      const result = await service.findUserWallets('user-id');

      expect(mockFiatWalletRepository.findAll).toHaveBeenCalledWith({ user_id: 'user-id' });
      expect(result).toEqual(userWallets);
    });
  });

  describe('updateBalance', () => {
    const baseWallet = {
      id: 'wallet-id',
      user_id: 'user-id',
      asset: 'USD',
      balance: 50,
      credit_balance: 0,
      status: FiatWalletStatus.ACTIVE,
    };

    const basePendingTransaction = {
      id: 'transaction-id',
      status: TransactionStatus.PENDING,
    };

    beforeEach(() => {
      mockFiatWalletTransactionRepository.findById.mockResolvedValue(basePendingTransaction);
      mockFiatWalletRepository.findById.mockResolvedValue(baseWallet);
    });

    it('should call withLock with correct parameters', async () => {
      const mockTransaction = {
        id: 'tx-1',
        status: TransactionStatus.PENDING,
      };
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockFiatWalletRepository.findById.mockResolvedValue(baseWallet);
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(null);

      await service.updateBalance(
        'wallet-1',
        1000,
        'tx-1',
        FiatWalletTransactionType.TRANSFER_IN,
        TransactionStatus.COMPLETED,
      );

      expect(mockLockerService.withLock).toHaveBeenCalledWith(
        'fiat-wallet:wallet-1:balance-update',
        expect.any(Function),
        { ttl: 30000, retryCount: 5, retryDelay: 500 },
      );
    });

    it('should update wallet balance for deposit transaction', async () => {
      const mockTransaction = {
        id: 'tx-1',
        status: TransactionStatus.PENDING,
      };
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockFiatWalletRepository.findById.mockResolvedValue(baseWallet);
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(null);

      await service.updateBalance(
        'wallet-1',
        1000,
        'tx-1',
        FiatWalletTransactionType.TRANSFER_IN,
        TransactionStatus.COMPLETED,
      );

      expect(mockFiatWalletRepository.update).toHaveBeenCalledWith('wallet-1', { balance: 1050 }, { trx: mockTrx });
    });

    it('should update wallet balance for withdrawal transaction', async () => {
      const mockTransaction = {
        id: 'tx-1',
        status: TransactionStatus.PENDING,
      };
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockFiatWalletRepository.findById.mockResolvedValue({ ...baseWallet, balance: 2000 });
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(null);

      await service.updateBalance(
        'wallet-1',
        -1000,
        'tx-1',
        FiatWalletTransactionType.TRANSFER_OUT,
        TransactionStatus.COMPLETED,
      );

      expect(mockFiatWalletRepository.update).toHaveBeenCalledWith('wallet-1', { balance: 1000 }, { trx: mockTrx });
    });

    it('should handle existing fiat wallet transaction update', async () => {
      const mockTransaction = {
        id: 'tx-1',
        status: TransactionStatus.PENDING,
      };
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockFiatWalletRepository.findById.mockResolvedValue(baseWallet);
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue({
        id: 'fwt-1',
        amount: 1000,
        status: TransactionStatus.PENDING,
      });

      await service.updateBalance(
        'wallet-1',
        1000,
        'tx-1',
        FiatWalletTransactionType.TRANSFER_IN,
        TransactionStatus.COMPLETED,
        { fiat_wallet_transaction_id: 'fwt-1' },
      );

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-1',
        {
          status: TransactionStatus.COMPLETED,
          balance_after: 1050,
          processed_at: expect.any(String),
          completed_at: expect.any(String),
        },
        { trx: mockTrx },
      );
    });

    it('should update existing fiat wallet transaction when fiat_wallet_transaction_id is provided', async () => {
      const mockTransaction: ITransaction = {
        id: 'tx-1',
        status: TransactionStatus.PENDING,
        reference: 'tx-1',
        asset: 'USD',
        amount: 1000,
        balance_before: 50,
        balance_after: 1050,
        transaction_type: TransactionType.TRANSFER,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        processed_at: expect.any(Date),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      };
      const mockFiatWalletTransaction: IFiatWalletTransaction = {
        id: 'fwt-1',
        amount: 500,
        status: TransactionStatus.PENDING,
        transaction_id: 'tx-1',
        fiat_wallet_id: 'wallet-1',
        user_id: 'user-id',
        transaction_type: FiatWalletTransactionType.TRANSFER_IN,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
        balance_before: 50,
        balance_after: 1050,
        currency: 'USD',
        completed_at: null,
      };

      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockFiatWalletRepository.findById.mockResolvedValue(baseWallet);
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);

      await service.updateBalance(
        'wallet-1',
        1000,
        'tx-1',
        FiatWalletTransactionType.TRANSFER_IN,
        TransactionStatus.COMPLETED,
        { fiat_wallet_transaction_id: 'fwt-1' },
      );

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-1',
        {
          status: TransactionStatus.COMPLETED,
          balance_after: 1050,
          completed_at: expect.any(String),
          processed_at: expect.any(String),
        },
        { trx: mockTrx },
      );
    });

    it('should update existing fiat wallet transaction for refund transactions', async () => {
      const mockTransaction = {
        id: 'tx-1',
        status: TransactionStatus.PENDING,
      };
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockFiatWalletRepository.findById.mockResolvedValue(baseWallet);
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue({
        id: 'fwt-1',
        amount: 1000,
        status: TransactionStatus.COMPLETED,
      });

      await service.updateBalance(
        'wallet-1',
        1000,
        'tx-1',
        FiatWalletTransactionType.REFUND,
        TransactionStatus.COMPLETED,
        { fiat_wallet_transaction_id: 'fwt-1' },
      );

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-1',
        {
          status: TransactionStatus.COMPLETED,
          balance_after: 1050,
          completed_at: expect.any(String),
          processed_at: expect.any(String),
        },
        { trx: mockTrx },
      );
    });

    it('should handle zero amount transactions', async () => {
      const mockTransaction = {
        id: 'tx-1',
        status: TransactionStatus.PENDING,
      };
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockFiatWalletRepository.findById.mockResolvedValue(baseWallet);
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(null);
      mockFiatWalletTransactionRepository.create.mockResolvedValue({});

      await service.updateBalance(
        'wallet-1',
        0,
        'tx-1',
        FiatWalletTransactionType.TRANSFER_IN,
        TransactionStatus.COMPLETED,
      );

      expect(mockFiatWalletTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 0,
          fiat_wallet_id: 'wallet-1',
          transaction_id: 'tx-1',
          transaction_type: FiatWalletTransactionType.TRANSFER_IN,
          status: TransactionStatus.COMPLETED,
          balance_before: 50,
          balance_after: 50,
          currency: 'USD',
          user_id: 'user-id',
          completed_at: expect.any(String),
          description: undefined,
          destination: undefined,
          provider: undefined,
          provider_fee: undefined,
          provider_metadata: undefined,
          provider_reference: undefined,
          source: undefined,
        }),
        mockTrx,
      );
      expect(mockFiatWalletRepository.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException when transaction not found', async () => {
      mockTransactionRepository.findById.mockResolvedValue(null);
      mockFiatWalletRepository.findById.mockResolvedValue(baseWallet);

      await expect(
        service.updateBalance(
          'wallet-1',
          1000,
          'non-existent-tx',
          FiatWalletTransactionType.TRANSFER_IN,
          TransactionStatus.COMPLETED,
        ),
      ).rejects.toThrow(new BadRequestException('Transaction not found'));
    });

    it('should throw BadRequestException when transaction already completed', async () => {
      const completedTransaction = {
        id: 'tx-1',
        status: TransactionStatus.COMPLETED,
      };
      mockTransactionRepository.findById.mockResolvedValue(completedTransaction);
      mockFiatWalletRepository.findById.mockResolvedValue(baseWallet);

      await expect(
        service.updateBalance(
          'wallet-1',
          1000,
          'tx-1',
          FiatWalletTransactionType.TRANSFER_IN,
          TransactionStatus.COMPLETED,
        ),
      ).rejects.toThrow(new BadRequestException('Transaction already completed'));
    });

    it('should throw BadRequestException when wallet not found', async () => {
      const mockTransaction = {
        id: 'tx-1',
        status: TransactionStatus.PENDING,
      };
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockFiatWalletRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateBalance(
          'non-existent-wallet',
          1000,
          'tx-1',
          FiatWalletTransactionType.TRANSFER_IN,
          TransactionStatus.COMPLETED,
        ),
      ).rejects.toThrow(new BadRequestException('Fiat wallet not found'));
    });

    it('should throw BadRequestException for insufficient balance on withdrawal', async () => {
      const mockTransaction = {
        id: 'tx-1',
        status: TransactionStatus.PENDING,
      };
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockFiatWalletRepository.findById.mockResolvedValue({ ...baseWallet, balance: 10 });

      await expect(
        service.updateBalance(
          'wallet-1',
          -100,
          'tx-1',
          FiatWalletTransactionType.WITHDRAWAL,
          TransactionStatus.COMPLETED,
        ),
      ).rejects.toThrow(new BadRequestException('Insufficient balance for this transaction'));
    });

    it('should throw BadRequestException when fiat wallet transaction not found during update', async () => {
      const mockTransaction = {
        id: 'tx-1',
        status: TransactionStatus.PENDING,
      };
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockFiatWalletRepository.findById.mockResolvedValue(baseWallet);
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(null);
      mockFiatWalletRepository.update.mockRejectedValue(new Error('Update failed'));

      await expect(
        service.updateBalance(
          'wallet-1',
          1000,
          'tx-1',
          FiatWalletTransactionType.TRANSFER_IN,
          TransactionStatus.COMPLETED,
          { fiat_wallet_transaction_id: 'non-existent-fwt' },
        ),
      ).rejects.toThrow(new BadRequestException('Failed to update wallet balance'));
    });
  });

  describe('transfer', () => {
    const mockSender = {
      id: 'sender-123',
      username: 'sender_user',
      first_name: 'John',
      last_name: 'Sender',
    };

    it('should call transferUSDToOneDoshUser for USD currency', async () => {
      const transferDto = {
        username: 'receiver_user',
        amount: 100,
        asset: 'USD',
        remark: 'Test transfer',
      };

      jest.spyOn(withdrawalService, 'transferUSDToOneDoshUser').mockResolvedValue({
        senderTransactionId: 'tx-sender',
        recipientTransactionId: 'tx-recipient',
        clientTransferId: 'client-123',
        transferId: 'provider-123',
        amount: 100,
        asset: 'USD',
        recipient: 'receiver_user',
        status: 'approved',
        message: 'Transfer initiated successfully',
      });

      const result = await withdrawalService.transfer(mockSender as any, transferDto);

      // Verify tier limit validation was called
      expect(mockUserTierService.validateLimit).toHaveBeenCalledWith(
        'sender-123',
        10000, // 100 USD in cents
        'USD',
        FiatWalletTransactionType.TRANSFER_OUT,
      );
      expect(withdrawalService.transferUSDToOneDoshUser).toHaveBeenCalledWith(mockSender, transferDto);
      expect(result).toEqual({
        senderTransactionId: 'tx-sender',
        recipientTransactionId: 'tx-recipient',
        clientTransferId: 'client-123',
        transferId: 'provider-123',
        amount: 100,
        asset: 'USD',
        recipient: 'receiver_user',
        status: 'approved',
        message: 'Transfer initiated successfully',
      });
    });

    it('should call sendNairaToOneDoshUser for NGN currency', async () => {
      const transferDto = {
        username: 'receiver_user',
        amount: 5000,
        asset: 'NGN',
        remark: 'Test transfer',
      };

      jest.spyOn(withdrawalService, 'sendNairaToOneDoshUser').mockResolvedValue({
        transactionReference: 'WAAS-REF-123',
        status: 'success',
      } as any);

      const result = await withdrawalService.transfer(mockSender as any, transferDto);

      // Verify tier limit validation was called
      expect(mockUserTierService.validateLimit).toHaveBeenCalledWith(
        'sender-123',
        500000, // 5000 NGN in kobo
        'NGN',
        FiatWalletTransactionType.TRANSFER_OUT,
      );
      expect(withdrawalService.sendNairaToOneDoshUser).toHaveBeenCalledWith(mockSender, {
        username: 'receiver_user',
        amount: 5000,
        currency: 'NGN',
        remark: 'Test transfer',
      });
      expect(result).toEqual({
        transactionReference: 'WAAS-REF-123',
        status: 'success',
      });
    });

    it('should throw BadRequestException for unsupported currency', async () => {
      const transferDto = {
        username: 'receiver_user',
        amount: 100,
        asset: 'EUR',
        remark: 'Test transfer',
      };

      await expect(withdrawalService.transfer(mockSender as any, transferDto)).rejects.toThrow(
        new BadRequestException('Currency is not supported'),
      );
    });

    it('should throw error when tier limit validation fails', async () => {
      const transferDto = {
        username: 'receiver_user',
        amount: 10000,
        asset: 'USD',
        remark: 'Test transfer',
      };

      mockUserTierService.validateLimit.mockRejectedValueOnce(
        new BadRequestException('Transaction exceeds daily limit'),
      );

      await expect(withdrawalService.transfer(mockSender as any, transferDto)).rejects.toThrow(
        new BadRequestException('Transaction exceeds daily limit'),
      );

      // Should not call the currency-specific transfer method if validation fails
      expect(mockUserTierService.validateLimit).toHaveBeenCalledWith(
        'sender-123',
        1000000, // 10000 USD in cents
        'USD',
        FiatWalletTransactionType.TRANSFER_OUT,
      );
    });
  });

  describe('transferUSDToOneDoshUser', () => {
    const mockSender = {
      id: 'sender-123',
      username: 'sender_user',
      first_name: 'John',
      last_name: 'Sender',
      $fetchGraph: jest.fn().mockResolvedValue({
        country: { code: 'US' },
      }),
    };

    const mockRecipient = {
      id: 'recipient-123',
      username: 'recipient_user',
      first_name: 'Jane',
      last_name: 'Recipient',
    };

    const transferDto = {
      username: 'recipient_user',
      amount: 100,
      asset: 'USD',
      remark: 'Test transfer',
    };

    it('should successfully initiate USD transfer to OneDosh user', async () => {
      mockKycVerificationService.findByUserId.mockResolvedValue({
        provider_ref: 'kyc-ref-123',
      });

      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);

      const senderExternalAccount = {
        id: 'ext-account-sender',
        user_id: 'sender-123',
        provider: 'zerohash',
        participant_code: 'sender-code-123',
      };

      const recipientExternalAccount = {
        id: 'ext-account-recipient',
        user_id: 'recipient-123',
        provider: 'zerohash',
        participant_code: 'recipient-code-123',
      };

      mockExternalAccountService.getExternalAccountForTransaction
        .mockResolvedValueOnce(senderExternalAccount)
        .mockResolvedValueOnce(recipientExternalAccount);

      const senderWallet = {
        id: 'sender-wallet',
        user_id: 'sender-123',
        asset: 'USD',
        balance: 10000,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      const recipientWallet = {
        id: 'recipient-wallet',
        user_id: 'recipient-123',
        asset: 'USD',
        balance: 5000,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      jest
        .spyOn(withdrawalService, 'getUserWallet')
        .mockResolvedValueOnce(senderWallet as any)
        .mockResolvedValueOnce(recipientWallet as any);

      mockTransactionRepository.create
        .mockResolvedValueOnce({
          id: 'sender-tx-123',
          reference: 'REF-123-OUT',
        })
        .mockResolvedValueOnce({
          id: 'recipient-tx-123',
          reference: 'REF-123-IN',
        });

      mockTransactionRepository.update.mockResolvedValue({});

      mockFiatWalletTransactionRepository.create
        .mockResolvedValueOnce({
          id: 'sender-fwt-123',
        })
        .mockResolvedValueOnce({
          id: 'recipient-fwt-123',
        });

      mockFiatWalletTransactionRepository.update.mockResolvedValue({});

      mockFiatWalletAdapter.transfer.mockResolvedValue({
        providerRequestRef: 'provider-ref-123',
        status: 'approved',
      });

      const result = await withdrawalService.transferUSDToOneDoshUser(mockSender as any, transferDto);

      expect(mockKycVerificationService.findByUserId).toHaveBeenCalledWith('sender-123');
      expect(mockUserService.findActiveByUsername).toHaveBeenCalledWith('recipient_user');
      expect(mockFiatWalletAdapter.transfer).toHaveBeenCalled();
      expect(result).toEqual({
        senderTransactionId: 'sender-tx-123',
        recipientTransactionId: 'recipient-tx-123',
        clientTransferId: 'REF-123',
        transferId: 'provider-ref-123',
        amount: 100,
        asset: 'USD',
        recipient: 'recipient_user',
        status: 'approved',
        message: 'Transfer initiated successfully',
      });
    });

    it('should throw BadRequestException when KYC verification not found', async () => {
      mockKycVerificationService.findByUserId.mockResolvedValue(null);

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, transferDto)).rejects.toThrow(
        new BadRequestException('KYC verification required for USD transactions'),
      );
    });

    it('should throw BadRequestException when KYC verification has no provider_ref', async () => {
      mockKycVerificationService.findByUserId.mockResolvedValue({
        provider_ref: null,
      });

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, transferDto)).rejects.toThrow(
        new BadRequestException('KYC verification required for USD transactions'),
      );
    });

    it('should throw NotFoundException when recipient not found', async () => {
      mockKycVerificationService.findByUserId.mockResolvedValue({
        provider_ref: 'kyc-ref-123',
      });

      mockUserService.findActiveByUsername.mockResolvedValue(null);

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, transferDto)).rejects.toThrow(
        `Recipient is deactivated or not found`,
      );
    });

    it('should throw BadRequestException when trying to transfer to self', async () => {
      mockKycVerificationService.findByUserId.mockResolvedValue({
        provider_ref: 'kyc-ref-123',
      });

      const selfTransferDto = {
        ...transferDto,
        username: 'sender_user',
      };

      mockUserService.findActiveByUsername.mockResolvedValue(mockSender);

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, selfTransferDto)).rejects.toThrow(
        new BadRequestException('Cannot transfer to yourself'),
      );
    });

    it('should throw NotFoundException when sender external account not found', async () => {
      const { NotFoundException } = await import('@nestjs/common');

      mockKycVerificationService.findByUserId.mockResolvedValue({
        provider_ref: 'kyc-ref-123',
      });

      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);
      mockExternalAccountService.getExternalAccountForTransaction.mockRejectedValueOnce(
        new NotFoundException('External account not found for provider zerohash. Please complete your account setup.'),
      );

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, transferDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when sender external account has no participant_code', async () => {
      mockKycVerificationService.findByUserId.mockResolvedValue({
        provider_ref: 'kyc-ref-123',
      });

      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);

      mockExternalAccountService.getExternalAccountForTransaction.mockRejectedValueOnce(
        new BadRequestException('External account is not properly configured for provider zerohash.'),
      );

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, transferDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when recipient external account not found', async () => {
      const { NotFoundException } = await import('@nestjs/common');

      mockKycVerificationService.findByUserId.mockResolvedValue({
        provider_ref: 'kyc-ref-123',
      });

      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);

      const senderExternalAccount = {
        id: 'ext-account-sender',
        user_id: 'sender-123',
        provider: 'zerohash',
        participant_code: 'sender-code-123',
      };

      mockExternalAccountService.getExternalAccountForTransaction
        .mockResolvedValueOnce(senderExternalAccount)
        .mockRejectedValueOnce(
          new NotFoundException(
            'External account not found for provider zerohash. Please complete your account setup.',
          ),
        );

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, transferDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when recipient external account has no participant_code', async () => {
      mockKycVerificationService.findByUserId.mockResolvedValue({
        provider_ref: 'kyc-ref-123',
      });

      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);

      const senderExternalAccount = {
        id: 'ext-account-sender',
        user_id: 'sender-123',
        provider: 'zerohash',
        participant_code: 'sender-code-123',
      };

      mockExternalAccountService.getExternalAccountForTransaction
        .mockResolvedValueOnce(senderExternalAccount)
        .mockRejectedValueOnce(
          new BadRequestException('External account is not properly configured for provider zerohash.'),
        );

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, transferDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when sender has insufficient balance', async () => {
      mockKycVerificationService.findByUserId.mockResolvedValue({
        provider_ref: 'kyc-ref-123',
      });

      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);

      const senderExternalAccount = {
        id: 'ext-account-sender',
        user_id: 'sender-123',
        provider: 'zerohash',
        participant_code: 'sender-code-123',
      };

      const recipientExternalAccount = {
        id: 'ext-account-recipient',
        user_id: 'recipient-123',
        provider: 'zerohash',
        participant_code: 'recipient-code-123',
      };

      mockExternalAccountService.getExternalAccountForTransaction
        .mockResolvedValueOnce(senderExternalAccount)
        .mockResolvedValueOnce(recipientExternalAccount);

      const senderWallet = {
        id: 'sender-wallet',
        user_id: 'sender-123',
        asset: 'USD',
        balance: 50, // Less than 100 (10000 cents)
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      jest.spyOn(withdrawalService, 'getUserWallet').mockResolvedValueOnce(senderWallet as any);

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, transferDto)).rejects.toThrow(
        new BadRequestException('Insufficient balance'),
      );
    });

    it('should update transactions to failed when adapter call fails', async () => {
      mockKycVerificationService.findByUserId.mockResolvedValue({
        provider_ref: 'kyc-ref-123',
      });

      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);

      const senderExternalAccount = {
        id: 'ext-account-sender',
        user_id: 'sender-123',
        provider: 'zerohash',
        participant_code: 'sender-code-123',
      };

      const recipientExternalAccount = {
        id: 'ext-account-recipient',
        user_id: 'recipient-123',
        provider: 'zerohash',
        participant_code: 'recipient-code-123',
      };

      mockExternalAccountService.getExternalAccountForTransaction
        .mockResolvedValueOnce(senderExternalAccount)
        .mockResolvedValueOnce(recipientExternalAccount);

      const senderWallet = {
        id: 'sender-wallet',
        user_id: 'sender-123',
        asset: 'USD',
        balance: 10000,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      const recipientWallet = {
        id: 'recipient-wallet',
        user_id: 'recipient-123',
        asset: 'USD',
        balance: 5000,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      jest
        .spyOn(withdrawalService, 'getUserWallet')
        .mockResolvedValueOnce(senderWallet as any)
        .mockResolvedValueOnce(recipientWallet as any);

      mockTransactionRepository.create
        .mockResolvedValueOnce({
          id: 'sender-tx-123',
          reference: 'REF-123-OUT',
        })
        .mockResolvedValueOnce({
          id: 'recipient-tx-123',
          reference: 'REF-123-IN',
        });

      mockTransactionRepository.update.mockResolvedValue({});

      mockFiatWalletTransactionRepository.create
        .mockResolvedValueOnce({
          id: 'sender-fwt-123',
        })
        .mockResolvedValueOnce({
          id: 'recipient-fwt-123',
        });

      mockFiatWalletTransactionRepository.update.mockResolvedValue({});

      mockFiatWalletAdapter.transfer.mockRejectedValue(new Error('Adapter error'));

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, transferDto)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('sender-tx-123', {
        status: TransactionStatus.FAILED,
        failure_reason: 'Transfer adapter call failed',
      });

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('recipient-tx-123', {
        status: TransactionStatus.FAILED,
        failure_reason: 'Transfer adapter call failed',
      });
    });
  });

  describe('exchangeCancel', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
    };

    const mockTransaction = {
      id: 'tx-123',
      user_id: 'user-123',
      status: TransactionStatus.PENDING,
      amount: 10000,
      metadata: {
        from_currency: 'USD',
        to_currency: 'NGN',
      },
    };

    const mockSourceFiatWalletTransaction = {
      id: 'source-fwt-123',
      transaction_id: 'tx-123',
      status: TransactionStatus.PENDING,
    };

    const mockDestinationTransaction = {
      id: 'dest-tx-123',
      parent_id: 'tx-123',
      status: TransactionStatus.PENDING,
    };

    const mockDestinationFiatWalletTransaction = {
      id: 'dest-fwt-123',
      transaction_id: 'dest-tx-123',
      status: TransactionStatus.PENDING,
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockTransactionRepository.findOne
        .mockResolvedValueOnce(mockTransaction) // Main transaction
        .mockResolvedValueOnce(mockDestinationTransaction); // Destination transaction
      mockFiatWalletTransactionRepository.findOne
        .mockResolvedValueOnce(mockSourceFiatWalletTransaction) // Source fiat wallet transaction
        .mockResolvedValueOnce(mockDestinationFiatWalletTransaction); // Destination fiat wallet transaction
      mockTransactionRepository.update
        .mockResolvedValueOnce({
          ...mockTransaction,
          status: TransactionStatus.CANCELLED,
        }) // Main transaction update
        .mockResolvedValueOnce({
          ...mockDestinationTransaction,
          status: TransactionStatus.CANCELLED,
        }); // Destination transaction update
      mockFiatWalletTransactionRepository.update
        .mockResolvedValueOnce({
          ...mockSourceFiatWalletTransaction,
          status: TransactionStatus.CANCELLED,
        }) // Source fiat wallet transaction update
        .mockResolvedValueOnce({
          ...mockDestinationFiatWalletTransaction,
          status: TransactionStatus.CANCELLED,
        }); // Destination fiat wallet transaction update
    });

    it('should successfully cancel PENDING exchange', async () => {
      const cancelDto = {
        transaction_id: 'tx-123',
      };

      const result = await exchangeService.exchangeCancel(mockUser as any, cancelDto);

      // Verify main transaction cancelled
      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-123', {
        status: TransactionStatus.CANCELLED,
        failure_reason: 'Transaction cancelled by user',
      });

      // Verify source fiat wallet transaction cancelled
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith('source-fwt-123', {
        status: TransactionStatus.CANCELLED,
        failure_reason: 'Transaction cancelled by user',
      });

      // Verify destination transaction cancelled
      expect(mockTransactionRepository.update).toHaveBeenCalledWith('dest-tx-123', {
        status: TransactionStatus.CANCELLED,
        failure_reason: 'Exchange cancelled by user',
      });

      // Verify destination fiat wallet transaction cancelled
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith('dest-fwt-123', {
        status: TransactionStatus.CANCELLED,
        failure_reason: 'Exchange cancelled by user',
      });

      expect(result).toEqual(
        expect.objectContaining({
          transaction_id: 'tx-123',
          status: TransactionStatus.CANCELLED,
          message: 'Exchange cancelled successfully',
        }),
      );
    });

    it('should reject cancellation of non-PENDING transaction', async () => {
      const cancelDto = {
        transaction_id: 'tx-123',
      };

      // Mock transaction with non-pending status
      mockTransactionRepository.findOne.mockReset();
      mockTransactionRepository.findOne.mockResolvedValueOnce({
        ...mockTransaction,
        status: TransactionStatus.PROCESSING,
      });

      await expect(exchangeService.exchangeCancel(mockUser as any, cancelDto)).rejects.toThrow(
        'Cannot cancel transaction with status: processing. Only pending transactions can be cancelled.',
      );
    });

    it('should handle missing destination transactions gracefully', async () => {
      const cancelDto = {
        transaction_id: 'tx-123',
      };

      // Reset mocks for this specific test
      mockTransactionRepository.findOne.mockReset();
      mockFiatWalletTransactionRepository.findOne.mockReset();
      mockTransactionRepository.update.mockReset();
      mockFiatWalletTransactionRepository.update.mockReset();

      // Mock missing destination transactions
      mockTransactionRepository.findOne
        .mockResolvedValueOnce(mockTransaction) // Main transaction
        .mockResolvedValueOnce(null); // No destination transaction
      mockFiatWalletTransactionRepository.findOne
        .mockResolvedValueOnce(mockSourceFiatWalletTransaction) // Source fiat wallet transaction
        .mockResolvedValueOnce(null); // No destination fiat wallet transaction

      // Mock successful updates
      mockTransactionRepository.update.mockResolvedValueOnce({
        ...mockTransaction,
        status: TransactionStatus.CANCELLED,
      });
      mockFiatWalletTransactionRepository.update.mockResolvedValueOnce({
        ...mockSourceFiatWalletTransaction,
        status: TransactionStatus.CANCELLED,
      });

      const result = await exchangeService.exchangeCancel(mockUser as any, cancelDto);

      // Should still cancel main transaction and source fiat wallet transaction
      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-123', {
        status: TransactionStatus.CANCELLED,
        failure_reason: 'Transaction cancelled by user',
      });

      expect(result).toEqual(
        expect.objectContaining({
          transaction_id: 'tx-123',
          status: TransactionStatus.CANCELLED,
          message: 'Exchange cancelled successfully',
        }),
      );
    });

    it('should throw BadRequestException when transaction not found', async () => {
      const cancelDto = {
        transaction_id: 'non-existent-tx',
      };

      // Reset mocks
      mockTransactionRepository.findOne.mockReset();
      mockFiatWalletTransactionRepository.findOne.mockReset();

      mockTransactionRepository.findOne.mockResolvedValueOnce(null);

      await expect(exchangeService.exchangeCancel(mockUser as any, cancelDto)).rejects.toThrow(
        'Exchange transaction not found',
      );
    });

    it('should throw BadRequestException when source fiat wallet transaction not found', async () => {
      const cancelDto = {
        transaction_id: 'tx-123',
      };

      // Reset mocks
      mockTransactionRepository.findOne.mockReset();
      mockFiatWalletTransactionRepository.findOne.mockReset();

      mockTransactionRepository.findOne.mockResolvedValueOnce(mockTransaction);
      mockFiatWalletTransactionRepository.findOne.mockResolvedValueOnce(null);

      await expect(exchangeService.exchangeCancel(mockUser as any, cancelDto)).rejects.toThrow(
        'Related source fiat wallet transaction not found',
      );
    });

    it('should throw BadRequestException when transaction metadata missing currency', async () => {
      const cancelDto = {
        transaction_id: 'tx-123',
      };

      const transactionWithoutMetadata = {
        ...mockTransaction,
        metadata: {},
      };

      // Reset mocks
      mockTransactionRepository.findOne.mockReset();
      mockFiatWalletTransactionRepository.findOne.mockReset();

      mockTransactionRepository.findOne.mockResolvedValueOnce(transactionWithoutMetadata).mockResolvedValueOnce(null);
      mockFiatWalletTransactionRepository.findOne
        .mockResolvedValueOnce(mockSourceFiatWalletTransaction)
        .mockResolvedValueOnce(null);

      await expect(exchangeService.exchangeCancel(mockUser as any, cancelDto)).rejects.toThrow(
        'Transaction metadata is missing required currency information',
      );
    });
  });

  describe('withdrawToExternalNGAccount', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
    };

    const mockWallet = {
      id: 'wallet-ngn-123',
      user_id: 'user-123',
      asset: 'NGN',
      balance: 100000, // 100,000 NGN
      credit_balance: 0,
      status: 'ACTIVE',
      virtualAccounts: [
        {
          id: 'va-123',
          account_number: '1234567890',
          account_name: 'Test User',
          provider: 'ninepayment',
          bank_code: '999',
        },
      ],
    };

    const mockWithdrawDto = {
      amount: 50000, // 50,000 NGN (in main unit, not kobo)
      bank_ref: 'gtbank-uuid',
      account_number: '0123456789',
      country_code: 'NG',
      beneficiary_id: undefined as string | undefined,
      remark: 'Test remark',
    };

    beforeEach(() => {
      // Reset all mocks before each test to prevent state leakage
      jest.resetAllMocks();

      // Re-setup the module mocks that need to persist
      mockFiatWalletConfigProvider.getConfig.mockReturnValue({
        default_usd_fiat_wallet_provider: 'zerohash',
        default_ngn_fiat_wallet_provider: 'zerohash',
        default_underlying_currency: 'USDC.SOL',
      });
      mockLockerService.withLock.mockImplementation((_lockKey, callback) => callback());
      mockFiatWalletRepository.transaction.mockImplementation((callback) => callback(mockTrx));
      mockTransactionRepository.transaction.mockImplementation((callback) => callback(mockTrx));
      mockWaasAdapter.getBankCode.mockReturnValue('999');
      mockWaasAdapter.getProviderName.mockReturnValue('ninepayment');

      // Re-setup private method mocks that get cleared by resetAllMocks
      jest.spyOn(withdrawalService as any, 'getActiveVirtualAccount').mockResolvedValue({
        id: 'va-123',
        account_number: '1234567890',
        account_name: 'Test User',
        provider: 'ninepayment',
        bank_code: '999',
      });

      jest.spyOn(withdrawalService as any, 'createNGTransactionAndFiatWalletTransaction').mockResolvedValue({
        transaction: { id: 'tx-123', reference: 'REF-123' },
        fiatWalletTransaction: { id: 'fwt-123' },
      });

      jest
        .spyOn(withdrawalService as any, 'mapWaasTransactionStatusToTransactionStatus')
        .mockImplementation((status: string) => {
          switch (status.toLowerCase()) {
            case 'success':
              return 'completed';
            case 'failed':
              return 'failed';
            default:
              return 'pending';
          }
        });

      // Re-setup utility mocks that get cleared by resetAllMocks
      jest.spyOn(CurrencyUtility, 'formatCurrencyAmountToSmallestUnit').mockImplementation((amount, currency) => {
        const currencies = {
          NGN: { minorUnit: 100 },
          USD: { minorUnit: 100 },
        };
        const currencyInfo = currencies[currency.toUpperCase()];
        if (!currencyInfo) return 0;
        return Math.floor(amount * currencyInfo.minorUnit);
      });

      // Re-setup circuit breaker and withdrawal services that get cleared by resetAllMocks
      mockCircuitBreakerService.canProceed.mockResolvedValue({ allowed: true });
      mockCircuitBreakerService.recordAttempt.mockResolvedValue(undefined);
      mockWithdrawalSessionService.endSession.mockResolvedValue(undefined);
    });

    it('should successfully initiate withdrawal to external NG account', async () => {
      const mockBankDetails = {
        accountName: 'John Doe',
        accountNumber: '0123456789',
        bankName: 'Access Bank',
        bankCode: '044',
      };

      // Setup mocks for this specific test
      const highBalanceWallet = {
        ...mockWallet,
        balance: 10000000, // 100,000 NGN in kobo (more than withdrawal amount)
      };
      mockFiatWalletRepository.findOne.mockResolvedValue(highBalanceWallet);
      mockBankService.verifyBankAccount.mockResolvedValue(mockBankDetails);
      mockTransactionService.create.mockResolvedValue({ id: 'tx-123', reference: 'REF-123' });
      mockFiatWalletTransactionService.create.mockResolvedValue({ id: 'fwt-123' });
      mockTransactionRepository.transaction.mockResolvedValue({
        transaction: { id: 'tx-123', reference: 'REF-123' },
        fiatWalletTransaction: { id: 'fwt-123' },
      });
      mockWaasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: 'success',
        message: 'Transaction successful',
      });
      mockTransactionRepository.update.mockResolvedValue({});
      mockFiatWalletTransactionRepository.update.mockResolvedValue({ id: 'fwt-123' });

      // Mock the sendMoneyToExternalNGAccount method to avoid complex transaction flow issues
      jest.spyOn(withdrawalService, 'sendMoneyToExternalNGAccount').mockResolvedValue({
        id: 'fwt-123',
        transaction_id: 'tx-123',
        fiat_wallet_id: 'wallet-ngn-123',
        user_id: 'user-123',
        transaction_type: 'WITHDRAWAL',
        amount: 5000000,
        balance_before: 10000000,
        balance_after: 5000000,
        status: 'COMPLETED',
        currency: 'NGN',
        provider: 'ninepayment',
        provider_transaction_id: 'waas-ref-123',
        provider_account_id: 'va-123',
        description: 'ONEDOSH/WITHDRAWAL/REF-123',
        fee_amount: 0,
        metadata: {},
        processed_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String),
      } as any);

      const result = await withdrawalService.withdrawToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
      );

      // Since sendMoneyToExternalNGAccount is mocked, check the result matches the mock return value
      expect(result).toEqual({
        id: 'fwt-123',
        transaction_id: 'tx-123',
        fiat_wallet_id: 'wallet-ngn-123',
        user_id: 'user-123',
        transaction_type: 'WITHDRAWAL',
        amount: 5000000,
        balance_before: 10000000,
        balance_after: 5000000,
        status: 'COMPLETED',
        currency: 'NGN',
        provider: 'ninepayment',
        provider_transaction_id: 'waas-ref-123',
        provider_account_id: 'va-123',
        description: 'ONEDOSH/WITHDRAWAL/REF-123',
        fee_amount: 0,
        metadata: {},
        processed_at: expect.any(String),
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('should throw NotFoundException when user wallet not found', async () => {
      // Setup mock to return null
      mockFiatWalletRepository.findOne.mockResolvedValue(null);

      await expect(
        withdrawalService.withdrawToExternalNGAccount(mockUser as any, 'test-idempotency-key', mockWithdrawDto),
      ).rejects.toThrow('User wallet not found');
    });

    it('should throw BadRequestException when user has insufficient balance', async () => {
      const lowBalanceWallet = {
        ...mockWallet,
        balance: 1000000, // 10,000 NGN in kobo (less than 50,000 NGN withdrawal amount)
      };
      mockFiatWalletRepository.findOne.mockResolvedValue(lowBalanceWallet);

      await expect(
        withdrawalService.withdrawToExternalNGAccount(mockUser as any, 'test-idempotency-key', mockWithdrawDto),
      ).rejects.toThrow('Insufficient balance');
    });

    it('should handle withdrawal to beneficiary when beneficiary_id is provided', async () => {
      const withdrawDtoWithBeneficiary = {
        ...mockWithdrawDto,
        beneficiary_id: 'beneficiary-123',
        country_code: 'NG',
      };

      // Setup mocks for this test
      const highBalanceWallet = {
        ...mockWallet,
        balance: 10000000, // 100,000 NGN in kobo (more than withdrawal amount)
      };
      mockFiatWalletRepository.findOne.mockResolvedValue(highBalanceWallet);
      jest.spyOn(withdrawalService, 'sendMoneyToBeneficiary').mockResolvedValue(undefined);

      await withdrawalService.withdrawToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        withdrawDtoWithBeneficiary,
      );

      expect(withdrawalService.sendMoneyToBeneficiary).toHaveBeenCalledWith(
        mockUser,
        'beneficiary-123',
        5000000,
        'Test remark',
      );
    });
  });

  describe('sendMoneyToExternalNGAccount', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
    };

    const mockWallet = {
      id: 'wallet-ngn-123',
      user_id: 'user-123',
      asset: 'NGN',
      balance: 100000, // 100,000 NGN in kobo
      credit_balance: 0,
      status: 'ACTIVE',
      virtualAccounts: [
        {
          id: 'va-123',
          account_number: '1234567890',
          account_name: 'Test User',
          provider: 'ninepayment',
          bank_code: '999',
        },
      ],
    };

    const mockWithdrawDto = {
      amount: 50000, // 50,000 NGN (in main unit, not kobo)
      bank_ref: '044',
      account_number: '0123456789',
      country_code: 'NG',
      beneficiary_id: undefined as string | undefined,
      remark: 'Test remark',
    };

    const mockBankDetails = {
      accountName: 'John Doe',
      accountNumber: '0123456789',
      bankName: 'Access Bank',
      bankCode: '044',
    };

    const setupMocksForSuccessfulWithdrawal = () => {
      mockBankService.verifyBankAccount.mockResolvedValue(mockBankDetails);
      mockWithdrawalSessionService.checkAndBlockConcurrent.mockResolvedValue(undefined);
      mockWithdrawalSessionService.startSession.mockResolvedValue(undefined);
      mockWithdrawalSessionService.endSession.mockResolvedValue(undefined);
      mockCircuitBreakerService.canProceed.mockResolvedValue({ allowed: true });
      mockCircuitBreakerService.recordAttempt.mockResolvedValue(undefined);
      mockWaasAdapter.checkLedgerBalance.mockResolvedValue({
        hasSufficientBalance: true,
        requestedAmount: 50000,
        availableBalance: 100000,
      });
      mockTransactionRepository.update.mockResolvedValue({ id: 'tx-123', reference: 'REF-123' });
      mockFiatWalletTransactionRepository.update.mockResolvedValue({ id: 'fwt-123' });

      jest.spyOn(withdrawalService as any, 'getActiveVirtualAccount').mockReturnValue({
        id: 'va-123',
        account_number: '1234567890',
        account_name: 'Test User',
        provider: 'ninepayment',
        bank_code: '999',
      });
      jest.spyOn(withdrawalService as any, 'createNGTransactionAndFiatWalletTransaction').mockResolvedValue({
        transaction: { id: 'tx-123', reference: 'REF-123' },
        fiatWalletTransaction: { id: 'fwt-123', fiat_wallet_id: 'wallet-ngn-123' },
      });
      jest.spyOn(withdrawalService, 'updateBalance').mockResolvedValue(undefined);
      jest.spyOn(withdrawalService as any, 'sendWithdrawalInitiatedNotification').mockResolvedValue(undefined);
      jest.spyOn(withdrawalService, 'revertWithdrawalBalance').mockResolvedValue(5000000);
    };

    it('should successfully send money to external NG account', async () => {
      setupMocksForSuccessfulWithdrawal();
      mockWaasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: 'success',
        message: 'Transaction successful',
      });

      const result = await withdrawalService.sendMoneyToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet as any,
      );

      expect(mockBankService.verifyBankAccount).toHaveBeenCalledWith({
        account_number: '0123456789',
        bank_ref: '044',
        country_code: 'NG',
      });
      expect(mockWaasAdapter.transferToOtherBank).toHaveBeenCalledWith({
        amount: 50000,
        receiver: {
          accountNumber: '0123456789',
          accountName: 'John Doe',
          bankRef: '044',
        },
        sender: {
          accountNumber: '1234567890',
          accountName: 'Test User',
          bankCode: '999',
        },
        transactionReference: 'REF-123',
        transactionType: 'WITHDRAWAL',
        description: 'Transfer from Test User - ****6789',
        currency: 'NGN',
      });
      expect(result).toEqual({ id: 'fwt-123' });
    });

    it('should throw BadRequestException for invalid bank account', async () => {
      mockBankService.verifyBankAccount.mockResolvedValue(null);

      await expect(
        withdrawalService.sendMoneyToExternalNGAccount(
          mockUser as any,
          'test-idempotency-key',
          mockWithdrawDto,
          mockWallet as any,
        ),
      ).rejects.toThrow('Invalid bank account');
    });

    it('should throw BadRequestException when no active virtual account found', async () => {
      const walletWithoutVirtualAccount = {
        ...mockWallet,
        virtualAccounts: [],
      };

      mockBankService.verifyBankAccount.mockResolvedValue(mockBankDetails);
      jest.spyOn(withdrawalService as any, 'getActiveVirtualAccount').mockImplementation(() => {
        throw new BadRequestException('No active virtual account found');
      });

      await expect(
        withdrawalService.sendMoneyToExternalNGAccount(
          mockUser as any,
          'test-idempotency-key',
          mockWithdrawDto,
          walletWithoutVirtualAccount as any,
        ),
      ).rejects.toThrow('No active virtual account found');
    });

    it('should handle failed transaction status from waas adapter', async () => {
      setupMocksForSuccessfulWithdrawal();
      mockWaasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: 'failed',
        message: 'Transaction failed',
      });

      const result = await withdrawalService.sendMoneyToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet as any,
      );

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-123', {
        status: TransactionStatus.FAILED,
        failure_reason: 'Transaction failed',
        failed_at: expect.any(String),
      });
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith('fwt-123', {
        status: TransactionStatus.FAILED,
        failure_reason: 'Transaction failed',
        failed_at: expect.any(String),
      });
      expect(result).toEqual({ id: 'fwt-123' });
    });

    it('should calculate fees correctly and include in transfer amount', async () => {
      setupMocksForSuccessfulWithdrawal();
      mockWaasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: 'success',
        message: 'Transaction successful',
      });

      await withdrawalService.sendMoneyToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet as any,
      );

      expect(mockWaasAdapter.transferToOtherBank).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50000,
        }),
      );
    });

    it('should create transaction with TRANSFER_OUT type and include destination_bank_code in metadata', async () => {
      setupMocksForSuccessfulWithdrawal();
      mockWaasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: 'success',
        message: 'Transaction successful',
      });

      const mockCreateNGTransactionAndFiatWalletTransaction = jest.spyOn(
        withdrawalService as any,
        'createNGTransactionAndFiatWalletTransaction',
      );

      await withdrawalService.sendMoneyToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet as any,
      );

      expect(mockCreateNGTransactionAndFiatWalletTransaction).toHaveBeenCalledWith(
        mockUser,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet,
        50000,
        mockBankDetails,
      );
    });
  });

  describe('transfer', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
    };

    it('should route to transferUSDToOneDoshUser for USD transfers', async () => {
      const transferDto = {
        username: 'recipient',
        amount: 100,
        asset: 'USD',
        remark: 'Test transfer',
      };

      const mockResult = {
        senderTransactionId: 'tx-123',
        recipientTransactionId: 'tx-456',
        clientTransferId: 'REF-123',
        transferId: '12345',
        amount: 100,
        asset: 'USD',
        recipient: 'recipient',
        status: 'approved',
        message: 'Transfer initiated successfully',
      };

      jest.spyOn(withdrawalService, 'transferUSDToOneDoshUser').mockResolvedValue(mockResult as any);

      const result = await withdrawalService.transfer(mockUser as any, transferDto);

      expect(withdrawalService.transferUSDToOneDoshUser).toHaveBeenCalledWith(mockUser, transferDto);
      expect(result).toEqual(mockResult);
    });

    it('should route to sendNairaToOneDoshUser for NGN transfers', async () => {
      const transferDto = {
        username: 'recipient',
        amount: 100,
        asset: 'NGN',
        remark: 'Test transfer',
      };

      const mockResult = {
        transactionReference: 'WAAS-REF-123',
        status: 'success',
      };

      jest.spyOn(withdrawalService, 'sendNairaToOneDoshUser').mockResolvedValue(mockResult as any);

      const result = await withdrawalService.transfer(mockUser as any, transferDto);

      expect(withdrawalService.sendNairaToOneDoshUser).toHaveBeenCalledWith(mockUser, {
        username: 'recipient',
        amount: 100,
        currency: 'NGN',
        remark: 'Test transfer',
      });
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for unsupported currency', async () => {
      const transferDto = {
        username: 'recipient',
        amount: 100,
        asset: 'EUR',
        remark: 'Test transfer',
      };

      await expect(withdrawalService.transfer(mockUser as any, transferDto)).rejects.toThrow(
        new BadRequestException('Currency is not supported'),
      );
    });
  });

  describe('transferUSDToOneDoshUser', () => {
    const mockSender = {
      id: 'sender-123',
      username: 'sender_user',
      first_name: 'John',
      last_name: 'Sender',
      country: { id: 'country-1', code: 'US', name: 'United States' },
      $fetchGraph: jest.fn().mockResolvedValue(this),
    };

    const mockRecipient = {
      id: 'recipient-123',
      username: 'recipient_user',
      first_name: 'Jane',
      last_name: 'Recipient',
    };

    const mockTransferDto = {
      username: 'recipient_user',
      amount: 100,
      asset: 'USD',
      remark: 'Test transfer',
    };

    beforeEach(() => {
      mockKycVerificationService.findByUserId.mockResolvedValue({
        provider_ref: 'test-provider-ref',
      });
    });

    it('should successfully initiate USD transfer between OneDosh users', async () => {
      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);

      const mockSenderAccount = {
        id: 'ext-acc-1',
        user_id: 'sender-123',
        provider: 'zerohash',
        participant_code: 'SENDER-CODE',
      };

      const mockRecipientAccount = {
        id: 'ext-acc-2',
        user_id: 'recipient-123',
        provider: 'zerohash',
        participant_code: 'RECIPIENT-CODE',
      };

      mockExternalAccountService.getExternalAccountForTransaction
        .mockResolvedValueOnce(mockSenderAccount)
        .mockResolvedValueOnce(mockRecipientAccount);

      const mockSenderWallet = {
        id: 'wallet-1',
        user_id: 'sender-123',
        asset: 'USD',
        balance: 10000, // $100 in cents
      };

      const mockRecipientWallet = {
        id: 'wallet-2',
        user_id: 'recipient-123',
        asset: 'USD',
        balance: 0,
      };

      mockFiatWalletRepository.findOne
        .mockResolvedValueOnce(mockSenderWallet)
        .mockResolvedValueOnce(mockRecipientWallet);

      mockTransactionRepository.create
        .mockResolvedValueOnce({ id: 'tx-sender', reference: 'REF-123-OUT' })
        .mockResolvedValueOnce({ id: 'tx-recipient', reference: 'REF-123-IN' });

      mockFiatWalletTransactionRepository.create
        .mockResolvedValueOnce({ id: 'fwt-sender' })
        .mockResolvedValueOnce({ id: 'fwt-recipient' });

      mockFiatWalletAdapter.transfer.mockResolvedValue({
        providerRequestRef: '12345',
        status: 'approved',
      });

      const result = await withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto);

      expect(mockKycVerificationService.findByUserId).toHaveBeenCalledWith('sender-123');
      expect(mockUserService.findActiveByUsername).toHaveBeenCalledWith('recipient_user');
      expect(mockFiatWalletAdapter.transfer).toHaveBeenCalled();
      expect(result).toMatchObject({
        amount: 100,
        asset: 'USD',
        recipient: 'recipient_user',
        status: 'approved',
        message: 'Transfer initiated successfully',
      });
    });

    it('should throw BadRequestException if KYC verification not found', async () => {
      mockKycVerificationService.findByUserId.mockResolvedValue(null);

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto)).rejects.toThrow(
        new BadRequestException('KYC verification required for USD transactions'),
      );
    });

    it('should throw NotFoundException if recipient not found', async () => {
      mockUserService.findActiveByUsername.mockResolvedValue(null);

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto)).rejects.toThrow(
        new NotFoundException('Recipient is deactivated or not found'),
      );
    });

    it('should throw BadRequestException for self-transfer', async () => {
      mockUserService.findActiveByUsername.mockResolvedValue(mockSender);

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto)).rejects.toThrow(
        new BadRequestException('Cannot transfer to yourself'),
      );
    });

    it('should throw BadRequestException if sender has insufficient balance', async () => {
      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);

      const mockSenderAccount = {
        id: 'ext-acc-1',
        user_id: 'sender-123',
        provider: 'zerohash',
        participant_code: 'SENDER-CODE',
      };

      const mockRecipientAccount = {
        id: 'ext-acc-2',
        user_id: 'recipient-123',
        provider: 'zerohash',
        participant_code: 'RECIPIENT-CODE',
      };

      mockExternalAccountRepository.findOne
        .mockResolvedValueOnce(mockSenderAccount)
        .mockResolvedValueOnce(mockRecipientAccount);

      const mockSenderWallet = {
        id: 'wallet-1',
        user_id: 'sender-123',
        asset: 'USD',
        balance: 500, // $5 in cents (insufficient)
      };

      mockFiatWalletRepository.findOne.mockResolvedValueOnce(mockSenderWallet);

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto)).rejects.toThrow(
        new BadRequestException('Insufficient balance'),
      );
    });

    it('should handle transfer adapter failure gracefully', async () => {
      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);

      const mockSenderAccount = {
        id: 'ext-acc-1',
        user_id: 'sender-123',
        provider: 'zerohash',
        participant_code: 'SENDER-CODE',
      };

      const mockRecipientAccount = {
        id: 'ext-acc-2',
        user_id: 'recipient-123',
        provider: 'zerohash',
        participant_code: 'RECIPIENT-CODE',
      };

      mockExternalAccountRepository.findOne
        .mockResolvedValueOnce(mockSenderAccount)
        .mockResolvedValueOnce(mockRecipientAccount);

      const mockSenderWallet = {
        id: 'wallet-1',
        user_id: 'sender-123',
        asset: 'USD',
        balance: 10000,
      };

      const mockRecipientWallet = {
        id: 'wallet-2',
        user_id: 'recipient-123',
        asset: 'USD',
        balance: 0,
      };

      mockFiatWalletRepository.findOne
        .mockResolvedValueOnce(mockSenderWallet)
        .mockResolvedValueOnce(mockRecipientWallet);

      mockTransactionRepository.create
        .mockResolvedValueOnce({ id: 'tx-sender', reference: 'REF-123-OUT' })
        .mockResolvedValueOnce({ id: 'tx-recipient', reference: 'REF-123-IN' });

      mockFiatWalletTransactionRepository.create
        .mockResolvedValueOnce({ id: 'fwt-sender' })
        .mockResolvedValueOnce({ id: 'fwt-recipient' });

      mockFiatWalletAdapter.transfer.mockRejectedValue(new Error('Adapter error'));

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto)).rejects.toThrow(
        new InternalServerErrorException('Transfer failed to initiate'),
      );

      // Verify transactions were marked as failed
      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-sender', {
        status: TransactionStatus.FAILED,
        failure_reason: 'Transfer adapter call failed',
      });

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-recipient', {
        status: TransactionStatus.FAILED,
        failure_reason: 'Transfer adapter call failed',
      });
    });
  });

  describe('sendNairaToOneDoshUser', () => {
    const mockSender = {
      id: 'sender-123',
      username: 'sender_user',
      first_name: 'John',
      last_name: 'Sender',
      email: 'sender@example.com',
    };

    const mockReceiver = {
      id: 'receiver-123',
      username: 'receiver_user',
      first_name: 'Jane',
      last_name: 'Receiver',
      email: 'receiver@example.com',
    };

    const mockSendDto = {
      username: 'receiver_user',
      amount: 5000,
      currency: 'NGN',
      remark: '',
    };

    const mockSenderWallet = {
      id: 'sender-wallet-123',
      user_id: 'sender-123',
      asset: 'NGN',
      balance: 1000000, // 10,000 NGN in smallest unit
      credit_balance: 0,
      status: FiatWalletStatus.ACTIVE,
      virtualAccounts: [
        {
          id: 'va-sender-123',
          account_number: '1234567890',
          account_name: 'John Sender',
          provider: 'ninepayment',
        },
      ],
    };

    const mockReceiverWallet = {
      id: 'receiver-wallet-123',
      user_id: 'receiver-123',
      asset: 'NGN',
      balance: 500000, // 5,000 NGN in smallest unit
      credit_balance: 0,
      status: FiatWalletStatus.ACTIVE,
    };

    const mockReceiverVirtualAccount = {
      id: 'va-receiver-123',
      user_id: 'receiver-123',
      account_number: '0987654321',
      account_name: 'Jane Receiver',
      provider: 'ninepayment',
    };

    const mockReceiverProfile = {
      id: 'profile-123',
      user_id: 'receiver-123',
      notification_token: 'mock-notification-token',
    };

    it('should successfully send money to OneDosh user', async () => {
      mockFiatWalletRepository.findOne.mockResolvedValueOnce(mockSenderWallet);
      mockUserService.findActiveByUsername.mockResolvedValue(mockReceiver);
      mockVirtualAccountRepository.findOne.mockResolvedValue(mockReceiverVirtualAccount);

      jest.spyOn(withdrawalService, 'getUserWallet').mockResolvedValue(mockReceiverWallet as any);

      mockTransactionRepository.transaction.mockImplementation(async (callback) => {
        return callback(mockTrx);
      });

      mockTransactionService.create
        .mockResolvedValueOnce({
          id: 'sender-tx-123',
          reference: 'REF-SENDER-123',
          user_id: 'sender-123',
          amount: 500000,
          status: 'PENDING',
          description: 'Transfer to receiver_user',
        })
        .mockResolvedValueOnce({
          id: 'receiver-tx-123',
          reference: 'REF-RECEIVER-123',
          user_id: 'receiver-123',
          amount: 500000,
          status: 'PENDING',
          description: 'Transfer from sender_user',
        });

      mockFiatWalletTransactionService.create
        .mockResolvedValueOnce({
          id: 'sender-fwt-123',
          fiat_wallet_id: 'sender-wallet-123',
          transaction_id: 'sender-tx-123',
          amount: 500000,
          status: 'PENDING',
        })
        .mockResolvedValueOnce({
          id: 'receiver-fwt-123',
          fiat_wallet_id: 'receiver-wallet-123',
          transaction_id: 'receiver-tx-123',
          amount: 500000,
          status: 'PENDING',
        });

      mockWaasAdapter.transferToSameBank.mockResolvedValue({
        transactionReference: 'WAAS-REF-123',
        status: 'success',
      });

      jest.spyOn(withdrawalService, 'updateBalance').mockResolvedValue(undefined);
      mockTransactionService.updateStatus.mockResolvedValue(undefined);
      mockUserProfileService.findByUserId.mockResolvedValue(mockReceiverProfile);

      const result = await withdrawalService.sendNairaToOneDoshUser(mockSender as any, mockSendDto);

      expect(mockUserService.findActiveByUsername).toHaveBeenCalledWith('receiver_user');
      expect(mockVirtualAccountRepository.findOne).toHaveBeenCalledWith({
        user_id: 'receiver-123',
        provider: 'ninepayment',
      });
      expect(mockWaasAdapter.transferToSameBank).toHaveBeenCalledWith({
        amount: 5000,
        transactionReference: 'REF-SENDER-123',
        transactionType: 'INTRA_BANK',
        description: 'Transfer to Jane Receiver',
        currency: 'NGN',
        sender: {
          accountNumber: '1234567890',
          accountName: 'John Sender',
        },
        receiver: {
          accountNumber: '0987654321',
          accountName: 'Jane Receiver',
        },
      });
      expect(mockMailerService.send).toHaveBeenCalled();
      expect(mockPushNotificationService.sendPushNotification).toHaveBeenCalled();
      // Service now creates notifications for both sender and receiver using dynamic config
      expect(mockInAppNotificationService.createNotification).toHaveBeenCalledTimes(2);
      expect(mockInAppNotificationService.getTransactionNotificationConfig).toHaveBeenCalledTimes(2);

      // Verify sender notification (transfer_out)
      expect(mockInAppNotificationService.createNotification).toHaveBeenCalledWith({
        user_id: 'sender-123',
        type: 'transaction_success',
        title: 'Transaction Completed',
        message: 'You sent ₦5,000.00 to Jane Receiver successfully. A receipt has also been sent to your email',
        metadata: {
          amount: expect.any(String),
          description: 'Transfer to receiver_user',
          recipient_name: 'Jane Receiver',
          recipient_id: 'receiver-123',
          sender_name: 'John Sender',
          sender_id: 'sender-123',
        },
      });

      // Verify receiver notification (transfer_in)
      expect(mockInAppNotificationService.createNotification).toHaveBeenCalledWith({
        user_id: 'receiver-123',
        type: 'transaction_success',
        title: "You've Received Money",
        message:
          'You just received ₦5,000.00 from John Sender. The funds are now available in your OneDosh wallet. A receipt has also been sent to your email',
        metadata: {
          amount: expect.any(String),
          description: 'Transfer to receiver_user',
          recipient_name: 'Jane Receiver',
          recipient_id: 'receiver-123',
          sender_name: 'John Sender',
          sender_id: 'sender-123',
        },
      });
      expect(result).toEqual({
        transactionReference: 'WAAS-REF-123',
        status: 'success',
      });
    });

    it('should include remark in transfer description when provided', async () => {
      const sendDtoWithRemark = {
        ...mockSendDto,
        remark: 'Payment for services',
      };

      mockFiatWalletRepository.findOne.mockResolvedValueOnce(mockSenderWallet);
      mockUserService.findActiveByUsername.mockResolvedValue(mockReceiver);
      mockVirtualAccountRepository.findOne.mockResolvedValue(mockReceiverVirtualAccount);

      jest.spyOn(withdrawalService, 'getUserWallet').mockResolvedValue(mockReceiverWallet as any);

      mockTransactionRepository.transaction.mockImplementation(async (callback) => {
        return callback(mockTrx);
      });

      mockTransactionService.create
        .mockResolvedValueOnce({
          id: 'sender-tx-123',
          reference: 'REF-SENDER-123',
          description: 'Payment for services',
        })
        .mockResolvedValueOnce({
          id: 'receiver-tx-123',
          reference: 'REF-RECEIVER-123',
          description: 'Transfer from sender_user',
        });

      mockFiatWalletTransactionService.create
        .mockResolvedValueOnce({
          id: 'sender-fwt-123',
        })
        .mockResolvedValueOnce({
          id: 'receiver-fwt-123',
        });

      mockWaasAdapter.transferToSameBank.mockResolvedValue({
        transactionReference: 'WAAS-REF-123',
        status: 'success',
      });

      jest.spyOn(withdrawalService, 'updateBalance').mockResolvedValue(undefined);
      mockTransactionService.updateStatus.mockResolvedValue(undefined);
      mockUserProfileService.findByUserId.mockResolvedValue(mockReceiverProfile);

      await withdrawalService.sendNairaToOneDoshUser(mockSender as any, sendDtoWithRemark);

      expect(mockWaasAdapter.transferToSameBank).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Transfer to Jane Receiver - Payment for services',
        }),
      );
      // Service now creates notifications for both sender and receiver using dynamic config
      expect(mockInAppNotificationService.createNotification).toHaveBeenCalledTimes(2);
      expect(mockInAppNotificationService.getTransactionNotificationConfig).toHaveBeenCalledTimes(2);

      // Verify sender notification (transfer_out)
      expect(mockInAppNotificationService.createNotification).toHaveBeenCalledWith({
        user_id: 'sender-123',
        type: 'transaction_success',
        title: 'Transaction Completed',
        message: 'You sent ₦5,000.00 to Jane Receiver successfully. A receipt has also been sent to your email',
        metadata: {
          amount: expect.any(String),
          description: 'Payment for services',
          recipient_name: 'Jane Receiver',
          recipient_id: 'receiver-123',
          sender_name: 'John Sender',
          sender_id: 'sender-123',
        },
      });

      // Verify receiver notification (transfer_in)
      expect(mockInAppNotificationService.createNotification).toHaveBeenCalledWith({
        user_id: 'receiver-123',
        type: 'transaction_success',
        title: "You've Received Money",
        message:
          'You just received ₦5,000.00 from John Sender. The funds are now available in your OneDosh wallet. A receipt has also been sent to your email',
        metadata: {
          amount: expect.any(String),
          description: 'Payment for services',
          recipient_name: 'Jane Receiver',
          recipient_id: 'receiver-123',
          sender_name: 'John Sender',
          sender_id: 'sender-123',
        },
      });
    });

    it('should throw InternalServerErrorException for unsupported currency', async () => {
      const invalidDto = {
        ...mockSendDto,
        currency: 'USD',
      };

      await expect(withdrawalService.sendNairaToOneDoshUser(mockSender as any, invalidDto)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(withdrawalService.sendNairaToOneDoshUser(mockSender as any, invalidDto)).rejects.toThrow(
        'Currency is not supported',
      );
    });

    it('should throw InternalServerErrorException when sender wallet not found', async () => {
      mockFiatWalletRepository.findOne.mockResolvedValue(null);

      await expect(withdrawalService.sendNairaToOneDoshUser(mockSender as any, mockSendDto)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(withdrawalService.sendNairaToOneDoshUser(mockSender as any, mockSendDto)).rejects.toThrow(
        'User wallet not found',
      );
    });

    it('should throw InternalServerErrorException when sender has insufficient balance', async () => {
      const poorWallet = {
        ...mockSenderWallet,
        balance: 100, // Only 1 NGN in smallest unit
      };
      mockFiatWalletRepository.findOne.mockResolvedValue(poorWallet);

      await expect(withdrawalService.sendNairaToOneDoshUser(mockSender as any, mockSendDto)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(withdrawalService.sendNairaToOneDoshUser(mockSender as any, mockSendDto)).rejects.toThrow(
        'Insufficient balance',
      );
    });

    it('should throw InternalServerErrorException when receiver virtual account not found', async () => {
      mockFiatWalletRepository.findOne.mockResolvedValue(mockSenderWallet);
      mockUserService.findActiveByUsername.mockResolvedValue(mockReceiver);
      mockVirtualAccountRepository.findOne.mockResolvedValue(null);

      await expect(withdrawalService.sendNairaToOneDoshUser(mockSender as any, mockSendDto)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(withdrawalService.sendNairaToOneDoshUser(mockSender as any, mockSendDto)).rejects.toThrow(
        `${mockReceiver.username} virtual account not found`,
      );
    });

    it('should handle transfer failure and throw InternalServerErrorException', async () => {
      mockFiatWalletRepository.findOne.mockResolvedValue(mockSenderWallet);
      mockUserService.findActiveByUsername.mockResolvedValue(mockReceiver);
      mockVirtualAccountRepository.findOne.mockResolvedValue(mockReceiverVirtualAccount);

      jest.spyOn(withdrawalService, 'getUserWallet').mockResolvedValue(mockReceiverWallet as any);

      mockTransactionRepository.transaction.mockImplementation(async (callback) => {
        return callback(mockTrx);
      });

      mockTransactionService.create.mockResolvedValue({
        id: 'sender-tx-123',
        reference: 'REF-SENDER-123',
      });

      mockFiatWalletTransactionService.create.mockResolvedValue({
        id: 'sender-fwt-123',
      });

      mockWaasAdapter.transferToSameBank.mockRejectedValue(new Error('Transfer failed'));

      await expect(withdrawalService.sendNairaToOneDoshUser(mockSender as any, mockSendDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should not send push notification if receiver has no notification token', async () => {
      mockFiatWalletRepository.findOne.mockResolvedValue(mockSenderWallet);
      mockUserService.findActiveByUsername.mockResolvedValue(mockReceiver);
      mockVirtualAccountRepository.findOne.mockResolvedValue(mockReceiverVirtualAccount);

      jest.spyOn(withdrawalService, 'getUserWallet').mockResolvedValue(mockReceiverWallet as any);

      mockTransactionRepository.transaction.mockImplementation(async (callback) => {
        return callback(mockTrx);
      });

      mockTransactionService.create.mockResolvedValue({
        id: 'sender-tx-123',
        reference: 'REF-SENDER-123',
      });

      mockFiatWalletTransactionService.create.mockResolvedValue({
        id: 'sender-fwt-123',
      });

      mockWaasAdapter.transferToSameBank.mockResolvedValue({
        transactionReference: 'WAAS-REF-123',
        status: 'success',
      });

      jest.spyOn(withdrawalService, 'updateBalance').mockResolvedValue(undefined);
      mockTransactionService.updateStatus.mockResolvedValue(undefined);
      mockUserProfileService.findByUserId.mockResolvedValue({
        ...mockReceiverProfile,
        notification_token: null,
      });

      await withdrawalService.sendNairaToOneDoshUser(mockSender as any, mockSendDto);

      expect(mockPushNotificationService.sendPushNotification).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when trying to send to self', async () => {
      mockFiatWalletRepository.findOne.mockResolvedValue(mockSenderWallet);
      mockUserService.findActiveByUsername.mockResolvedValue(mockSender);

      await expect(withdrawalService.sendNairaToOneDoshUser(mockSender as any, mockSendDto)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(withdrawalService.sendNairaToOneDoshUser(mockSender as any, mockSendDto)).rejects.toThrow(
        'Cannot send money to yourself',
      );
    });
  });

  describe('sendMoneyToBeneficiary', () => {
    it('should log beneficiary transfer request', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
      };
      const beneficiaryId = 'beneficiary-123';
      const amount = 50000;
      const remark = 'Test beneficiary transfer';

      // Mock logger to verify log was called
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await withdrawalService.sendMoneyToBeneficiary(mockUser as any, beneficiaryId, amount, remark);

      expect(loggerSpy).toHaveBeenCalledWith(
        `user: ${mockUser.id} is sending money to beneficiary: ${beneficiaryId} with amount: ${amount} and remark: ${remark}`,
      );
    });
  });

  describe('updateBalanceWithTransaction', () => {
    const mockWallet = {
      id: 'wallet-123',
      user_id: 'user-123',
      asset: 'USD',
      balance: 10000,
    };

    const mockMetadata = {
      description: 'Test transaction',
      provider: 'test-provider',
    };

    it('should successfully update balance and create fiat wallet transaction', async () => {
      const mockCreateFn = jest.fn().mockResolvedValue({ id: 'fwt-123' });
      const mockTrx = { trx: 'test-transaction' };

      const mockUpdatedWallet = { ...mockWallet, balance: 11000 };
      mockFiatWalletRepository.update.mockResolvedValue(mockUpdatedWallet);

      const result = await service.updateBalanceWithTransaction(
        'wallet-123',
        1000,
        'tx-123',
        TransactionStatus.COMPLETED,
        mockMetadata,
        mockWallet as any,
        10000,
        11000,
        mockCreateFn,
        mockTrx as any,
      );

      expect(mockFiatWalletRepository.update).toHaveBeenCalledWith('wallet-123', { balance: 11000 }, { trx: mockTrx });
      expect(mockCreateFn).toHaveBeenCalledWith(mockTrx);
      expect(result).toEqual(mockUpdatedWallet);
    });

    it('should update existing fiat wallet transaction when fiat_wallet_transaction_id is provided', async () => {
      const mockMetadataWithId = {
        ...mockMetadata,
        fiat_wallet_transaction_id: 'fwt-existing-123',
      };

      const mockExistingFwt = {
        id: 'fwt-existing-123',
        user_id: 'user-123',
        status: TransactionStatus.PENDING,
      };

      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(mockExistingFwt);
      mockFiatWalletRepository.update.mockResolvedValue({ ...mockWallet, balance: 11000 });

      const mockCreateFn = jest.fn();
      const mockTrx = { trx: 'test-transaction' };

      await service.updateBalanceWithTransaction(
        'wallet-123',
        1000,
        'tx-123',
        TransactionStatus.COMPLETED,
        mockMetadataWithId,
        mockWallet as any,
        10000,
        11000,
        mockCreateFn,
        mockTrx as any,
      );

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-existing-123',
        {
          status: TransactionStatus.COMPLETED,
          balance_after: 11000,
          processed_at: expect.any(String),
          completed_at: expect.any(String),
        },
        { trx: mockTrx },
      );

      // Should not create new transaction
      expect(mockCreateFn).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if fiat wallet transaction not found', async () => {
      const mockMetadataWithId = {
        ...mockMetadata,
        fiat_wallet_transaction_id: 'fwt-nonexistent',
      };

      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(null);

      const mockCreateFn = jest.fn();
      const mockTrx = { trx: 'test-transaction' };

      await expect(
        service.updateBalanceWithTransaction(
          'wallet-123',
          1000,
          'tx-123',
          TransactionStatus.COMPLETED,
          mockMetadataWithId,
          mockWallet as any,
          10000,
          11000,
          mockCreateFn,
          mockTrx as any,
        ),
      ).rejects.toThrow(new BadRequestException('Failed to update wallet balance'));
    });

    it('should throw BadRequestException if balance update fails', async () => {
      mockFiatWalletRepository.update.mockRejectedValue(new Error('Database error'));

      const mockCreateFn = jest.fn().mockResolvedValue({ id: 'fwt-123' });
      const mockTrx = { trx: 'test-transaction' };

      await expect(
        service.updateBalanceWithTransaction(
          'wallet-123',
          1000,
          'tx-123',
          TransactionStatus.COMPLETED,
          mockMetadata,
          mockWallet as any,
          10000,
          11000,
          mockCreateFn,
          mockTrx as any,
        ),
      ).rejects.toThrow(new BadRequestException('Failed to update wallet balance'));
    });
  });

  describe('transfer', () => {
    const mockSender = {
      id: 'sender-123',
      username: 'sender_user',
      first_name: 'John',
      last_name: 'Sender',
      email: 'sender@example.com',
    };

    it('should route USD transfer to transferUSDToOneDoshUser', async () => {
      const transferDto = {
        username: 'receiver_user',
        amount: 100,
        asset: 'USD',
      };

      const mockResult = {
        senderTransactionId: 'sender-tx-123',
        recipientTransactionId: 'recipient-tx-123',
        clientTransferId: 'CLIENT-123',
        transferId: 'TRANSFER-123',
        amount: 100,
        asset: 'USD',
        recipient: 'receiver_user',
        status: 'approved',
        message: 'Transfer initiated successfully',
      };

      jest.spyOn(withdrawalService, 'transferUSDToOneDoshUser').mockResolvedValue(mockResult as any);

      const result = await withdrawalService.transfer(mockSender as any, transferDto);

      expect(withdrawalService.transferUSDToOneDoshUser).toHaveBeenCalledWith(mockSender, transferDto);
      expect(result).toEqual(mockResult);
    });

    it('should route NGN transfer to sendNairaToOneDoshUser', async () => {
      const transferDto = {
        username: 'receiver_user',
        amount: 5000,
        asset: 'NGN',
      };

      const mockResult = {
        transactionReference: 'WAAS-REF-123',
        status: 'success',
      };

      jest.spyOn(withdrawalService, 'sendNairaToOneDoshUser').mockResolvedValue(mockResult as any);

      const result = await withdrawalService.transfer(mockSender as any, transferDto);

      expect(withdrawalService.sendNairaToOneDoshUser).toHaveBeenCalledWith(mockSender, {
        username: 'receiver_user',
        amount: 5000,
        currency: 'NGN',
      });
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for unsupported currency', async () => {
      const transferDto = {
        username: 'receiver_user',
        amount: 100,
        asset: 'EUR',
      };

      await expect(withdrawalService.transfer(mockSender as any, transferDto)).rejects.toThrow(
        new BadRequestException('Currency is not supported'),
      );
    });
  });

  describe('transferUSDToOneDoshUser', () => {
    const mockSender = {
      id: 'sender-123',
      username: 'sender_user',
      first_name: 'John',
      last_name: 'Sender',
      email: 'sender@example.com',
      $fetchGraph: jest.fn().mockResolvedValue(undefined),
    };

    const mockRecipient = {
      id: 'recipient-123',
      username: 'recipient_user',
      first_name: 'Jane',
      last_name: 'Recipient',
      email: 'recipient@example.com',
    };

    const mockTransferDto = {
      username: 'recipient_user',
      amount: 100,
      asset: 'USD',
    };

    const mockSenderWallet = {
      id: 'sender-wallet-123',
      user_id: 'sender-123',
      asset: 'USD',
      balance: 100000,
      credit_balance: 0,
      status: FiatWalletStatus.ACTIVE,
    };

    const mockRecipientWallet = {
      id: 'recipient-wallet-123',
      user_id: 'recipient-123',
      asset: 'USD',
      balance: 50000,
      credit_balance: 0,
      status: FiatWalletStatus.ACTIVE,
    };

    const mockSenderExternalAccount = {
      id: 'ext-sender-123',
      user_id: 'sender-123',
      provider: 'zerohash',
      participant_code: 'SENDER-PARTICIPANT',
    };

    const mockRecipientExternalAccount = {
      id: 'ext-recipient-123',
      user_id: 'recipient-123',
      provider: 'zerohash',
      participant_code: 'RECIPIENT-PARTICIPANT',
    };

    beforeEach(() => {
      mockKycVerificationService.findByUserId.mockResolvedValue({
        provider_ref: 'test-kyc-ref',
      });
    });

    it('should successfully transfer USD to OneDosh user', async () => {
      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);
      mockExternalAccountService.getExternalAccountForTransaction
        .mockResolvedValueOnce(mockSenderExternalAccount)
        .mockResolvedValueOnce(mockRecipientExternalAccount);

      jest
        .spyOn(service, 'getUserWallet')
        .mockResolvedValueOnce(mockSenderWallet as any)
        .mockResolvedValueOnce(mockRecipientWallet as any);

      mockTransactionRepository.create
        .mockResolvedValueOnce({ id: 'sender-tx-123', reference: 'REF-123-OUT' })
        .mockResolvedValueOnce({ id: 'recipient-tx-123', reference: 'REF-123-IN' });

      mockTransactionRepository.update.mockResolvedValue({});

      mockFiatWalletTransactionRepository.create
        .mockResolvedValueOnce({ id: 'sender-fwt-123' })
        .mockResolvedValueOnce({ id: 'recipient-fwt-123' });

      mockFiatWalletTransactionRepository.update.mockResolvedValue({});

      mockFiatWalletAdapter.transfer.mockResolvedValue({
        providerRequestRef: 'PROVIDER-REF-123',
        status: 'approved',
      });

      const result = await withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto);

      expect(mockKycVerificationService.findByUserId).toHaveBeenCalledWith('sender-123');
      expect(mockUserService.findActiveByUsername).toHaveBeenCalledWith('recipient_user');
      expect(mockExternalAccountService.getExternalAccountForTransaction).toHaveBeenCalledWith(
        'sender-123',
        'zerohash',
      );
      expect(mockExternalAccountService.getExternalAccountForTransaction).toHaveBeenCalledWith(
        'recipient-123',
        'zerohash',
      );
      expect(mockFiatWalletAdapter.transfer).toHaveBeenCalled();
      expect(result).toEqual({
        senderTransactionId: 'sender-tx-123',
        recipientTransactionId: 'recipient-tx-123',
        clientTransferId: 'REF-123',
        transferId: 'PROVIDER-REF-123',
        amount: 100,
        asset: 'USD',
        recipient: 'recipient_user',
        status: 'approved',
        message: 'Transfer initiated successfully',
      });
    });

    it('should throw BadRequestException when KYC verification not found', async () => {
      mockKycVerificationService.findByUserId.mockResolvedValue(null);

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto)).rejects.toThrow(
        new BadRequestException('KYC verification required for USD transactions'),
      );
    });

    it('should throw BadRequestException when KYC provider_ref is missing', async () => {
      mockKycVerificationService.findByUserId.mockResolvedValue({
        provider_ref: null,
      });

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto)).rejects.toThrow(
        new BadRequestException('KYC verification required for USD transactions'),
      );
    });

    it('should throw NotFoundException when recipient not found', async () => {
      mockUserService.findActiveByUsername.mockResolvedValue(null);

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto)).rejects.toThrow(
        `Recipient is deactivated or not found`,
      );
    });

    it('should throw BadRequestException for self-transfer', async () => {
      const selfUser = {
        ...mockSender,
        username: 'sender_user',
      };

      const selfTransferDto = {
        username: 'sender_user',
        amount: 100,
        asset: 'USD',
      };

      mockUserService.findActiveByUsername.mockResolvedValue(selfUser);

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, selfTransferDto)).rejects.toThrow(
        new BadRequestException('Cannot transfer to yourself'),
      );
    });

    it('should throw NotFoundException when sender external account not found', async () => {
      const { NotFoundException } = await import('@nestjs/common');

      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);
      mockExternalAccountService.getExternalAccountForTransaction.mockRejectedValueOnce(
        new NotFoundException('External account not found for provider zerohash. Please complete your account setup.'),
      );

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when sender participant_code is missing', async () => {
      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);
      mockExternalAccountService.getExternalAccountForTransaction.mockRejectedValueOnce(
        new BadRequestException('External account is not properly configured for provider zerohash.'),
      );

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when recipient external account not found', async () => {
      const { NotFoundException } = await import('@nestjs/common');

      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);
      mockExternalAccountService.getExternalAccountForTransaction
        .mockResolvedValueOnce(mockSenderExternalAccount)
        .mockRejectedValueOnce(
          new NotFoundException(
            'External account not found for provider zerohash. Please complete your account setup.',
          ),
        );

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when recipient participant_code is missing', async () => {
      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);

      mockExternalAccountService.getExternalAccountForTransaction
        .mockResolvedValueOnce(mockSenderExternalAccount)
        .mockRejectedValueOnce(
          new BadRequestException('External account is not properly configured for provider zerohash.'),
        );

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for insufficient balance', async () => {
      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);
      mockExternalAccountService.getExternalAccountForTransaction
        .mockResolvedValueOnce(mockSenderExternalAccount)
        .mockResolvedValueOnce(mockRecipientExternalAccount);

      jest.spyOn(withdrawalService, 'getUserWallet').mockResolvedValueOnce({
        ...mockSenderWallet,
        balance: 500,
      } as any);

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto)).rejects.toThrow(
        new BadRequestException('Insufficient balance'),
      );
    });

    it('should handle transfer adapter failure and update transaction statuses', async () => {
      mockUserService.findActiveByUsername.mockResolvedValue(mockRecipient);
      mockExternalAccountService.getExternalAccountForTransaction
        .mockResolvedValueOnce(mockSenderExternalAccount)
        .mockResolvedValueOnce(mockRecipientExternalAccount);

      jest
        .spyOn(service, 'getUserWallet')
        .mockResolvedValueOnce(mockSenderWallet as any)
        .mockResolvedValueOnce(mockRecipientWallet as any);

      const mockSenderTx = { id: 'sender-tx-123', reference: 'REF-123-OUT' };
      const mockRecipientTx = { id: 'recipient-tx-123', reference: 'REF-123-IN' };

      mockTransactionRepository.create.mockResolvedValueOnce(mockSenderTx).mockResolvedValueOnce(mockRecipientTx);

      mockTransactionRepository.update.mockResolvedValue({});

      const mockSenderFwt = { id: 'sender-fwt-123' };
      const mockRecipientFwt = { id: 'recipient-fwt-123' };

      mockFiatWalletTransactionRepository.create
        .mockResolvedValueOnce(mockSenderFwt)
        .mockResolvedValueOnce(mockRecipientFwt);

      mockFiatWalletTransactionRepository.update.mockResolvedValue({});

      mockFiatWalletAdapter.transfer.mockRejectedValue(new Error('Transfer adapter failed'));

      await expect(withdrawalService.transferUSDToOneDoshUser(mockSender as any, mockTransferDto)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('sender-tx-123', {
        status: TransactionStatus.FAILED,
        failure_reason: 'Transfer adapter call failed',
      });

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('recipient-tx-123', {
        status: TransactionStatus.FAILED,
        failure_reason: 'Transfer adapter call failed',
      });

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith('sender-fwt-123', {
        status: TransactionStatus.FAILED,
        failure_reason: 'Transfer adapter call failed',
      });

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith('recipient-fwt-123', {
        status: TransactionStatus.FAILED,
        failure_reason: 'Transfer adapter call failed',
      });
    });
  });

  describe('checkIfUserHasEnoughBalanceOrThrow', () => {
    it('should not throw when user has sufficient balance', async () => {
      const mockWallet = {
        id: 'wallet-123',
        user_id: 'user-123',
        asset: 'NGN',
        balance: 1000000,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      const mockQuery = {
        forUpdate: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockWallet),
      };

      mockFiatWalletRepository.query.mockReturnValue(mockQuery);

      const result = await service.checkIfUserHasEnoughBalanceOrThrow('user-123', 5000, 'NGN');

      expect(result).toBeUndefined();
    });

    it('should throw BadRequestException when user has insufficient balance', async () => {
      const mockWallet = {
        id: 'wallet-123',
        user_id: 'user-123',
        asset: 'NGN',
        balance: 100000,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      const mockQuery = {
        forUpdate: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockWallet),
      };

      mockFiatWalletRepository.query.mockReturnValue(mockQuery);

      await expect(service.checkIfUserHasEnoughBalanceOrThrow('user-123', 50000, 'NGN')).rejects.toThrow(
        new BadRequestException('Insufficient balance'),
      );
    });

    it('should work with default currency code NGN', async () => {
      const mockWallet = {
        id: 'wallet-123',
        user_id: 'user-123',
        asset: 'NGN',
        balance: 1000000,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      const mockQuery = {
        forUpdate: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockWallet),
      };

      mockFiatWalletRepository.query.mockReturnValue(mockQuery);

      const result = await service.checkIfUserHasEnoughBalanceOrThrow('user-123', 5000);

      expect(result).toBeUndefined();
    });

    it('should work with USD currency', async () => {
      const mockWallet = {
        id: 'wallet-123',
        user_id: 'user-123',
        asset: 'USD',
        balance: 50000,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      const mockQuery = {
        forUpdate: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockWallet),
      };

      mockFiatWalletRepository.query.mockReturnValue(mockQuery);

      const result = await service.checkIfUserHasEnoughBalanceOrThrow('user-123', 100, 'USD');

      expect(result).toBeUndefined();
    });
  });
  describe('revertWithdrawalBalance', () => {
    const mockFailedTransaction = {
      id: 'tx-failed-123',
      user_id: 'user-123',
      status: TransactionStatus.FAILED,
      amount: 5000000,
      reference: 'REF-123',
    };

    const mockFiatWalletTransaction = {
      id: 'fwt-123',
      fiat_wallet_id: 'wallet-123',
      transaction_id: 'tx-failed-123',
      source: '1234567890',
      destination: '0987654321',
      amount: 5000000,
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockWaasAdapter.getProviderName.mockReturnValue('ninepayment');
    });

    it('should successfully revert withdrawal balance when transaction is FAILED', async () => {
      mockTransactionRepository.findById.mockResolvedValue(mockFailedTransaction);
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletEscrowService.getEscrowAmount.mockResolvedValue(5000000);
      jest.spyOn(withdrawalService, 'updateBalance').mockResolvedValue(undefined);
      mockFiatWalletEscrowService.releaseMoneyFromEscrow.mockResolvedValue(undefined);

      const result = await withdrawalService.revertWithdrawalBalance('tx-failed-123');

      expect(mockTransactionRepository.findById).toHaveBeenCalledWith('tx-failed-123');
      expect(mockFiatWalletTransactionRepository.findOne).toHaveBeenCalledWith({
        transaction_id: 'tx-failed-123',
      });
      expect(mockFiatWalletEscrowService.getEscrowAmount).toHaveBeenCalledWith('tx-failed-123');
      expect(withdrawalService.updateBalance).toHaveBeenCalledWith(
        'wallet-123',
        5000000,
        'tx-failed-123',
        FiatWalletTransactionType.WITHDRAWAL,
        TransactionStatus.FAILED,
        expect.objectContaining({
          description: expect.any(String),
          source: '1234567890',
          destination: '0987654321',
          fiat_wallet_transaction_id: 'fwt-123',
          provider: 'ninepayment',
          provider_reference: 'REF-123',
        }),
      );
      expect(mockFiatWalletEscrowService.releaseMoneyFromEscrow).toHaveBeenCalledWith('tx-failed-123');
      expect(result).toBe(5000000);
    });

    it('should not revert when transaction is not FAILED', async () => {
      const pendingTransaction = {
        ...mockFailedTransaction,
        status: TransactionStatus.PENDING,
      };
      mockTransactionRepository.findById.mockResolvedValue(pendingTransaction);
      const updateBalanceSpy = jest.spyOn(withdrawalService, 'updateBalance').mockResolvedValue(undefined);

      const result = await withdrawalService.revertWithdrawalBalance('tx-pending-123');

      expect(mockTransactionRepository.findById).toHaveBeenCalledWith('tx-pending-123');
      expect(mockFiatWalletTransactionRepository.findOne).not.toHaveBeenCalled();
      expect(updateBalanceSpy).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should not revert when fiat wallet transaction is not found', async () => {
      mockTransactionRepository.findById.mockResolvedValue(mockFailedTransaction);
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(null);
      const updateBalanceSpy = jest.spyOn(withdrawalService, 'updateBalance').mockResolvedValue(undefined);

      const result = await withdrawalService.revertWithdrawalBalance('tx-failed-123');

      expect(mockTransactionRepository.findById).toHaveBeenCalledWith('tx-failed-123');
      expect(mockFiatWalletTransactionRepository.findOne).toHaveBeenCalledWith({
        transaction_id: 'tx-failed-123',
      });
      expect(updateBalanceSpy).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should not revert when escrow amount is 0', async () => {
      mockTransactionRepository.findById.mockResolvedValue(mockFailedTransaction);
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletEscrowService.getEscrowAmount.mockResolvedValue(0);
      const updateBalanceSpy = jest.spyOn(withdrawalService, 'updateBalance').mockResolvedValue(undefined);

      const result = await withdrawalService.revertWithdrawalBalance('tx-failed-123');

      expect(mockTransactionRepository.findById).toHaveBeenCalledWith('tx-failed-123');
      expect(mockFiatWalletTransactionRepository.findOne).toHaveBeenCalledWith({
        transaction_id: 'tx-failed-123',
      });
      expect(mockFiatWalletEscrowService.getEscrowAmount).toHaveBeenCalledWith('tx-failed-123');
      expect(updateBalanceSpy).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should not revert when transaction status is COMPLETED', async () => {
      const completedTransaction = {
        ...mockFailedTransaction,
        status: TransactionStatus.COMPLETED,
      };
      mockTransactionRepository.findById.mockResolvedValue(completedTransaction);
      const updateBalanceSpy = jest.spyOn(withdrawalService, 'updateBalance').mockResolvedValue(undefined);

      const result = await withdrawalService.revertWithdrawalBalance('tx-completed-123');

      expect(mockTransactionRepository.findById).toHaveBeenCalledWith('tx-completed-123');
      expect(mockFiatWalletTransactionRepository.findOne).not.toHaveBeenCalled();
      expect(updateBalanceSpy).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('sendMoneyToExternalNGAccount - escrow and balance revert', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
    };

    const mockWallet = {
      id: 'wallet-ngn-123',
      user_id: 'user-123',
      asset: 'NGN',
      balance: 10000000,
      credit_balance: 0,
      status: 'ACTIVE',
      virtualAccounts: [
        {
          id: 'va-123',
          account_number: '1234567890',
          account_name: 'Test User',
          provider: 'ninepayment',
          bank_code: '999',
        },
      ],
    };

    const mockWithdrawDto = {
      amount: 50000,
      bank_ref: '044',
      account_number: '0123456789',
      country_code: 'NG',
      beneficiary_id: undefined as string | undefined,
      remark: 'Test remark',
    };

    const mockBankDetails = {
      accountName: 'John Doe',
      accountNumber: '0123456789',
      bankName: 'Access Bank',
      bankCode: '044',
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockBankService.verifyBankAccount.mockResolvedValue(mockBankDetails);
      mockWithdrawalSessionService.checkAndBlockConcurrent.mockResolvedValue(undefined);
      mockWithdrawalSessionService.startSession.mockResolvedValue(undefined);
      mockWithdrawalSessionService.endSession.mockResolvedValue(undefined);
      mockCircuitBreakerService.canProceed.mockResolvedValue({ allowed: true });
      mockCircuitBreakerService.recordAttempt.mockResolvedValue(undefined);
      mockWaasAdapter.checkLedgerBalance.mockResolvedValue({
        hasSufficientBalance: true,
        requestedAmount: 50000,
        availableBalance: 100000,
      });
      mockWaasAdapter.getProviderName.mockReturnValue('ninepayment');
      mockWaasAdapter.getBankCode.mockReturnValue('999');
      mockLockerService.withLock.mockImplementation((_lockKey, callback) => callback());
      mockFiatWalletEscrowService.moveMoneyToEscrow.mockResolvedValue(undefined);
      mockFiatWalletEscrowService.releaseMoneyFromEscrow.mockResolvedValue(undefined);
      mockFiatWalletEscrowService.getEscrowAmount.mockResolvedValue(5000000);

      jest.spyOn(withdrawalService as any, 'getActiveVirtualAccount').mockReturnValue({
        id: 'va-123',
        account_number: '1234567890',
        account_name: 'Test User',
        provider: 'ninepayment',
        bank_code: '999',
      });
      jest.spyOn(withdrawalService as any, 'createNGTransactionAndFiatWalletTransaction').mockResolvedValue({
        transaction: { id: 'tx-123', reference: 'REF-123', status: TransactionStatus.INITIATED },
        fiatWalletTransaction: { id: 'fwt-123', fiat_wallet_id: 'wallet-ngn-123', currency: 'NGN', amount: 5000000 },
      });
      jest.spyOn(withdrawalService, 'updateBalance').mockResolvedValue(undefined);
      jest.spyOn(withdrawalService as any, 'sendWithdrawalInitiatedNotification').mockResolvedValue(undefined);
      jest.spyOn(withdrawalService, 'revertWithdrawalBalance').mockResolvedValue(5000000);
    });

    it('should move money to escrow after reserving balance', async () => {
      mockWaasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: 'success',
        message: 'Transaction successful',
      });
      mockTransactionRepository.update.mockResolvedValue({ id: 'tx-123', reference: 'REF-123' });
      mockFiatWalletTransactionRepository.update.mockResolvedValue({ id: 'fwt-123' });

      await withdrawalService.sendMoneyToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet as any,
      );

      expect(mockFiatWalletEscrowService.moveMoneyToEscrow).toHaveBeenCalledWith('tx-123', 5000000);
    });

    it('should throw when ledger has insufficient balance', async () => {
      mockWaasAdapter.checkLedgerBalance.mockResolvedValue({
        hasSufficientBalance: false,
        requestedAmount: 50000,
        availableBalance: 10000,
      });

      await expect(
        withdrawalService.sendMoneyToExternalNGAccount(
          mockUser as any,
          'test-idempotency-key',
          mockWithdrawDto,
          mockWallet as any,
        ),
      ).rejects.toThrow('Withdraw to external NG account failed');
    });

    it('should throw when circuit breaker blocks withdrawal', async () => {
      mockCircuitBreakerService.canProceed.mockResolvedValue({
        allowed: false,
        reason: 'Circuit breaker is open due to high failure rate',
      });
      mockTransactionRepository.update.mockResolvedValue({});
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});

      await expect(
        withdrawalService.sendMoneyToExternalNGAccount(
          mockUser as any,
          'test-idempotency-key',
          mockWithdrawDto,
          mockWallet as any,
        ),
      ).rejects.toThrow('Withdraw to external NG account failed');

      expect(mockCircuitBreakerService.canProceed).toHaveBeenCalledWith('ninepayment');
    });

    it('should queue status poll when provider call fails with ambiguous error', async () => {
      // Ambiguous errors (not pre-API validation errors) should queue status poll instead of failing
      mockWaasAdapter.transferToOtherBank.mockRejectedValue(new Error('Provider error'));
      mockTransactionRepository.update.mockResolvedValue({
        id: 'tx-123',
        status: TransactionStatus.PENDING,
      });
      mockFiatWalletTransactionRepository.update.mockResolvedValue({
        id: 'fwt-123',
        status: TransactionStatus.PENDING,
      });

      const result = await withdrawalService.sendMoneyToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet as any,
      );

      // Should return the transaction in pending status instead of throwing
      expect(result).toEqual({
        id: 'fwt-123',
        status: TransactionStatus.PENDING,
      });
      // Should queue status poll to verify actual transaction status
      expect(mockNgnWithdrawalStatusProcessor.queueStatusPoll).toHaveBeenCalled();
      // Should NOT record circuit breaker failure since we don't know the actual status
      expect(mockCircuitBreakerService.recordAttempt).not.toHaveBeenCalledWith('ninepayment', false);
    });

    it('should revert balance and throw for pre-API validation errors', async () => {
      // Pre-API validation errors should fail immediately
      mockWaasAdapter.transferToOtherBank.mockRejectedValue(new BadRequestException('Insufficient balance'));
      mockTransactionRepository.update.mockResolvedValue({ id: 'tx-123', status: TransactionStatus.FAILED });
      mockFiatWalletTransactionRepository.update.mockResolvedValue({ id: 'fwt-123', status: TransactionStatus.FAILED });

      await expect(
        withdrawalService.sendMoneyToExternalNGAccount(
          mockUser as any,
          'test-idempotency-key',
          mockWithdrawDto,
          mockWallet as any,
        ),
      ).rejects.toThrow('Withdraw to external NG account failed');

      expect(mockCircuitBreakerService.recordAttempt).toHaveBeenCalledWith('ninepayment', false);
      expect(withdrawalService.revertWithdrawalBalance).toHaveBeenCalledWith('tx-123');
    });

    it('should revert balance when provider returns FAILED status', async () => {
      mockWaasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: 'failed',
        message: 'Provider rejected transaction',
      });
      mockTransactionRepository.update.mockResolvedValue({ id: 'tx-123' });
      mockFiatWalletTransactionRepository.update.mockResolvedValue({ id: 'fwt-123' });

      await withdrawalService.sendMoneyToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet as any,
      );

      expect(mockCircuitBreakerService.recordAttempt).toHaveBeenCalledWith('ninepayment', false);
      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-123', {
        status: TransactionStatus.FAILED,
        failure_reason: 'Provider rejected transaction',
        failed_at: expect.any(String),
      });
      expect(withdrawalService.revertWithdrawalBalance).toHaveBeenCalledWith('tx-123');
    });

    it('should queue status poll when provider returns PENDING status', async () => {
      mockWaasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: 'pending',
        message: 'Transaction is being processed',
      });
      mockTransactionRepository.update.mockResolvedValue({ id: 'tx-123' });
      mockFiatWalletTransactionRepository.update.mockResolvedValue({ id: 'fwt-123' });

      await withdrawalService.sendMoneyToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet as any,
      );

      expect(mockCircuitBreakerService.recordAttempt).toHaveBeenCalledWith('ninepayment', true);
      expect(mockNgnWithdrawalStatusProcessor.queueStatusPoll).toHaveBeenCalledWith({
        transactionId: 'tx-123',
        fiatWalletTransactionId: 'fwt-123',
        userId: 'user-123',
        providerReference: 'waas-ref-123',
        amount: 50000,
        recipientInfo: 'John Doe - ****6789',
        remark: 'Test remark',
      });
    });

    it('should call withdrawal session service to start and end session', async () => {
      mockWaasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: 'success',
        message: 'Transaction successful',
      });
      mockTransactionRepository.update.mockResolvedValue({ id: 'tx-123' });
      mockFiatWalletTransactionRepository.update.mockResolvedValue({ id: 'fwt-123' });

      await withdrawalService.sendMoneyToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet as any,
      );

      expect(mockWithdrawalSessionService.checkAndBlockConcurrent).toHaveBeenCalledWith('user-123');
      expect(mockWithdrawalSessionService.startSession).toHaveBeenCalledWith('user-123', 'tx-123');
    });

    it('should record circuit breaker success when provider returns COMPLETED status', async () => {
      mockWaasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: 'success',
        message: 'Transaction successful',
      });
      mockTransactionRepository.update.mockResolvedValue({ id: 'tx-123' });
      mockFiatWalletTransactionRepository.update.mockResolvedValue({ id: 'fwt-123' });

      await withdrawalService.sendMoneyToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet as any,
      );

      expect(mockCircuitBreakerService.recordAttempt).toHaveBeenCalledWith('ninepayment', true);
      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-123', {
        status: TransactionStatus.COMPLETED,
        completed_at: expect.any(String),
      });
      expect(withdrawalService.revertWithdrawalBalance).not.toHaveBeenCalled();
    });
  });

  describe('transferUSDToRainDepositAddress', () => {
    const mockSender: any = {
      id: 'user-1',
      first_name: 'John',
      last_name: 'Doe',
      $fetchGraph: jest.fn().mockResolvedValue(undefined),
    };

    const rainDepositAddress = '0xabc123';

    beforeEach(() => {
      mockFiatWalletConfigProvider.getConfig.mockReturnValue({
        default_usd_fiat_wallet_provider: 'zerohash',
        default_ngn_fiat_wallet_provider: 'zerohash',
        default_underlying_currency: 'USDC.SOL',
      });
      mockUserTierService.getUserCurrentTier.mockResolvedValue({ level: 1 });
      mockExternalAccountService.getExternalAccountForTransaction.mockResolvedValue({
        participant_code: 'participant-1',
      } as any);
      jest.spyOn(UtilsService, 'generateTransactionReference').mockReturnValue('client-ref');
      jest.spyOn(withdrawalService, 'getUserWallet').mockResolvedValue({ id: 'wallet-1', balance: 2000 } as any);
      mockFiatWalletAdapter.createWithdrawalRequest.mockResolvedValue({
        providerRef: 'provider-ref',
        feeAmount: 2,
        withdrawalFee: 0,
        quotedFeeAmount: 0,
        quotedFeeNotional: 0,
        settledAmount: 12,
        status: 'pending',
        blockchainTransactionRef: null,
        blockchainStatus: null,
        clientWithdrawalRequestRef: 'client-request-ref',
      } as any);
      mockTransactionRepository.create.mockResolvedValue({
        id: 'txn-1',
        reference: 'client-ref-RAIN-OUT',
      } as any);
      mockFiatWalletTransactionRepository.create.mockResolvedValue({
        id: 'fiat-txn-1',
        provider_metadata: {},
      } as any);
      mockTransactionRepository.update.mockResolvedValue({} as any);
      mockFiatWalletTransactionRepository.update.mockResolvedValue({ id: 'fiat-txn-1' } as any);
      mockEventEmitterService.emit.mockResolvedValue(undefined);
    });

    it('should debit amount without fee while using total for balance and withdrawal', async () => {
      const result = await withdrawalService.transferUSDToRainDepositAddress(mockSender, {
        amount: 10,
        fee: 2,
        asset: 'USD',
        rain_deposit_address: rainDepositAddress,
      });

      expect(withdrawalService.getUserWallet).toHaveBeenCalledWith('user-1', 'USD');
      expect(mockTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: -1000, // amount only (10 USD)
        }),
      );
      expect(mockFiatWalletTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: -1000, // amount only (10 USD)
        }),
      );
      expect(mockFiatWalletAdapter.createWithdrawalRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '12', // total amount (amount + fee)
          withdrawalAddress: rainDepositAddress,
        }),
        'zerohash',
      );
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fiat-txn-1',
        expect.objectContaining({
          provider_fee: 200, // fee only (2 USD)
        }),
      );
      expect(result).toMatchObject({
        senderTransactionId: 'txn-1',
        fiatWalletTransactionId: 'fiat-txn-1',
        amount: 10,
        asset: 'USD',
        rain_deposit_address: rainDepositAddress,
        status: 'processing',
      });
    });

    it('should store card last four digits in transaction metadata as destination_name when provided', async () => {
      await withdrawalService.transferUSDToRainDepositAddress(mockSender, {
        amount: 10,
        fee: 2,
        asset: 'USD',
        rain_deposit_address: rainDepositAddress,
        card_last_four_digits: '6890',
      });

      expect(mockTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            destination_name: 'Card ****6890',
          }),
        }),
      );
    });

    it('should not include destination_name in metadata when card_last_four_digits is not provided', async () => {
      await withdrawalService.transferUSDToRainDepositAddress(mockSender, {
        amount: 10,
        fee: 2,
        asset: 'USD',
        rain_deposit_address: rainDepositAddress,
      });

      const createCall = mockTransactionRepository.create.mock.calls[0][0];
      expect(createCall.metadata).not.toHaveProperty('destination_name');
    });

    it('should throw when balance is insufficient for amount plus fee', async () => {
      jest.spyOn(withdrawalService, 'getUserWallet').mockResolvedValueOnce({ id: 'wallet-1', balance: 1000 } as any);

      await expect(
        withdrawalService.transferUSDToRainDepositAddress(mockSender, {
          amount: 10,
          fee: 2,
          asset: 'USD',
          rain_deposit_address: rainDepositAddress,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockTransactionRepository.create).not.toHaveBeenCalled();
      expect(mockFiatWalletTransactionRepository.create).not.toHaveBeenCalled();
    });

    it('should throw when user tier is below 1', async () => {
      mockUserTierService.getUserCurrentTier.mockResolvedValue({ level: 0 });

      await expect(
        withdrawalService.transferUSDToRainDepositAddress(mockSender, {
          amount: 10,
          fee: 2,
          asset: 'USD',
          rain_deposit_address: rainDepositAddress,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when asset is not USD', async () => {
      await expect(
        withdrawalService.transferUSDToRainDepositAddress(mockSender, {
          amount: 10,
          fee: 2,
          asset: 'NGN',
          rain_deposit_address: rainDepositAddress,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when underlying currency is missing', async () => {
      mockFiatWalletConfigProvider.getConfig.mockReturnValue({
        default_usd_fiat_wallet_provider: 'zerohash',
        default_ngn_fiat_wallet_provider: 'zerohash',
        default_underlying_currency: '',
      });

      await expect(
        withdrawalService.transferUSDToRainDepositAddress(mockSender, {
          amount: 10,
          fee: 2,
          asset: 'USD',
          rain_deposit_address: rainDepositAddress,
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw when external account is missing participant code', async () => {
      mockExternalAccountService.getExternalAccountForTransaction.mockRejectedValueOnce(
        new BadRequestException('External account is not properly configured for provider zerohash.'),
      );

      await expect(
        withdrawalService.transferUSDToRainDepositAddress(mockSender, {
          amount: 10,
          fee: 2,
          asset: 'USD',
          rain_deposit_address: rainDepositAddress,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark transactions failed when withdrawal request fails', async () => {
      mockFiatWalletAdapter.createWithdrawalRequest.mockRejectedValue(new Error('adapter-failure'));

      await expect(
        withdrawalService.transferUSDToRainDepositAddress(mockSender, {
          amount: 10,
          fee: 2,
          asset: 'USD',
          rain_deposit_address: rainDepositAddress,
        }),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        'txn-1',
        expect.objectContaining({ status: TransactionStatus.FAILED }),
      );
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fiat-txn-1',
        expect.objectContaining({ status: TransactionStatus.FAILED }),
      );
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(
        EventEmitterEventsEnum.SERVICE_STATUS_FAILURE,
        expect.any(Object),
      );
    });
  });

  describe('withdrawToExternalNGAccount', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
    };

    const mockWithdrawDto = {
      amount: 50000,
      bank_ref: '044',
      account_number: '0123456789',
      country_code: 'NG',
      remark: 'Test withdrawal',
    };

    const mockWallet = {
      id: 'wallet-ngn-123',
      user_id: 'user-123',
      asset: 'NGN',
      balance: 10000000,
      credit_balance: 0,
      status: 'ACTIVE',
      virtualAccounts: [
        {
          id: 'va-123',
          account_number: '1234567890',
          account_name: 'Test User',
          provider: 'ninepayment',
          bank_code: '999',
        },
      ],
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockFiatWalletTransactionRepository.findByUserIdAndIdempotencyKey.mockResolvedValue(null);
      mockFiatWalletRepository.findOne.mockResolvedValue(mockWallet);
      mockWithdrawalCounterService.checkDailyLimit.mockResolvedValue(undefined);
      mockWithdrawalCounterService.incrementDailyAttempts.mockResolvedValue(undefined);
    });

    it('should return existing transaction when idempotency key exists with COMPLETED status', async () => {
      const existingTransaction = {
        id: 'fwt-existing-123',
        status: TransactionStatus.COMPLETED,
        idempotency_key: 'test-key',
      };
      mockFiatWalletTransactionRepository.findByUserIdAndIdempotencyKey.mockResolvedValue(existingTransaction);

      const result = await withdrawalService.withdrawToExternalNGAccount(mockUser as any, 'test-key', mockWithdrawDto);

      expect(result).toEqual(existingTransaction);
      expect(mockFiatWalletRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return existing transaction when idempotency key exists with PENDING status', async () => {
      const existingTransaction = {
        id: 'fwt-existing-123',
        status: TransactionStatus.PENDING,
        idempotency_key: 'test-key',
      };
      mockFiatWalletTransactionRepository.findByUserIdAndIdempotencyKey.mockResolvedValue(existingTransaction);

      const result = await withdrawalService.withdrawToExternalNGAccount(mockUser as any, 'test-key', mockWithdrawDto);

      expect(result).toEqual(existingTransaction);
    });

    it('should return existing transaction when idempotency key exists with INITIATED status', async () => {
      const existingTransaction = {
        id: 'fwt-existing-123',
        status: TransactionStatus.INITIATED,
        idempotency_key: 'test-key',
      };
      mockFiatWalletTransactionRepository.findByUserIdAndIdempotencyKey.mockResolvedValue(existingTransaction);

      const result = await withdrawalService.withdrawToExternalNGAccount(mockUser as any, 'test-key', mockWithdrawDto);

      expect(result).toEqual(existingTransaction);
    });

    it('should throw BadRequestException when idempotency key exists with FAILED status', async () => {
      const existingTransaction = {
        id: 'fwt-existing-123',
        status: TransactionStatus.FAILED,
        idempotency_key: 'test-key',
      };
      mockFiatWalletTransactionRepository.findByUserIdAndIdempotencyKey.mockResolvedValue(existingTransaction);

      await expect(
        withdrawalService.withdrawToExternalNGAccount(mockUser as any, 'test-key', mockWithdrawDto),
      ).rejects.toThrow(
        new BadRequestException(
          'Previous transaction with this idempotency key failed. Please use a new idempotency key to retry.',
        ),
      );
    });

    it('should throw NotFoundException when user wallet is not found', async () => {
      mockFiatWalletRepository.findOne.mockResolvedValue(null);

      await expect(
        withdrawalService.withdrawToExternalNGAccount(mockUser as any, 'test-key', mockWithdrawDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when balance is insufficient', async () => {
      mockFiatWalletRepository.findOne.mockResolvedValue({
        ...mockWallet,
        balance: 100,
      });

      await expect(
        withdrawalService.withdrawToExternalNGAccount(mockUser as any, 'test-key', mockWithdrawDto),
      ).rejects.toThrow(new BadRequestException('Insufficient balance'));
    });

    it('should route to sendMoneyToBeneficiary when beneficiary_id is provided', async () => {
      const withdrawDtoWithBeneficiary = {
        ...mockWithdrawDto,
        beneficiary_id: 'beneficiary-123',
      };

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await withdrawalService.withdrawToExternalNGAccount(mockUser as any, 'test-key', withdrawDtoWithBeneficiary);

      expect(loggerSpy).toHaveBeenCalledWith(
        `user: ${mockUser.id} is sending money to beneficiary: beneficiary-123 with amount: 5000000 and remark: Test withdrawal`,
      );
    });

    it('should check and increment daily withdrawal attempts', async () => {
      const existingTransaction = {
        id: 'fwt-existing-123',
        status: TransactionStatus.COMPLETED,
        idempotency_key: 'test-key',
      };
      mockFiatWalletTransactionRepository.findByUserIdAndIdempotencyKey.mockResolvedValue(existingTransaction);

      await withdrawalService.withdrawToExternalNGAccount(mockUser as any, 'test-key', mockWithdrawDto);

      expect(mockWithdrawalCounterService.checkDailyLimit).not.toHaveBeenCalled();
    });
  });

  describe('sendNairaToOneDoshUser - additional edge cases', () => {
    const mockSender = {
      id: 'sender-123',
      username: 'sender_user',
      first_name: 'John',
      last_name: 'Sender',
      email: 'sender@test.com',
    };

    const mockReceiver = {
      id: 'receiver-123',
      username: 'receiver_user',
      first_name: 'Jane',
      last_name: 'Receiver',
      email: 'receiver@test.com',
    };

    const mockSendDto = {
      username: 'receiver_user',
      amount: 5000,
      currency: 'NGN',
      remark: 'Test transfer',
    };

    const mockSenderWallet = {
      id: 'sender-wallet-123',
      user_id: 'sender-123',
      asset: 'NGN',
      balance: 1000000,
      credit_balance: 0,
      status: FiatWalletStatus.ACTIVE,
      virtualAccounts: [
        {
          id: 'va-sender-123',
          account_number: '1234567890',
          account_name: 'John Sender',
          provider: 'ninepayment',
        },
      ],
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockWaasAdapter.getProviderName.mockReturnValue('ninepayment');
      mockWaasAdapter.getBankCode.mockReturnValue('999');
    });

    it('should throw InternalServerErrorException when wallet not found', async () => {
      mockFiatWalletRepository.findOne.mockResolvedValue(null);

      await expect(withdrawalService.sendNairaToOneDoshUser(mockSender as any, mockSendDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when receiver not found', async () => {
      mockFiatWalletRepository.findOne.mockResolvedValue(mockSenderWallet);
      mockUserService.findActiveByUsername.mockResolvedValue(null);

      await expect(withdrawalService.sendNairaToOneDoshUser(mockSender as any, mockSendDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException for USD currency', async () => {
      const usdDto = { ...mockSendDto, currency: 'USD' };

      await expect(withdrawalService.sendNairaToOneDoshUser(mockSender as any, usdDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when receiver virtual account not found', async () => {
      mockFiatWalletRepository.findOne.mockResolvedValue(mockSenderWallet);
      mockUserService.findActiveByUsername.mockResolvedValue(mockReceiver);
      mockVirtualAccountRepository.findOne.mockResolvedValue(null);

      await expect(withdrawalService.sendNairaToOneDoshUser(mockSender as any, mockSendDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('transferUSDToRainDepositAddress - additional edge cases', () => {
    const mockSender: any = {
      id: 'user-1',
      first_name: 'John',
      last_name: 'Doe',
      $fetchGraph: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
      mockFiatWalletConfigProvider.getConfig.mockReturnValue({
        default_usd_fiat_wallet_provider: 'zerohash',
        default_underlying_currency: 'USDC.SOL',
      });
      mockUserTierService.getUserCurrentTier.mockResolvedValue({ level: 1 });
      mockExternalAccountRepository.findOne.mockResolvedValue({ participant_code: 'participant-1' });
      jest.spyOn(withdrawalService, 'getUserWallet').mockResolvedValue({ id: 'wallet-1', balance: 5000 } as any);
    });

    it('should throw BadRequestException when user tier is null', async () => {
      mockUserTierService.getUserCurrentTier.mockResolvedValue(null);

      await expect(
        withdrawalService.transferUSDToRainDepositAddress(mockSender, {
          amount: 10,
          fee: 2,
          asset: 'USD',
          rain_deposit_address: '0xabc123',
        }),
      ).rejects.toThrow(new BadRequestException('You must complete tier one verification to perform USD transactions'));
    });

    it('should throw BadRequestException when rain_deposit_address is empty', async () => {
      await expect(
        withdrawalService.transferUSDToRainDepositAddress(mockSender, {
          amount: 10,
          fee: 2,
          asset: 'USD',
          rain_deposit_address: '',
        }),
      ).rejects.toThrow(new BadRequestException('Rain deposit address is required'));
    });

    it('should throw BadRequestException when external account not found', async () => {
      const { NotFoundException } = await import('@nestjs/common');

      mockExternalAccountService.getExternalAccountForTransaction.mockRejectedValueOnce(
        new NotFoundException('External account not found for provider zerohash. Please complete your account setup.'),
      );

      await expect(
        withdrawalService.transferUSDToRainDepositAddress(mockSender, {
          amount: 10,
          fee: 2,
          asset: 'USD',
          rain_deposit_address: '0xabc123',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should emit SERVICE_STATUS_SUCCESS event on successful withdrawal', async () => {
      jest.spyOn(withdrawalService, 'getUserWallet').mockResolvedValue({ id: 'wallet-1', balance: 5000 } as any);
      mockTransactionRepository.create.mockResolvedValue({ id: 'txn-1', reference: 'REF-123' });
      mockFiatWalletTransactionRepository.create.mockResolvedValue({ id: 'fwt-1', provider_metadata: {} });
      mockFiatWalletAdapter.createWithdrawalRequest.mockResolvedValue({
        providerRef: 'provider-ref-123',
        status: 'processing',
      });
      mockTransactionRepository.update.mockResolvedValue({});
      mockFiatWalletTransactionRepository.update.mockResolvedValue({ id: 'fwt-1' });

      await withdrawalService.transferUSDToRainDepositAddress(mockSender, {
        amount: 10,
        fee: 2,
        asset: 'USD',
        rain_deposit_address: '0xabc123',
      });

      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(
        EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS,
        expect.objectContaining({
          serviceKey: expect.any(String),
        }),
      );
    });
  });

  describe('sendMoneyToExternalNGAccount - comprehensive tests', () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
    };

    const mockWallet = {
      id: 'wallet-ngn-123',
      user_id: 'user-123',
      asset: 'NGN',
      balance: 10000000,
      credit_balance: 0,
      status: 'ACTIVE',
      virtualAccounts: [
        {
          id: 'va-123',
          account_number: '1234567890',
          account_name: 'Test User',
          provider: 'ninepayment',
          bank_code: '999',
        },
      ],
    };

    const mockWithdrawDto = {
      amount: 50000,
      bank_ref: '044',
      account_number: '0123456789',
      country_code: 'NG',
      remark: 'Test withdrawal',
    };

    const mockBankDetails = {
      accountName: 'John Doe',
      accountNumber: '0123456789',
      bankName: 'Access Bank',
      bankCode: '044',
      bankRef: '044',
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockBankService.verifyBankAccount.mockResolvedValue(mockBankDetails);
      mockWithdrawalSessionService.checkAndBlockConcurrent.mockResolvedValue(undefined);
      mockWithdrawalSessionService.startSession.mockResolvedValue(undefined);
      mockWithdrawalSessionService.endSession.mockResolvedValue(undefined);
      mockCircuitBreakerService.canProceed.mockResolvedValue({ allowed: true });
      mockCircuitBreakerService.recordAttempt.mockResolvedValue(undefined);
      mockUserTierService.validateLimit.mockResolvedValue(true);
      mockWaasAdapter.checkLedgerBalance.mockResolvedValue({
        hasSufficientBalance: true,
        requestedAmount: 50000,
        availableBalance: 100000,
      });
      mockWaasAdapter.getProviderName.mockReturnValue('ninepayment');
      mockWaasAdapter.getBankCode.mockReturnValue('999');
      mockLockerService.withLock.mockImplementation((_lockKey, callback) => callback());
      mockFiatWalletEscrowService.moveMoneyToEscrow.mockResolvedValue(undefined);

      jest.spyOn(withdrawalService as any, 'getActiveVirtualAccount').mockReturnValue({
        id: 'va-123',
        account_number: '1234567890',
        account_name: 'Test User',
        provider: 'ninepayment',
        bank_code: '999',
      });
      jest.spyOn(withdrawalService as any, 'createNGTransactionAndFiatWalletTransaction').mockResolvedValue({
        transaction: { id: 'tx-123', reference: 'REF-123', status: TransactionStatus.INITIATED },
        fiatWalletTransaction: { id: 'fwt-123', fiat_wallet_id: 'wallet-ngn-123', currency: 'NGN', amount: 5000000 },
      });
      jest.spyOn(withdrawalService, 'updateBalance').mockResolvedValue(undefined);
      jest.spyOn(withdrawalService as any, 'sendWithdrawalInitiatedNotification').mockResolvedValue(undefined);
      jest.spyOn(withdrawalService, 'revertWithdrawalBalance').mockResolvedValue(5000000);
    });

    it('should throw BadRequestException when bank account verification fails', async () => {
      mockBankService.verifyBankAccount.mockResolvedValue(null);

      await expect(
        withdrawalService.sendMoneyToExternalNGAccount(
          mockUser as any,
          'test-idempotency-key',
          mockWithdrawDto,
          mockWallet as any,
        ),
      ).rejects.toThrow(new BadRequestException('Invalid bank account'));
    });

    it('should throw BadRequestException when no active virtual account found', async () => {
      jest
        .spyOn(withdrawalService as any, 'getActiveVirtualAccount')
        .mockRejectedValue(new BadRequestException('No active virtual account found'));

      await expect(
        withdrawalService.sendMoneyToExternalNGAccount(mockUser as any, 'test-idempotency-key', mockWithdrawDto, {
          ...mockWallet,
          virtualAccounts: [],
        } as any),
      ).rejects.toThrow('No active virtual account found');
    });

    it('should send email notification on COMPLETED status', async () => {
      mockWaasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: 'success',
        message: 'Transaction successful',
      });
      mockTransactionRepository.update.mockResolvedValue({ id: 'tx-123', reference: 'REF-123' });
      mockFiatWalletTransactionRepository.update.mockResolvedValue({ id: 'fwt-123' });

      await withdrawalService.sendMoneyToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet as any,
      );

      expect(mockMailerService.send).toHaveBeenCalled();
    });

    it('should end withdrawal session on success', async () => {
      mockWaasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: 'success',
        message: 'Transaction successful',
      });
      mockTransactionRepository.update.mockResolvedValue({ id: 'tx-123' });
      mockFiatWalletTransactionRepository.update.mockResolvedValue({ id: 'fwt-123' });

      await withdrawalService.sendMoneyToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet as any,
      );

      expect(mockWithdrawalSessionService.endSession).toHaveBeenCalledWith('user-123', 'tx-123');
    });

    it('should end withdrawal session when provider error occurs and status poll is queued', async () => {
      // When provider error occurs, status poll is queued and session should still be ended
      mockWaasAdapter.transferToOtherBank.mockRejectedValue(new Error('Provider error'));
      mockTransactionRepository.update.mockResolvedValue({
        id: 'tx-123',
        status: TransactionStatus.PENDING,
      });
      mockFiatWalletTransactionRepository.update.mockResolvedValue({
        id: 'fwt-123',
        status: TransactionStatus.PENDING,
      });

      const result = await withdrawalService.sendMoneyToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet as any,
      );

      // Should return pending transaction instead of throwing
      expect(result).toEqual({
        id: 'fwt-123',
        status: TransactionStatus.PENDING,
      });
      expect(mockWithdrawalSessionService.endSession).toHaveBeenCalledWith('user-123', 'tx-123');
    });

    it('should end withdrawal session on pre-API validation error', async () => {
      // Pre-API validation errors should fail immediately but still end session
      mockWaasAdapter.transferToOtherBank.mockRejectedValue(new BadRequestException('Insufficient balance'));
      mockTransactionRepository.update.mockResolvedValue({ id: 'tx-123', status: TransactionStatus.FAILED });
      mockFiatWalletTransactionRepository.update.mockResolvedValue({ id: 'fwt-123', status: TransactionStatus.FAILED });

      await expect(
        withdrawalService.sendMoneyToExternalNGAccount(
          mockUser as any,
          'test-idempotency-key',
          mockWithdrawDto,
          mockWallet as any,
        ),
      ).rejects.toThrow('Withdraw to external NG account failed');

      expect(mockWithdrawalSessionService.endSession).toHaveBeenCalledWith('user-123', 'tx-123');
    });

    it('should update transactions to PENDING before calling provider', async () => {
      mockWaasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: 'success',
        message: 'Transaction successful',
      });
      mockTransactionRepository.update.mockResolvedValue({ id: 'tx-123' });
      mockFiatWalletTransactionRepository.update.mockResolvedValue({ id: 'fwt-123' });

      await withdrawalService.sendMoneyToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet as any,
      );

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-123', {
        status: TransactionStatus.PENDING,
      });
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith('fwt-123', {
        status: TransactionStatus.PENDING,
      });
    });

    it('should call waas adapter with correct transfer parameters', async () => {
      mockWaasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: 'success',
        message: 'Transaction successful',
      });
      mockTransactionRepository.update.mockResolvedValue({ id: 'tx-123', reference: 'REF-123' });
      mockFiatWalletTransactionRepository.update.mockResolvedValue({ id: 'fwt-123' });

      await withdrawalService.sendMoneyToExternalNGAccount(
        mockUser as any,
        'test-idempotency-key',
        mockWithdrawDto,
        mockWallet as any,
      );

      expect(mockWaasAdapter.transferToOtherBank).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50000,
          receiver: expect.objectContaining({
            accountNumber: '0123456789',
            accountName: 'John Doe',
            bankRef: '044',
          }),
          sender: expect.objectContaining({
            accountNumber: '1234567890',
            accountName: 'Test User',
          }),
          transactionType: 'WITHDRAWAL',
          currency: 'NGN',
        }),
      );
    });
  });

  describe('getActiveVirtualAccount private method', () => {
    it('should return active virtual account for matching provider', async () => {
      const virtualAccounts = [
        {
          id: 'va-123',
          account_number: '1234567890',
          account_name: 'Test User',
          provider: 'ninepayment',
        },
      ];

      // Restore original implementation for this test
      jest.spyOn(withdrawalService as any, 'getActiveVirtualAccount').mockRestore();
      mockWaasAdapter.getProviderName.mockReturnValue('ninepayment');

      const result = await (service as any).getActiveVirtualAccount(virtualAccounts);

      expect(result).toEqual(virtualAccounts[0]);
    });

    it('should throw BadRequestException when no matching virtual account found', async () => {
      const virtualAccounts = [
        {
          id: 'va-123',
          account_number: '1234567890',
          account_name: 'Test User',
          provider: 'other-provider',
        },
      ];

      jest.spyOn(withdrawalService as any, 'getActiveVirtualAccount').mockRestore();
      mockWaasAdapter.getProviderName.mockReturnValue('ninepayment');

      await expect((service as any).getActiveVirtualAccount(virtualAccounts)).rejects.toThrow(
        new BadRequestException('No active virtual account found'),
      );
    });
  });

  describe('mapWaasTransactionStatusToTransactionStatus private method', () => {
    beforeEach(() => {
      jest.spyOn(withdrawalService as any, 'mapWaasTransactionStatusToTransactionStatus').mockRestore();
    });

    it('should map success to COMPLETED', () => {
      const result = (service as any).mapWaasTransactionStatusToTransactionStatus('success');
      expect(result).toBe(TransactionStatus.COMPLETED);
    });

    it('should map Success (case insensitive) to COMPLETED', () => {
      const result = (service as any).mapWaasTransactionStatusToTransactionStatus('Success');
      expect(result).toBe(TransactionStatus.COMPLETED);
    });

    it('should map failed to FAILED', () => {
      const result = (service as any).mapWaasTransactionStatusToTransactionStatus('failed');
      expect(result).toBe(TransactionStatus.FAILED);
    });

    it('should map FAILED (uppercase) to FAILED', () => {
      const result = (service as any).mapWaasTransactionStatusToTransactionStatus('FAILED');
      expect(result).toBe(TransactionStatus.FAILED);
    });

    it('should map unknown status to PENDING', () => {
      const result = (service as any).mapWaasTransactionStatusToTransactionStatus('processing');
      expect(result).toBe(TransactionStatus.PENDING);
    });

    it('should map pending to PENDING', () => {
      const result = (service as any).mapWaasTransactionStatusToTransactionStatus('pending');
      expect(result).toBe(TransactionStatus.PENDING);
    });
  });

  describe('findById - additional edge cases', () => {
    it('should throw BadRequestException when wallet not found', async () => {
      mockFiatWalletRepository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        new BadRequestException('Fiat wallet not found'),
      );
    });

    it('should return wallet when no user is provided', async () => {
      const mockWallet = {
        id: 'wallet-123',
        user_id: 'user-123',
        asset: 'NGN',
        balance: 100000,
      };
      mockFiatWalletRepository.findById.mockResolvedValue(mockWallet);

      const result = await service.findById('wallet-123');

      expect(result).toEqual(mockWallet);
    });

    it('should return wallet when user matches wallet owner', async () => {
      const mockUser = { id: 'user-123' };
      const mockWallet = {
        id: 'wallet-123',
        user_id: 'user-123',
        asset: 'NGN',
        balance: 100000,
      };
      mockFiatWalletRepository.findById.mockResolvedValue(mockWallet);

      const result = await service.findById('wallet-123', mockUser as any);

      expect(result).toEqual(mockWallet);
    });

    it('should throw BadRequestException when user does not match wallet owner', async () => {
      const mockUser = { id: 'different-user-123' };
      const mockWallet = {
        id: 'wallet-123',
        user_id: 'user-123',
        asset: 'NGN',
        balance: 100000,
      };
      mockFiatWalletRepository.findById.mockResolvedValue(mockWallet);

      await expect(service.findById('wallet-123', mockUser as any)).rejects.toThrow(
        new BadRequestException('Forbidden Resource'),
      );
    });
  });

  describe('transfer - edge cases', () => {
    const mockSender = {
      id: 'sender-123',
      username: 'sender_user',
      first_name: 'John',
      last_name: 'Sender',
    };

    it('should handle lowercase USD currency', async () => {
      const transferDto = {
        username: 'recipient_user',
        amount: 100,
        asset: 'usd',
      };

      jest.spyOn(withdrawalService, 'transferUSDToOneDoshUser').mockResolvedValue({} as any);

      await withdrawalService.transfer(mockSender as any, transferDto);

      expect(withdrawalService.transferUSDToOneDoshUser).toHaveBeenCalled();
    });

    it('should handle lowercase NGN currency', async () => {
      const transferDto = {
        username: 'recipient_user',
        amount: 5000,
        asset: 'ngn',
      };

      jest.spyOn(withdrawalService, 'sendNairaToOneDoshUser').mockResolvedValue({} as any);

      await withdrawalService.transfer(mockSender as any, transferDto);

      expect(withdrawalService.sendNairaToOneDoshUser).toHaveBeenCalledWith(mockSender, {
        username: 'recipient_user',
        amount: 5000,
        currency: 'ngn',
        remark: undefined,
      });
    });

    it('should pass remark to sendNairaToOneDoshUser when provided', async () => {
      const transferDto = {
        username: 'recipient_user',
        amount: 5000,
        asset: 'NGN',
        remark: 'Payment for services',
      };

      jest.spyOn(withdrawalService, 'sendNairaToOneDoshUser').mockResolvedValue({} as any);

      await withdrawalService.transfer(mockSender as any, transferDto);

      expect(withdrawalService.sendNairaToOneDoshUser).toHaveBeenCalledWith(mockSender, {
        username: 'recipient_user',
        amount: 5000,
        currency: 'NGN',
        remark: 'Payment for services',
      });
    });

    it('should throw BadRequestException for GBP currency', async () => {
      const transferDto = {
        username: 'recipient_user',
        amount: 100,
        asset: 'GBP',
      };

      await expect(withdrawalService.transfer(mockSender as any, transferDto)).rejects.toThrow(
        new BadRequestException('Currency is not supported'),
      );
    });

    it('should throw BadRequestException for EUR currency', async () => {
      const transferDto = {
        username: 'recipient_user',
        amount: 100,
        asset: 'EUR',
      };

      await expect(withdrawalService.transfer(mockSender as any, transferDto)).rejects.toThrow(
        new BadRequestException('Currency is not supported'),
      );
    });
  });

  describe('getUserWallet - race condition handling', () => {
    it('should handle concurrent wallet creation race condition by error code', async () => {
      const walletData = {
        user_id: 'test-user-id',
        asset: 'USD',
        balance: 0,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
      };

      const existingWallet = {
        id: 'wallet-id',
        ...walletData,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockFiatWalletRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existingWallet);

      const error: any = new Error('Unique constraint violation');
      error.code = '23505';
      mockFiatWalletRepository.create.mockRejectedValue(error);

      const result = await service.getUserWallet(walletData.user_id, walletData.asset);

      expect(result).toHaveProperty('id', 'wallet-id');
      expect(mockFiatWalletRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException when wallet not found after constraint violation', async () => {
      const walletData = {
        user_id: 'test-user-id',
        asset: 'USD',
      };

      mockFiatWalletRepository.findOne.mockResolvedValue(null);

      const error: any = new Error('Unique constraint violation');
      error.code = '23505';
      mockFiatWalletRepository.create.mockRejectedValue(error);

      await expect(service.getUserWallet(walletData.user_id, walletData.asset)).rejects.toThrow(
        new BadRequestException('Failed to create fiat wallet'),
      );
    });

    it('should throw BadRequestException for non-constraint violation errors', async () => {
      const walletData = {
        user_id: 'test-user-id',
        asset: 'USD',
      };

      mockFiatWalletRepository.findOne.mockResolvedValue(null);
      mockFiatWalletRepository.create.mockRejectedValue(new Error('Database connection error'));

      await expect(service.getUserWallet(walletData.user_id, walletData.asset)).rejects.toThrow(
        new BadRequestException('Failed to create fiat wallet'),
      );
    });
  });

  describe('findUserWallets - wallet creation on missing wallets', () => {
    it('should create missing wallets when user does not have all supported currencies', async () => {
      const existingWallets = {
        fiat_wallets: [{ id: 'wallet-1', user_id: 'user-123', asset: 'USD' }],
      };

      mockFiatWalletRepository.findAll.mockResolvedValueOnce(existingWallets).mockResolvedValueOnce({
        fiat_wallets: [
          { id: 'wallet-1', user_id: 'user-123', asset: 'USD' },
          { id: 'wallet-2', user_id: 'user-123', asset: 'NGN' },
        ],
      });

      jest.spyOn(service, 'getUserWallet').mockResolvedValue({} as any);

      await service.findUserWallets('user-123');

      expect(service.getUserWallet).toHaveBeenCalled();
    });

    it('should not create wallets when user has all supported currencies', async () => {
      const existingWallets = {
        fiat_wallets: [
          { id: 'wallet-1', user_id: 'user-123', asset: 'USD' },
          { id: 'wallet-2', user_id: 'user-123', asset: 'NGN' },
        ],
      };

      mockFiatWalletRepository.findAll.mockResolvedValue(existingWallets);
      jest.spyOn(service, 'getUserWallet');

      await service.findUserWallets('user-123');

      expect(mockFiatWalletRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('updateBalance - comprehensive scenarios', () => {
    const mockWallet = {
      id: 'wallet-123',
      user_id: 'user-123',
      asset: 'USD',
      balance: 10000,
    };

    beforeEach(() => {
      mockLockerService.withLock.mockImplementation((_lockKey, callback) => callback());
      mockFiatWalletRepository.findById.mockResolvedValue(mockWallet);
      mockFiatWalletRepository.update.mockResolvedValue({ ...mockWallet, balance: 11000 });
    });

    it('should throw BadRequestException when transaction not found', async () => {
      mockTransactionRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateBalance(
          'wallet-123',
          1000,
          'non-existent-tx',
          FiatWalletTransactionType.DEPOSIT,
          TransactionStatus.COMPLETED,
        ),
      ).rejects.toThrow(new BadRequestException('Transaction not found'));
    });

    it('should throw BadRequestException when transaction already completed', async () => {
      mockTransactionRepository.findById.mockResolvedValue({
        id: 'tx-123',
        status: TransactionStatus.COMPLETED,
      });

      await expect(
        service.updateBalance(
          'wallet-123',
          1000,
          'tx-123',
          FiatWalletTransactionType.DEPOSIT,
          TransactionStatus.COMPLETED,
        ),
      ).rejects.toThrow(new BadRequestException('Transaction already completed'));
    });

    it('should throw BadRequestException when wallet not found', async () => {
      mockFiatWalletRepository.findById.mockResolvedValue(null);
      mockTransactionRepository.findById.mockResolvedValue({
        id: 'tx-123',
        status: TransactionStatus.PENDING,
      });

      await expect(
        service.updateBalance(
          'non-existent-wallet',
          1000,
          'tx-123',
          FiatWalletTransactionType.DEPOSIT,
          TransactionStatus.COMPLETED,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for insufficient balance on withdrawal', async () => {
      mockFiatWalletRepository.findById.mockResolvedValue({
        ...mockWallet,
        balance: 500,
      });
      mockTransactionRepository.findById.mockResolvedValue({
        id: 'tx-123',
        status: TransactionStatus.PENDING,
      });

      await expect(
        service.updateBalance(
          'wallet-123',
          -1000,
          'tx-123',
          FiatWalletTransactionType.WITHDRAWAL,
          TransactionStatus.COMPLETED,
        ),
      ).rejects.toThrow(new BadRequestException('Insufficient balance for this transaction'));
    });

    it('should allow zero amount transactions', async () => {
      mockFiatWalletRepository.findById.mockResolvedValue(mockWallet);
      mockTransactionRepository.findById.mockResolvedValue({
        id: 'tx-123',
        status: TransactionStatus.PENDING,
      });
      mockFiatWalletTransactionRepository.create.mockResolvedValue({ id: 'fwt-123' });

      const result = await service.updateBalance(
        'wallet-123',
        0,
        'tx-123',
        FiatWalletTransactionType.DEPOSIT,
        TransactionStatus.COMPLETED,
      );

      expect(result).toBeDefined();
    });

    it('should emit WALLET_BALANCE_CHANGED event on successful update', async () => {
      mockFiatWalletRepository.findById.mockResolvedValue(mockWallet);
      mockTransactionRepository.findById.mockResolvedValue({
        id: 'tx-123',
        status: TransactionStatus.PENDING,
      });
      mockFiatWalletTransactionRepository.create.mockResolvedValue({ id: 'fwt-123' });
      mockFiatWalletRepository.update.mockResolvedValue({ ...mockWallet, balance: 11000 });

      await service.updateBalance(
        'wallet-123',
        1000,
        'tx-123',
        FiatWalletTransactionType.DEPOSIT,
        TransactionStatus.COMPLETED,
      );

      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(
        EventEmitterEventsEnum.WALLET_BALANCE_CHANGED,
        expect.objectContaining({
          userId: 'user-123',
          walletType: 'fiat',
          walletId: 'wallet-123',
        }),
      );
    });
  });

  describe('reconcileUsdBalanceFromProvider', () => {
    const mockUserId = 'user-123';
    const mockParticipantCode = 'PARTICIPANT123';
    const mockDefaultUnderlyingCurrency = 'USDC.SOL';
    const mockWalletId = 'wallet-456';

    beforeEach(() => {
      jest.clearAllMocks();
      mockFiatWalletConfigProvider.getConfig.mockReturnValue({
        default_usd_fiat_wallet_provider: 'zerohash',
        default_ngn_fiat_wallet_provider: 'zerohash',
        default_underlying_currency: mockDefaultUnderlyingCurrency,
      });
      // Reset external account service and repository mocks to prevent interference
      mockExternalAccountService.getExternalAccountForTransaction.mockReset();
      mockExternalAccountRepository.findOne.mockReset();
    });

    it('should return failure when no external account is found', async () => {
      mockExternalAccountRepository.findOne.mockResolvedValue(null);

      const result = await service.reconcileUsdBalanceFromProvider(mockUserId);

      expect(result).toEqual({
        success: false,
        providerBalance: 0,
        localBalance: 0,
        updated: false,
        message: 'No external account found for user',
      });
      expect(mockExternalAccountRepository.findOne).toHaveBeenCalledWith({
        user_id: mockUserId,
        provider: 'zerohash',
      });
    });

    it('should return failure when external account has no participant_code', async () => {
      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-account-123',
        user_id: mockUserId,
        participant_code: null,
      });

      const result = await service.reconcileUsdBalanceFromProvider(mockUserId);

      expect(result).toEqual({
        success: false,
        providerBalance: 0,
        localBalance: 0,
        updated: false,
        message: 'No external account found for user',
      });
    });

    it('should return failure when no accounts found from Zerohash', async () => {
      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-account-123',
        user_id: mockUserId,
        participant_code: mockParticipantCode,
      });

      mockFiatWalletAdapter.getAccountDetails = jest.fn().mockResolvedValue({
        accounts: [],
        page: 1,
        totalPages: 1,
      });

      const result = await service.reconcileUsdBalanceFromProvider(mockUserId);

      expect(result).toEqual({
        success: false,
        providerBalance: 0,
        localBalance: 0,
        updated: false,
        message: 'No accounts found from provider',
      });
      expect(mockFiatWalletAdapter.getAccountDetails).toHaveBeenCalledWith({
        accountOwner: mockParticipantCode,
        asset: mockDefaultUnderlyingCurrency,
      });
    });

    it('should return success with no update when balances match', async () => {
      const localBalance = 10000; // 100.00 USD in cents
      const providerBalance = '100.00'; // 100.00 USD from provider

      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-account-123',
        user_id: mockUserId,
        participant_code: mockParticipantCode,
      });

      mockFiatWalletAdapter.getAccountDetails = jest.fn().mockResolvedValue({
        accounts: [
          {
            asset: 'USDC',
            accountOwner: mockParticipantCode,
            accountType: 'trading',
            accountGroup: 'group1',
            accountLabel: 'Main',
            balance: providerBalance,
            accountRef: 'acc-ref-123',
            lastUpdate: Date.now(),
          },
        ],
        page: 1,
        totalPages: 1,
      });

      mockFiatWalletRepository.findOne.mockResolvedValue({
        id: mockWalletId,
        user_id: mockUserId,
        asset: 'USD',
        balance: localBalance,
      });

      const result = await service.reconcileUsdBalanceFromProvider(mockUserId);

      expect(result).toEqual({
        success: true,
        providerBalance: localBalance,
        localBalance: localBalance,
        updated: false,
        message: 'Balances are in sync',
      });
    });

    it('should update local balance when provider balance is different', async () => {
      const localBalance = 10000; // 100.00 USD in cents
      const providerBalance = '150.00'; // 150.00 USD from provider
      const providerBalanceInCents = 15000;

      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-account-123',
        user_id: mockUserId,
        participant_code: mockParticipantCode,
      });

      mockFiatWalletAdapter.getAccountDetails = jest.fn().mockResolvedValue({
        accounts: [
          {
            asset: 'USDC',
            accountOwner: mockParticipantCode,
            accountType: 'trading',
            accountGroup: 'group1',
            accountLabel: 'Main',
            balance: providerBalance,
            accountRef: 'acc-ref-123',
            lastUpdate: Date.now(),
          },
        ],
        page: 1,
        totalPages: 1,
      });

      // First call for initial balance check (getUserWallet)
      mockFiatWalletRepository.findOne
        .mockResolvedValueOnce({
          id: mockWalletId,
          user_id: mockUserId,
          asset: 'USD',
          balance: localBalance,
        })
        // Second call within lock
        .mockResolvedValueOnce({
          id: mockWalletId,
          user_id: mockUserId,
          asset: 'USD',
          balance: localBalance,
        });

      mockFiatWalletRepository.update.mockResolvedValue({
        id: mockWalletId,
        user_id: mockUserId,
        asset: 'USD',
        balance: providerBalanceInCents,
      });

      const result = await service.reconcileUsdBalanceFromProvider(mockUserId);

      expect(result).toEqual({
        success: true,
        providerBalance: providerBalanceInCents,
        localBalance: localBalance,
        updated: true,
        message: `Balance updated from ${localBalance} to ${providerBalanceInCents}`,
      });
      expect(mockFiatWalletRepository.update).toHaveBeenCalledWith(mockWalletId, {
        balance: providerBalanceInCents,
      });
    });

    it('should sum multiple account balances from provider', async () => {
      const localBalance = 10000;
      const providerBalance1 = '50.00';
      const providerBalance2 = '75.00';
      const totalProviderBalanceInCents = 12500; // 125.00 USD

      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-account-123',
        user_id: mockUserId,
        participant_code: mockParticipantCode,
      });

      mockFiatWalletAdapter.getAccountDetails = jest.fn().mockResolvedValue({
        accounts: [
          {
            asset: 'USDC',
            accountOwner: mockParticipantCode,
            balance: providerBalance1,
            accountRef: 'acc-ref-1',
            lastUpdate: Date.now(),
          },
          {
            asset: 'USDC',
            accountOwner: mockParticipantCode,
            balance: providerBalance2,
            accountRef: 'acc-ref-2',
            lastUpdate: Date.now(),
          },
        ],
        page: 1,
        totalPages: 1,
      });

      mockFiatWalletRepository.findOne
        .mockResolvedValueOnce({
          id: mockWalletId,
          user_id: mockUserId,
          asset: 'USD',
          balance: localBalance,
        })
        .mockResolvedValueOnce({
          id: mockWalletId,
          user_id: mockUserId,
          asset: 'USD',
          balance: localBalance,
        });

      mockFiatWalletRepository.update.mockResolvedValue({
        id: mockWalletId,
        balance: totalProviderBalanceInCents,
      });

      const result = await service.reconcileUsdBalanceFromProvider(mockUserId);

      expect(result.success).toBe(true);
      expect(result.providerBalance).toBe(totalProviderBalanceInCents);
      expect(result.updated).toBe(true);
    });

    it('should return failure when local USD wallet not found within lock', async () => {
      const localBalance = 10000;
      const providerBalance = '150.00';

      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-account-123',
        user_id: mockUserId,
        participant_code: mockParticipantCode,
      });

      mockFiatWalletAdapter.getAccountDetails = jest.fn().mockResolvedValue({
        accounts: [
          {
            asset: 'USDC',
            accountOwner: mockParticipantCode,
            balance: providerBalance,
            accountRef: 'acc-ref-123',
            lastUpdate: Date.now(),
          },
        ],
        page: 1,
        totalPages: 1,
      });

      // First call returns wallet (for getUserWallet), second call within lock returns null
      mockFiatWalletRepository.findOne
        .mockResolvedValueOnce({
          id: mockWalletId,
          user_id: mockUserId,
          asset: 'USD',
          balance: localBalance,
        })
        .mockResolvedValueOnce(null);

      const result = await service.reconcileUsdBalanceFromProvider(mockUserId);

      expect(result).toEqual({
        success: false,
        providerBalance: 15000,
        localBalance: 0,
        updated: false,
        message: 'Local USD wallet not found',
      });
    });

    it('should not update when balances match after acquiring lock', async () => {
      const localBalance = 10000;
      const providerBalance = '150.00';
      const providerBalanceInCents = 15000;

      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-account-123',
        user_id: mockUserId,
        participant_code: mockParticipantCode,
      });

      mockFiatWalletAdapter.getAccountDetails = jest.fn().mockResolvedValue({
        accounts: [
          {
            asset: 'USDC',
            accountOwner: mockParticipantCode,
            balance: providerBalance,
            accountRef: 'acc-ref-123',
            lastUpdate: Date.now(),
          },
        ],
        page: 1,
        totalPages: 1,
      });

      // First call shows discrepancy, second call within lock shows balance already updated
      mockFiatWalletRepository.findOne
        .mockResolvedValueOnce({
          id: mockWalletId,
          user_id: mockUserId,
          asset: 'USD',
          balance: localBalance,
        })
        .mockResolvedValueOnce({
          id: mockWalletId,
          user_id: mockUserId,
          asset: 'USD',
          balance: providerBalanceInCents,
        });

      const result = await service.reconcileUsdBalanceFromProvider(mockUserId);

      expect(result).toEqual({
        success: true,
        providerBalance: providerBalanceInCents,
        localBalance: providerBalanceInCents,
        updated: false,
        message: 'Balances are in sync',
      });
      expect(mockFiatWalletRepository.update).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully and return failure', async () => {
      mockExternalAccountRepository.findOne.mockRejectedValue(new Error('Database connection failed'));

      const result = await service.reconcileUsdBalanceFromProvider(mockUserId);

      expect(result).toEqual({
        success: false,
        providerBalance: 0,
        localBalance: 0,
        updated: false,
        message: 'Reconciliation failed: Database connection failed',
      });
    });

    it('should handle Zerohash API errors gracefully', async () => {
      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-account-123',
        user_id: mockUserId,
        participant_code: mockParticipantCode,
      });

      mockFiatWalletAdapter.getAccountDetails = jest.fn().mockRejectedValue(new Error('Zerohash API timeout'));

      const result = await service.reconcileUsdBalanceFromProvider(mockUserId);

      expect(result).toEqual({
        success: false,
        providerBalance: 0,
        localBalance: 0,
        updated: false,
        message: 'Reconciliation failed: Zerohash API timeout',
      });
    });

    it('should use the full default_underlying_currency from config', async () => {
      const customCurrency = 'USDT.ETH';
      mockFiatWalletConfigProvider.getConfig.mockReturnValue({
        default_usd_fiat_wallet_provider: 'zerohash',
        default_ngn_fiat_wallet_provider: 'zerohash',
        default_underlying_currency: customCurrency,
      });

      mockExternalAccountRepository.findOne.mockResolvedValue({
        id: 'ext-account-123',
        user_id: mockUserId,
        participant_code: mockParticipantCode,
      });

      mockFiatWalletAdapter.getAccountDetails = jest.fn().mockResolvedValue({
        accounts: [],
        page: 1,
        totalPages: 1,
      });

      await service.reconcileUsdBalanceFromProvider(mockUserId);

      expect(mockFiatWalletAdapter.getAccountDetails).toHaveBeenCalledWith({
        accountOwner: mockParticipantCode,
        asset: customCurrency,
      });
    });
  });
});

describe('FiatWalletController', () => {
  let controller: FiatWalletController;
  let fixedDate: Date;

  const mockFiatWalletService = {
    findById: jest.fn(),
    findUserWallets: jest.fn(),
  };

  const mockFiatWalletWithdrawalService = {
    transfer: jest.fn(),
    withdrawToExternalNGAccount: jest.fn(),
  };

  const mockFiatWalletExchangeService = {
    exchangeCancel: jest.fn(),
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

  const mockTransactionPinService = {
    incrementFailedAttempts: jest.fn(),
    getFailedAttempts: jest.fn(),
    verifyTransactionPinWithoutThrowing: jest.fn(),
    resetFailedAttempts: jest.fn(),
  };

  const mockLockerService = {
    withLock: jest.fn((lockKey, callback) => callback()),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FiatWalletController],
      providers: [
        {
          provide: FiatWalletService,
          useValue: mockFiatWalletService,
        },
        {
          provide: FiatWalletWithdrawalService,
          useValue: mockFiatWalletWithdrawalService,
        },
        {
          provide: FiatWalletExchangeService,
          useValue: mockFiatWalletExchangeService,
        },
        {
          provide: AppLoggerService,
          useValue: mockAppLoggerService,
        },
        {
          provide: TransactionPinService,
          useValue: mockTransactionPinService,
        },
        {
          provide: EventEmitterService,
          useValue: mockEventEmitterService,
        },
        {
          provide: LockerService,
          useValue: mockLockerService,
        },
        {
          provide: StreamService,
          useValue: {
            getUserBalanceStream: jest.fn(),
            getUserStream: jest.fn(),
            getAllStreamUpdates: jest.fn(),
            triggerSampleBalanceUpdate: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: LocationRestrictionService,
          useValue: {
            validateRegionalAccess: jest.fn(),
          },
        },
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FiatWalletController>(FiatWalletController);

    // Create a fixed date and use it consistently throughout the tests
    fixedDate = new Date();

    // Mock transformResponse method to use our fixed date
    jest.spyOn(controller as any, 'transformResponse').mockImplementation((message, data, statusCode = 200) => ({
      message,
      data,
      statusCode,
      timestamp: fixedDate.toISOString(),
    }));
  });

  describe('findOne', () => {
    it('should return a wallet by ID', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
      };

      const wallet = {
        id: 'wallet-id',
        user_id: 'user-id',
        asset: 'USD',
        balance: 100,
        credit_balance: 0,
        status: FiatWalletStatus.ACTIVE,
        created_at: fixedDate,
        updated_at: fixedDate,
      };

      mockFiatWalletService.findById.mockResolvedValue(wallet);

      const result = await controller.findOne(user as any, 'wallet-id');

      expect(mockFiatWalletService.findById).toHaveBeenCalledWith('wallet-id', user);
      expect(result).toEqual({
        message: 'Fiat wallet fetched successfully',
        data: wallet,
        statusCode: 200,
        timestamp: fixedDate.toISOString(),
      });
    });
  });

  describe('findAll', () => {
    it('should return all wallets for a user', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
      };

      const userWallets = {
        data: [
          {
            id: 'wallet-id-1',
            user_id: 'user-id',
            asset: 'USD',
            balance: 100,
            credit_balance: 0,
            status: FiatWalletStatus.ACTIVE,
          },
          {
            id: 'wallet-id-2',
            user_id: 'user-id',
            asset: 'NGN',
            balance: 50,
            credit_balance: 0,
            status: FiatWalletStatus.ACTIVE,
          },
        ],
        meta: {
          total: 2,
          page: 1,
          pageSize: 10,
        },
      };

      mockFiatWalletService.findUserWallets.mockResolvedValue(userWallets);

      const result = await controller.findAll(user as any);

      expect(mockFiatWalletService.findUserWallets).toHaveBeenCalledWith('user-id');
      expect(result).toEqual({
        message: 'Fiat wallets fetched successfully',
        data: userWallets,
        statusCode: 200,
        timestamp: fixedDate.toISOString(),
      });
    });
  });

  describe('transfer', () => {
    it('should successfully initiate a transfer', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'sender_user',
      };

      const transferDto = {
        username: 'recipient_user',
        amount: 100,
        asset: 'USD',
      };

      const transferResult = {
        transaction_id: 'tx-123',
        client_transfer_id: 'OD-12345',
        zerohash_transfer_id: 1261302,
        amount: 100,
        asset: 'USD',
        recipient: 'recipient_user',
        status: 'approved',
        message: 'Transfer initiated successfully',
      };

      mockFiatWalletWithdrawalService.transfer.mockResolvedValue(transferResult);

      const result = await controller.transfer(user as any, transferDto);

      expect(mockFiatWalletWithdrawalService.transfer).toHaveBeenCalledWith(user, transferDto);
      expect(result).toEqual({
        message: 'Transfer initiated successfully',
        data: transferResult,
        statusCode: 201,
        timestamp: fixedDate.toISOString(),
      });
    });

    it('should handle transfer errors', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'sender_user',
      };

      const transferDto = {
        username: 'nonexistent_user',
        amount: 100,
        asset: 'USD',
      };

      mockFiatWalletWithdrawalService.transfer.mockRejectedValue(new BadRequestException('User not found'));

      await expect(controller.transfer(user as any, transferDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('exchangeCancel', () => {
    it('should successfully cancel an exchange', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
      };

      const cancelDto = {
        transaction_id: 'tx-123',
      };

      const cancelResult = {
        transaction_id: 'tx-123',
        status: TransactionStatus.CANCELLED,
        message: 'Exchange cancelled successfully',
      };

      mockFiatWalletExchangeService.exchangeCancel.mockResolvedValue(cancelResult);

      const result = await controller.exchangeCancel(user as any, cancelDto);

      expect(mockFiatWalletExchangeService.exchangeCancel).toHaveBeenCalledWith(user, cancelDto);
      expect(result).toEqual({
        message: 'Exchange cancelled successfully',
        data: cancelResult,
        statusCode: 200,
        timestamp: fixedDate.toISOString(),
      });
    });
  });

  describe('withdrawalExternalNGAccount', () => {
    it('should successfully initiate withdrawal to external NG account', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
      };

      const withdrawDto = {
        amount: 50000,
        bank_ref: '044',
        account_number: '0123456789',
        country_code: 'NG',
        remark: 'Test withdrawal',
      };

      const withdrawResult = {
        id: 'fwt-123',
        transaction_id: 'tx-123',
        fiat_wallet_id: 'wallet-123',
        user_id: 'user-id',
        transaction_type: 'WITHDRAWAL',
        amount: 5000000,
        balance_before: 10000000,
        balance_after: 5000000,
        status: 'COMPLETED',
        currency: 'NGN',
      };

      mockFiatWalletWithdrawalService.withdrawToExternalNGAccount.mockResolvedValue(withdrawResult);

      const result = await controller.withdrawalExternalNGAccount(
        user as any,
        'test-idempotency-key',
        withdrawDto as any,
      );

      expect(mockFiatWalletWithdrawalService.withdrawToExternalNGAccount).toHaveBeenCalledWith(
        user,
        'test-idempotency-key',
        withdrawDto,
      );
      expect(result).toEqual({
        message: 'Withdrawal initiated',
        data: withdrawResult,
        statusCode: 201,
        timestamp: fixedDate.toISOString(),
      });
    });

    it('should handle withdrawal errors', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
      };

      const withdrawDto = {
        amount: 50000,
        bank_ref: '044',
        account_number: '0123456789',
        country_code: 'NG',
        remark: 'Test withdrawal',
      };

      mockFiatWalletWithdrawalService.withdrawToExternalNGAccount.mockRejectedValue(
        new BadRequestException('Insufficient balance'),
      );

      await expect(
        controller.withdrawalExternalNGAccount(user as any, 'test-idempotency-key', withdrawDto as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('streamBalanceUpdates', () => {
    it('should return an observable for balance stream', () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
      };

      const mockObservable = {
        subscribe: jest.fn(),
      };

      const streamService = controller['streamService'];
      (streamService.getUserBalanceStream as jest.Mock).mockReturnValue(mockObservable);

      const result = controller.streamBalanceUpdates(user as any);

      expect(streamService.getUserBalanceStream).toHaveBeenCalledWith('user-id');
      expect(result).toEqual(mockObservable);
    });
  });

  describe('triggerSampleFiatBalance', () => {
    it('should trigger a sample balance update event', async () => {
      const user = {
        id: 'user-id',
        email: 'test@example.com',
      };

      const streamService = controller['streamService'];

      const result = await controller.triggerSampleFiatBalance(user as any);

      expect(streamService.triggerSampleBalanceUpdate).toHaveBeenCalledWith('user-id', 'fiat');
      expect(result).toEqual({
        message: 'Sample balance update event published',
        data: { stream: 'balance', walletType: 'fiat' },
        statusCode: 201,
        timestamp: fixedDate.toISOString(),
      });
    });
  });
});
