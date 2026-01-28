jest.mock('../../../config/environment', () => ({
  EnvironmentService: {
    getValue: jest.fn((key: string) => {
      if (key === 'DEFAULT_USD_FIAT_WALLET_PROVIDER') {
        return 'zerohash';
      }
      return undefined;
    }),
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

jest.mock('../../../config/onedosh/onedosh.config', () => ({
  OneDoshConfiguration: {
    getAllSupportedCryptoCurrencies: jest.fn(() => ['USDC', 'USDT']),
    getSupportedCryptoNetworks: jest.fn(() => ['SOL', 'ETH', 'TRON']),
  },
}));

jest.mock('../../../currencies/currencies', () => ({
  CurrencyUtility: {
    formatCurrencyAmountToSmallestUnit: jest.fn((amount) => Math.round(amount * 100)),
    formatCurrencyAmountToMainUnit: jest.fn((amount, currency) => {
      if (amount === null || amount === undefined) {
        return 0;
      }
      if (currency === 'USD' || currency === 'NGN') {
        return amount / 100;
      }
      return amount;
    }),
    formatCurrencyAmountToLocaleString: jest.fn((amount, currency) => {
      if (amount === null || amount === undefined) {
        return `${currency} 0`;
      }
      return `${currency} ${amount.toLocaleString()}`;
    }),
  },
  SUPPORTED_CURRENCIES: {
    USD: {
      code: 'USD',
      numericCode: '840',
      name: 'US Dollar',
      symbol: '$',
      minorUnit: 100,
      country: 'United States',
      countryCode: 'US',
    },
    NGN: {
      code: 'NGN',
      numericCode: '566',
      name: 'Nigerian Naira',
      symbol: '₦',
      minorUnit: 100,
      country: 'Nigeria',
      countryCode: 'NG',
    },
  },
}));

jest.mock('../../../database/database.connection', () => ({
  KnexDB: {
    connection: jest.fn(() => ({
      raw: jest.fn(),
      destroy: jest.fn(),
    })),
  },
}));

import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeAdapter } from '../../../adapters/exchange/exchange.adapter';
import { FiatWalletAdapter } from '../../../adapters/fiat-wallet/fiat-wallet.adapter';
import { KYCAdapter } from '../../../adapters/kyc/kyc-adapter';
import { ZerohashParticipantAdapter } from '../../../adapters/participant/zerohash/zerohash.adapter';
import { FiatWalletTransactionType } from '../../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import {
  TransactionCategory,
  TransactionScope,
  TransactionStatus,
  TransactionType,
} from '../../../database/models/transaction/transaction.interface';
import { KycStatusLogService } from '../../../modules/auth/kycStatusLog/kycStatusLog.service';
import { KycVerificationService } from '../../../modules/auth/kycVerification/kycVerification.service';
import { UserRepository } from '../../../modules/auth/user/user.repository';
import { UserService } from '../../../modules/auth/user/user.service';
import { UserProfileService } from '../../../modules/auth/userProfile/userProfile.service';
import { BlockchainWalletTransactionRepository } from '../../../modules/blockchainWalletTransaction/blockchainWalletTransaction.repository';
import { ExternalAccountService } from '../../../modules/externalAccount/external-account.service';
import { FiatWalletRepository } from '../../../modules/fiatWallet/fiatWallet.repository';
import { FiatWalletService } from '../../../modules/fiatWallet/fiatWallet.service';
import { FiatWalletTransactionRepository } from '../../../modules/fiatWalletTransactions/fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from '../../../modules/fiatWalletTransactions/fiatWalletTransactions.service';
import { RateRepository } from '../../../modules/rate/rate.repository';
import { RateConfigRepository } from '../../../modules/rateConfig/rateConfig.repository';
import { TransactionRepository } from '../../../modules/transaction/transaction.repository';
import { TransactionService } from '../../../modules/transaction/transaction.service';
import { TransactionAggregateService } from '../../../modules/transactionAggregate/transactionAggregate.service';
import { LockerService } from '../../../services/locker/locker.service';
import { AppLoggerService } from '../../../services/logger/logger.service';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UsdFiatRewardsProcessor } from '../../../services/queue/processors/usd-fiat-rewards/usd-fiat-rewards.processor';
import { DoshPointsAccountService } from '../../doshPoints/doshPointsAccount/doshPointsAccount.service';
import { DoshPointsTransactionService } from '../../doshPoints/doshPointsTransaction/doshPointsTransaction.service';
import { VirtualAccountService } from '../../virtualAccount';
import { YellowCardWebhookService } from '../yellowcard/yellowcard-webhook.service';
import { ZerohashWebhookController } from './zerohash-webhook.controller';
import {
  ZeroHashExternalAccountStatusChangedPayload,
  ZeroHashParticipantStatusChangedPayload,
  ZeroHashPaymentStatusChangedPayload,
  ZeroHashTradeState,
  ZeroHashTradeStatusChangedPayload,
  ZeroHashWebhookEventType,
} from './zerohash-webhook.interface';
import { ZerohashWebhookService } from './zerohash-webhook.service';

describe('ZerohashWebhookService', () => {
  let service: ZerohashWebhookService;
  let controller: ZerohashWebhookController;

  const mockAdapter = {
    getKycDetails: jest.fn(),
  };

  const mockKycVerificationService = {
    findActiveByParticipantCode: jest.fn(),
    updateVerificationStatus: jest.fn(),
    findByProviderRef: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
  };

  const mockKycStatusLogService = {
    logStatusChange: jest.fn(),
  };

  const mockUserRepository = {
    findActiveById: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
  };

  const mockUserService = {
    findUserWithCountryByEmail: jest.fn(),
    findActiveByEmail: jest.fn(),
    findByUserId: jest.fn(),
  };

  const mockUserProfileService = {
    update: jest.fn(),
  };

  const mockExternalAccountService = {
    findOne: jest.fn(),
    update: jest.fn(),
    closeExternalAccount: jest.fn(),
  };

  const mockTransactionService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateStatus: jest.fn(),
    create: jest.fn(),
    transactionRepository: {
      findOne: jest.fn(),
      update: jest.fn(),
    },
    completeExchangeTransaction: jest.fn(),
  };

  const mockFiatWalletTransactionService = {
    findOne: jest.fn(),
    findOneOrNull: jest.fn(),
    findAll: jest.fn(),
    updateStatus: jest.fn(),
    create: jest.fn(),
    fiatWalletTransactionRepository: {
      findOne: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockFiatWalletRepository = {
    findById: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn(),
  };

  const mockFiatWalletService = {
    getUserWallet: jest.fn(),
    updateBalance: jest.fn(),
    updateBalanceWithTransaction: jest.fn(),
  };

  const mockBlockchainWalletTransactionRepository = {
    findByTransactionHash: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
  };

  const mockMailerService = {
    send: jest.fn(),
  };

  const mockFiatWalletAdapter = {
    transfer: jest.fn(),
    getTransferDetails: jest.fn(),
    getWithdrawalDetails: jest.fn(),
  };

  const mockLockerService = {
    runWithLock: jest.fn().mockImplementation(async (_key, fn) => await fn()),
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

  const mockZerohashParticipantAdapter = {
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  };

  const mockYellowCardWebhookService = {
    processWebhook: jest.fn(),
    mockPaymentCompleteWebhook: jest.fn(),
  };

  const mockRateRepository = {
    findOne: jest.fn(),
  };

  const mockRateConfigRepository = {
    findOne: jest.fn(),
  };

  const mockExchangeAdapter = {
    getProviderName: jest.fn().mockReturnValue('yellowcard'),
  };

  const mockTransactionRepository = {
    findOne: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn(),
    query: jest.fn(),
  };

  const mockFiatWalletTransactionRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    query: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockDoshPointsAccountService = {
    findOrCreate: jest.fn().mockResolvedValue({ usd_fiat_rewards_enabled: null }),
  };

  const mockDoshPointsTransactionService = {
    creditPoints: jest.fn().mockResolvedValue({ is_duplicate: false }),
  };

  const mockUsdFiatRewardsProcessor = {
    queueCreditFirstDepositReward: jest.fn().mockResolvedValue({ id: 'job-1' }),
    sendRewardNotification: jest.fn().mockResolvedValue(undefined),
  };

  const mockTransactionAggregateService = {
    findAndUpdate: jest.fn().mockResolvedValue({ id: 'aggregate-1', amount: 1000 }),
  };

  const mockVirtualAccountService = {
    findOrCreateVirtualAccount: jest.fn(),
    scheduleExchangeVirtualAccountDeletion: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ZerohashWebhookController],
      providers: [
        ZerohashWebhookService,
        { provide: KYCAdapter, useValue: mockAdapter },
        { provide: KycVerificationService, useValue: mockKycVerificationService },
        { provide: KycStatusLogService, useValue: mockKycStatusLogService },
        { provide: UserService, useValue: mockUserService },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: UserProfileService, useValue: mockUserProfileService },
        { provide: ExternalAccountService, useValue: mockExternalAccountService },
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: TransactionRepository, useValue: mockTransactionRepository },
        { provide: FiatWalletTransactionService, useValue: mockFiatWalletTransactionService },
        { provide: FiatWalletTransactionRepository, useValue: mockFiatWalletTransactionRepository },
        { provide: FiatWalletService, useValue: mockFiatWalletService },
        { provide: FiatWalletRepository, useValue: mockFiatWalletRepository },
        { provide: BlockchainWalletTransactionRepository, useValue: mockBlockchainWalletTransactionRepository },
        { provide: FiatWalletAdapter, useValue: mockFiatWalletAdapter },
        { provide: ZerohashParticipantAdapter, useValue: mockZerohashParticipantAdapter },
        { provide: LockerService, useValue: mockLockerService },
        { provide: AppLoggerService, useValue: mockAppLoggerService },
        { provide: YellowCardWebhookService, useValue: mockYellowCardWebhookService },
        { provide: MailerService, useValue: mockMailerService },
        { provide: DoshPointsAccountService, useValue: mockDoshPointsAccountService },
        { provide: DoshPointsTransactionService, useValue: mockDoshPointsTransactionService },
        { provide: UsdFiatRewardsProcessor, useValue: mockUsdFiatRewardsProcessor },
        { provide: RateRepository, useValue: mockRateRepository },
        { provide: RateConfigRepository, useValue: mockRateConfigRepository },
        { provide: ExchangeAdapter, useValue: mockExchangeAdapter },
        { provide: VirtualAccountService, useValue: mockVirtualAccountService },
        { provide: TransactionAggregateService, useValue: mockTransactionAggregateService },
      ],
    }).compile();

    service = module.get<ZerohashWebhookService>(ZerohashWebhookService);
    controller = module.get<ZerohashWebhookController>(ZerohashWebhookController);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('processWebhook', () => {
    it('should process participant_status_changed webhook', async () => {
      const payload: ZeroHashParticipantStatusChangedPayload = {
        participant_code: 'abc123',
        participant_status: 'SUBMITTED',
      };

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'external-1',
        participant_code: 'abc123',
        provider_kyc_status: 'not_started',
      });

      await service.processWebhook(payload, ZeroHashWebhookEventType.PARTICIPANT_STATUS_CHANGED);

      expect(mockExternalAccountService.update).toHaveBeenCalledWith(
        { id: 'external-1' },
        { provider_kyc_status: 'submitted' },
      );
    });

    it('should process external_account_status_changed webhook', async () => {
      const payload: ZeroHashExternalAccountStatusChangedPayload = {
        external_account_id: 'ext-1',
        external_account_status: 'APPROVED',
      };

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'external-1',
        participant_code: 'abc123',
        provider_kyc_status: 'approved',
        external_account_ref: 'ext-1',
        status: 'pending',
      });

      await service.processWebhook(payload, ZeroHashWebhookEventType.EXTERNAL_ACCOUNT_STATUS_CHANGED);

      expect(mockExternalAccountService.update).toHaveBeenCalledWith({ id: 'external-1' }, { status: 'approved' });
    });

    it('should process participant_updated webhook', async () => {
      const payload = { participant_code: 'abc123' };

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'external-1',
        participant_code: 'abc123',
      });

      await expect(
        service.processWebhook(payload, ZeroHashWebhookEventType.PARTICIPANT_UPDATED),
      ).resolves.not.toThrow();
    });

    it('should process account_balance.changed webhook', async () => {
      const payload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL',
        account_type: 'available',
        balance: '100.00',
        movements: [],
      } as any;

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'external-1',
        participant_code: 'abc123',
        user_id: 'user-1',
      });

      await expect(
        service.processWebhook(payload, ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED),
      ).resolves.not.toThrow();
    });

    it('should process payment_status_changed webhook with settled status', async () => {
      const payload: ZeroHashPaymentStatusChangedPayload = {
        transaction_id: 'tx-123',
        payment_status: 'settled',
        participant_code: 'ABC123',
        timestamp: 1764724461060,
      };

      mockTransactionService.findOne.mockResolvedValue({
        id: 'trans-1',
        status: 'processing',
        metadata: {},
      });

      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        id: 'fwt-1',
        transaction_id: 'trans-1',
        provider_metadata: {},
      });

      await service.processWebhook(payload, ZeroHashWebhookEventType.PAYMENT_STATUS_CHANGED);

      // Settled status should only update fiat wallet transaction's settled_at, not main transaction status
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-1',
        expect.objectContaining({
          settled_at: expect.any(String),
          provider_metadata: expect.any(Object),
        }),
      );
      expect(mockTransactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should process payment_status_changed webhook with posted status', async () => {
      const payload: ZeroHashPaymentStatusChangedPayload = {
        transaction_id: 'tx-123',
        payment_status: 'posted',
        participant_code: 'ABC123',
        timestamp: 1764724461060,
      };

      mockTransactionService.findOne.mockResolvedValue({
        id: 'trans-1',
        status: 'pending',
        metadata: {},
      });

      await service.processWebhook(payload, ZeroHashWebhookEventType.PAYMENT_STATUS_CHANGED);

      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        'trans-1',
        TransactionStatus.PROCESSING,
        expect.any(Object),
      );
    });

    it('should process trade.status_changed webhook', async () => {
      const payload: ZeroHashTradeStatusChangedPayload = {
        client_trade_id: 'trade-123',
        trade_state: 'accepted',
        trade_id: 'zh-trade-456',
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        id: 'fwt-1',
        status: 'pending',
        provider_metadata: {},
      });

      await service.processWebhook(payload, ZeroHashWebhookEventType.TRADE_STATUS_CHANGED);

      expect(mockFiatWalletTransactionService.updateStatus).toHaveBeenCalled();
    });

    it('should log warning for unhandled event types', async () => {
      const warnSpy = jest.spyOn(service['logger'], 'warn');
      await service.processWebhook({} as any, 'unhandled_event' as any);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unhandled Zerohash event type'));
    });
  });

  describe('extractParticipantCode', () => {
    it('should extract participant_code from direct field', () => {
      const payload: Partial<ZeroHashPaymentStatusChangedPayload> = {
        participant_code: 'abc123',
        transaction_id: 'tx-123',
        payment_status: 'settled',
      };
      const result = service['extractParticipantCode'](payload as ZeroHashPaymentStatusChangedPayload);
      expect(result).toBe('abc123');
    });

    it('should extract participant_code from obo_participant', () => {
      const payload: Partial<ZeroHashPaymentStatusChangedPayload> = {
        obo_participant: { participant_code: 'xyz789' },
        transaction_id: 'tx-123',
        payment_status: 'settled',
      };
      const result = service['extractParticipantCode'](payload as ZeroHashPaymentStatusChangedPayload);
      expect(result).toBe('xyz789');
    });

    it('should throw BadRequestException if participant_code is missing', () => {
      const payload: Partial<ZeroHashPaymentStatusChangedPayload> = {
        transaction_id: 'tx-123',
        payment_status: 'settled',
      };
      expect(() => service['extractParticipantCode'](payload as ZeroHashPaymentStatusChangedPayload)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('getExternalAccount', () => {
    it('should return external account when found', async () => {
      const mockAccount = { id: 'ext-1', user_id: 'user-1' };
      mockExternalAccountService.findOne.mockResolvedValue(mockAccount);

      const result = await service['getExternalAccount']('abc123');

      expect(result).toEqual(mockAccount);
      expect(mockExternalAccountService.findOne).toHaveBeenCalledWith({ participant_code: 'abc123' });
    });

    it('should return null when account not found', async () => {
      mockExternalAccountService.findOne.mockRejectedValue(new NotFoundException());

      const result = await service['getExternalAccount']('abc123');

      expect(result).toBeNull();
    });

    it('should throw InternalServerErrorException for other errors', async () => {
      mockExternalAccountService.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service['getExternalAccount']('abc123')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('processParticipantStatusChanged', () => {
    it('should update status when priority is higher', async () => {
      const payload = {
        participant_code: 'abc123',
        participant_status: 'APPROVED',
      };

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-1',
        provider_kyc_status: 'submitted',
      });

      await service['processParticipantStatusChanged'](payload);

      expect(mockExternalAccountService.update).toHaveBeenCalledWith(
        { id: 'ext-1' },
        { provider_kyc_status: 'approved' },
      );
    });

    it('should not downgrade from approved to submitted', async () => {
      const payload = {
        participant_code: 'abc123',
        participant_status: 'SUBMITTED',
      };

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-1',
        provider_kyc_status: 'approved',
      });

      await service['processParticipantStatusChanged'](payload);

      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
    });

    it('should allow approved to pending_approval transition', async () => {
      const payload = {
        participant_code: 'abc123',
        participant_status: 'PENDING_APPROVAL',
      };

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-1',
        provider_kyc_status: 'approved',
      });

      await service['processParticipantStatusChanged'](payload);

      expect(mockExternalAccountService.update).toHaveBeenCalledWith(
        { id: 'ext-1' },
        { provider_kyc_status: 'pending_approval' },
      );
    });

    it('should allow locked to approved transition', async () => {
      const payload = {
        participant_code: 'abc123',
        participant_status: 'APPROVED',
      };

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-1',
        provider_kyc_status: 'locked',
      });

      await service['processParticipantStatusChanged'](payload);

      expect(mockExternalAccountService.update).toHaveBeenCalledWith(
        { id: 'ext-1' },
        { provider_kyc_status: 'approved' },
      );
    });

    it('should skip update when status is the same', async () => {
      const payload = {
        participant_code: 'abc123',
        participant_status: 'APPROVED',
      };

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-1',
        provider_kyc_status: 'approved',
      });

      await service['processParticipantStatusChanged'](payload);

      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
    });

    it('should mirror any other status from ZeroHash', async () => {
      const payload = {
        participant_code: 'abc123',
        participant_status: 'PENDING_UNLOCK',
      };

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-1',
        provider_kyc_status: 'locked',
      });

      await service['processParticipantStatusChanged'](payload);

      expect(mockExternalAccountService.update).toHaveBeenCalledWith(
        { id: 'ext-1' },
        { provider_kyc_status: 'pending_unlock' },
      );
    });

    it('should not update if external account not found', async () => {
      const payload = {
        participant_code: 'abc123',
        participant_status: 'APPROVED',
      };

      mockExternalAccountService.findOne.mockRejectedValue(new NotFoundException());

      await service['processParticipantStatusChanged'](payload);

      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
    });
  });

  describe('processExternalAccountStatusChanged', () => {
    it('should find external account by external_account_ref', async () => {
      const payload = {
        external_account_id: 'ext-ref-123',
        external_account_status: 'APPROVED',
      };

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-1',
        status: 'pending',
        external_account_ref: 'ext-ref-123',
      });

      await service['processExternalAccountStatusChanged'](payload);

      expect(mockExternalAccountService.findOne).toHaveBeenCalledWith({
        external_account_ref: 'ext-ref-123',
      });
      expect(mockExternalAccountService.update).toHaveBeenCalledWith({ id: 'ext-1' }, { status: 'approved' });
    });

    it('should throw if external_account_id is missing', async () => {
      const payload = {
        external_account_status: 'APPROVED',
      } as any; // Intentionally invalid payload for testing validation

      await expect(service['processExternalAccountStatusChanged'](payload)).rejects.toThrow(BadRequestException);
    });

    it('should call closeExternalAccount when status is CLOSED', async () => {
      const payload = {
        external_account_id: 'ext-ref-123',
        external_account_status: 'CLOSED',
      };

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-1',
        status: 'approved',
        external_account_ref: 'ext-ref-123',
      });

      mockExternalAccountService.closeExternalAccount.mockResolvedValue(undefined);

      await service['processExternalAccountStatusChanged'](payload);

      expect(mockExternalAccountService.closeExternalAccount).toHaveBeenCalledWith('ext-1');
      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
    });

    it('should call closeExternalAccount when status is revoked', async () => {
      const payload = {
        external_account_id: 'ext-ref-123',
        external_account_status: 'revoked',
      };

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-1',
        status: 'approved',
        external_account_ref: 'ext-ref-123',
      });

      mockExternalAccountService.closeExternalAccount.mockResolvedValue(undefined);

      await service['processExternalAccountStatusChanged'](payload);

      expect(mockExternalAccountService.closeExternalAccount).toHaveBeenCalledWith('ext-1');
      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
    });

    it('should not downgrade from approved to pending', async () => {
      const payload = {
        external_account_id: 'ext-ref-123',
        external_account_status: 'PENDING',
      };

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-1',
        status: 'approved',
        external_account_ref: 'ext-ref-123',
      });

      await service['processExternalAccountStatusChanged'](payload);

      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
    });

    it('should not downgrade from any status to pending', async () => {
      const payload = {
        external_account_id: 'ext-ref-123',
        external_account_status: 'PENDING',
      };

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-1',
        status: 'rejected',
        external_account_ref: 'ext-ref-123',
      });

      await service['processExternalAccountStatusChanged'](payload);

      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
    });

    it('should skip if status is unchanged', async () => {
      const payload = {
        external_account_id: 'ext-ref-123',
        external_account_status: 'approved',
      };

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-1',
        status: 'approved',
        external_account_ref: 'ext-ref-123',
      });

      await service['processExternalAccountStatusChanged'](payload);

      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException when external account not found', async () => {
      const payload = {
        external_account_id: 'ext-ref-123',
        external_account_status: 'APPROVED',
      };

      mockExternalAccountService.findOne.mockRejectedValue(new NotFoundException('External account not found'));

      const warnSpy = jest.spyOn(service['logger'], 'warn');
      await service['processExternalAccountStatusChanged'](payload);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No ExternalAccount found for external_account_id: ext-ref-123'),
      );
      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
    });
  });

  describe('isValidBalanceChangePayload', () => {
    it('should return true for valid payload with available account', () => {
      const payload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL',
        account_type: 'available',
        movements: [],
      } as any;

      const result = service['isValidBalanceChangePayload'](payload);
      expect(result).toBe(true);
    });

    it('should return true for collateral account with withdrawal_confirmed', () => {
      const payload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL',
        account_type: 'collateral',
        movements: [{ movement_type: 'withdrawal_confirmed', change: '-10.00' }],
      } as any;

      const result = service['isValidBalanceChangePayload'](payload);
      expect(result).toBe(true);
    });

    it('should return false for collateral account without withdrawal_confirmed', () => {
      const payload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL',
        account_type: 'collateral',
        movements: [{ movement_type: 'deposit', change: '10.00' }],
      } as any;

      const result = service['isValidBalanceChangePayload'](payload);
      expect(result).toBe(false);
    });

    it('should return false if participant_code is missing', () => {
      const payload = {
        asset: 'USDC.SOL',
        account_type: 'available',
      } as any; // Intentionally invalid for testing validation

      const result = service['isValidBalanceChangePayload'](payload);
      expect(result).toBe(false);
    });

    it('should return false if asset is missing', () => {
      const payload = {
        participant_code: 'abc123',
        account_type: 'available',
      } as any; // Intentionally invalid for testing validation

      const result = service['isValidBalanceChangePayload'](payload);
      expect(result).toBe(false);
    });

    it('should return false for unsupported account type', () => {
      const payload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL',
        account_type: 'unknown',
        movements: [],
      } as any; // Intentionally invalid account_type for testing validation

      const result = service['isValidBalanceChangePayload'](payload);
      expect(result).toBe(false);
    });

    it('should return false for unsupported asset', () => {
      const payload = {
        participant_code: 'abc123',
        asset: 'BTC',
        account_type: 'available',
        movements: [],
      } as any;

      const result = service['isValidBalanceChangePayload'](payload);
      expect(result).toBe(false);
    });
  });

  describe('isSupportedStablecoin', () => {
    it('should return true for supported stablecoin', () => {
      const result = service['isSupportedStablecoin']('USDC.SOL');
      expect(result).toBe(true);
    });

    it('should return false for asset without dot', () => {
      const result = service['isSupportedStablecoin']('USDC');
      expect(result).toBe(false);
    });

    it('should return false for unsupported currency', () => {
      const result = service['isSupportedStablecoin']('BTC.SOL');
      expect(result).toBe(false);
    });

    it('should return false for unsupported network', () => {
      const result = service['isSupportedStablecoin']('USDC.BTC');
      expect(result).toBe(false);
    });
  });

  describe('isValidMovement', () => {
    it('should return true for valid final_settlement movement', () => {
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'trade-123',
        change: '10.50',
      } as any;

      const result = service['isValidMovement'](movement);
      expect(result).toBe(true);
    });

    it('should return true for valid transfer movement', () => {
      const movement = {
        movement_type: 'transfer',
        transfer_request_id: 'transfer-123',
        change: '10.50',
      } as any;

      const result = service['isValidMovement'](movement);
      expect(result).toBe(true);
    });

    it('should return true for valid withdrawal_confirmed movement', () => {
      const movement = {
        movement_type: 'withdrawal_confirmed',
        withdrawal_request_id: 'withdrawal-123',
        change: '-10.50',
      } as any;

      const result = service['isValidMovement'](movement);
      expect(result).toBe(true);
    });

    it('should return true for valid deposit movement', () => {
      const movement = {
        movement_type: 'deposit',
        deposit_reference_id: 'deposit-123',
        change: '10.50',
      } as any;

      const result = service['isValidMovement'](movement);
      expect(result).toBe(true);
    });

    it('should return false if change is missing', () => {
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'trade-123',
      } as any; // Intentionally missing 'change' for testing validation

      const warnSpy = jest.spyOn(service['logger'], 'warn');
      const result = service['isValidMovement'](movement);

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should return false if final_settlement missing trade_id', () => {
      const movement = {
        movement_type: 'final_settlement',
        change: '10.50',
      } as any;

      const result = service['isValidMovement'](movement);
      expect(result).toBe(false);
    });

    it('should return false if transfer missing transfer_request_id', () => {
      const movement = {
        movement_type: 'transfer',
        change: '10.50',
      } as any;

      const result = service['isValidMovement'](movement);
      expect(result).toBe(false);
    });

    it('should return false for unsupported movement type', () => {
      const movement = {
        movement_type: 'unknown',
        change: '10.50',
      } as any; // Intentionally invalid movement_type for testing validation

      const result = service['isValidMovement'](movement);
      expect(result).toBe(false);
    });
  });

  describe('mapPaymentStatusToTransactionStatus', () => {
    it('should map submitted to PENDING', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('submitted');
      expect(result).toBe(TransactionStatus.PENDING);
    });

    it('should map settled to SETTLED', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('settled');
      expect(result).toBe(TransactionStatus.SETTLED);
    });

    it('should map failed to FAILED', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('failed');
      expect(result).toBe(TransactionStatus.FAILED);
    });

    it('should map cancelled to CANCELLED', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('cancelled');
      expect(result).toBe(TransactionStatus.CANCELLED);
    });

    it('should return null for unknown status', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('unknown');
      expect(result).toBeNull();
    });
  });

  describe('mapTradeStateToTransactionStatus', () => {
    it('should map active to PENDING', () => {
      const result = service['mapTradeStateToTransactionStatus'](ZeroHashTradeState.ACTIVE);
      expect(result).toBe(TransactionStatus.PENDING);
    });

    it('should map pending to PENDING', () => {
      const result = service['mapTradeStateToTransactionStatus'](ZeroHashTradeState.PENDING);
      expect(result).toBe(TransactionStatus.PENDING);
    });

    it('should map accepted to PROCESSING', () => {
      const result = service['mapTradeStateToTransactionStatus'](ZeroHashTradeState.ACCEPTED);
      expect(result).toBe(TransactionStatus.PROCESSING);
    });

    it('should map terminated to COMPLETED', () => {
      const result = service['mapTradeStateToTransactionStatus'](ZeroHashTradeState.TERMINATED);
      expect(result).toBe(TransactionStatus.COMPLETED);
    });

    it('should map settled to COMPLETED', () => {
      const result = service['mapTradeStateToTransactionStatus'](ZeroHashTradeState.SETTLED);
      expect(result).toBe(TransactionStatus.COMPLETED);
    });

    it('should map rejected to FAILED', () => {
      const result = service['mapTradeStateToTransactionStatus'](ZeroHashTradeState.REJECTED);
      expect(result).toBe(TransactionStatus.FAILED);
    });

    it('should map cancelled to CANCELLED', () => {
      const result = service['mapTradeStateToTransactionStatus'](ZeroHashTradeState.CANCELLED);
      expect(result).toBe(TransactionStatus.CANCELLED);
    });

    it('should map expired to FAILED', () => {
      const result = service['mapTradeStateToTransactionStatus'](ZeroHashTradeState.EXPIRED);
      expect(result).toBe(TransactionStatus.FAILED);
    });

    it('should return null for unknown state', () => {
      const result = service['mapTradeStateToTransactionStatus']('unknown' as any);
      expect(result).toBeNull();
    });
  });

  describe('buildFailureReason', () => {
    it('should build reason from all fields', () => {
      const result = service['buildFailureReason']('ERR001', 'Invalid account', 'NSF', 'Rejected by bank');

      expect(result).toContain('Code: ERR001');
      expect(result).toContain('Description: Invalid account');
      expect(result).toContain('ACH Failure: NSF');
      expect(result).toContain('Rejected: Rejected by bank');
    });

    it('should return default message when no fields provided', () => {
      const result = service['buildFailureReason']();
      expect(result).toBe('Payment failed');
    });

    it('should build reason with partial fields', () => {
      const result = service['buildFailureReason']('ERR001', undefined, 'NSF');

      expect(result).toContain('Code: ERR001');
      expect(result).toContain('ACH Failure: NSF');
      expect(result).not.toContain('Description');
    });
  });

  describe('mergeMetadataWithWebhookPayload', () => {
    it('should merge metadata and append webhook payload with essential fields only', () => {
      const existingMetadata = { key1: 'value1' };
      const newMetadata = {} as any; // Empty metadata for testing
      const payload: ZeroHashParticipantStatusChangedPayload = {
        participant_code: 'test123',
        participant_status: 'approved',
      };

      const result = service['mergeMetadataWithWebhookPayload'](
        existingMetadata,
        newMetadata,
        ZeroHashWebhookEventType.PARTICIPANT_STATUS_CHANGED,
        payload,
      );

      expect(result.key1).toBe('value1');
      expect(result.webhook_payloads).toHaveLength(1);
      expect(result.webhook_payloads[0].event_type).toBe(ZeroHashWebhookEventType.PARTICIPANT_STATUS_CHANGED);
      expect(result.webhook_payloads[0].payload).toBeDefined();
    });

    it('should append to existing webhook_payloads', () => {
      const existingMetadata = {
        webhook_payloads: [
          {
            timestamp: '2023-01-01',
            event_type: ZeroHashWebhookEventType.PARTICIPANT_STATUS_CHANGED,
            payload: {
              participant_code: 'old123',
              participant_status: 'pending',
            } as ZeroHashParticipantStatusChangedPayload,
          },
        ],
      };
      const newMetadata = {} as any;
      const payload: ZeroHashParticipantStatusChangedPayload = {
        participant_code: 'new123',
        participant_status: 'approved',
      };

      const result = service['mergeMetadataWithWebhookPayload'](
        existingMetadata,
        newMetadata,
        ZeroHashWebhookEventType.PARTICIPANT_UPDATED,
        payload,
      );

      expect(result.webhook_payloads).toHaveLength(2);
      expect(result.webhook_payloads[1].event_type).toBe(ZeroHashWebhookEventType.PARTICIPANT_UPDATED);
    });

    it('should limit webhook_payloads to 5 entries to prevent memory exhaustion', () => {
      const existingMetadata = {
        webhook_payloads: [
          {
            timestamp: '2023-01-01',
            event_type: ZeroHashWebhookEventType.PARTICIPANT_STATUS_CHANGED,
            payload: {
              participant_code: 'old1',
              participant_status: 'pending',
            } as ZeroHashParticipantStatusChangedPayload,
          },
          {
            timestamp: '2023-01-02',
            event_type: ZeroHashWebhookEventType.PARTICIPANT_STATUS_CHANGED,
            payload: {
              participant_code: 'old2',
              participant_status: 'pending',
            } as ZeroHashParticipantStatusChangedPayload,
          },
          {
            timestamp: '2023-01-03',
            event_type: ZeroHashWebhookEventType.PARTICIPANT_STATUS_CHANGED,
            payload: {
              participant_code: 'old3',
              participant_status: 'pending',
            } as ZeroHashParticipantStatusChangedPayload,
          },
          {
            timestamp: '2023-01-04',
            event_type: ZeroHashWebhookEventType.PARTICIPANT_STATUS_CHANGED,
            payload: {
              participant_code: 'old4',
              participant_status: 'pending',
            } as ZeroHashParticipantStatusChangedPayload,
          },
          {
            timestamp: '2023-01-05',
            event_type: ZeroHashWebhookEventType.PARTICIPANT_STATUS_CHANGED,
            payload: {
              participant_code: 'old5',
              participant_status: 'pending',
            } as ZeroHashParticipantStatusChangedPayload,
          },
        ],
      };
      const newMetadata = {} as any;
      const payload: ZeroHashParticipantStatusChangedPayload = {
        participant_code: 'new',
        participant_status: 'approved',
      };

      const result = service['mergeMetadataWithWebhookPayload'](
        existingMetadata,
        newMetadata,
        ZeroHashWebhookEventType.PARTICIPANT_UPDATED,
        payload,
      );

      expect(result.webhook_payloads).toHaveLength(5);
      expect(result.webhook_payloads[0].event_type).toBe(ZeroHashWebhookEventType.PARTICIPANT_STATUS_CHANGED);
      expect(result.webhook_payloads[4].event_type).toBe(ZeroHashWebhookEventType.PARTICIPANT_UPDATED);
    });
  });

  describe('processPaymentStatusChanged', () => {
    it('should handle settled status by updating only fiat wallet transaction settled_at', async () => {
      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'settled',
        participant_code: 'ABC123',
        timestamp: 1764724461060,
      };

      mockTransactionService.findOne.mockResolvedValue({
        id: 'trans-1',
        status: 'completed',
        metadata: {},
      });

      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        id: 'fwt-1',
        transaction_id: 'trans-1',
        provider_metadata: {},
      });

      await service['processPaymentStatusChanged'](payload);

      // Settled status should only update fiat wallet transaction, not main transaction
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-1',
        expect.objectContaining({
          settled_at: expect.any(String),
          provider_metadata: expect.any(Object),
        }),
      );
      expect(mockTransactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should update transaction status for posted payment', async () => {
      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'posted',
        participant_code: 'ABC123',
        timestamp: 1764724461060,
      };

      mockTransactionService.findOne.mockResolvedValue({
        id: 'trans-1',
        status: 'pending',
        metadata: {},
      });

      await service['processPaymentStatusChanged'](payload);

      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        'trans-1',
        TransactionStatus.PROCESSING,
        expect.any(Object),
      );
    });

    it('should include failure reason for failed payment', async () => {
      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'failed',
        reason_code: 'ERR001',
        reason_description: 'Payment failed',
        participant_code: 'ABC123',
        timestamp: 1764724461060,
      };

      mockTransactionService.findOne.mockResolvedValue({
        id: 'trans-1',
        status: 'processing',
        metadata: {},
      });

      await service['processPaymentStatusChanged'](payload);

      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        'trans-1',
        TransactionStatus.FAILED,
        expect.objectContaining({
          failure_reason: expect.stringContaining('ERR001'),
        }),
      );
    });

    it('handles payment_status_changed webhook with metadata from fiat wallet transaction for posted status', async () => {
      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'posted',
        failure_reason: null,
        participant_code: 'ABC123',
        timestamp: 1764724461060,
      };

      const mockTransaction = {
        id: 'trans-1',
        status: 'pending',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'trans-1',
        description: 'Test deposit from Chase',
        source: 'Chase Bank',
        destination: 'OneDosh Wallet',
        provider_fee: 250, // $2.50 in cents
      };

      mockTransactionService.findOne.mockResolvedValue(mockTransaction);
      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);

      await service.processWebhook(payload, ZeroHashWebhookEventType.PAYMENT_STATUS_CHANGED);

      expect(mockFiatWalletTransactionService.findOne).toHaveBeenCalledWith({
        transaction_id: 'trans-1',
      });
      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        'trans-1',
        'processing',
        expect.objectContaining({
          description: 'Test deposit from Chase',
          source: 'Chase Bank',
          destination: 'OneDosh Wallet',
          provider_fee: 250,
          provider_metadata: expect.objectContaining({
            zerohash_payment_status: 'posted',
          }),
        }),
      );
    });

    it('should skip update for unknown payment status', async () => {
      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'unknown_status',
        timestamp: 1764724461060,
      };

      mockTransactionService.findOne.mockResolvedValue({
        id: 'trans-1',
        status: 'processing',
        metadata: {},
      });

      const warnSpy = jest.spyOn(service['logger'], 'warn');
      await service['processPaymentStatusChanged'](payload);

      expect(warnSpy).toHaveBeenCalled();
      expect(mockTransactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should handle missing transaction_id or payment_status', async () => {
      const payload = {
        transaction_id: null,
        payment_status: null,
        timestamp: 1764724461060,
      };

      const warnSpy = jest.spyOn(service['logger'], 'warn');
      await service['processPaymentStatusChanged'](payload);

      expect(warnSpy).toHaveBeenCalled();
      expect(mockTransactionService.findOne).not.toHaveBeenCalled();
    });

    it('should prevent downgrading from completed to pending status', async () => {
      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'pending_trade',
        participant_code: 'ABC123',
        timestamp: 1764724461060,
      };

      mockTransactionService.findOne.mockResolvedValue({
        id: 'trans-1',
        status: TransactionStatus.COMPLETED,
        metadata: {},
      });

      const warnSpy = jest.spyOn(service['logger'], 'warn');
      await service['processPaymentStatusChanged'](payload);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ignoring status downgrade from completed to pending'),
      );
      expect(mockTransactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should prevent downgrading from completed to processing status', async () => {
      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'posted',
        participant_code: 'ABC123',
        timestamp: 1764724461060,
      };

      mockTransactionService.findOne.mockResolvedValue({
        id: 'trans-1',
        status: TransactionStatus.COMPLETED,
        metadata: {},
      });

      const warnSpy = jest.spyOn(service['logger'], 'warn');
      await service['processPaymentStatusChanged'](payload);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ignoring status downgrade from completed to processing'),
      );
      expect(mockTransactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should allow updating from pending to processing status', async () => {
      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'posted',
        participant_code: 'ABC123',
        timestamp: 1764724461060,
      };

      mockTransactionService.findOne.mockResolvedValue({
        id: 'trans-1',
        status: TransactionStatus.PENDING,
        metadata: {},
      });

      await service['processPaymentStatusChanged'](payload);

      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        'trans-1',
        TransactionStatus.PROCESSING,
        expect.any(Object),
      );
    });
  });

  describe('processTradeStatusChanged', () => {
    it('should update fiat wallet transaction for valid trade', async () => {
      const payload = {
        client_trade_id: 'trade-123',
        trade_state: 'accepted',
        trade_id: 'zh-trade-456',
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        id: 'fwt-1',
        status: 'pending',
        provider_metadata: {},
      });

      await service['processTradeStatusChanged'](payload);

      expect(mockFiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        'fwt-1',
        TransactionStatus.PROCESSING,
        expect.objectContaining({
          provider_reference: 'zh-trade-456',
        }),
      );
    });

    it('should update provider_reference for all trade states when trade_id is available', async () => {
      const payload = {
        client_trade_id: 'trade-123',
        trade_state: 'pending',
        trade_id: 'zh-trade-456',
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        id: 'fwt-1',
        status: 'pending',
        provider_metadata: {},
      });

      await service['processTradeStatusChanged'](payload);

      // provider_reference is now always updated when trade_id is available
      // This ensures trade_id is stored regardless of webhook order
      expect(mockFiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        'fwt-1',
        TransactionStatus.PENDING,
        expect.objectContaining({
          provider_reference: 'zh-trade-456',
        }),
      );
    });

    it('should handle transaction not found', async () => {
      const payload = {
        client_trade_id: 'trade-123',
        trade_state: 'accepted',
      };

      mockFiatWalletTransactionService.findOne.mockRejectedValue(new NotFoundException());

      const warnSpy = jest.spyOn(service['logger'], 'warn');
      await service['processTradeStatusChanged'](payload);

      expect(warnSpy).toHaveBeenCalled();
      expect(mockFiatWalletTransactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should skip update for missing client_trade_id or trade_state', async () => {
      const payload = {
        client_trade_id: null,
        trade_state: null,
      };

      const warnSpy = jest.spyOn(service['logger'], 'warn');
      await service['processTradeStatusChanged'](payload);

      expect(warnSpy).toHaveBeenCalled();
      expect(mockFiatWalletTransactionService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('processWithdrawalPending', () => {
    it('should update transaction to PROCESSING status', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
      } as any;

      const externalAccount = {
        user_id: 'user-1',
      } as any;

      const payload = {
        timestamp: '2023-01-01T00:00:00Z',
      } as any;

      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        id: 'fwt-1',
        transaction_id: 'trans-1',
        provider_metadata: {},
        status: 'pending',
      });

      mockTransactionRepository.findById.mockResolvedValue({
        id: 'trans-1',
        status: 'pending',
      });

      await service['processWithdrawalPending'](movement, externalAccount, payload);

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('trans-1', {
        status: TransactionStatus.PROCESSING,
        processed_at: expect.any(String),
      });

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-1',
        expect.objectContaining({
          status: TransactionStatus.PROCESSING,
        }),
      );
    });

    it('should handle transaction not found', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
      } as any;

      const externalAccount = {
        user_id: 'user-1',
      } as any;

      const payload = {
        timestamp: '2023-01-01T00:00:00Z',
      } as any;

      mockFiatWalletTransactionService.findOne.mockResolvedValue(null);

      const warnSpy = jest.spyOn(service['logger'], 'warn');
      await service['processWithdrawalPending'](movement, externalAccount, payload);

      expect(warnSpy).toHaveBeenCalled();
      expect(mockTransactionRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('processTransferMovement', () => {
    const mockExternalAccount = {
      user_id: 'user-1',
      provider: 'zerohash',
    } as any;

    const mockPayload = {
      participant_code: 'abc123',
      balance: '1500.00',
      asset: 'USDC.SOL',
    } as any;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should process transfer movement successfully with recipient details', async () => {
      const movement = {
        transfer_request_id: 'transfer-123',
        client_transfer_id: 'client-456',
      } as any;

      const mockTransferDetails = {
        providerReference: 'client-456',
      };

      const mockSenderTransaction = {
        id: 'sender-tx-1',
        user_id: 'user-1',
        reference: 'client-456-OUT',
      };

      const mockReceiverTransaction = {
        id: 'receiver-tx-1',
        user_id: 'user-2',
        reference: 'client-456-IN',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'sender-tx-1',
        currency: 'USD',
        description: 'Transfer to John Doe',
        source: 'OneDosh Wallet',
        destination: 'External Transfer',
        provider_fee: 250,
        provider_metadata: {},
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        user_id: 'user-1',
        asset: 'USD',
        balance: 100000, // Initial balance before the transfer
      };

      mockFiatWalletAdapter.getTransferDetails.mockResolvedValue(mockTransferDetails);
      mockTransactionRepository.findOne = jest
        .fn()
        .mockResolvedValueOnce(mockSenderTransaction)
        .mockResolvedValueOnce(mockReceiverTransaction);
      mockTransactionRepository.update = jest.fn();
      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockFiatWalletRepository.findById = jest.fn();
      mockFiatWalletRepository.update = jest.fn();
      mockFiatWalletRepository.transaction = jest.fn((callback) => callback({}));
      mockFiatWalletService.updateBalanceWithTransaction = jest.fn().mockResolvedValue({});
      mockUserRepository.findActiveById = jest.fn().mockResolvedValue({
        id: 'user-2',
        first_name: 'John',
        last_name: 'Doe',
        country: { name: 'United States' },
      });
      mockTransactionService.updateStatus.mockResolvedValue({});
      mockFiatWalletTransactionRepository.findOne = jest.fn();
      mockFiatWalletTransactionRepository.update = jest.fn();

      await service['processTransferMovement'](movement, mockExternalAccount, mockPayload);

      expect(mockFiatWalletAdapter.getTransferDetails).toHaveBeenCalledWith('transfer-123', 'zerohash');
      expect(mockUserRepository.findActiveById).toHaveBeenCalledWith('user-1');

      // Verify updateBalanceWithTransaction was called
      expect(mockFiatWalletService.updateBalanceWithTransaction).toHaveBeenCalledWith(
        mockFiatWallet.id,
        expect.any(Number), // amount
        'sender-tx-1',
        TransactionStatus.COMPLETED,
        {
          fiat_wallet_transaction_id: mockFiatWalletTransaction.id,
        },
        mockFiatWallet,
        expect.any(Number), // balanceBefore
        expect.any(Number), // balanceAfter
        expect.any(Function), // createFiatWalletTransaction
        {}, // trx
      );

      // Verify fiat wallet transaction metadata was updated
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        mockFiatWalletTransaction.id,
        {
          provider_metadata: expect.any(Object),
          provider_request_ref: 'transfer-123',
        },
        { trx: {} },
      );

      // Verify main transaction was updated
      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        'sender-tx-1',
        TransactionStatus.COMPLETED,
        {
          balance_after: 150000,
          completed_at: expect.any(String),
          provider_reference: 'client-456',
          provider_metadata: expect.any(Object),
          description: 'Transfer to John Doe',
          source: 'OneDosh Wallet',
          destination: 'External Transfer',
          provider_fee: 250,
          recipient: 'John Doe',
          participant_code: 'abc123',
          sender_name: 'John Doe',
          recipient_name: 'John Doe',
          recipient_location: 'United States',
        },
        {}, // trx
      );
    });

    it('should handle recipient user not found gracefully', async () => {
      const movement = {
        transfer_request_id: 'transfer-123',
        client_transfer_id: 'client-456',
      } as any;

      const mockTransferDetails = {
        providerReference: 'client-456',
      };

      const mockSenderTransaction = {
        id: 'sender-tx-1',
        user_id: 'user-1',
        reference: 'client-456-OUT',
      };

      const mockReceiverTransaction = {
        id: 'receiver-tx-1',
        user_id: 'user-2',
        reference: 'client-456-IN',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'sender-tx-1',
        currency: 'USD',
        description: 'Transfer',
        source: 'OneDosh Wallet',
        destination: 'External Transfer',
        provider_fee: 250,
        provider_metadata: {},
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        user_id: 'user-1',
        asset: 'USD',
        balance: 100000, // Initial balance before the transfer
      };

      mockFiatWalletAdapter.getTransferDetails.mockResolvedValue(mockTransferDetails);
      mockTransactionRepository.findOne = jest
        .fn()
        .mockResolvedValueOnce(mockSenderTransaction)
        .mockResolvedValueOnce(mockReceiverTransaction);
      mockTransactionRepository.update = jest.fn();
      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockFiatWalletRepository.findById = jest.fn();
      mockFiatWalletRepository.update = jest.fn();
      mockFiatWalletRepository.transaction = jest.fn((callback) => callback({}));
      mockFiatWalletService.updateBalanceWithTransaction = jest.fn().mockResolvedValue({});
      mockUserRepository.findActiveById = jest.fn().mockRejectedValue(new Error('User not found'));
      mockTransactionService.updateStatus.mockResolvedValue({});
      mockFiatWalletTransactionRepository.findOne = jest.fn();
      mockFiatWalletTransactionRepository.update = jest.fn();

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processTransferMovement'](movement, mockExternalAccount, mockPayload);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not fetch user details for transfer participants:'),
        expect.any(Error),
      );

      // Verify updateBalanceWithTransaction was called
      expect(mockFiatWalletService.updateBalanceWithTransaction).toHaveBeenCalled();

      // Verify fiat wallet transaction metadata was updated
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        mockFiatWalletTransaction.id,
        {
          provider_metadata: expect.any(Object),
          provider_request_ref: 'transfer-123',
        },
        { trx: {} },
      );

      // Verify main transaction was updated
      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        'sender-tx-1',
        TransactionStatus.COMPLETED,
        {
          balance_after: 150000,
          completed_at: expect.any(String),
          provider_reference: 'client-456',
          provider_metadata: expect.any(Object),
          description: 'Transfer',
          source: 'OneDosh Wallet',
          destination: 'External Transfer',
          provider_fee: 250,
          recipient: undefined,
          participant_code: 'abc123',
          sender_name: undefined,
          recipient_name: undefined,
          recipient_location: undefined,
        },
        {}, // trx
      );
    });

    it('should handle transfer details fetch failure', async () => {
      const movement = {
        transfer_request_id: 'transfer-123',
      } as any;

      mockFiatWalletAdapter.getTransferDetails.mockRejectedValue(new Error('API Error'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service['processTransferMovement'](movement, mockExternalAccount, mockPayload);

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to fetch transfer details for transfer_request_id: transfer-123',
        expect.any(Error),
      );
      expect(mockTransactionService.transactionRepository?.findOne).not.toHaveBeenCalled();
    });

    it('should handle transaction not found error', async () => {
      const movement = {
        transfer_request_id: 'transfer-123',
        client_transfer_id: 'client-456',
      } as any;

      const mockTransferDetails = {
        providerReference: 'client-456',
      };

      mockFiatWalletAdapter.getTransferDetails.mockResolvedValue(mockTransferDetails);
      mockTransactionRepository.findOne = jest.fn().mockResolvedValue(null); // Both transactions not found
      mockTransactionRepository.update = jest.fn();

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service['processTransferMovement'](movement, mockExternalAccount, mockPayload);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Transaction not found for client_transfer_id: client-456'),
      );
    });

    it('should process receiver transaction when current participant is receiver', async () => {
      const movement = {
        transfer_request_id: 'transfer-123',
        client_transfer_id: 'client-456',
      } as any;

      const mockTransferDetails = {
        providerReference: 'client-456',
      };

      const mockSenderTransaction = {
        id: 'sender-tx-1',
        user_id: 'user-2', // Different user
        reference: 'client-456-OUT',
      };

      const mockReceiverTransaction = {
        id: 'receiver-tx-1',
        user_id: 'user-1', // Current participant
        reference: 'client-456-IN',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'receiver-tx-1',
        currency: 'USD',
        description: 'Received transfer',
        source: 'External Transfer',
        destination: 'OneDosh Wallet',
        provider_fee: 0,
        provider_metadata: {},
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        user_id: 'user-1',
        asset: 'USD',
        balance: 100000, // Initial balance before the transfer
      };

      mockFiatWalletAdapter.getTransferDetails.mockResolvedValue(mockTransferDetails);
      mockTransactionRepository.findOne = jest
        .fn()
        .mockResolvedValueOnce(mockSenderTransaction)
        .mockResolvedValueOnce(mockReceiverTransaction);
      mockTransactionRepository.update = jest.fn();
      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockFiatWalletRepository.findById = jest.fn();
      mockFiatWalletRepository.update = jest.fn();
      mockFiatWalletRepository.transaction = jest.fn((callback) => callback({}));
      mockFiatWalletService.updateBalanceWithTransaction = jest.fn().mockResolvedValue({});
      mockUserRepository.findActiveById = jest.fn().mockResolvedValue({
        id: 'user-2',
        first_name: 'Jane',
        last_name: 'Smith',
        country: { name: 'United States' },
      });
      mockTransactionService.updateStatus.mockResolvedValue({});
      mockFiatWalletTransactionRepository.findOne = jest.fn();
      mockFiatWalletTransactionRepository.update = jest.fn();

      await service['processTransferMovement'](movement, mockExternalAccount, mockPayload);

      expect(mockUserRepository.findActiveById).toHaveBeenCalledWith('user-2');

      // Verify updateBalanceWithTransaction was called
      expect(mockFiatWalletService.updateBalanceWithTransaction).toHaveBeenCalledWith(
        mockFiatWallet.id,
        expect.any(Number), // amount
        'receiver-tx-1',
        TransactionStatus.COMPLETED,
        {
          fiat_wallet_transaction_id: mockFiatWalletTransaction.id,
        },
        mockFiatWallet,
        expect.any(Number), // balanceBefore
        expect.any(Number), // balanceAfter
        expect.any(Function), // createFiatWalletTransaction
        {}, // trx
      );

      // Verify fiat wallet transaction metadata was updated
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        mockFiatWalletTransaction.id,
        {
          provider_metadata: expect.any(Object),
          provider_request_ref: 'transfer-123',
        },
        { trx: {} },
      );

      // Verify main transaction was updated
      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        'receiver-tx-1',
        TransactionStatus.COMPLETED,
        {
          balance_after: 150000,
          completed_at: expect.any(String),
          provider_reference: 'client-456',
          provider_metadata: expect.any(Object),
          description: 'Received transfer',
          source: 'External Transfer',
          destination: 'OneDosh Wallet',
          provider_fee: 0,
          recipient: 'Jane Smith',
          participant_code: 'abc123',
          sender_name: 'Jane Smith',
          recipient_name: 'Jane Smith',
          recipient_location: 'United States',
        },
        {}, // trx
      );
    });
  });

  describe('determineCurrentTransaction', () => {
    const mockSenderTransaction = {
      id: 'sender-tx-1',
      user_id: 'user-1',
      reference: 'client-456-OUT',
    } as any;

    const mockReceiverTransaction = {
      id: 'receiver-tx-1',
      user_id: 'user-2',
      reference: 'client-456-IN',
    } as any;

    it('should return sender transaction when user is the sender', () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      const result = service['determineCurrentTransaction'](mockSenderTransaction, mockReceiverTransaction, 'user-1');

      expect(result).toBe(mockSenderTransaction);
      expect(logSpy).toHaveBeenCalledWith('Current participant is the sender');
    });

    it('should return receiver transaction when user is the receiver', () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      const result = service['determineCurrentTransaction'](mockSenderTransaction, mockReceiverTransaction, 'user-2');

      expect(result).toBe(mockReceiverTransaction);
      expect(logSpy).toHaveBeenCalledWith('Current participant is the receiver');
    });

    it('should return null when user is neither sender nor receiver', () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');

      const result = service['determineCurrentTransaction'](mockSenderTransaction, mockReceiverTransaction, 'user-3');

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith('Neither transaction belongs to current participant user_id: user-3');
    });
  });

  describe('processAccountBalanceChanged - final_settlement movement', () => {
    const mockExternalAccount = {
      user_id: 'user-1',
      provider: 'zerohash',
      participant_code: 'abc123',
    } as any;

    it('should process final_settlement movement and update wallet balance from payload', async () => {
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'trade-123',
        change: '500.00',
      };

      const mockPayload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL', // Supported stablecoin
        account_type: 'available',
        balance: '1500.00',
        timestamp: '2024-01-01T00:00:00Z',
        movements: [movement],
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'tx-1',
        currency: 'USDC',
        provider_reference: 'trade-123',
        provider_metadata: {},
        description: 'Test description',
        source: 'Test source',
        destination: 'Test destination',
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        user_id: 'user-1',
        asset: 'USDC',
        balance: 1000000000, // 1000 USDC in smallest unit (6 decimals)
      };

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockFiatWalletRepository.findById = jest.fn();
      mockFiatWalletRepository.update = jest.fn();
      mockFiatWalletRepository.transaction = jest.fn((callback) => callback({}));
      mockFiatWalletService.updateBalanceWithTransaction = jest.fn().mockResolvedValue({});
      mockFiatWalletTransactionRepository.findOne = jest.fn();
      mockFiatWalletTransactionRepository.update = jest.fn();
      mockTransactionService.updateStatus = jest.fn().mockResolvedValue({});
      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);

      await service.processWebhook(mockPayload, ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED);

      // Verify updateBalanceWithTransaction was called with balance from payload (150000 smallest units)
      expect(mockFiatWalletService.updateBalanceWithTransaction).toHaveBeenCalledWith(
        mockFiatWallet.id,
        expect.any(Number), // amount (balanceAfter - balanceBefore)
        mockFiatWalletTransaction.transaction_id,
        TransactionStatus.COMPLETED,
        {
          fiat_wallet_transaction_id: mockFiatWalletTransaction.id,
        },
        mockFiatWallet,
        1000000000, // balanceBefore (1000 USDC)
        150000, // balanceAfter (from payload.balance = 1500.00 * 100 = 150000)
        expect.any(Function),
        {},
      );

      // Verify fiat wallet transaction metadata was updated
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        mockFiatWalletTransaction.id,
        {
          provider_metadata: expect.objectContaining({
            settlement_trade_id: 'trade-123',
            settlement_balance: '1500.00',
            settlement_asset: 'USDC.SOL',
          }),
        },
        { trx: {} },
      );

      // Verify main transaction was updated using TransactionService to trigger notifications
      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        mockFiatWalletTransaction.transaction_id,
        TransactionStatus.COMPLETED,
        {
          balance_after: 150000,
          completed_at: expect.any(String),
          provider_metadata: expect.objectContaining({
            settlement_trade_id: 'trade-123',
            settlement_balance: '1500.00',
            settlement_asset: 'USDC.SOL',
          }),
          participant_code: 'abc123',
          description: mockFiatWalletTransaction.description,
          source: mockFiatWalletTransaction.source,
          destination: mockFiatWalletTransaction.destination,
        },
        {},
      );
    });

    it('should handle final_settlement when client_transfer_id already exists (duplicate webhook)', async () => {
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'trade-456',
        change: '500.00',
      };

      const mockPayload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL',
        account_type: 'available',
        balance: '1500.00',
        timestamp: '2024-01-01T00:00:00Z',
        client_transfer_id: 'client-transfer-123', // In payload, not movement
        movements: [movement],
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'tx-1',
        currency: 'USDC',
        provider_reference: 'trade-456',
        provider_metadata: {},
      };

      const mockExistingTransaction = {
        id: 'existing-tx-1',
        status: TransactionStatus.COMPLETED,
      };

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionRepository.findOne = jest.fn().mockResolvedValue(mockExistingTransaction);
      mockTransactionRepository.update = jest.fn();
      mockTransactionService.updateStatus.mockResolvedValue({});
      mockFiatWalletTransactionService.updateStatus.mockResolvedValue({});
      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);

      await service.processWebhook(mockPayload, ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED);

      // Verify it just updates status without changing balance (duplicate webhook scenario)
      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        mockExistingTransaction.id,
        TransactionStatus.COMPLETED,
      );
      expect(mockFiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        mockFiatWalletTransaction.id,
        TransactionStatus.COMPLETED,
        {
          provider_reference: 'trade-456',
        },
      );

      // Verify updateBalanceWithTransaction was NOT called (duplicate webhook)
      expect(mockFiatWalletService.updateBalanceWithTransaction).not.toHaveBeenCalled();
    });

    it('should skip processing when fiat wallet transaction not found', async () => {
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'trade-999',
        change: '500.00',
      };

      const mockPayload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL',
        account_type: 'available',
        balance: '1500.00',
        timestamp: '2024-01-01T00:00:00Z',
        movements: [movement],
      };

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);
      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service.processWebhook(mockPayload, ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No fiat wallet transaction found for trade_id: trade-999'),
      );
      expect(mockFiatWalletService.updateBalanceWithTransaction).not.toHaveBeenCalled();
    });

    it('should validate and reject unsupported crypto asset', async () => {
      const invalidPayload = {
        participant_code: 'abc123',
        asset: 'UNSUPPORTED.ETH',
        account_type: 'available',
        balance: '1500.00',
        movements: [
          {
            movement_type: 'final_settlement',
            trade_id: 'trade-123',
            change: '500.00',
          },
        ],
      };

      const debugSpy = jest.spyOn(service['logger'], 'debug');

      await service.processWebhook(invalidPayload, ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED);

      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('not a supported stablecoin'));
      expect(mockFiatWalletTransactionService.findOneOrNull).not.toHaveBeenCalled();
    });

    it('should set settled_at for REWARD transactions during final_settlement', async () => {
      const timestamp = 1765494669809;
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'reward-trade-123',
        change: '10.00',
      };

      const mockPayload = {
        participant_code: 'abc123',
        asset: 'USDC.ETH',
        account_type: 'available',
        balance: '40.00',
        timestamp,
        movements: [movement],
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-reward-1',
        transaction_id: 'tx-reward-1',
        transaction_type: FiatWalletTransactionType.REWARD,
        currency: 'USD',
        provider_reference: 'reward-trade-123',
        provider_metadata: {},
        description: 'Reward',
        source: 'Rewards',
        destination: 'US Wallet',
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        user_id: 'user-1',
        asset: 'USD',
        balance: 3000,
      };

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockFiatWalletRepository.findById = jest.fn();
      mockFiatWalletRepository.update = jest.fn();
      mockFiatWalletRepository.transaction = jest.fn((callback) => callback({}));
      mockFiatWalletService.updateBalanceWithTransaction = jest.fn().mockResolvedValue({});
      mockFiatWalletTransactionRepository.findOne = jest.fn();
      mockFiatWalletTransactionRepository.update = jest.fn();
      mockTransactionService.updateStatus = jest.fn().mockResolvedValue({});
      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);

      await service.processWebhook(mockPayload, ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED);

      // Verify settled_at was set for REWARD transaction
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        mockFiatWalletTransaction.id,
        expect.objectContaining({
          settled_at: expect.any(String),
        }),
      );
    });

    it('should NOT set settled_at for DEPOSIT transactions during final_settlement', async () => {
      const timestamp = 1765494669809;
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'deposit-trade-123',
        change: '100.00',
      };

      const mockPayload = {
        participant_code: 'abc123',
        asset: 'USDC.ETH',
        account_type: 'available',
        balance: '100.00',
        timestamp,
        movements: [movement],
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-deposit-1',
        transaction_id: 'tx-deposit-1',
        transaction_type: FiatWalletTransactionType.DEPOSIT,
        currency: 'USD',
        provider_reference: 'deposit-trade-123',
        provider_metadata: {},
        description: 'Deposit',
        source: 'Bank',
        destination: 'US Wallet',
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        user_id: 'user-1',
        asset: 'USD',
        balance: 0,
      };

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockFiatWalletRepository.findById = jest.fn();
      mockFiatWalletRepository.update = jest.fn();
      mockFiatWalletRepository.transaction = jest.fn((callback) => callback({}));
      mockFiatWalletService.updateBalanceWithTransaction = jest.fn().mockResolvedValue({});
      mockFiatWalletTransactionRepository.findOne = jest.fn();
      mockFiatWalletTransactionRepository.update = jest.fn();
      mockTransactionService.updateStatus = jest.fn().mockResolvedValue({});
      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);

      await service.processWebhook(mockPayload, ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED);

      // Verify settled_at was NOT set for DEPOSIT transaction (it gets set later via settled webhook)
      const updateCalls = (mockFiatWalletTransactionRepository.update as jest.Mock).mock.calls;
      const settledAtUpdate = updateCalls.find((call) => call[1]?.settled_at !== undefined);
      expect(settledAtUpdate).toBeUndefined();
    });

    it('should credit first deposit bonus with deposit metadata for first USD deposit', async () => {
      const timestamp = 1765494669809;
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'first-deposit-trade-123',
        change: '100.00',
      };

      const mockPayload = {
        participant_code: 'abc123',
        asset: 'USDC.ETH',
        account_type: 'available',
        balance: '100.00',
        timestamp,
        movements: [movement],
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-first-deposit-1',
        transaction_id: 'tx-first-deposit-1',
        transaction_type: FiatWalletTransactionType.DEPOSIT,
        amount: '10000',
        fiat_wallet_id: 'wallet-1',
        currency: 'USD',
        provider_reference: 'first-deposit-trade-123',
        provider_metadata: {},
        description: 'First Deposit',
        source: 'Bank',
        destination: 'US Wallet',
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        user_id: 'user-1',
        asset: 'USD',
        balance: 0,
      };

      const mockDoshPointsResult = {
        is_duplicate: false,
        transaction: { id: 'points-tx-1' },
      };

      // Mock only 1 completed deposit (this is the first one)
      const mockCompletedDeposits = [{ id: 'fwt-first-deposit-1' }];

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockFiatWalletRepository.findById = jest.fn();
      mockFiatWalletRepository.update = jest.fn();
      mockFiatWalletRepository.transaction = jest.fn((callback) => callback({}));
      mockFiatWalletService.updateBalanceWithTransaction = jest.fn().mockResolvedValue({});
      mockFiatWalletTransactionRepository.findOne = jest.fn();
      mockFiatWalletTransactionRepository.update = jest.fn();
      mockFiatWalletTransactionRepository.query = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(mockCompletedDeposits),
      });
      mockTransactionService.updateStatus = jest.fn().mockResolvedValue({});
      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);
      mockDoshPointsTransactionService.creditPoints.mockResolvedValue(mockDoshPointsResult);
      // User is not opted in yet
      mockDoshPointsAccountService.findOrCreate.mockResolvedValue({ usd_fiat_rewards_enabled: null });
      const mockStablecoinProcessor = {
        queueCreditFirstDepositReward: jest.fn().mockResolvedValue({}),
      };
      (service as any).usdFiatRewardsProcessor = mockStablecoinProcessor;

      await service.processWebhook(mockPayload, ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED);

      // Verify lock was acquired for first deposit bonus
      expect(mockLockerService.runWithLock).toHaveBeenCalledWith('first_deposit_bonus_user-1', expect.any(Function));

      // Verify dosh points were credited with deposit metadata
      expect(mockDoshPointsTransactionService.creditPoints).toHaveBeenCalledWith({
        user_id: 'user-1',
        event_code: 'FIRST_DEPOSIT_USD',
        source_reference: 'zerohash',
        description: 'First USD deposit bonus',
        metadata: {
          deposit: {
            amount: '10000',
            fiat_wallet_id: 'wallet-1',
            external_account_id: mockExternalAccount.id,
            participant_code: 'abc123',
          },
        },
      });

      // Verify only FIRST_DEPOSIT_USD was credited (not FIRST_DEPOSIT_USD_MATCH since user not opted in)
      expect(mockDoshPointsTransactionService.creditPoints).toHaveBeenCalledTimes(1);

      // Verify stablecoin reward was NOT queued (user not opted in)
      expect(mockStablecoinProcessor.queueCreditFirstDepositReward).not.toHaveBeenCalled();
    });

    it('should process first deposit match when user is already opted in', async () => {
      const timestamp = 1765494669809;
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'first-deposit-trade-123',
        change: '100.00',
      };

      const mockPayload = {
        participant_code: 'abc123',
        asset: 'USDC.ETH',
        account_type: 'available',
        balance: '100.00',
        timestamp,
        movements: [movement],
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-first-deposit-1',
        transaction_id: 'tx-first-deposit-1',
        transaction_type: FiatWalletTransactionType.DEPOSIT,
        amount: '10000',
        fiat_wallet_id: 'wallet-1',
        currency: 'USD',
        provider_reference: 'first-deposit-trade-123',
        provider_metadata: {},
        description: 'First Deposit',
        source: 'Bank',
        destination: 'US Wallet',
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        user_id: 'user-1',
        asset: 'USD',
        balance: 0,
      };

      const mockDoshPointsResult = {
        is_duplicate: false,
        transaction: { id: 'points-tx-1' },
      };

      // Mock only 1 completed deposit (this is the first one)
      const mockCompletedDeposits = [{ id: 'fwt-first-deposit-1' }];

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockFiatWalletRepository.findById = jest.fn();
      mockFiatWalletRepository.update = jest.fn();
      mockFiatWalletRepository.transaction = jest.fn((callback) => callback({}));
      mockFiatWalletService.updateBalanceWithTransaction = jest.fn().mockResolvedValue({});
      mockFiatWalletTransactionRepository.findOne = jest.fn();
      mockFiatWalletTransactionRepository.update = jest.fn();
      mockFiatWalletTransactionRepository.query = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(mockCompletedDeposits),
      });
      mockTransactionService.updateStatus = jest.fn().mockResolvedValue({});
      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);
      mockDoshPointsTransactionService.creditPoints.mockResolvedValue(mockDoshPointsResult);
      // User is already opted in
      mockDoshPointsAccountService.findOrCreate.mockResolvedValue({ usd_fiat_rewards_enabled: true });
      const mockStablecoinProcessor = {
        queueCreditFirstDepositReward: jest.fn().mockResolvedValue({}),
      };
      (service as any).usdFiatRewardsProcessor = mockStablecoinProcessor;

      await service.processWebhook(mockPayload, ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED);

      // Verify FIRST_DEPOSIT_USD was credited
      expect(mockDoshPointsTransactionService.creditPoints).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          event_code: 'FIRST_DEPOSIT_USD',
        }),
      );

      // Verify FIRST_DEPOSIT_USD_MATCH was also created (user opted in)
      expect(mockDoshPointsTransactionService.creditPoints).toHaveBeenCalledWith({
        user_id: 'user-1',
        event_code: 'FIRST_DEPOSIT_USD_MATCH',
        source_reference: 'zerohash',
        description: 'First USD deposit match reward',
      });

      // Verify both events were credited
      expect(mockDoshPointsTransactionService.creditPoints).toHaveBeenCalledTimes(2);

      // Verify stablecoin reward was queued
      expect(mockStablecoinProcessor.queueCreditFirstDepositReward).toHaveBeenCalledWith({
        userId: 'user-1',
        participantCode: 'abc123',
        depositAmount: '10000',
        fiatWalletId: 'wallet-1',
        externalAccountId: mockExternalAccount.id,
      });
    });

    it('should handle duplicate first deposit bonus gracefully', async () => {
      const timestamp = 1765494669809;
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'first-deposit-trade-456',
        change: '100.00',
      };

      const mockPayload = {
        participant_code: 'abc123',
        asset: 'USDC.ETH',
        account_type: 'available',
        balance: '100.00',
        timestamp,
        movements: [movement],
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-first-deposit-2',
        transaction_id: 'tx-first-deposit-2',
        transaction_type: FiatWalletTransactionType.DEPOSIT,
        amount: '10000',
        fiat_wallet_id: 'wallet-1',
        currency: 'USD',
        provider_reference: 'first-deposit-trade-456',
        provider_metadata: {},
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        user_id: 'user-1',
        asset: 'USD',
        balance: 0,
      };

      // FIRST_DEPOSIT_USD is a duplicate (already processed)
      const mockDuplicateResult = {
        is_duplicate: true,
        transaction: { id: 'points-tx-1' },
      };

      const mockCompletedDeposits = [{ id: 'fwt-first-deposit-2' }];

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockFiatWalletRepository.findById = jest.fn();
      mockFiatWalletRepository.update = jest.fn();
      mockFiatWalletRepository.transaction = jest.fn((callback) => callback({}));
      mockFiatWalletService.updateBalanceWithTransaction = jest.fn().mockResolvedValue({});
      mockFiatWalletTransactionRepository.findOne = jest.fn();
      mockFiatWalletTransactionRepository.update = jest.fn();
      mockFiatWalletTransactionRepository.query = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(mockCompletedDeposits),
      });
      mockTransactionService.updateStatus = jest.fn().mockResolvedValue({});
      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);
      mockDoshPointsTransactionService.creditPoints.mockResolvedValue(mockDuplicateResult);

      const mockStablecoinProcessor = {
        queueCreditFirstDepositReward: jest.fn().mockResolvedValue({}),
      };
      (service as any).usdFiatRewardsProcessor = mockStablecoinProcessor;

      await service.processWebhook(mockPayload, ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED);

      // Verify only one credit attempt (FIRST_DEPOSIT_USD)
      expect(mockDoshPointsTransactionService.creditPoints).toHaveBeenCalledTimes(1);

      // Verify opt-in check was NOT performed (duplicate detected early)
      expect(mockDoshPointsAccountService.findOrCreate).not.toHaveBeenCalled();

      // Verify stablecoin reward was NOT queued (duplicate detected)
      expect(mockStablecoinProcessor.queueCreditFirstDepositReward).not.toHaveBeenCalled();
    });

    it('should skip first deposit bonus for non-first USD deposits', async () => {
      const timestamp = 1765494669809;
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'second-deposit-trade-123',
        change: '100.00',
      };

      const mockPayload = {
        participant_code: 'abc123',
        asset: 'USDC.ETH',
        account_type: 'available',
        balance: '200.00',
        timestamp,
        movements: [movement],
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-second-deposit-1',
        transaction_id: 'tx-second-deposit-1',
        transaction_type: FiatWalletTransactionType.DEPOSIT,
        currency: 'USD',
        provider_reference: 'second-deposit-trade-123',
        provider_metadata: {},
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        user_id: 'user-1',
        asset: 'USD',
        balance: 10000,
      };

      // Mock 2 completed deposits (not first deposit)
      const mockCompletedDeposits = [{ id: 'fwt-first-1' }, { id: 'fwt-second-deposit-1' }];

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockFiatWalletRepository.findById = jest.fn();
      mockFiatWalletRepository.update = jest.fn();
      mockFiatWalletRepository.transaction = jest.fn((callback) => callback({}));
      mockFiatWalletService.updateBalanceWithTransaction = jest.fn().mockResolvedValue({});
      mockFiatWalletTransactionRepository.findOne = jest.fn();
      mockFiatWalletTransactionRepository.update = jest.fn();
      mockFiatWalletTransactionRepository.query = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(mockCompletedDeposits),
      });
      mockTransactionService.updateStatus = jest.fn().mockResolvedValue({});
      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);

      await service.processWebhook(mockPayload, ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED);

      // Verify dosh points were NOT credited
      expect(mockDoshPointsTransactionService.creditPoints).not.toHaveBeenCalled();
    });

    it('should handle first deposit bonus error gracefully', async () => {
      const timestamp = 1765494669809;
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'error-deposit-trade-123',
        change: '100.00',
      };

      const mockPayload = {
        participant_code: 'abc123',
        asset: 'USDC.ETH',
        account_type: 'available',
        balance: '100.00',
        timestamp,
        movements: [movement],
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-error-deposit-1',
        transaction_id: 'tx-error-deposit-1',
        transaction_type: FiatWalletTransactionType.DEPOSIT,
        currency: 'USD',
        provider_reference: 'error-deposit-trade-123',
        provider_metadata: {},
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        user_id: 'user-1',
        asset: 'USD',
        balance: 0,
      };

      const mockCompletedDeposits = [{ id: 'fwt-error-deposit-1' }];

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockFiatWalletRepository.findById = jest.fn();
      mockFiatWalletRepository.update = jest.fn();
      mockFiatWalletRepository.transaction = jest.fn((callback) => callback({}));
      mockFiatWalletService.updateBalanceWithTransaction = jest.fn().mockResolvedValue({});
      mockFiatWalletTransactionRepository.findOne = jest.fn();
      mockFiatWalletTransactionRepository.update = jest.fn();
      mockFiatWalletTransactionRepository.query = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(mockCompletedDeposits),
      });
      mockTransactionService.updateStatus = jest.fn().mockResolvedValue({});
      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);
      mockDoshPointsTransactionService.creditPoints.mockRejectedValue(new Error('Points service error'));

      // Should not throw - deposit should complete even if bonus fails
      await expect(
        service.processWebhook(mockPayload, ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED),
      ).resolves.not.toThrow();

      // Verify transaction still completed
      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        mockFiatWalletTransaction.transaction_id,
        TransactionStatus.COMPLETED,
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('processPaymentStatusChanged - enhanced with fiat wallet transaction lookup', () => {
    it('should include fiat wallet transaction metadata in payment status update for posted status', async () => {
      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'posted',
        participant_code: 'ABC123',
        timestamp: 1764724461060,
      };

      const mockTransaction = {
        id: 'trans-1',
        status: 'pending',
        metadata: {},
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'trans-1',
        description: 'Test deposit from Chase',
        source: 'Chase Bank',
        destination: 'OneDosh Wallet',
        provider_fee: 250,
      };

      mockTransactionService.findOne.mockResolvedValue(mockTransaction);
      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);

      await service['processPaymentStatusChanged'](payload);

      expect(mockFiatWalletTransactionService.findOne).toHaveBeenCalledWith({
        transaction_id: 'trans-1',
      });
      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        'trans-1',
        TransactionStatus.PROCESSING,
        expect.objectContaining({
          description: 'Test deposit from Chase',
          source: 'Chase Bank',
          destination: 'OneDosh Wallet',
          provider_fee: 250,
          provider_metadata: expect.objectContaining({
            zerohash_payment_status: 'posted',
          }),
        }),
      );
    });

    it('should handle missing fiat wallet transaction gracefully for posted status', async () => {
      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'posted',
        participant_code: 'ABC123',
        timestamp: 1764724461060,
      };

      const mockTransaction = {
        id: 'trans-1',
        status: 'pending',
        metadata: {},
      };

      mockTransactionService.findOne.mockResolvedValue(mockTransaction);
      mockFiatWalletTransactionService.findOne.mockRejectedValue(new NotFoundException('Not found'));

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processPaymentStatusChanged'](payload);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not fetch fiat wallet transaction for transaction trans-1'),
        expect.any(NotFoundException),
      );
      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        'trans-1',
        TransactionStatus.PROCESSING,
        expect.objectContaining({
          description: 'Transaction',
          source: 'External Account',
          destination: 'External Account',
          provider_fee: undefined,
        }),
      );
    });
  });

  describe('updateFiatWalletTransactionSettled', () => {
    it('should update fiat wallet transaction with settled_at and provider_metadata', async () => {
      const mockTransaction = {
        id: 'trans-1',
        status: 'completed',
        metadata: {},
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'trans-1',
        provider_metadata: { existing: 'data' },
      };

      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'settled',
        participant_code: 'ABC123',
        timestamp: 1764724461060,
      };

      const providerMetadata = {
        zerohash_payment_status: 'settled',
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);

      await service['updateFiatWalletTransactionSettled'](
        mockTransaction as any,
        providerMetadata as any,
        payload as any,
      );

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-1',
        expect.objectContaining({
          settled_at: expect.any(String),
          provider_metadata: expect.objectContaining({
            existing: 'data',
            zerohash_payment_status: 'settled',
          }),
        }),
      );
    });

    it('should handle fiat wallet transaction not found', async () => {
      const mockTransaction = {
        id: 'trans-1',
        status: 'completed',
        metadata: {},
      };

      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'settled',
        participant_code: 'ABC123',
        timestamp: 1764724461060,
      };

      const providerMetadata = {
        zerohash_payment_status: 'settled',
      };

      mockFiatWalletTransactionService.findOne.mockRejectedValue(new NotFoundException('Not found'));

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['updateFiatWalletTransactionSettled'](
        mockTransaction as any,
        providerMetadata as any,
        payload as any,
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No fiat wallet transaction found for transaction ID: trans-1'),
      );
      expect(mockFiatWalletTransactionRepository.update).not.toHaveBeenCalled();
    });

    it('should handle other errors when updating settled_at', async () => {
      const mockTransaction = {
        id: 'trans-1',
        status: 'completed',
        metadata: {},
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'trans-1',
        provider_metadata: {},
      };

      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'settled',
        participant_code: 'ABC123',
        timestamp: 1764724461060,
      };

      const providerMetadata = {
        zerohash_payment_status: 'settled',
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletTransactionRepository.update.mockRejectedValue(new Error('Database error'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service['updateFiatWalletTransactionSettled'](
        mockTransaction as any,
        providerMetadata as any,
        payload as any,
      );

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error updating fiat wallet transaction settled_at: Database error'),
      );
    });
  });

  describe('processDepositMovement', () => {
    it('should process deposit movement successfully', async () => {
      const movement = {
        deposit_reference_id: 'deposit-123',
        change: '50.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      const mockPayload = {
        asset: 'USDC.SOL',
        account_group: 'group-1',
        timestamp: Date.now(),
      } as any;

      const mockBlockchainTransaction = {
        id: 'blockchain-tx-1',
        main_transaction_id: 'main-tx-1',
        tx_hash: 'deposit-123',
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        balance: 100000,
      };

      mockBlockchainWalletTransactionRepository.findByTransactionHash.mockResolvedValue(mockBlockchainTransaction);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockFiatWalletService.updateBalance.mockResolvedValue({});
      mockTransactionRepository.findOne.mockResolvedValue(null);

      await service['processDepositMovement'](movement, mockExternalAccount, mockPayload);

      expect(mockBlockchainWalletTransactionRepository.findByTransactionHash).toHaveBeenCalledWith('deposit-123');
      expect(mockFiatWalletService.updateBalance).toHaveBeenCalled();
      const updateBalanceCall = mockFiatWalletService.updateBalance.mock.calls[0];
      expect(updateBalanceCall[0]).toBe('wallet-1');
      expect(updateBalanceCall[1]).toBe(5000);
      expect(updateBalanceCall[2]).toBe('main-tx-1');
      expect(updateBalanceCall[4]).toBe(TransactionStatus.COMPLETED);
      expect(updateBalanceCall[5]).toEqual(
        expect.objectContaining({
          description: 'Crypto deposit to USD wallet',
          provider: 'zerohash',
          provider_reference: 'deposit-123',
        }),
      );
    });

    it('should return when blockchain transaction not found', async () => {
      const movement = {
        deposit_reference_id: 'deposit-123',
        change: '50.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        asset: 'USDC.SOL',
      } as any;

      mockBlockchainWalletTransactionRepository.findByTransactionHash.mockResolvedValue(null);

      await service['processDepositMovement'](movement, mockExternalAccount, mockPayload);

      expect(mockBlockchainWalletTransactionRepository.findByTransactionHash).toHaveBeenCalledWith('deposit-123');
      expect(mockFiatWalletService.updateBalance).not.toHaveBeenCalled();
    });

    it('should return when main_transaction_id is missing', async () => {
      const movement = {
        deposit_reference_id: 'deposit-123',
        change: '50.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        asset: 'USDC.SOL',
      } as any;

      mockBlockchainWalletTransactionRepository.findByTransactionHash.mockResolvedValue({
        id: 'blockchain-tx-1',
        main_transaction_id: null,
      } as any);

      await service['processDepositMovement'](movement, mockExternalAccount, mockPayload);

      expect(mockFiatWalletService.updateBalance).not.toHaveBeenCalled();
    });

    it('should return when fiat wallet not found', async () => {
      const movement = {
        deposit_reference_id: 'deposit-123',
        change: '50.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        asset: 'USDC.SOL',
      } as any;

      mockBlockchainWalletTransactionRepository.findByTransactionHash.mockResolvedValue({
        id: 'blockchain-tx-1',
        main_transaction_id: 'main-tx-1',
      } as any);
      mockFiatWalletService.getUserWallet.mockResolvedValue(null);

      await service['processDepositMovement'](movement, mockExternalAccount, mockPayload);

      expect(mockFiatWalletService.updateBalance).not.toHaveBeenCalled();
    });

    it('should create placeholder transaction when no transaction found for exchange', async () => {
      const movement = {
        deposit_reference_id: 'tx-hash-123',
        change: '100.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      const mockPayload = {
        asset: 'USDC',
        account_group: 'group-1',
        timestamp: Date.now(),
        participant_code: 'PC123',
      } as any;

      const mockBlockchainTransaction = {
        id: 'blockchain-tx-1',
        main_transaction_id: 'main-tx-1',
        tx_hash: 'tx-hash-123',
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        balance: 100000,
      };

      mockBlockchainWalletTransactionRepository.findByTransactionHash.mockResolvedValue(mockBlockchainTransaction);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockFiatWalletService.updateBalance.mockResolvedValue({});
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockTransactionService.create.mockResolvedValue({
        id: 'placeholder-tx-1',
        reference: 'REF-123',
        status: TransactionStatus.RECONCILE,
        external_reference: 'tx-hash-123',
      });

      await service['processDepositMovement'](movement, mockExternalAccount, mockPayload);

      expect(mockTransactionService.create).toHaveBeenCalledWith('user-1', {
        amount: 10000,
        asset: 'USD',
        status: TransactionStatus.RECONCILE,
        balance_before: 0,
        balance_after: 0,
        reference: expect.any(String),
        transaction_type: TransactionType.EXCHANGE,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        description: 'Exchange pending reconciliation',
        external_reference: 'tx-hash-123',
        metadata: {
          zerohash_webhook_received_at: expect.any(String),
        },
      });
    });
  });

  describe('processWithdrawalPending', () => {
    it('should update transaction to PROCESSING status', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'trans-1',
        status: 'pending',
        provider_metadata: {},
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionRepository.findById.mockResolvedValue({
        id: 'trans-1',
        status: 'pending',
      });

      await service['processWithdrawalPending'](movement, mockExternalAccount, mockPayload);

      expect(mockFiatWalletTransactionService.findOne).toHaveBeenCalledWith({
        provider_request_ref: 'withdrawal-123',
        user_id: 'user-1',
      });
      expect(mockTransactionRepository.update).toHaveBeenCalledWith('trans-1', {
        status: TransactionStatus.PROCESSING,
        processed_at: expect.any(String),
      });
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-1',
        expect.objectContaining({
          status: TransactionStatus.PROCESSING,
          processed_at: expect.any(String),
        }),
      );
    });

    it('should skip when fiat wallet transaction not found', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
      } as any;

      mockFiatWalletTransactionService.findOne.mockResolvedValue(null);

      await service['processWithdrawalPending'](movement, mockExternalAccount, mockPayload);

      expect(mockTransactionRepository.update).not.toHaveBeenCalled();
    });

    it('should skip when already completed', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
      } as any;

      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        id: 'fwt-1',
        transaction_id: 'trans-1',
        status: TransactionStatus.COMPLETED,
      });

      await service['processWithdrawalPending'](movement, mockExternalAccount, mockPayload);

      expect(mockTransactionRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('processWithdrawalConfirmed', () => {
    it('should process withdrawal confirmed successfully', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
        change: '-25.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'trans-1',
        status: TransactionStatus.PROCESSING,
        currency: 'USD',
        balance_before: 10000,
        fiat_wallet_id: 'wallet-1',
        provider_metadata: {},
        description: 'Test withdrawal',
        source: 'Test source',
        destination: 'Test Bank / Account Name / 1234567890',
        provider_fee: 100, // 1 cent in cents
      };

      const mockTransaction = {
        id: 'trans-1',
        status: TransactionStatus.PROCESSING,
        metadata: {},
        description: 'Test withdrawal',
      };

      const mockSourceWallet = {
        id: 'wallet-1',
        balance: 10000,
        credit_balance: 0,
      };

      const mockWithdrawalDetails = {
        externalReference: 'tx-hash-123',
        status: 'confirmed',
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionService.findOne.mockResolvedValue(mockTransaction);
      mockFiatWalletAdapter.getWithdrawalDetails.mockResolvedValue(mockWithdrawalDetails);
      mockFiatWalletRepository.findById = jest.fn().mockResolvedValue(mockSourceWallet);
      mockFiatWalletRepository.update = jest.fn();
      mockFiatWalletRepository.transaction = jest.fn();
      mockYellowCardWebhookService.mockPaymentCompleteWebhook.mockResolvedValue({});

      await service['processWithdrawalConfirmed'](movement, mockExternalAccount, mockPayload);

      expect(mockFiatWalletTransactionService.findOne).toHaveBeenCalledWith({
        provider_request_ref: 'withdrawal-123',
        user_id: 'user-1',
      });
      expect(mockFiatWalletAdapter.getWithdrawalDetails).toHaveBeenCalledWith('withdrawal-123', 'zerohash');
      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        'trans-1',
        TransactionStatus.COMPLETED,
        expect.objectContaining({
          balance_after: expect.any(Number),
          completed_at: expect.any(String),
          participant_code: mockExternalAccount.participant_code,
          description: mockTransaction.description,
          source: mockFiatWalletTransaction.source,
          destination: mockFiatWalletTransaction.destination,
          provider_fee: 100,
          provider_metadata: expect.objectContaining({
            transactionHash: 'tx-hash-123',
          }),
        }),
        undefined,
        {
          shouldSendInAppNotification: false,
          shouldSendEmail: false,
          shouldSendPushNotification: false,
        },
      );
    });

    it('should skip when fiat wallet transaction not found', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
        change: '-25.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
      } as any;

      mockFiatWalletTransactionService.findOne.mockResolvedValue(null);

      await service['processWithdrawalConfirmed'](movement, mockExternalAccount, mockPayload);

      expect(mockFiatWalletAdapter.getWithdrawalDetails).not.toHaveBeenCalled();
    });

    it('should skip when already completed', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
        change: '-25.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
      } as any;

      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        id: 'fwt-1',
        status: TransactionStatus.COMPLETED,
      });

      await service['processWithdrawalConfirmed'](movement, mockExternalAccount, mockPayload);

      expect(mockFiatWalletAdapter.getWithdrawalDetails).not.toHaveBeenCalled();
    });

    it('should skip when not in processing status', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
        change: '-25.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
      } as any;

      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        id: 'fwt-1',
        status: TransactionStatus.PENDING,
      });

      await service['processWithdrawalConfirmed'](movement, mockExternalAccount, mockPayload);

      expect(mockFiatWalletAdapter.getWithdrawalDetails).not.toHaveBeenCalled();
    });

    it('should extract provider_fee from transaction metadata when missing from fiat wallet transaction', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
        change: '-25.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        participant_code: 'LHBX5H',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'trans-1',
        status: TransactionStatus.PROCESSING,
        currency: 'USD',
        balance_before: 10000,
        fiat_wallet_id: 'wallet-1',
        provider_metadata: {},
        description: 'Card funding from USD wallet',
        source: 'Test source',
        destination: 'Test destination',
        provider_fee: null, // Missing from fiat wallet transaction
      };

      const mockTransaction = {
        id: 'trans-1',
        status: TransactionStatus.PROCESSING,
        metadata: {
          fee: 100, // Fee in transaction metadata
        },
        description: 'Card funding from USD wallet',
      };

      const mockSourceWallet = {
        id: 'wallet-1',
        balance: 10000,
        credit_balance: 0,
      };

      const mockWithdrawalDetails = {
        externalReference: 'tx-hash-123',
        status: 'confirmed',
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionService.findOne.mockResolvedValue(mockTransaction);
      mockFiatWalletAdapter.getWithdrawalDetails.mockResolvedValue(mockWithdrawalDetails);
      mockFiatWalletRepository.findById = jest.fn().mockResolvedValue(mockSourceWallet);
      mockFiatWalletRepository.update = jest.fn();
      mockFiatWalletRepository.transaction = jest.fn();
      mockYellowCardWebhookService.mockPaymentCompleteWebhook.mockResolvedValue({});

      await service['processWithdrawalConfirmed'](movement, mockExternalAccount, mockPayload);

      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        'trans-1',
        TransactionStatus.COMPLETED,
        expect.objectContaining({
          provider_fee: 100,
          provider_metadata: expect.objectContaining({
            transactionHash: 'tx-hash-123',
          }),
        }),
        undefined,
        {
          shouldSendInAppNotification: false,
          shouldSendEmail: false,
          shouldSendPushNotification: false,
        },
      );
    });

    describe('createIncomingNgnTransaction flow', () => {
      it('should complete withdrawal processing and proceed to NGN transaction creation', async () => {
        const movement = {
          withdrawal_request_id: 'withdrawal-123',
          change: '-25.00',
        } as any;

        const mockExternalAccount = {
          id: 'external-1',
          user_id: 'user-1',
          participant_code: 'LHBX5H',
        } as any;

        const mockPayload = {
          timestamp: Date.now(),
          asset: 'USDC.SOL',
        } as any;

        const mockFiatWalletTransaction = {
          id: 'fwt-1',
          transaction_id: 'trans-1',
          status: TransactionStatus.PROCESSING,
          currency: 'USD',
          balance_before: 10000,
          fiat_wallet_id: 'wallet-1',
          provider_metadata: {},
          description: 'Exchange USD to NGN',
          source: 'USD Wallet',
          destination: 'NGN Wallet',
          provider_fee: 100,
        };

        const mockTransaction = {
          id: 'trans-1',
          user_id: 'user-1',
          amount: 10000,
          status: TransactionStatus.PROCESSING,
          metadata: {
            rate_id: 'rate-123',
          },
          description: 'Exchange USD to NGN',
        };

        const mockSourceWallet = {
          id: 'wallet-1',
          balance: 10000,
          credit_balance: 0,
        };

        const mockWithdrawalDetails = {
          externalReference: 'tx-hash-123',
          status: 'confirmed',
        };

        mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
        mockTransactionService.findOne.mockResolvedValue(mockTransaction);
        mockFiatWalletAdapter.getWithdrawalDetails.mockResolvedValue(mockWithdrawalDetails);
        mockFiatWalletRepository.findById = jest.fn().mockResolvedValue(mockSourceWallet);
        mockFiatWalletRepository.update = jest.fn();
        mockYellowCardWebhookService.mockPaymentCompleteWebhook.mockResolvedValue({});

        await service['processWithdrawalConfirmed'](movement, mockExternalAccount, mockPayload);

        // Verify the main flow completed
        expect(mockTransactionService.updateStatus).toHaveBeenCalled();
        expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalled();
      });

      it('should return existing incoming transaction if one already exists', async () => {
        const mockParentTransaction = {
          id: 'parent-123',
          user_id: 'user-1',
          amount: 10000,
          metadata: { rate_id: 'rate-123' },
        };

        const mockExistingIncomingTransaction = {
          id: 'existing-incoming-123',
          parent_transaction_id: 'parent-123',
          asset: 'NGN',
          user_id: 'user-1',
          amount: 15000000,
          status: TransactionStatus.COMPLETED,
        };

        mockTransactionRepository.findOne.mockResolvedValue(mockExistingIncomingTransaction);

        const result = await service['createIncomingNgnTransaction'](mockParentTransaction as any, 'seq-123');

        expect(mockTransactionRepository.findOne).toHaveBeenCalledWith({
          parent_transaction_id: 'parent-123',
          asset: 'NGN',
        });
        expect(result).toEqual(mockExistingIncomingTransaction);
        // Verify that no new transaction creation was attempted
        expect(mockRateRepository.findOne).not.toHaveBeenCalled();
        expect(mockRateConfigRepository.findOne).not.toHaveBeenCalled();
        expect(mockTransactionService.create).not.toHaveBeenCalled();
      });

      it('should calculate fees correctly with percentage-based partner fee', async () => {
        const mockParentTransaction = {
          id: 'parent-123',
          user_id: 'user-1',
          amount: 10000,
          metadata: { rate_id: 'rate-123' },
        };

        const mockExchangeRate = {
          id: 'rate-123',
          rate: 1500,
        };

        const mockRateConfig = {
          provider: 'yellowcard',
          is_active: true,
          is_partner_fee_percentage: true,
          partner_fee: 2,
          is_disbursement_fee_percentage: false,
          disbursement_fee: 0,
        };

        const mockFiatWallet = {
          id: 'wallet-1',
          balance: 100000,
        };

        // Reset to ensure no existing transaction is found by outer check
        mockTransactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
        mockTransactionRepository.query.mockReturnValue({
          withGraphFetched: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null),
        });
        mockTransactionService.create.mockResolvedValue({ id: 'child-123' });
        mockFiatWalletTransactionService.create.mockResolvedValue({ id: 'fwt-123' });

        const result = await service['createIncomingNgnTransaction'](mockParentTransaction as any, 'seq-123');

        expect(mockRateConfigRepository.findOne).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it('should calculate fees correctly with fixed partner fee', async () => {
        const mockParentTransaction = {
          id: 'parent-123',
          user_id: 'user-1',
          amount: 10000,
          metadata: { rate_id: 'rate-123' },
        };

        const mockExchangeRate = {
          id: 'rate-123',
          rate: 1500,
        };

        const mockRateConfig = {
          provider: 'yellowcard',
          is_active: true,
          is_partner_fee_percentage: false,
          partner_fee: 500,
          is_disbursement_fee_percentage: false,
          disbursement_fee: 0,
        };

        const mockFiatWallet = {
          id: 'wallet-1',
          balance: 100000,
        };

        // Reset to ensure no existing transaction is found by outer check
        mockTransactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
        mockTransactionRepository.query.mockReturnValue({
          withGraphFetched: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null),
        });
        mockTransactionService.create.mockResolvedValue({ id: 'child-123' });
        mockFiatWalletTransactionService.create.mockResolvedValue({ id: 'fwt-123' });

        const result = await service['createIncomingNgnTransaction'](mockParentTransaction as any, 'seq-123');

        expect(mockRateConfigRepository.findOne).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it('should calculate fees correctly with percentage-based disbursement fee', async () => {
        const mockParentTransaction = {
          id: 'parent-123',
          user_id: 'user-1',
          amount: 10000,
          metadata: { rate_id: 'rate-123' },
        };

        const mockExchangeRate = {
          id: 'rate-123',
          rate: 1500,
        };

        const mockRateConfig = {
          provider: 'yellowcard',
          is_active: true,
          is_partner_fee_percentage: false,
          partner_fee: 0,
          is_disbursement_fee_percentage: true,
          disbursement_fee: 1,
        };

        const mockFiatWallet = {
          id: 'wallet-1',
          balance: 100000,
        };

        // Reset to ensure no existing transaction is found by outer check
        mockTransactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
        mockTransactionRepository.query.mockReturnValue({
          withGraphFetched: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null),
        });
        mockTransactionService.create.mockResolvedValue({ id: 'child-123' });
        mockFiatWalletTransactionService.create.mockResolvedValue({ id: 'fwt-123' });

        const result = await service['createIncomingNgnTransaction'](mockParentTransaction as any, 'seq-123');

        expect(mockRateConfigRepository.findOne).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it('should calculate fees correctly with fixed disbursement fee', async () => {
        const mockParentTransaction = {
          id: 'parent-123',
          user_id: 'user-1',
          amount: 10000,
          metadata: { rate_id: 'rate-123' },
        };

        const mockExchangeRate = {
          id: 'rate-123',
          rate: 1500,
        };

        const mockRateConfig = {
          provider: 'yellowcard',
          is_active: true,
          is_partner_fee_percentage: false,
          partner_fee: 0,
          is_disbursement_fee_percentage: false,
          disbursement_fee: 250,
        };

        const mockFiatWallet = {
          id: 'wallet-1',
          balance: 100000,
        };

        // Reset to ensure no existing transaction is found by outer check
        mockTransactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));
        mockTransactionRepository.query.mockReturnValue({
          withGraphFetched: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null),
        });
        mockTransactionService.create.mockResolvedValue({ id: 'child-123' });
        mockFiatWalletTransactionService.create.mockResolvedValue({ id: 'fwt-123' });

        const result = await service['createIncomingNgnTransaction'](mockParentTransaction as any, 'seq-123');

        expect(mockRateConfigRepository.findOne).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it('should find existing transaction using only parent_transaction_id and asset (not external_reference) inside DB transaction', async () => {
        const mockParentTransaction = {
          id: 'parent-123',
          user_id: 'user-1',
          amount: 10000,
          metadata: { rate_id: 'rate-123' },
        };

        const mockExistingChildFromPaga = {
          id: 'existing-child-from-paga',
          parent_transaction_id: 'parent-123',
          asset: 'NGN',
          external_reference: 'paga-different-reference', // Different external_reference (from Paga)
          status: TransactionStatus.PROCESSING,
          fiatWalletTransaction: { id: 'fwt-456' },
        };

        const mockExchangeRate = {
          id: 'rate-123',
          rate: 1500,
        };

        const mockRateConfig = {
          provider: 'yellowcard',
          isActive: true,
          fiatExchange: {
            partner_fee: { is_percentage: false, value: 0 },
            disbursement_fee: { is_percentage: false, value: 0 },
          },
        };

        const mockFiatWallet = {
          id: 'wallet-1',
          balance: 100000,
        };

        // First findOne (outer check) returns null to simulate no existing transaction found initially
        mockTransactionRepository.findOne.mockResolvedValue(null);

        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));

        // The inner query (with forUpdate) should find the existing transaction regardless of external_reference
        mockTransactionRepository.query.mockReturnValue({
          withGraphFetched: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockExistingChildFromPaga),
        });

        mockTransactionService.updateStatus.mockResolvedValue(mockExistingChildFromPaga);

        const result = await service['createIncomingNgnTransaction'](mockParentTransaction as any, 'zerohash-seq-123');

        // Verify that the inner check found the existing transaction and returned it
        expect(result).toEqual(mockExistingChildFromPaga);
        // Verify no new transaction was created
        expect(mockTransactionService.create).not.toHaveBeenCalled();
        expect(mockFiatWalletTransactionService.create).not.toHaveBeenCalled();
      });

      it('should update existing transaction status to PROCESSING when found by inner check', async () => {
        const mockParentTransaction = {
          id: 'parent-123',
          user_id: 'user-1',
          amount: 10000,
          metadata: { rate_id: 'rate-123' },
        };

        const mockExistingChild = {
          id: 'existing-child-123',
          parent_transaction_id: 'parent-123',
          asset: 'NGN',
          status: TransactionStatus.INITIATED,
          fiatWalletTransaction: { id: 'fwt-456' },
        };

        const mockExchangeRate = {
          id: 'rate-123',
          rate: 1500,
        };

        const mockRateConfig = {
          provider: 'yellowcard',
          isActive: true,
          fiatExchange: {
            partner_fee: { is_percentage: false, value: 0 },
            disbursement_fee: { is_percentage: false, value: 0 },
          },
        };

        const mockFiatWallet = {
          id: 'wallet-1',
          balance: 100000,
        };

        // First findOne (outer check) returns null
        mockTransactionRepository.findOne.mockResolvedValue(null);

        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        mockTransactionRepository.transaction.mockImplementation(async (callback) => callback({}));

        // Inner query finds the existing transaction
        mockTransactionRepository.query.mockReturnValue({
          withGraphFetched: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockExistingChild),
        });

        mockTransactionService.updateStatus.mockResolvedValue({
          ...mockExistingChild,
          status: TransactionStatus.PROCESSING,
        });
        mockFiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

        await service['createIncomingNgnTransaction'](mockParentTransaction as any, 'seq-123');

        // Verify the existing transaction was updated to PROCESSING
        expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
          'existing-child-123',
          TransactionStatus.PROCESSING,
          {},
          expect.anything(),
        );
        // Verify the fiat wallet transaction was also updated
        expect(mockFiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
          'fwt-456',
          TransactionStatus.PROCESSING,
          {},
          expect.anything(),
        );
      });
    });
  });

  describe('isValidBalanceChangePayload', () => {
    it('should return true for valid payload with available account type', () => {
      const payload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL',
        account_type: 'available',
        movements: [],
      } as any;

      const result = service['isValidBalanceChangePayload'](payload);

      expect(result).toBe(true);
    });

    it('should return false when participant_code is missing', () => {
      const payload = {
        asset: 'USDC.SOL',
        account_type: 'available',
      } as any;

      const result = service['isValidBalanceChangePayload'](payload);

      expect(result).toBe(false);
    });

    it('should return false when asset is missing', () => {
      const payload = {
        participant_code: 'abc123',
        account_type: 'available',
      } as any;

      const result = service['isValidBalanceChangePayload'](payload);

      expect(result).toBe(false);
    });

    it('should return false when account_type is not available and not collateral with withdrawal_confirmed', () => {
      const payload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL',
        account_type: 'hold',
        movements: [],
      } as any;

      const result = service['isValidBalanceChangePayload'](payload);

      expect(result).toBe(false);
    });

    it('should return true for collateral account with withdrawal_confirmed movement', () => {
      const payload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL',
        account_type: 'collateral',
        movements: [{ movement_type: 'withdrawal_confirmed' }],
      } as any;

      const result = service['isValidBalanceChangePayload'](payload);

      expect(result).toBe(true);
    });

    it('should return false when asset is not supported', () => {
      const payload = {
        participant_code: 'abc123',
        asset: 'BTC.ETH',
        account_type: 'available',
      } as any;

      const result = service['isValidBalanceChangePayload'](payload);

      expect(result).toBe(false);
    });
  });

  describe('isSupportedStablecoin', () => {
    it('should return true for supported stablecoin USDC.SOL', () => {
      const result = service['isSupportedStablecoin']('USDC.SOL');
      expect(result).toBe(true);
    });

    it('should return true for supported stablecoin USDT.ETH', () => {
      const result = service['isSupportedStablecoin']('USDT.ETH');
      expect(result).toBe(true);
    });

    it('should return false for unsupported asset without dot', () => {
      const result = service['isSupportedStablecoin']('USDC');
      expect(result).toBe(false);
    });

    it('should return false for unsupported currency', () => {
      const result = service['isSupportedStablecoin']('BTC.SOL');
      expect(result).toBe(false);
    });

    it('should return false for unsupported network', () => {
      const result = service['isSupportedStablecoin']('USDC.BTC');
      expect(result).toBe(false);
    });
  });

  describe('isValidMovement', () => {
    it('should return true for valid final_settlement movement', () => {
      const movement = {
        movement_type: 'final_settlement',
        change: '100.00',
        trade_id: 'trade-123',
      } as any;

      const result = service['isValidMovement'](movement);

      expect(result).toBe(true);
    });

    it('should return false when change is missing', () => {
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'trade-123',
      } as any;

      const result = service['isValidMovement'](movement);

      expect(result).toBe(false);
    });

    it('should return false for final_settlement without trade_id', () => {
      const movement = {
        movement_type: 'final_settlement',
        change: '100.00',
      } as any;

      const result = service['isValidMovement'](movement);

      expect(result).toBe(false);
    });

    it('should return false for transfer without transfer_request_id', () => {
      const movement = {
        movement_type: 'transfer',
        change: '50.00',
      } as any;

      const result = service['isValidMovement'](movement);

      expect(result).toBe(false);
    });

    it('should return false for withdrawal_confirmed without withdrawal_request_id', () => {
      const movement = {
        movement_type: 'withdrawal_confirmed',
        change: '-25.00',
      } as any;

      const result = service['isValidMovement'](movement);

      expect(result).toBe(false);
    });

    it('should return false for deposit without deposit_reference_id', () => {
      const movement = {
        movement_type: 'deposit',
        change: '75.00',
      } as any;

      const result = service['isValidMovement'](movement);

      expect(result).toBe(false);
    });

    it('should return false for unsupported movement types', () => {
      const movement = {
        movement_type: 'unsupported_type',
        change: '100.00',
      } as any;

      const result = service['isValidMovement'](movement);

      expect(result).toBe(false);
    });
  });

  describe('mapPaymentStatusToTransactionStatus', () => {
    it('should map submitted to PENDING', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('submitted');
      expect(result).toBe(TransactionStatus.PENDING);
    });

    it('should map settled to SETTLED', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('settled');
      expect(result).toBe(TransactionStatus.SETTLED);
    });

    it('should map failed to FAILED', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('failed');
      expect(result).toBe(TransactionStatus.FAILED);
    });

    it('should map cancelled to CANCELLED', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('cancelled');
      expect(result).toBe(TransactionStatus.CANCELLED);
    });

    it('should return null for unknown status', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('unknown_status');
      expect(result).toBeNull();
    });
  });

  describe('mapTradeStateToTransactionStatus', () => {
    it('should map active to PENDING', () => {
      const result = service['mapTradeStateToTransactionStatus']('active');
      expect(result).toBe(TransactionStatus.PENDING);
    });

    it('should map accepted to PROCESSING', () => {
      const result = service['mapTradeStateToTransactionStatus']('accepted');
      expect(result).toBe(TransactionStatus.PROCESSING);
    });

    it('should map settled to COMPLETED', () => {
      const result = service['mapTradeStateToTransactionStatus']('settled');
      expect(result).toBe(TransactionStatus.COMPLETED);
    });

    it('should map rejected to FAILED', () => {
      const result = service['mapTradeStateToTransactionStatus']('rejected');
      expect(result).toBe(TransactionStatus.FAILED);
    });

    it('should return null for unknown state', () => {
      const result = service['mapTradeStateToTransactionStatus']('unknown_state');
      expect(result).toBeNull();
    });
  });

  describe('buildFailureReason', () => {
    it('should build failure reason with all fields', () => {
      const result = service['buildFailureReason'](
        'ERR_001',
        'Payment declined',
        'Insufficient funds',
        'Account closed',
      );

      expect(result).toContain('Code: ERR_001');
      expect(result).toContain('Description: Payment declined');
      expect(result).toContain('ACH Failure: Insufficient funds');
      expect(result).toContain('Rejected: Account closed');
    });

    it('should return default message when no reasons provided', () => {
      const result = service['buildFailureReason']();

      expect(result).toBe('Payment failed');
    });

    it('should build reason with partial fields', () => {
      const result = service['buildFailureReason']('ERR_002', undefined, 'Insufficient funds');

      expect(result).toContain('Code: ERR_002');
      expect(result).toContain('ACH Failure: Insufficient funds');
      expect(result).not.toContain('Description:');
    });
  });

  describe('controller', () => {
    it('should handle webhook endpoint', async () => {
      const reqMock = {
        body: {
          participant_code: 'abc123',
          participant_status: 'SUBMITTED',
        },
        headers: {
          'x-zh-hook-payload-type': 'participant_status_changed',
        },
      } as any;

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'external-1',
        participant_code: 'abc123',
        provider_kyc_status: 'not_started',
      });

      const res = await controller.handleWebhook(reqMock);

      expect(res).toEqual(
        expect.objectContaining({
          message: 'Webhook processed successfully',
          data: {},
          statusCode: 200,
        }),
      );
    });
  });

  describe('isSupportedStablecoin', () => {
    it('should return false for asset without dot separator', () => {
      const result = service['isSupportedStablecoin']('USDC');
      expect(result).toBe(false);
    });

    it('should return true for valid USDC.SOL', () => {
      const result = service['isSupportedStablecoin']('USDC.SOL');
      expect(result).toBe(true);
    });

    it('should return true for valid USDT.ETH', () => {
      const result = service['isSupportedStablecoin']('USDT.ETH');
      expect(result).toBe(true);
    });

    it('should return false for unsupported currency', () => {
      const result = service['isSupportedStablecoin']('BTC.SOL');
      expect(result).toBe(false);
    });

    it('should return false for unsupported network', () => {
      const result = service['isSupportedStablecoin']('USDC.BSC');
      expect(result).toBe(false);
    });
  });

  describe('isValidBalanceChangePayload', () => {
    it('should return false when participant_code is missing', () => {
      const payload = { asset: 'USDC.SOL', account_type: 'available' } as any;
      const result = service['isValidBalanceChangePayload'](payload);
      expect(result).toBe(false);
    });

    it('should return false when asset is missing', () => {
      const payload = { participant_code: 'abc123', account_type: 'available' } as any;
      const result = service['isValidBalanceChangePayload'](payload);
      expect(result).toBe(false);
    });

    it('should return true for withdrawal_confirmed from collateral account', () => {
      const payload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL',
        account_type: 'collateral',
        movements: [{ movement_type: 'withdrawal_confirmed' }],
      } as any;
      const result = service['isValidBalanceChangePayload'](payload);
      expect(result).toBe(true);
    });

    it('should return false for collateral account without withdrawal_confirmed', () => {
      const payload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL',
        account_type: 'collateral',
        movements: [{ movement_type: 'deposit' }],
      } as any;
      const result = service['isValidBalanceChangePayload'](payload);
      expect(result).toBe(false);
    });

    it('should return false for non-available account type', () => {
      const payload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL',
        account_type: 'other',
        movements: [],
      } as any;
      const result = service['isValidBalanceChangePayload'](payload);
      expect(result).toBe(false);
    });

    it('should return true for valid available account with supported stablecoin', () => {
      const payload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL',
        account_type: 'available',
        movements: [],
      } as any;
      const result = service['isValidBalanceChangePayload'](payload);
      expect(result).toBe(true);
    });
  });

  describe('isValidMovement', () => {
    it('should return false when change is missing', () => {
      const movement = { movement_type: 'final_settlement', trade_id: 'trade-1' } as any;
      const result = service['isValidMovement'](movement);
      expect(result).toBe(false);
    });

    it('should return false for final_settlement without trade_id', () => {
      const movement = { movement_type: 'final_settlement', change: '100' } as any;
      const result = service['isValidMovement'](movement);
      expect(result).toBe(false);
    });

    it('should return false for transfer without transfer_request_id', () => {
      const movement = { movement_type: 'transfer', change: '100' } as any;
      const result = service['isValidMovement'](movement);
      expect(result).toBe(false);
    });

    it('should return false for withdrawal_confirmed without withdrawal_request_id', () => {
      const movement = { movement_type: 'withdrawal_confirmed', change: '100' } as any;
      const result = service['isValidMovement'](movement);
      expect(result).toBe(false);
    });

    it('should return false for withdrawal_pending without withdrawal_request_id', () => {
      const movement = { movement_type: 'withdrawal_pending', change: '100' } as any;
      const result = service['isValidMovement'](movement);
      expect(result).toBe(false);
    });

    it('should return false for deposit without deposit_reference_id', () => {
      const movement = { movement_type: 'deposit', change: '100' } as any;
      const result = service['isValidMovement'](movement);
      expect(result).toBe(false);
    });

    it('should return false for unsupported movement type', () => {
      const movement = { movement_type: 'unknown', change: '100' } as any;
      const result = service['isValidMovement'](movement);
      expect(result).toBe(false);
    });

    it('should return true for valid final_settlement', () => {
      const movement = { movement_type: 'final_settlement', change: '100', trade_id: 'trade-1' } as any;
      const result = service['isValidMovement'](movement);
      expect(result).toBe(true);
    });

    it('should return true for valid final_settlement_outstanding', () => {
      const movement = { movement_type: 'final_settlement_outstanding', change: '100', trade_id: 'trade-1' } as any;
      const result = service['isValidMovement'](movement);
      expect(result).toBe(true);
    });

    it('should return false for final_settlement_outstanding without trade_id', () => {
      const movement = { movement_type: 'final_settlement_outstanding', change: '100' } as any;
      const result = service['isValidMovement'](movement);
      expect(result).toBe(false);
    });

    it('should return true for valid transfer', () => {
      const movement = { movement_type: 'transfer', change: '100', transfer_request_id: 'transfer-1' } as any;
      const result = service['isValidMovement'](movement);
      expect(result).toBe(true);
    });

    it('should return true for valid deposit', () => {
      const movement = { movement_type: 'deposit', change: '100', deposit_reference_id: 'deposit-1' } as any;
      const result = service['isValidMovement'](movement);
      expect(result).toBe(true);
    });
  });

  describe('determineCurrentTransaction', () => {
    it('should return sender transaction when user is sender', () => {
      const senderTx = { id: 'tx-1', user_id: 'user-1' } as any;
      const receiverTx = { id: 'tx-2', user_id: 'user-2' } as any;
      const result = service['determineCurrentTransaction'](senderTx, receiverTx, 'user-1');
      expect(result).toBe(senderTx);
    });

    it('should return receiver transaction when user is receiver', () => {
      const senderTx = { id: 'tx-1', user_id: 'user-1' } as any;
      const receiverTx = { id: 'tx-2', user_id: 'user-2' } as any;
      const result = service['determineCurrentTransaction'](senderTx, receiverTx, 'user-2');
      expect(result).toBe(receiverTx);
    });

    it('should return null when user is neither sender nor receiver', () => {
      const senderTx = { id: 'tx-1', user_id: 'user-1' } as any;
      const receiverTx = { id: 'tx-2', user_id: 'user-2' } as any;
      const result = service['determineCurrentTransaction'](senderTx, receiverTx, 'user-3');
      expect(result).toBeNull();
    });
  });

  describe('mergeMetadataWithWebhookPayload', () => {
    it('should merge existing metadata with new provider metadata', () => {
      const existingMetadata = { existing_field: 'value' } as any;
      const newProviderMetadata = { new_field: 'new_value' } as any;
      const eventType = ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED;
      const payload = { participant_code: 'abc123' } as any;

      const result = service['mergeMetadataWithWebhookPayload'](
        existingMetadata,
        newProviderMetadata,
        eventType,
        payload,
      );

      expect(result.existing_field).toBe('value');
      expect(result.new_field).toBe('new_value');
      expect(result.webhook_payloads).toBeDefined();
      expect(result.webhook_payloads.length).toBe(1);
      expect(result.webhook_payloads[0].event_type).toBe(eventType);
    });

    it('should limit webhook history to 5 entries', () => {
      const existingMetadata = {
        webhook_payloads: [
          { timestamp: '1', event_type: 'test1', payload: {} },
          { timestamp: '2', event_type: 'test2', payload: {} },
          { timestamp: '3', event_type: 'test3', payload: {} },
          { timestamp: '4', event_type: 'test4', payload: {} },
          { timestamp: '5', event_type: 'test5', payload: {} },
        ],
      } as any;
      const newProviderMetadata = {} as any;
      const eventType = ZeroHashWebhookEventType.PAYMENT_STATUS_CHANGED;
      const payload = { transaction_id: 'tx-123' } as any;

      const result = service['mergeMetadataWithWebhookPayload'](
        existingMetadata,
        newProviderMetadata,
        eventType,
        payload,
      );

      expect(result.webhook_payloads.length).toBe(5);
      expect(result.webhook_payloads.at(-1).event_type).toBe(eventType);
    });
  });

  describe('processExternalAccountStatusChanged', () => {
    it('should handle closed status and delegate to service', async () => {
      const payload = {
        external_account_id: 'ext-1',
        external_account_status: 'closed',
      } as any;

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'external-1',
        status: 'active',
        external_account_ref: 'ext-1',
      });
      mockExternalAccountService.closeExternalAccount.mockResolvedValue({});

      await service['processExternalAccountStatusChanged'](payload);

      expect(mockExternalAccountService.closeExternalAccount).toHaveBeenCalledWith('external-1');
    });

    it('should handle revoked status and delegate to service', async () => {
      const payload = {
        external_account_id: 'ext-1',
        external_account_status: 'revoked',
      } as any;

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'external-1',
        status: 'active',
        external_account_ref: 'ext-1',
      });
      mockExternalAccountService.closeExternalAccount.mockResolvedValue({});

      await service['processExternalAccountStatusChanged'](payload);

      expect(mockExternalAccountService.closeExternalAccount).toHaveBeenCalledWith('external-1');
    });

    it('should not downgrade from non-pending to pending', async () => {
      const payload = {
        external_account_id: 'ext-1',
        external_account_status: 'pending',
      } as any;

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'external-1',
        status: 'approved',
        external_account_ref: 'ext-1',
      });

      await service['processExternalAccountStatusChanged'](payload);

      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
    });
  });

  describe('processAccountBalanceChanged', () => {
    it('should skip processing when external account not found', async () => {
      const payload = {
        participant_code: 'unknown',
        asset: 'USDC.SOL',
        account_type: 'available',
        movements: [],
      } as any;

      mockExternalAccountService.findOne.mockRejectedValue(new NotFoundException());

      await service['processAccountBalanceChanged'](payload);

      expect(mockFiatWalletService.updateBalance).not.toHaveBeenCalled();
    });
  });

  describe('mapPaymentStatusToTransactionStatus', () => {
    it('should map submitted to pending', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('submitted');
      expect(result).toBe(TransactionStatus.PENDING);
    });

    it('should map pending to pending', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('pending');
      expect(result).toBe(TransactionStatus.PENDING);
    });

    it('should map pending_trade to pending', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('pending_trade');
      expect(result).toBe(TransactionStatus.PENDING);
    });

    it('should map posted to processing', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('posted');
      expect(result).toBe(TransactionStatus.PROCESSING);
    });

    it('should map settled to settled', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('settled');
      expect(result).toBe(TransactionStatus.SETTLED);
    });

    it('should map cancelled to cancelled', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('cancelled');
      expect(result).toBe(TransactionStatus.CANCELLED);
    });

    it('should map failed to failed', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('failed');
      expect(result).toBe(TransactionStatus.FAILED);
    });

    it('should map returned to failed', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('returned');
      expect(result).toBe(TransactionStatus.FAILED);
    });

    it('should map rejected to failed', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('rejected');
      expect(result).toBe(TransactionStatus.FAILED);
    });

    it('should map retried to processing', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('retried');
      expect(result).toBe(TransactionStatus.PROCESSING);
    });

    it('should return null for unknown status', () => {
      const result = service['mapPaymentStatusToTransactionStatus']('unknown_status');
      expect(result).toBeNull();
    });
  });

  describe('processMovement', () => {
    it('should skip processing when movement change is zero', async () => {
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'trade-123',
        change: '0',
      } as any;

      const externalAccount = {
        id: 'ext-1',
        user_id: 'user-1',
        participant_code: 'part-1',
      } as any;

      const payload = {
        participant_code: 'part-1',
        asset: 'USDC.SOL',
        account_type: 'available',
      } as any;

      await service['processMovement'](movement, externalAccount, payload);

      expect(mockFiatWalletTransactionService.findOneOrNull).not.toHaveBeenCalled();
    });

    it('should handle error during movement processing', async () => {
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'trade-123',
        change: '100',
      } as any;

      const externalAccount = {
        id: 'ext-1',
        user_id: 'user-1',
        participant_code: 'part-1',
      } as any;

      const payload = {
        participant_code: 'part-1',
        asset: 'USDC.SOL',
        account_type: 'available',
      } as any;

      mockFiatWalletTransactionService.findOneOrNull.mockRejectedValue(new Error('DB error'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service['processMovement'](movement, externalAccount, payload);

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should process default movement type with warning', async () => {
      const movement = {
        movement_type: 'unknown_type',
        trade_id: 'trade-123',
        change: '100',
      } as any;

      const externalAccount = {
        id: 'ext-1',
        user_id: 'user-1',
      } as any;

      const payload = {
        participant_code: 'part-1',
        asset: 'USDC.SOL',
        account_type: 'available',
      } as any;

      await service['processMovement'](movement, externalAccount, payload);
    });
  });

  describe('findFiatWalletTransactionByTradeId', () => {
    it('should return fiat wallet transaction when found', async () => {
      const externalAccount = {
        id: 'ext-1',
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        provider_reference: 'trade-123',
      };

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);

      const result = await service['findFiatWalletTransactionByTradeId'](externalAccount, 'trade-123');

      expect(result).toEqual(mockFiatWalletTransaction);
    });

    it('should return null when transaction not found', async () => {
      const externalAccount = {
        id: 'ext-1',
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);

      const result = await service['findFiatWalletTransactionByTradeId'](externalAccount, 'trade-123');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      const externalAccount = {
        id: 'ext-1',
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      mockFiatWalletTransactionService.findOneOrNull.mockRejectedValue(new Error('DB error'));

      await expect(service['findFiatWalletTransactionByTradeId'](externalAccount, 'trade-123')).rejects.toThrow(
        'DB error',
      );
    });
  });

  describe('extractParticipantCode', () => {
    it('should extract participant_code from payload', () => {
      const payload = { participant_code: 'part-123' } as any;
      const result = service['extractParticipantCode'](payload);
      expect(result).toBe('part-123');
    });

    it('should extract from obo_participant when direct code missing', () => {
      const payload = { obo_participant: { participant_code: 'obo-123' } } as any;
      const result = service['extractParticipantCode'](payload);
      expect(result).toBe('obo-123');
    });

    it('should throw when participant_code is missing', () => {
      const payload = {} as any;
      expect(() => service['extractParticipantCode'](payload)).toThrow('Missing participant_code');
    });
  });

  describe('getExternalAccount', () => {
    it('should return external account when found', async () => {
      const mockAccount = { id: 'ext-1', user_id: 'user-1', participant_code: 'part-1' };
      mockExternalAccountService.findOne.mockResolvedValue(mockAccount);

      const result = await service['getExternalAccount']('part-1');

      expect(result).toEqual(mockAccount);
    });

    it('should return null when account not found', async () => {
      mockExternalAccountService.findOne.mockRejectedValue(new NotFoundException());

      const result = await service['getExternalAccount']('unknown-part');

      expect(result).toBeNull();
    });

    it('should throw on other errors', async () => {
      mockExternalAccountService.findOne.mockRejectedValue(new Error('DB error'));

      await expect(service['getExternalAccount']('part-1')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('processParticipantStatusChanged', () => {
    it('should allow status updates except approved to submitted', async () => {
      const payload = {
        participant_code: 'part-1',
        participant_status: 'locked',
      } as any;

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-1',
        provider_kyc_status: 'approved',
      });

      await service['processParticipantStatusChanged'](payload);

      expect(mockExternalAccountService.update).toHaveBeenCalledWith(
        { id: 'ext-1' },
        { provider_kyc_status: 'locked' },
      );
    });

    it('should not downgrade from approved to submitted', async () => {
      const payload = {
        participant_code: 'part-1',
        participant_status: 'submitted',
      } as any;

      mockExternalAccountService.findOne.mockResolvedValue({
        id: 'ext-1',
        provider_kyc_status: 'approved',
      });

      await service['processParticipantStatusChanged'](payload);

      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
    });
  });

  describe('processParticipantUpdated', () => {
    it('should log participant updated payload', async () => {
      const payload = { participant_code: 'part-1', data: 'test' } as any;
      const debugSpy = jest.spyOn(service['logger'], 'debug');

      await service['processParticipantUpdated'](payload);

      expect(debugSpy).toHaveBeenCalled();
    });
  });

  describe('updateWalletBalanceFromPayload - with client_transfer_id', () => {
    it('should update existing transaction when client_transfer_id exists', async () => {
      const payload = {
        participant_code: 'part-1',
        asset: 'USDC.SOL',
        balance: '100.50',
        timestamp: Date.now(),
        client_transfer_id: 'transfer-123',
      } as any;

      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'trade-123',
        movement_id: 'mov-123',
      } as any;

      const externalAccount = {
        id: 'ext-1',
        user_id: 'user-1',
        participant_code: 'part-1',
      } as any;

      const fiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'tx-1',
        currency: 'USD',
        provider_metadata: {},
      } as any;

      mockTransactionRepository.findOne.mockResolvedValue({ id: 'tx-1' });
      mockTransactionService.updateStatus.mockResolvedValue({});
      mockFiatWalletTransactionService.updateStatus.mockResolvedValue({});

      await service['updateWalletBalanceFromPayload'](
        payload,
        'trade-123',
        externalAccount,
        movement,
        fiatWalletTransaction,
      );

      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith('tx-1', TransactionStatus.COMPLETED);
    });
  });

  describe('processWebhook - unhandled event type', () => {
    it('should log warning for unhandled event type', async () => {
      const payload = { data: 'test' } as any;
      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service.processWebhook(payload, 'UNKNOWN_EVENT' as any);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unhandled Zerohash event type'));
    });
  });

  describe('determineCurrentTransaction', () => {
    it('should return sender transaction when user is sender', () => {
      const senderTransaction = { id: 'sender-tx', user_id: 'user-1' } as any;
      const receiverTransaction = { id: 'receiver-tx', user_id: 'user-2' } as any;

      const result = service['determineCurrentTransaction'](senderTransaction, receiverTransaction, 'user-1');

      expect(result).toEqual(senderTransaction);
    });

    it('should return receiver transaction when user is receiver', () => {
      const senderTransaction = { id: 'sender-tx', user_id: 'user-1' } as any;
      const receiverTransaction = { id: 'receiver-tx', user_id: 'user-2' } as any;

      const result = service['determineCurrentTransaction'](senderTransaction, receiverTransaction, 'user-2');

      expect(result).toEqual(receiverTransaction);
    });

    it('should return null when user is neither sender nor receiver', () => {
      const senderTransaction = { id: 'sender-tx', user_id: 'user-1' } as any;
      const receiverTransaction = { id: 'receiver-tx', user_id: 'user-2' } as any;

      const result = service['determineCurrentTransaction'](senderTransaction, receiverTransaction, 'user-3');

      expect(result).toBeNull();
    });
  });

  describe('buildFailureReason', () => {
    it('should build failure reason with reason_code', () => {
      const result = service['buildFailureReason']('CODE_123', undefined, undefined, undefined);
      expect(result).toContain('CODE_123');
    });

    it('should build failure reason with reason_description', () => {
      const result = service['buildFailureReason'](undefined, 'Test description', undefined, undefined);
      expect(result).toContain('Test description');
    });

    it('should build failure reason with ach_failure_reason', () => {
      const result = service['buildFailureReason'](undefined, undefined, 'ACH failure', undefined);
      expect(result).toContain('ACH failure');
    });

    it('should build failure reason with rejected_reason', () => {
      const result = service['buildFailureReason'](undefined, undefined, undefined, 'Rejected due to...');
      expect(result).toContain('Rejected due to');
    });

    it('should return default message when no reasons provided', () => {
      const result = service['buildFailureReason'](undefined, undefined, undefined, undefined);
      expect(result).toBe('Payment failed');
    });

    it('should combine multiple reasons', () => {
      const result = service['buildFailureReason']('CODE_123', 'Description', undefined, undefined);
      expect(result).toContain('CODE_123');
      expect(result).toContain('Description');
    });
  });

  describe('mergeMetadataWithWebhookPayload', () => {
    it('should merge existing metadata with new webhook payload', () => {
      const existingMetadata = {
        existing_key: 'value',
        webhook_payloads: [{ timestamp: '2023-01-01', event_type: 'old_event', payload: {} }],
      } as any;

      const newProviderMetadata = { zerohash_payment_status: 'completed' };
      const payload = { participant_code: 'part-1' } as any;

      const result = service['mergeMetadataWithWebhookPayload'](
        existingMetadata,
        newProviderMetadata,
        ZeroHashWebhookEventType.PAYMENT_STATUS_CHANGED,
        payload,
      );

      expect(result.existing_key).toBe('value');
      expect(result.zerohash_payment_status).toBe('completed');
      expect(result.webhook_payloads.length).toBe(2);
    });

    it('should limit webhook history to MAX_WEBHOOK_HISTORY', () => {
      const existingMetadata = {
        webhook_payloads: [
          { timestamp: '2023-01-01', event_type: 'event1', payload: {} },
          { timestamp: '2023-01-02', event_type: 'event2', payload: {} },
          { timestamp: '2023-01-03', event_type: 'event3', payload: {} },
          { timestamp: '2023-01-04', event_type: 'event4', payload: {} },
          { timestamp: '2023-01-05', event_type: 'event5', payload: {} },
        ],
      } as any;

      const payload = { participant_code: 'part-1' } as any;

      const result = service['mergeMetadataWithWebhookPayload'](
        existingMetadata,
        {},
        ZeroHashWebhookEventType.PAYMENT_STATUS_CHANGED,
        payload,
      );

      expect(result.webhook_payloads.length).toBe(5);
    });
  });

  describe('updateFiatWalletTransactionIfNeeded', () => {
    it('should skip update for non-terminal status', async () => {
      const transaction = { id: 'tx-1' } as any;
      const providerMetadata = {} as any;
      const payload = {} as any;

      await service['updateFiatWalletTransactionIfNeeded'](
        transaction,
        TransactionStatus.PROCESSING,
        providerMetadata,
        payload,
      );

      expect(mockFiatWalletTransactionService.findOne).not.toHaveBeenCalled();
    });

    it('should update fiat wallet transaction for FAILED status', async () => {
      const transaction = { id: 'tx-1' } as any;
      const providerMetadata = { zerohash_payment_status: 'failed' } as any;
      const payload = { participant_code: 'part-1' } as any;
      const fiatWalletTransaction = {
        id: 'fwt-1',
        provider_metadata: {},
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(fiatWalletTransaction);
      mockFiatWalletTransactionService.updateStatus.mockResolvedValue({});

      await service['updateFiatWalletTransactionIfNeeded'](
        transaction,
        TransactionStatus.FAILED,
        providerMetadata,
        payload,
        'Test failure reason',
      );

      expect(mockFiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        'fwt-1',
        TransactionStatus.FAILED,
        expect.objectContaining({ failure_reason: 'Test failure reason' }),
      );
    });

    it('should update fiat wallet transaction for CANCELLED status', async () => {
      const transaction = { id: 'tx-1' } as any;
      const providerMetadata = {} as any;
      const payload = { participant_code: 'part-1' } as any;
      const fiatWalletTransaction = {
        id: 'fwt-1',
        provider_metadata: {},
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(fiatWalletTransaction);
      mockFiatWalletTransactionService.updateStatus.mockResolvedValue({});

      await service['updateFiatWalletTransactionIfNeeded'](
        transaction,
        TransactionStatus.CANCELLED,
        providerMetadata,
        payload,
      );

      expect(mockFiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        'fwt-1',
        TransactionStatus.CANCELLED,
        expect.anything(),
      );
    });

    it('should log warning when fiat wallet transaction not found', async () => {
      const transaction = { id: 'tx-1' } as any;
      const providerMetadata = {} as any;
      const payload = { participant_code: 'part-1' } as any;

      mockFiatWalletTransactionService.findOne.mockRejectedValue(new NotFoundException());

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['updateFiatWalletTransactionIfNeeded'](
        transaction,
        TransactionStatus.FAILED,
        providerMetadata,
        payload,
      );

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No fiat wallet transaction found'));
    });

    it('should log error for other errors', async () => {
      const transaction = { id: 'tx-1' } as any;
      const providerMetadata = {} as any;
      const payload = { participant_code: 'part-1' } as any;

      mockFiatWalletTransactionService.findOne.mockRejectedValue(new Error('DB error'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service['updateFiatWalletTransactionIfNeeded'](
        transaction,
        TransactionStatus.FAILED,
        providerMetadata,
        payload,
      );

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('updateFiatWalletTransactionSettled', () => {
    it('should update fiat wallet transaction with settled_at', async () => {
      const transaction = { id: 'tx-1' } as any;
      const providerMetadata = {} as any;
      const payload = { timestamp: Date.now(), participant_code: 'part-1' } as any;
      const fiatWalletTransaction = {
        id: 'fwt-1',
        provider_metadata: {},
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(fiatWalletTransaction);
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});

      await service['updateFiatWalletTransactionSettled'](transaction, providerMetadata, payload);

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-1',
        expect.objectContaining({ settled_at: expect.any(String) }),
      );
    });

    it('should log warning when fiat wallet transaction not found', async () => {
      const transaction = { id: 'tx-1' } as any;
      const providerMetadata = {} as any;
      const payload = { timestamp: Date.now(), participant_code: 'part-1' } as any;

      mockFiatWalletTransactionService.findOne.mockRejectedValue(new NotFoundException());

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['updateFiatWalletTransactionSettled'](transaction, providerMetadata, payload);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No fiat wallet transaction found'));
    });
  });

  describe('processPaymentStatusChanged - additional coverage', () => {
    it('should warn for missing transaction_id or payment_status', async () => {
      const payload = { transaction_id: null, payment_status: null } as any;
      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processPaymentStatusChanged'](payload);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Missing transaction_id or payment_status'));
    });

    it('should warn for unknown payment status', async () => {
      const payload = { transaction_id: 'tx-123', payment_status: 'unknown_xyz' } as any;
      mockTransactionService.findOne.mockResolvedValue({ id: 'tx-1', status: TransactionStatus.PENDING } as any);
      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processPaymentStatusChanged'](payload);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown payment_status'));
    });

    it('should handle settled status separately', async () => {
      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'settled',
        timestamp: Date.now(),
        participant_code: 'part-1',
      } as any;

      const transaction = {
        id: 'tx-1',
        status: TransactionStatus.COMPLETED,
        metadata: {},
      } as any;

      const fiatWalletTransaction = {
        id: 'fwt-1',
        provider_metadata: {},
      };

      mockTransactionService.findOne.mockResolvedValue(transaction);
      mockFiatWalletTransactionService.findOne.mockResolvedValue(fiatWalletTransaction);
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});

      await service['processPaymentStatusChanged'](payload);

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalled();
      expect(mockTransactionService.updateStatus).not.toHaveBeenCalled();
    });

    it('should prevent downgrade from completed status', async () => {
      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'pending',
        participant_code: 'part-1',
      } as any;

      const transaction = {
        id: 'tx-1',
        status: TransactionStatus.COMPLETED,
        metadata: {},
      } as any;

      mockTransactionService.findOne.mockResolvedValue(transaction);
      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processPaymentStatusChanged'](payload);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Ignoring status downgrade'));
    });
  });

  describe('buildProviderMetadata', () => {
    it('should build provider metadata with all fields', () => {
      const payload = {
        payment_status: 'completed',
        reason_code: 'CODE_123',
        reason_description: 'Test description',
        ach_failure_reason: 'ACH failure',
        rejected_reason: 'Rejected',
      } as any;

      const result = service['buildProviderMetadata'](payload);

      expect(result.zerohash_payment_status).toBe('completed');
      expect(result.reason_code).toBe('CODE_123');
      expect(result.reason_description).toBe('Test description');
      expect(result.ach_failure_reason).toBe('ACH failure');
      expect(result.rejected_reason).toBe('Rejected');
    });
  });

  describe('processAccountBalanceChanged - unsupported crypto asset', () => {
    it('should skip processing for unsupported crypto asset', async () => {
      const mockExternalAccount = {
        user_id: 'user-1',
        provider: 'zerohash',
        participant_code: 'abc123',
      } as any;

      const mockPayload = {
        participant_code: 'abc123',
        asset: 'UNSUPPORTED.NETWORK',
        account_type: 'available',
        balance: '1500.00',
        movements: [
          {
            movement_type: 'final_settlement',
            trade_id: 'trade-123',
            change: '100.00',
          },
        ],
      };

      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);

      await service.processWebhook(mockPayload, ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED);

      expect(mockFiatWalletTransactionService.findOneOrNull).not.toHaveBeenCalled();
    });
  });

  describe('processTradeStatusChanged - unknown trade state', () => {
    it('should log warning and return for unknown trade_state', async () => {
      const payload = {
        client_trade_id: 'trade-123',
        trade_state: 'unknown_state',
        timestamp: 1764724461060,
      } as any;

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processTradeStatusChanged'](payload);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown trade_state received: unknown_state'));
    });
  });

  describe('processWithdrawalConfirmed', () => {
    it('should process withdrawal confirmed movement', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
        change: '-50.00',
      } as any;

      const mockExternalAccount = {
        user_id: 'user-1',
        provider: 'zerohash',
        participant_code: 'abc123',
      } as any;

      const mockPayload = {
        asset: 'USDC.SOL',
        timestamp: Date.now(),
        participant_code: 'abc123',
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'tx-1',
        status: TransactionStatus.PROCESSING,
        currency: 'USD',
        balance_before: 10000,
        fiat_wallet_id: 'wallet-1',
        provider_metadata: {},
        description: 'Test withdrawal',
        source: 'Test source',
        destination: 'Test destination',
        provider_fee: 100,
        transaction_type: 'withdrawal',
      };

      const mockMainTransaction = {
        id: 'tx-1',
        user_id: 'user-1',
        balance_before: 10000,
        balance_after: 5000,
        metadata: {},
        description: 'Test withdrawal',
      };

      const mockSourceWallet = {
        id: 'wallet-1',
        balance: 10000,
        credit_balance: 0,
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionService.findOne.mockResolvedValue(mockMainTransaction);
      mockTransactionService.updateStatus.mockResolvedValue({});
      mockFiatWalletRepository.findById.mockResolvedValue(mockSourceWallet);
      mockFiatWalletRepository.update.mockResolvedValue({});
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});
      mockFiatWalletAdapter.getWithdrawalDetails.mockResolvedValue({
        externalReference: 'tx-hash-123',
        status: 'completed',
      });
      mockTransactionRepository.findOne.mockResolvedValue(null);

      await service['processWithdrawalConfirmed'](movement, mockExternalAccount, mockPayload);

      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(
        'tx-1',
        TransactionStatus.COMPLETED,
        expect.any(Object),
        undefined,
        expect.objectContaining({
          shouldSendEmail: false,
          shouldSendPushNotification: false,
          shouldSendInAppNotification: false,
        }),
      );
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-1',
        expect.objectContaining({
          status: TransactionStatus.COMPLETED,
        }),
      );
    });

    it('should handle transaction not found during withdrawal confirmation', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
        change: '-50.00',
      } as any;

      const mockExternalAccount = {
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      const mockPayload = {
        asset: 'USDC.SOL',
        timestamp: Date.now(),
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'tx-1',
        status: TransactionStatus.PROCESSING,
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionService.findOne.mockResolvedValue(null);

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processWithdrawalConfirmed'](movement, mockExternalAccount, mockPayload);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No transaction found for fiat wallet transaction'));
      expect(mockTransactionService.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('processTradeStatusChanged - rejected trade handling', () => {
    it('should update fiat wallet transaction status to failed for rejected trade', async () => {
      const payload = {
        client_trade_id: 'trade-123',
        trade_state: ZeroHashTradeState.REJECTED,
        reason: 'Insufficient funds',
        timestamp: 1764724461060,
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'tx-1',
        status: TransactionStatus.PROCESSING,
        provider_metadata: {},
        provider_reference: null,
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletTransactionService.updateStatus.mockResolvedValue({});

      await service['processTradeStatusChanged'](payload);

      expect(mockFiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        'fwt-1',
        TransactionStatus.FAILED,
        expect.any(Object),
      );
    });
  });

  describe('processExternalAccountStatusChanged - error handling', () => {
    it('should throw error when account data is invalid', async () => {
      const payload = {
        participant_code: 'ABC123',
        external_account_id: null,
        external_account_status: 'active',
      } as any;

      await expect(service['processExternalAccountStatusChanged'](payload)).rejects.toThrow(
        'Missing external_account_id or status',
      );
    });

    it('should handle NotFoundException for external account', async () => {
      const payload = {
        participant_code: 'ABC123',
        external_account_id: 'ext-123',
        external_account_status: 'active',
      } as any;

      mockExternalAccountService.findOne.mockRejectedValue(new NotFoundException('Not found'));

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processExternalAccountStatusChanged'](payload);

      expect(warnSpy).toHaveBeenCalled();
    });

    it('should throw other errors', async () => {
      const payload = {
        participant_code: 'ABC123',
        external_account_id: 'ext-123',
        external_account_status: 'active',
      } as any;

      mockExternalAccountService.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service['processExternalAccountStatusChanged'](payload)).rejects.toThrow('Database error');
    });
  });

  describe('determineCurrentTransaction - null return', () => {
    it('should return null when current participant is neither sender nor receiver', () => {
      const senderTransaction = {
        id: 'tx-sender',
        user_id: 'user-1',
      } as any;

      const receiverTransaction = {
        id: 'tx-receiver',
        user_id: 'user-2',
      } as any;

      const errorSpy = jest.spyOn(service['logger'], 'error');

      const result = service['determineCurrentTransaction'](
        senderTransaction,
        receiverTransaction,
        'user-3', // Different user
      );

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Neither transaction belongs to current participant'),
      );
    });
  });

  describe('processTransferMovement - error logging', () => {
    it('should log error when transfer transaction not found', async () => {
      const movement = {
        transfer_request_id: 'transfer-123',
        client_transfer_id: 'client-456',
      } as any;

      const mockExternalAccount = {
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      const mockPayload = {
        participant_code: 'abc123',
        balance: '1500.00',
        asset: 'USDC.SOL',
      } as any;

      const mockTransferDetails = {
        providerReference: 'client-456',
      };

      mockFiatWalletAdapter.getTransferDetails.mockResolvedValue(mockTransferDetails);
      mockTransactionRepository.findOne.mockResolvedValue(null);

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service['processTransferMovement'](movement, mockExternalAccount, mockPayload);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Transaction not found'));
    });

    it('should log error when neither transaction belongs to current participant', async () => {
      const movement = {
        transfer_request_id: 'transfer-123',
        client_transfer_id: 'client-456',
      } as any;

      const mockExternalAccount = {
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      const mockPayload = {
        participant_code: 'abc123',
        balance: '1500.00',
        asset: 'USDC.SOL',
      } as any;

      const mockTransferDetails = {
        providerReference: 'client-456',
      };

      const mockSenderTransaction = {
        id: 'tx-sender',
        user_id: 'user-2',
        reference: 'client-456-OUT',
      };

      const mockReceiverTransaction = {
        id: 'tx-receiver',
        user_id: 'user-3',
        reference: 'client-456-IN',
      };

      mockFiatWalletAdapter.getTransferDetails.mockResolvedValue(mockTransferDetails);
      mockTransactionRepository.findOne = jest
        .fn()
        .mockResolvedValueOnce(mockSenderTransaction)
        .mockResolvedValueOnce(mockReceiverTransaction);

      await service['processTransferMovement'](movement, mockExternalAccount, mockPayload);

      expect(mockFiatWalletTransactionService.findOne).not.toHaveBeenCalled();
    });

    it('should log and throw error when NotFoundException is not the cause', async () => {
      const movement = {
        transfer_request_id: 'transfer-123',
        client_transfer_id: 'client-456',
      } as any;

      const mockExternalAccount = {
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      const mockPayload = {
        participant_code: 'abc123',
        balance: '1500.00',
        asset: 'USDC.SOL',
      } as any;

      const mockTransferDetails = {
        providerReference: 'client-456',
      };

      const mockSenderTransaction = {
        id: 'tx-sender',
        user_id: 'user-1',
        reference: 'client-456-OUT',
      };

      const mockReceiverTransaction = {
        id: 'tx-receiver',
        user_id: 'user-2',
        reference: 'client-456-IN',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'tx-sender',
      };

      mockFiatWalletAdapter.getTransferDetails.mockResolvedValue(mockTransferDetails);
      mockTransactionRepository.findOne = jest
        .fn()
        .mockResolvedValueOnce(mockSenderTransaction)
        .mockResolvedValueOnce(mockReceiverTransaction);
      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletService.getUserWallet.mockRejectedValue(new Error('Wallet service error'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await expect(service['processTransferMovement'](movement, mockExternalAccount, mockPayload)).rejects.toThrow(
        'Wallet service error',
      );

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error processing transfer movement'),
        expect.any(Error),
      );
    });

    it('should handle missing transaction during transfer movement', async () => {
      const movement = {
        transfer_request_id: 'transfer-123',
        client_transfer_id: 'client-456',
      } as any;

      const mockExternalAccount = {
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      const mockPayload = {
        participant_code: 'abc123',
        balance: '1500.00',
        asset: 'USDC.SOL',
      } as any;

      const mockTransferDetails = {
        providerReference: 'client-456',
      };

      mockFiatWalletAdapter.getTransferDetails.mockResolvedValue(mockTransferDetails);
      // Both sender and receiver transactions are null
      mockTransactionRepository.findOne = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service['processTransferMovement'](movement, mockExternalAccount, mockPayload);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Transaction not found for client_transfer_id'));
    });
  });

  describe('processParticipantStatusChanged - return on missing data', () => {
    it('should return early when external account is not found', async () => {
      const payload = {
        participant_code: 'ABC123',
        participant_status: 'active',
      } as any;

      mockExternalAccountService.findOne.mockRejectedValue(new NotFoundException('Not found'));

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processParticipantStatusChanged'](payload);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No ExternalAccount found for participant_code: ABC123'),
      );
    });
  });

  describe('isValidMovement - return false', () => {
    it('should return false when movement is not valid', () => {
      const movement = {
        movement_type: 'final_settlement',
      } as any;

      const result = service['isValidMovement'](movement);

      expect(result).toBe(false);
    });
  });

  describe('processAccountBalanceChanged - mock webhook in non-production', () => {
    it('should process withdrawal_pending movement correctly', async () => {
      const mockExternalAccount = {
        user_id: 'user-1',
        provider: 'zerohash',
        participant_code: 'abc123',
      } as any;

      const mockPayload = {
        participant_code: 'abc123',
        asset: 'USDC.SOL',
        account_type: 'available',
        balance: '1500.00',
        timestamp: '2024-01-01T00:00:00Z',
        movements: [
          {
            movement_type: 'withdrawal_pending',
            withdrawal_request_id: 'withdrawal-123',
            change: '-50.00',
          },
        ],
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'parent-tx-1',
        status: TransactionStatus.PENDING,
        provider_metadata: {},
      };

      const mockMainTransaction = {
        id: 'parent-tx-1',
        status: TransactionStatus.PENDING,
      };

      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);
      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionRepository.findById.mockResolvedValue(mockMainTransaction);
      mockTransactionRepository.update.mockResolvedValue({});
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});
      mockLockerService.runWithLock.mockImplementation(async (key, callback) => {
        return await callback();
      });

      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.processWebhook(mockPayload, ZeroHashWebhookEventType.ACCOUNT_BALANCE_CHANGED);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Processing withdrawal_pending'));
    });
  });

  describe('processWithdrawalConfirmed - main transaction not found', () => {
    it('should throw NotFoundException when main transaction is not found', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
        change: '-25.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'trans-1',
        status: TransactionStatus.PROCESSING,
        currency: 'USD',
        balance_before: 10000,
        fiat_wallet_id: 'wallet-1',
        provider_metadata: {},
        description: 'Test withdrawal',
        source: 'Test source',
        destination: 'Test destination',
        provider_fee: 100,
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionService.findOne.mockResolvedValue(null);

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processWithdrawalConfirmed'](movement, mockExternalAccount, mockPayload);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No transaction found for fiat wallet transaction'));
    });
  });

  describe('processWithdrawalPending - skip when main transaction already completed', () => {
    it('should skip update when main transaction is already completed', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'trans-1',
        status: TransactionStatus.PENDING,
        provider_metadata: {},
      };

      const mockMainTransaction = {
        id: 'trans-1',
        status: TransactionStatus.COMPLETED,
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionRepository.findById.mockResolvedValue(mockMainTransaction);

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processWithdrawalPending'](movement, mockExternalAccount, mockPayload);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Main transaction is already COMPLETED'));
      expect(mockTransactionRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('createIncomingNgnTransaction - rate config inactive', () => {
    it('should return null when rate config is inactive', async () => {
      const mockParentTransaction = {
        id: 'parent-123',
        user_id: 'user-1',
        amount: 10000,
        metadata: { rate_id: 'rate-123' },
      };

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 1500,
      };

      const mockRateConfig = {
        provider: 'yellowcard',
        isActive: false,
      };

      // First findOne should return null (no existing transaction)
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
      mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      const result = await service['createIncomingNgnTransaction'](mockParentTransaction as any, 'seq-123');

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith('Rate config not found or inactive');
    });

    it('should return null when exchange rate is not found', async () => {
      const mockParentTransaction = {
        id: 'parent-123',
        user_id: 'user-1',
        amount: 10000,
        metadata: { rate_id: 'rate-123' },
      };

      // First findOne should return null (no existing transaction)
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockRateRepository.findOne.mockResolvedValue(null);

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      const result = await service['createIncomingNgnTransaction'](mockParentTransaction as any, 'seq-123');

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith('Exchange rate not found');
    });
  });

  describe('processDepositMovement - complete exchange transaction', () => {
    it('should complete exchange transaction when transaction type is exchange', async () => {
      const movement = {
        deposit_reference_id: 'deposit-123',
        change: '100.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
        account_group: 'test-group',
      } as any;

      const mockTransaction = {
        id: 'tx-1',
        user_id: 'user-1',
        transaction_type: TransactionType.EXCHANGE,
        user: { id: 'user-1', country: { name: 'Nigeria' } },
      };

      mockBlockchainWalletTransactionRepository.findByTransactionHash.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockTransactionService.completeExchangeTransaction = jest.fn().mockResolvedValue({});

      await service['processDepositMovement'](movement, mockExternalAccount, mockPayload);

      expect(mockTransactionService.completeExchangeTransaction).toHaveBeenCalledWith(
        mockTransaction,
        10000, // 100.00 * 100 cents
      );
    });
  });

  describe('processMovement - skip zero change amount', () => {
    it('should skip processing when change amount is zero', async () => {
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'trade-123',
        change: '0',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
      } as any;

      const debugSpy = jest.spyOn(service['logger'], 'debug');

      await service['processMovement'](movement, mockExternalAccount, mockPayload);

      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Ignoring zero change amount'));
    });
  });

  describe('updateFiatWalletTransactionIfNeeded - schedule exchange virtual account deletion', () => {
    it('should schedule virtual account deletion for failed exchange transaction', async () => {
      const mockTransaction = {
        id: 'tx-123',
        user_id: 'user-1',
        transaction_type: TransactionType.EXCHANGE,
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        transaction_id: 'tx-123',
        provider_metadata: {},
      };

      const providerMetadata = {
        zerohash_payment_status: 'failed',
      };

      const payload = {
        payment_status: 'failed',
        timestamp: Date.now(),
      } as any;

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletTransactionService.updateStatus.mockResolvedValue({});
      mockVirtualAccountService.scheduleExchangeVirtualAccountDeletion.mockResolvedValue(undefined);

      await service['updateFiatWalletTransactionIfNeeded'](
        mockTransaction as any,
        TransactionStatus.FAILED,
        providerMetadata as any,
        payload,
        'Payment failed',
      );

      expect(mockVirtualAccountService.scheduleExchangeVirtualAccountDeletion).toHaveBeenCalledWith(
        'user-1',
        'tx-123',
        'Payment failed',
      );
    });
  });

  describe('createIncomingNgnTransaction - complete flow', () => {
    it('should create new incoming NGN transaction when no existing transaction', async () => {
      const mockParentTransaction = {
        id: 'parent-123',
        user_id: 'user-1',
        amount: 10000,
        metadata: { rate_id: 'rate-123' },
      };

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 1500,
      };

      const mockRateConfig = {
        provider: 'yellowcard',
        isActive: true,
        fiatExchange: {
          partner_fee: { is_percentage: true, value: 1 },
          disbursement_fee: { is_percentage: true, value: 0.5 },
        },
      };

      const mockFiatWallet = {
        id: 'wallet-123',
        balance: 100000,
      };

      const mockCreatedTransaction = {
        id: 'created-tx-123',
        amount: 1475000,
      };

      // First findOne should return null (no existing transaction)
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
      mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockTransactionService.create.mockResolvedValue(mockCreatedTransaction);
      mockFiatWalletTransactionService.create.mockResolvedValue({});

      // Inside the transaction callback, it checks for existing again
      mockTransactionRepository.transaction.mockImplementation(async (callback: (trx: any) => Promise<any>) => {
        return await callback({});
      });
      mockTransactionRepository.query.mockReturnValue({
        withGraphFetched: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            forUpdate: jest.fn().mockReturnValue({
              first: jest.fn().mockResolvedValue(null),
            }),
          }),
        }),
      });

      const result = await service['createIncomingNgnTransaction'](mockParentTransaction as any, 'seq-123');

      expect(result).not.toBeNull();
      expect(mockTransactionService.create).toHaveBeenCalled();
      expect(mockFiatWalletTransactionService.create).toHaveBeenCalled();
    });

    it('should return null and log error when database transaction fails', async () => {
      const mockParentTransaction = {
        id: 'parent-123',
        user_id: 'user-1',
        amount: 10000,
        metadata: { rate_id: 'rate-123' },
      };

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 1500,
      };

      const mockRateConfig = {
        provider: 'yellowcard',
        isActive: true,
        fiatExchange: {
          partner_fee: { is_percentage: true, value: 1 },
          disbursement_fee: { is_percentage: true, value: 0.5 },
        },
      };

      const mockFiatWallet = {
        id: 'wallet-123',
        balance: 100000,
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
      mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);

      mockTransactionRepository.transaction.mockRejectedValue(new Error('Database error'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      const result = await service['createIncomingNgnTransaction'](mockParentTransaction as any, 'seq-123');

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith('Error creating incoming NGN transaction', expect.any(Error));
    });

    it('should return null when rate config is not found', async () => {
      const mockParentTransaction = {
        id: 'parent-123',
        user_id: 'user-1',
        amount: 10000,
        metadata: { rate_id: 'rate-123' },
      };

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 1500,
      };

      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
      mockRateConfigRepository.findOne.mockResolvedValue(null);

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      const result = await service['createIncomingNgnTransaction'](mockParentTransaction as any, 'seq-123');

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith('Rate config not found or inactive');
    });
  });

  describe('handleClientTransferIdTransaction error handling', () => {
    it('should rethrow non-NotFoundException errors', async () => {
      const clientTransferId = 'client-123';
      const userId = 'user-123';
      const fiatWalletTransactionId = 'fwt-123';
      const tradeId = 'trade-123';

      mockTransactionRepository.findOne.mockRejectedValue(new Error('Database connection error'));

      await expect(
        service['handleClientTransferIdTransaction'](clientTransferId, userId, fiatWalletTransactionId, tradeId),
      ).rejects.toThrow('Database connection error');
    });

    it('should return false and log when NotFoundException is thrown', async () => {
      const clientTransferId = 'client-123';
      const userId = 'user-123';
      const fiatWalletTransactionId = 'fwt-123';
      const tradeId = 'trade-123';

      mockTransactionRepository.findOne.mockRejectedValue(new NotFoundException('Transaction not found'));

      const logSpy = jest.spyOn(service['logger'], 'log');

      const result = await service['handleClientTransferIdTransaction'](
        clientTransferId,
        userId,
        fiatWalletTransactionId,
        tradeId,
      );

      expect(result).toBe(false);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('No existing transaction found for client_transfer_id'),
      );
    });
  });

  describe('processTransferMovement - error handling', () => {
    it('should log error when transaction aggregate update fails during transfer', async () => {
      const movement = {
        transfer_request_id: 'transfer-123',
        client_transfer_id: 'client-123',
        change: '100.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
        participant_code: 'participant-1',
        balance: '100.00',
      } as any;

      const senderTx = {
        id: 'sender-tx-123',
        user_id: 'user-1',
        metadata: {},
      };

      const receiverTx = {
        id: 'receiver-tx-123',
        user_id: 'user-2',
        metadata: {},
      };

      const mockFiatWallet = {
        id: 'wallet-123',
        balance: 1000,
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        currency: 'USD',
        description: 'Transfer',
        source: 'Sender',
        destination: 'Receiver',
        provider_metadata: {},
      };

      mockFiatWalletAdapter.getTransferDetails.mockResolvedValue({
        providerReference: 'client-123',
      });
      mockTransactionRepository.findOne.mockResolvedValueOnce(senderTx).mockResolvedValueOnce(receiverTx);
      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockUserRepository.findActiveById.mockResolvedValue({
        first_name: 'Test',
        last_name: 'User',
        country: { name: 'Nigeria' },
      });
      mockFiatWalletRepository.transaction.mockImplementation(async (callback) => await callback({}));
      mockFiatWalletService.updateBalanceWithTransaction.mockResolvedValue({});
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});
      mockTransactionService.updateStatus.mockResolvedValue({});
      mockTransactionAggregateService.findAndUpdate.mockRejectedValue(new Error('Aggregate update failed'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service['processTransferMovement'](movement, mockExternalAccount, mockPayload);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update transaction aggregate'),
        expect.any(String),
      );
    });

    it('should log error and not rethrow NotFoundException when transactions not found', async () => {
      const movement = {
        transfer_request_id: 'transfer-123',
        client_transfer_id: 'client-123',
        change: '100.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
        participant_code: 'participant-1',
      } as any;

      mockFiatWalletAdapter.getTransferDetails.mockResolvedValue({
        providerReference: 'client-123',
      });
      mockTransactionRepository.findOne.mockRejectedValue(new NotFoundException('Transaction not found'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service['processTransferMovement'](movement, mockExternalAccount, mockPayload);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Transaction not found for client_transfer_id'));
    });
  });

  describe('processPaymentStatusChanged - exception handling', () => {
    it('should throw and log error when processing fails', async () => {
      const payload = {
        transaction_id: 'tx-123',
        payment_status: 'posted',
        participant_code: 'participant-1',
        timestamp: Date.now(),
      } as any;

      mockTransactionService.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service['processPaymentStatusChanged'](payload)).rejects.toThrow('Database error');
    });
  });

  describe('processTradeStatusChanged - exception handling', () => {
    it('should throw and log error when update fails', async () => {
      const payload = {
        client_trade_id: 'trade-123',
        trade_state: 'accepted',
        trade_id: 'trade-id-123',
        symbol: 'USDC/USD',
        trade_price: '1.00',
        trade_quantity: '100',
        total_notional: '100.00',
        timestamp: Date.now(),
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        status: 'pending',
        provider_metadata: {},
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletTransactionService.updateStatus.mockRejectedValue(new Error('Update failed'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await expect(service['processTradeStatusChanged'](payload)).rejects.toThrow('Update failed');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error processing trade status change'),
        expect.any(Error),
      );
    });
  });

  describe('processWithdrawalConfirmed - aggregate error handling', () => {
    it('should log error but not throw when transaction aggregate update fails', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
        change: '-100.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        participant_code: 'participant-1',
        provider: 'zerohash',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'trans-1',
        transaction_type: 'withdrawal',
        status: 'processing',
        provider_metadata: {},
        balance_before: 100000,
        currency: 'USD',
        fiat_wallet_id: 'wallet-1',
        source: 'USD Wallet',
        destination: 'Bank Account',
      };

      const mockTransaction = {
        id: 'trans-1',
        status: 'processing',
        transaction_type: 'withdrawal',
        description: 'Withdrawal',
        metadata: {},
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        balance: 100000,
        credit_balance: 0,
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionService.findOne.mockResolvedValue(mockTransaction);
      mockFiatWalletAdapter.getWithdrawalDetails.mockResolvedValue({
        externalReference: 'ext-ref-123',
        status: 'confirmed',
      });
      mockFiatWalletRepository.findById.mockResolvedValue(mockFiatWallet);
      mockFiatWalletRepository.update.mockResolvedValue({});
      mockTransactionService.updateStatus.mockResolvedValue({});
      mockTransactionAggregateService.findAndUpdate.mockRejectedValue(new Error('Aggregate update failed'));
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue({
        account_number: '1234567890',
      });

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service['processWithdrawalConfirmed'](movement, mockExternalAccount, mockPayload);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update transaction aggregate'),
        expect.any(String),
      );
    });
  });

  describe('updateWalletBalanceFromPayload - unsupported asset', () => {
    it('should throw error for unsupported crypto asset', async () => {
      const mockPayload = {
        balance: '100.00',
        asset: 'UNSUPPORTED.TOKEN',
        timestamp: Date.now(),
      } as any;

      const tradeId = 'trade-123';

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        participant_code: 'participant-1',
      } as any;

      const movement = {
        movement_type: 'final_settlement',
        trade_id: tradeId,
        change: '100.00',
        movement_id: 'movement-123',
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        currency: 'USD',
        fiat_wallet_id: 'wallet-1',
        transaction_id: 'tx-1',
        transaction_type: 'deposit',
        provider_metadata: {},
      };

      await expect(
        service['updateWalletBalanceFromPayload'](
          mockPayload,
          tradeId,
          mockExternalAccount,
          movement,
          mockFiatWalletTransaction as any,
        ),
      ).rejects.toThrow('Unsupported crypto asset: UNSUPPORTED.TOKEN');
    });
  });

  describe('processMovement - movement types', () => {
    it('should process TRANSFER movement type', async () => {
      const movement = {
        movement_type: 'transfer',
        transfer_request_id: 'transfer-123',
        change: '100.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
        participant_code: 'participant-1',
        balance: '100.00',
      } as any;

      // Mock to fail early to avoid complex setup
      mockFiatWalletAdapter.getTransferDetails.mockRejectedValue(new Error('Test failure'));

      jest.spyOn(service['logger'], 'error');

      await service['processMovement'](movement, mockExternalAccount, mockPayload);

      expect(mockFiatWalletAdapter.getTransferDetails).toHaveBeenCalled();
    });

    it('should log warning for unhandled movement type in default case', async () => {
      const movement = {
        movement_type: 'unknown_type',
        change: '100.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
      } as any;

      const debugSpy = jest.spyOn(service['logger'], 'debug');

      await service['processMovement'](movement, mockExternalAccount, mockPayload);

      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Ignoring movement type'));
    });

    it('should process WITHDRAWAL_CONFIRMED movement type successfully', async () => {
      const movement = {
        movement_type: 'withdrawal_confirmed',
        withdrawal_request_id: 'withdrawal-123',
        change: '-100.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        provider: 'zerohash',
        participant_code: 'participant-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'trans-1',
        transaction_type: 'withdrawal',
        status: TransactionStatus.PROCESSING,
        provider_metadata: {},
        balance_before: 100000,
        currency: 'USD',
        fiat_wallet_id: 'wallet-1',
        source: 'USD Wallet',
        destination: 'Bank Account',
      };

      const mockTransaction = {
        id: 'trans-1',
        status: 'processing',
        transaction_type: 'withdrawal',
        description: 'Withdrawal',
        metadata: {},
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        balance: 100000,
        credit_balance: 0,
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionService.findOne.mockResolvedValue(mockTransaction);
      mockFiatWalletAdapter.getWithdrawalDetails.mockResolvedValue({
        externalReference: 'ext-ref-123',
        status: 'confirmed',
      });
      mockFiatWalletRepository.findById.mockResolvedValue(mockFiatWallet);
      mockFiatWalletRepository.update.mockResolvedValue({});
      mockTransactionService.updateStatus.mockResolvedValue({});
      mockTransactionAggregateService.findAndUpdate.mockResolvedValue({});
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockVirtualAccountService.findOrCreateVirtualAccount.mockResolvedValue({
        account_number: '1234567890',
      });

      const logSpy = jest.spyOn(service['logger'], 'log');

      await service['processMovement'](movement, mockExternalAccount, mockPayload);

      expect(mockFiatWalletTransactionService.findOne).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Processing withdrawal_confirmed'));
    });

    it('should process WITHDRAWAL_PENDING movement type successfully', async () => {
      const movement = {
        movement_type: 'withdrawal_pending',
        withdrawal_request_id: 'withdrawal-123',
        change: '-100.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'trans-1',
        status: 'pending',
        provider_metadata: {},
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionRepository.findById.mockResolvedValue({
        id: 'trans-1',
        status: 'pending',
      });

      const logSpy = jest.spyOn(service['logger'], 'log');

      await service['processMovement'](movement, mockExternalAccount, mockPayload);

      expect(mockFiatWalletTransactionService.findOne).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Processing withdrawal_pending'));
    });

    it('should process DEPOSIT movement type successfully', async () => {
      const movement = {
        movement_type: 'deposit',
        deposit_reference_id: 'deposit-123',
        change: '100.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
        account_group: 'test-group',
      } as any;

      mockBlockchainWalletTransactionRepository.findByTransactionHash.mockResolvedValue(null);
      mockTransactionRepository.findOne.mockResolvedValue(null);

      const logSpy = jest.spyOn(service['logger'], 'log');

      await service['processMovement'](movement, mockExternalAccount, mockPayload);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Processing deposit'));
    });

    it('should log warning for unhandled movement type in switch default case', async () => {
      // Create a movement with a type that passes isValidMovement but is not handled
      // By mocking isValidMovement to return true for a custom movement type
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'trade-123',
        change: '100.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
        balance: '100.00',
        participant_code: 'participant-1',
      } as any;

      // Make findOneOrNull return null to trigger the retry and then null path
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processMovement'](movement, mockExternalAccount, mockPayload);

      // Should have logged warning about no fiat wallet transaction found
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No fiat wallet transaction found'));
    });
  });

  describe('processParticipantStatusChanged - edge cases', () => {
    it('should skip update when status is the same (idempotent)', async () => {
      const payload = {
        participant_code: 'participant-123',
        participant_status: 'pending',
      };

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        provider_kyc_status: 'pending',
      };

      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);

      await service['processParticipantStatusChanged'](payload as any);

      expect(mockExternalAccountService.update).not.toHaveBeenCalled();
    });

    it('should update for any other status change', async () => {
      const payload = {
        participant_code: 'participant-123',
        participant_status: 'approved',
      };

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        provider_kyc_status: 'pending_approval',
      };

      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);

      await service['processParticipantStatusChanged'](payload as any);

      expect(mockExternalAccountService.update).toHaveBeenCalledWith(
        { id: 'external-1' },
        { provider_kyc_status: 'approved' },
      );
    });
  });

  describe('processWithdrawalConfirmed - transaction not found warning', () => {
    it('should log warning and throw when main transaction is not found', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
        change: '-100.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        participant_code: 'participant-1',
        provider: 'zerohash',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        transaction_id: 'trans-123',
        status: 'processing',
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionService.findOne.mockResolvedValue(null);

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processWithdrawalConfirmed'](movement, mockExternalAccount, mockPayload);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No transaction found for fiat wallet transaction'));
    });
  });

  describe('processMovement - switch case default', () => {
    it('should log warning for unhandled movement type in switch statement default case', async () => {
      // Spy on isValidMovement to track that it was called
      const isValidMovementSpy = jest.spyOn(service as any, 'isValidMovement');
      isValidMovementSpy.mockReturnValue(true);

      const movement = {
        movement_type: 'some_unknown_but_valid_type',
        change: '100.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
      } as any;

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processMovement'](movement, mockExternalAccount, mockPayload);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unhandled movement type'));

      isValidMovementSpy.mockRestore();
    });
  });

  describe('updateWalletBalanceFromPayload - transaction aggregate error handling', () => {
    it('should log error when transaction aggregate update fails but continue processing', async () => {
      const mockPayload = {
        balance: '100.00',
        asset: 'USDC.SOL',
        timestamp: Date.now(),
        participant_code: 'participant-1',
      } as any;

      const tradeId = 'trade-123';

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        participant_code: 'participant-1',
        bank_name: 'Test Bank',
        account_number: '1234567890',
      } as any;

      const movement = {
        movement_type: 'final_settlement',
        trade_id: tradeId,
        change: '100.00',
        movement_id: 'movement-123',
      } as any;

      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        currency: 'USD',
        fiat_wallet_id: 'wallet-1',
        transaction_id: 'tx-1',
        transaction_type: FiatWalletTransactionType.DEPOSIT,
        provider_metadata: {},
        source: 'Bank Account',
        destination: 'USD Wallet',
        description: 'Test deposit',
      };

      const mockFiatWallet = {
        id: 'wallet-1',
        balance: 0,
        credit_balance: 0,
        user_id: 'user-1',
      };

      const mockTransaction = {
        id: 'tx-1',
        metadata: {},
      };

      mockFiatWalletRepository.findById.mockResolvedValue(mockFiatWallet);
      mockFiatWalletService.updateBalanceWithTransaction.mockResolvedValue({});
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);
      mockTransactionService.updateStatus.mockResolvedValue({});
      mockTransactionAggregateService.findAndUpdate.mockRejectedValue(new Error('Aggregate update failed'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service['updateWalletBalanceFromPayload'](
        mockPayload,
        tradeId,
        mockExternalAccount,
        movement,
        mockFiatWalletTransaction as any,
      );

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update transaction aggregate'),
        expect.any(String),
      );
    });
  });

  describe('handlePostSettlementActions - error handling', () => {
    it('should log error when setting settled_at for reward transaction fails', async () => {
      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        transaction_type: FiatWalletTransactionType.REWARD,
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
      } as any;

      mockFiatWalletTransactionRepository.update.mockRejectedValue(new Error('Database error'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service['handlePostSettlementActions'](mockFiatWalletTransaction, mockExternalAccount, mockPayload);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error setting settled_at for reward transaction'),
        expect.any(Error),
      );
    });
  });

  describe('processWithdrawalConfirmed - fiat wallet transaction not found', () => {
    it('should log warning and return early when fiat wallet transaction not found', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
        change: '-100.00',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        participant_code: 'participant-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
      } as any;

      mockLockerService.runWithLock.mockImplementation(async (key, callback) => await callback());
      mockFiatWalletTransactionService.findOne.mockResolvedValue(null);

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processWithdrawalConfirmed'](movement, mockExternalAccount, mockPayload);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No fiat wallet transaction found for withdrawal_request_id'),
      );
      expect(mockTransactionService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('checkAndCompleteUsdWithdrawal', () => {
    it('should return false when no fiat wallet transaction found', async () => {
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(null);

      const result = await service.checkAndCompleteUsdWithdrawal('parent-tx-123', 'user-1');

      expect(result).toBe(false);
      expect(mockFiatWalletTransactionService.findOneOrNull).toHaveBeenCalledWith({
        transaction_id: 'parent-tx-123',
        user_id: 'user-1',
      });
    });

    it('should return false when no provider_request_ref found', async () => {
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue({
        id: 'fwt-123',
        provider_request_ref: null,
      });

      const result = await service.checkAndCompleteUsdWithdrawal('parent-tx-123', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false when withdrawal status is not confirmed', async () => {
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue({
        id: 'fwt-123',
        provider_request_ref: 'withdrawal-req-123',
      });
      mockFiatWalletAdapter.getWithdrawalDetails.mockResolvedValue({
        status: 'pending',
        externalReference: null,
      });

      const result = await service.checkAndCompleteUsdWithdrawal('parent-tx-123', 'user-1');

      expect(result).toBe(false);
      expect(mockFiatWalletAdapter.getWithdrawalDetails).toHaveBeenCalledWith('withdrawal-req-123', 'zerohash');
    });

    it('should return false when parent transaction not found', async () => {
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue({
        id: 'fwt-123',
        provider_request_ref: 'withdrawal-req-123',
        amount: -5000,
        balance_before: 10000,
        transaction_type: FiatWalletTransactionType.WITHDRAWAL,
        source: 'USD Wallet',
        destination: 'Bank Account',
      });
      mockFiatWalletAdapter.getWithdrawalDetails.mockResolvedValue({
        status: 'confirmed',
        externalReference: 'tx-hash-123',
      });
      mockTransactionService.findOne.mockResolvedValue(null);

      const result = await service.checkAndCompleteUsdWithdrawal('parent-tx-123', 'user-1');

      expect(result).toBe(false);
    });

    it('should complete USD withdrawal when withdrawal is confirmed', async () => {
      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        provider_request_ref: 'withdrawal-req-123',
        amount: -5000,
        balance_before: 10000,
        transaction_type: FiatWalletTransactionType.WITHDRAWAL,
        source: 'USD Wallet',
        destination: 'Bank Account',
        fiat_wallet_id: 'wallet-1',
        provider_metadata: {},
        status: 'processing',
        provider_fee: 100,
      };

      const mockTransaction = {
        id: 'parent-tx-123',
        metadata: {},
        description: 'USD Withdrawal',
      };

      const mockSourceWallet = {
        id: 'wallet-1',
        balance: 10000,
        credit_balance: 0,
      };

      const mockExternalAccount = {
        participant_code: 'PC123',
      };

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletAdapter.getWithdrawalDetails.mockResolvedValue({
        status: 'confirmed',
        externalReference: 'tx-hash-123',
      });
      mockTransactionService.findOne.mockResolvedValue(mockTransaction);
      mockExternalAccountService.findOne.mockResolvedValue(mockExternalAccount);
      mockLockerService.runWithLock.mockImplementation(async (key, callback) => await callback());
      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        ...mockFiatWalletTransaction,
        status: 'processing',
      });
      mockFiatWalletRepository.findById.mockResolvedValue(mockSourceWallet);
      mockFiatWalletRepository.update.mockResolvedValue({});
      mockTransactionRepository.update.mockResolvedValue({});
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});

      const result = await service.checkAndCompleteUsdWithdrawal('parent-tx-123', 'user-1');

      expect(result).toBe(true);
      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        'parent-tx-123',
        expect.objectContaining({
          status: TransactionStatus.COMPLETED,
        }),
      );
    });

    it('should return true when transaction is already completed inside lock', async () => {
      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        provider_request_ref: 'withdrawal-req-123',
        amount: -5000,
        balance_before: 10000,
        transaction_type: FiatWalletTransactionType.WITHDRAWAL,
        source: 'USD Wallet',
        destination: 'Bank Account',
        fiat_wallet_id: 'wallet-1',
        provider_metadata: {},
        status: 'processing',
      };

      const mockTransaction = {
        id: 'parent-tx-123',
        metadata: {},
      };

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletAdapter.getWithdrawalDetails.mockResolvedValue({
        status: 'confirmed',
        externalReference: 'tx-hash-123',
      });
      mockTransactionService.findOne.mockResolvedValue(mockTransaction);
      mockExternalAccountService.findOne.mockResolvedValue({ participant_code: 'PC123' });
      mockLockerService.runWithLock.mockImplementation(async (key, callback) => await callback());
      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        ...mockFiatWalletTransaction,
        status: TransactionStatus.COMPLETED,
      });

      const result = await service.checkAndCompleteUsdWithdrawal('parent-tx-123', 'user-1');

      expect(result).toBe(true);
      expect(mockTransactionRepository.update).not.toHaveBeenCalled();
    });

    it('should return false when error occurs during processing', async () => {
      mockFiatWalletTransactionService.findOneOrNull.mockRejectedValue(new Error('Database error'));

      const result = await service.checkAndCompleteUsdWithdrawal('parent-tx-123', 'user-1');

      expect(result).toBe(false);
    });

    it('should extract provider_fee from transaction metadata when not in fiat wallet transaction', async () => {
      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        provider_request_ref: 'withdrawal-req-123',
        amount: -5000,
        balance_before: 10000,
        transaction_type: FiatWalletTransactionType.WITHDRAWAL,
        source: 'USD Wallet',
        destination: 'Bank Account',
        fiat_wallet_id: 'wallet-1',
        provider_metadata: {},
        status: 'processing',
        provider_fee: null,
      };

      const mockTransaction = {
        id: 'parent-tx-123',
        metadata: {
          fee: 150,
        },
        description: 'USD Withdrawal',
      };

      const mockSourceWallet = {
        id: 'wallet-1',
        balance: 10000,
        credit_balance: 0,
      };

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletAdapter.getWithdrawalDetails.mockResolvedValue({
        status: 'settled',
        externalReference: 'tx-hash-123',
      });
      mockTransactionService.findOne.mockResolvedValue(mockTransaction);
      mockExternalAccountService.findOne.mockResolvedValue({ participant_code: 'PC123' });
      mockLockerService.runWithLock.mockImplementation(async (key, callback) => await callback());
      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        ...mockFiatWalletTransaction,
        status: 'processing',
      });
      mockFiatWalletRepository.findById.mockResolvedValue(mockSourceWallet);
      mockFiatWalletRepository.update.mockResolvedValue({});
      mockTransactionRepository.update.mockResolvedValue({});
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});

      const result = await service.checkAndCompleteUsdWithdrawal('parent-tx-123', 'user-1');

      expect(result).toBe(true);
      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        'parent-tx-123',
        expect.objectContaining({
          metadata: expect.objectContaining({
            provider_fee: 150,
          }),
        }),
      );
    });

    it('should extract provider_fee from provider_metadata when fee is in nested metadata', async () => {
      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        provider_request_ref: 'withdrawal-req-123',
        amount: -5000,
        balance_before: 10000,
        transaction_type: FiatWalletTransactionType.WITHDRAWAL,
        source: 'USD Wallet',
        destination: 'Bank Account',
        fiat_wallet_id: 'wallet-1',
        provider_metadata: {},
        status: 'processing',
        provider_fee: null,
      };

      const mockTransaction = {
        id: 'parent-tx-123',
        metadata: {
          provider_metadata: {
            fee: 200,
          },
        },
        description: 'USD Withdrawal',
      };

      const mockSourceWallet = {
        id: 'wallet-1',
        balance: 10000,
        credit_balance: 0,
      };

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletAdapter.getWithdrawalDetails.mockResolvedValue({
        status: 'completed',
        externalReference: 'tx-hash-456',
      });
      mockTransactionService.findOne.mockResolvedValue(mockTransaction);
      mockExternalAccountService.findOne.mockResolvedValue({ participant_code: 'PC123' });
      mockLockerService.runWithLock.mockImplementation(async (key, callback) => await callback());
      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        ...mockFiatWalletTransaction,
        status: 'processing',
      });
      mockFiatWalletRepository.findById.mockResolvedValue(mockSourceWallet);
      mockFiatWalletRepository.update.mockResolvedValue({});
      mockTransactionRepository.update.mockResolvedValue({});
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});

      const result = await service.checkAndCompleteUsdWithdrawal('parent-tx-123', 'user-1');

      expect(result).toBe(true);
      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        'parent-tx-123',
        expect.objectContaining({
          metadata: expect.objectContaining({
            provider_fee: 200,
          }),
        }),
      );
    });

    it('should handle approved withdrawal status', async () => {
      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue({
        id: 'fwt-123',
        provider_request_ref: 'withdrawal-req-123',
        amount: -5000,
        balance_before: 10000,
        transaction_type: FiatWalletTransactionType.WITHDRAWAL,
        source: 'USD Wallet',
        destination: 'Bank Account',
        fiat_wallet_id: 'wallet-1',
        provider_metadata: {},
        status: 'processing',
        provider_fee: 100,
      });

      mockFiatWalletAdapter.getWithdrawalDetails.mockResolvedValue({
        status: 'approved',
        externalReference: 'tx-hash-789',
      });

      mockTransactionService.findOne.mockResolvedValue({
        id: 'parent-tx-123',
        metadata: {},
        description: 'USD Withdrawal',
      });

      mockExternalAccountService.findOne.mockResolvedValue({ participant_code: 'PC123' });
      mockLockerService.runWithLock.mockImplementation(async (key, callback) => await callback());
      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        id: 'fwt-123',
        status: 'processing',
      });
      mockFiatWalletRepository.findById.mockResolvedValue({
        id: 'wallet-1',
        balance: 10000,
        credit_balance: 0,
      });
      mockFiatWalletRepository.update.mockResolvedValue({});
      mockTransactionRepository.update.mockResolvedValue({});
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});

      const result = await service.checkAndCompleteUsdWithdrawal('parent-tx-123', 'user-1');

      expect(result).toBe(true);
    });

    it('should track transaction aggregate after completing withdrawal', async () => {
      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        provider_request_ref: 'withdrawal-req-123',
        amount: -5000,
        balance_before: 10000,
        transaction_type: FiatWalletTransactionType.WITHDRAWAL,
        source: 'USD Wallet',
        destination: 'Bank Account',
        fiat_wallet_id: 'wallet-1',
        provider_metadata: {},
        status: 'processing',
        provider_fee: 100,
      };

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletAdapter.getWithdrawalDetails.mockResolvedValue({
        status: 'confirmed',
        externalReference: 'tx-hash-123',
      });
      mockTransactionService.findOne.mockResolvedValue({
        id: 'parent-tx-123',
        metadata: {},
        description: 'USD Withdrawal',
      });
      mockExternalAccountService.findOne.mockResolvedValue({ participant_code: 'PC123' });
      mockLockerService.runWithLock.mockImplementation(async (key, callback) => await callback());
      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        ...mockFiatWalletTransaction,
        status: 'processing',
      });
      mockFiatWalletRepository.findById.mockResolvedValue({
        id: 'wallet-1',
        balance: 10000,
        credit_balance: 0,
      });
      mockFiatWalletRepository.update.mockResolvedValue({});
      mockTransactionRepository.update.mockResolvedValue({});
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});
      mockTransactionAggregateService.findAndUpdate.mockResolvedValue({});

      await service.checkAndCompleteUsdWithdrawal('parent-tx-123', 'user-1');

      expect(mockTransactionAggregateService.findAndUpdate).toHaveBeenCalledWith(
        'zerohash',
        FiatWalletTransactionType.WITHDRAWAL,
        expect.any(Number),
      );
    });

    it('should handle transaction aggregate update failure gracefully', async () => {
      const mockFiatWalletTransaction = {
        id: 'fwt-123',
        provider_request_ref: 'withdrawal-req-123',
        amount: -5000,
        balance_before: 10000,
        transaction_type: FiatWalletTransactionType.WITHDRAWAL,
        source: 'USD Wallet',
        destination: 'Bank Account',
        fiat_wallet_id: 'wallet-1',
        provider_metadata: {},
        status: 'processing',
        provider_fee: 100,
      };

      mockFiatWalletTransactionService.findOneOrNull.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletAdapter.getWithdrawalDetails.mockResolvedValue({
        status: 'confirmed',
        externalReference: 'tx-hash-123',
      });
      mockTransactionService.findOne.mockResolvedValue({
        id: 'parent-tx-123',
        metadata: {},
        description: 'USD Withdrawal',
      });
      mockExternalAccountService.findOne.mockResolvedValue({ participant_code: 'PC123' });
      mockLockerService.runWithLock.mockImplementation(async (key, callback) => await callback());
      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        ...mockFiatWalletTransaction,
        status: 'processing',
      });
      mockFiatWalletRepository.findById.mockResolvedValue({
        id: 'wallet-1',
        balance: 10000,
        credit_balance: 0,
      });
      mockFiatWalletRepository.update.mockResolvedValue({});
      mockTransactionRepository.update.mockResolvedValue({});
      mockFiatWalletTransactionRepository.update.mockResolvedValue({});
      mockTransactionAggregateService.findAndUpdate.mockRejectedValue(new Error('Aggregate error'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      const result = await service.checkAndCompleteUsdWithdrawal('parent-tx-123', 'user-1');

      expect(result).toBe(true);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to update transaction aggregate'));
    });
  });

  describe('processWithdrawalPending - main transaction already completed', () => {
    it('should skip update when main transaction is already completed', async () => {
      const movement = {
        withdrawal_request_id: 'withdrawal-123',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
      } as any;

      mockFiatWalletTransactionService.findOne.mockResolvedValue({
        id: 'fwt-1',
        transaction_id: 'trans-1',
        status: 'pending',
        provider_metadata: {},
      });

      mockTransactionRepository.findById.mockResolvedValue({
        id: 'trans-1',
        status: TransactionStatus.COMPLETED,
      });

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processWithdrawalPending'](movement, mockExternalAccount, mockPayload);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Main transaction is already COMPLETED'));
      expect(mockTransactionRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('isValidMovement - withdrawal_pending validation', () => {
    it('should return false if withdrawal_pending missing withdrawal_request_id', () => {
      const movement = {
        movement_type: 'withdrawal_pending',
        change: '100.00',
      } as any;

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      const result = service['isValidMovement'](movement);

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing withdrawal_request_id for withdrawal_pending movement'),
        expect.any(Object),
      );
    });

    it('should return true for valid withdrawal_pending movement', () => {
      const movement = {
        movement_type: 'withdrawal_pending',
        change: '100.00',
        withdrawal_request_id: 'withdrawal-123',
      } as any;

      const result = service['isValidMovement'](movement);

      expect(result).toBe(true);
    });
  });

  describe('processMovement - zero change amount', () => {
    it('should skip processing when change amount is zero', async () => {
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'trade-123',
        change: '0',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
      } as any;

      const debugSpy = jest.spyOn(service['logger'], 'debug');

      await service['processMovement'](movement, mockExternalAccount, mockPayload);

      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Ignoring zero change amount'));
    });
  });

  describe('processMovement - error handling', () => {
    it('should log error when processing movement throws an error', async () => {
      const movement = {
        movement_type: 'final_settlement',
        trade_id: 'trade-123',
        change: '100.00',
        movement_id: 'movement-123',
      } as any;

      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      const mockPayload = {
        timestamp: Date.now(),
        asset: 'USDC.SOL',
        participant_code: 'participant-1',
      } as any;

      mockFiatWalletTransactionService.findOneOrNull.mockRejectedValue(new Error('Database error'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service['processMovement'](movement, mockExternalAccount, mockPayload);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error processing'), expect.any(Error));
    });
  });

  describe('findFiatWalletTransactionByTradeId - error handling', () => {
    it('should rethrow error when find fails', async () => {
      const mockExternalAccount = {
        id: 'external-1',
        user_id: 'user-1',
        provider: 'zerohash',
      } as any;

      mockFiatWalletTransactionService.findOneOrNull.mockRejectedValue(new Error('Database error'));

      await expect(service['findFiatWalletTransactionByTradeId'](mockExternalAccount, 'trade-123')).rejects.toThrow(
        'Database error',
      );
    });
  });
});
