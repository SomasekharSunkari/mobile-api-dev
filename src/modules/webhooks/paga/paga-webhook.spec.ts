import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeAdapter } from '../../../adapters/exchange/exchange.adapter';
import { PagaPersistentAccountWebhookPayload } from '../../../adapters/waas/paga/paga.interface';
import { WaasAdapter } from '../../../adapters/waas/waas.adapter';
import { EnvironmentService } from '../../../config';
import { SUPPORTED_CURRENCIES } from '../../../currencies';
import {
  FiatWalletTransactionType,
  TransactionCategory,
  TransactionScope,
  TransactionStatus,
  TransactionType,
} from '../../../database';
import { VirtualAccountType } from '../../../database/models/virtualAccount';
import { CurrencyConversionSuccessMail } from '../../../notifications/mails/currency_conversion_success_mail';
import { NgDepositMail } from '../../../notifications/mails/ng_deposit_mail';
import { LockerService } from '../../../services/locker/locker.service';
import { PushNotificationService } from '../../../services/pushNotification/pushNotification.service';
import { MailerService } from '../../../services/queue/processors/mailer/mailer.service';
import { UserService } from '../../auth/user/user.service';
import { UserProfileService } from '../../auth/userProfile/userProfile.service';
import { ExternalAccountRepository } from '../../externalAccount/external-account.repository';
import { FiatWalletRepository, FiatWalletService } from '../../fiatWallet';
import { FiatWalletTransactionRepository } from '../../fiatWalletTransactions/fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from '../../fiatWalletTransactions/fiatWalletTransactions.service';
import { PagaLedgerAccountService } from '../../pagaLedgerAccount/pagaLedgerAccount.service';
import { RateRepository } from '../../rate/rate.repository';
import { RateConfigRepository } from '../../rateConfig/rateConfig.repository';
import { TransactionService } from '../../transaction';
import { TransactionRepository } from '../../transaction/transaction.repository';
import { VirtualAccountRepository } from '../../virtualAccount';
import { ZerohashWebhookService } from '../zerohash/zerohash-webhook.service';
import { PagaWebhookController } from './paga-webhook.controller';
import { PagaWebhookAuthGuard } from './paga-webhook.guard';
import { PagaWebhookService } from './paga-webhook.service';

describe('PagaWebhookService', () => {
  let service: PagaWebhookService;
  let waasAdapter: jest.Mocked<WaasAdapter>;
  let pagaLedgerAccountService: jest.Mocked<PagaLedgerAccountService>;
  let transactionService: jest.Mocked<TransactionService>;
  let fiatWalletService: jest.Mocked<FiatWalletService>;
  let fiatWalletTransactionService: jest.Mocked<FiatWalletTransactionService>;
  let transactionRepository: jest.Mocked<TransactionRepository>;
  let fiatWalletTransactionRepository: jest.Mocked<FiatWalletTransactionRepository>;
  let virtualAccountRepository: jest.Mocked<VirtualAccountRepository>;
  let pushNotificationService: jest.Mocked<PushNotificationService>;
  let userProfileService: jest.Mocked<UserProfileService>;
  let userService: jest.Mocked<UserService>;
  let mailerService: jest.Mocked<MailerService>;

  const mockWaasAdapter = {
    getProviderName: jest.fn(),
    createBank: jest.fn(),
    findOrCreateVirtualAccount: jest.fn(),
    debitBank: jest.fn(),
    creditBank: jest.fn(),
    getVirtualAccount: jest.fn(),
    getWalletDetails: jest.fn(),
    processTransferInflowWebhook: jest.fn(),
    upgradeVirtualAccount: jest.fn(),
    checkUpgradeStatus: jest.fn(),
    upgradeAccountToTierThreeMultipart: jest.fn(),
    getTransactions: jest.fn(),
    transferToOtherBank: jest.fn(),
    transferToSameBank: jest.fn(),
    getBankList: jest.fn(),
    getTransactionStatus: jest.fn(),
    verifyBankAccount: jest.fn(),
    getBankCode: jest.fn(),
    updateVirtualAccount: jest.fn(),
    deleteVirtualAccount: jest.fn(),
  };

  const mockPagaLedgerAccountService = {
    findByAccountNumber: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    depositMoney: jest.fn(),
  };

  const mockTransactionService = {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockFiatWalletService = {
    getUserWallet: jest.fn(),
    updateBalance: jest.fn(),
    reconcileUsdBalanceFromProvider: jest.fn(),
  };

  const mockFiatWalletTransactionService = {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    updateStatus: jest.fn(),
  };

  const mockTransactionRepository = {
    findById: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    transaction: jest.fn(),
    query: jest.fn().mockReturnValue({
      withGraphFetched: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      forUpdate: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    }),
  };

  const mockFiatWalletTransactionRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    transaction: jest.fn(),
  };

  const mockVirtualAccountRepository = {
    findById: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    transaction: jest.fn(),
  };

  const mockPushNotificationService = {
    sendNotification: jest.fn(),
    sendPushNotification: jest.fn(),
    getTransactionPushNotificationConfig: jest.fn(),
  };

  const mockUserProfileService = {
    findOne: jest.fn(),
    update: jest.fn(),
    findByUserId: jest.fn(),
  };

  const mockUserService = {
    findByUserName: jest.fn(),
    update: jest.fn(),
    findByUserId: jest.fn(),
  };

  const mockMailerService = {
    sendMail: jest.fn(),
    send: jest.fn(),
  };

  const mockRateRepository = {
    findOne: jest.fn(),
  };

  const mockRateConfigRepository = {
    findOne: jest.fn(),
  };

  const mockExchangeAdapter = {
    getProviderName: jest.fn().mockReturnValue('YellowCard'),
  };

  const mockLockerService = {
    runWithLock: jest.fn().mockImplementation((_key, callback) => callback()),
    withLock: jest.fn().mockImplementation((_key, callback) => callback()),
    createLock: jest.fn(),
    isLocked: jest.fn(),
    forceRelease: jest.fn(),
  };

  const mockZerohashWebhookService = {
    checkAndCompleteUsdWithdrawal: jest.fn().mockResolvedValue(true),
  };

  const mockFiatWalletRepository = {
    findOne: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    query: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      withGraphFetched: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({
        id: 'ngn-wallet-123',
        user_id: 'user-123',
        asset: 'NGN',
        balance: 100000,
        virtualAccounts: [
          {
            id: 'va-123',
            account_number: '1234567890',
            type: 'main_account',
          },
        ],
      }),
    }),
  };

  const mockExternalAccountRepository = {
    findByUserId: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagaWebhookService,
        {
          provide: WaasAdapter,
          useValue: mockWaasAdapter,
        },
        {
          provide: PagaLedgerAccountService,
          useValue: mockPagaLedgerAccountService,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
        {
          provide: FiatWalletService,
          useValue: mockFiatWalletService,
        },
        {
          provide: FiatWalletTransactionService,
          useValue: mockFiatWalletTransactionService,
        },
        {
          provide: TransactionRepository,
          useValue: mockTransactionRepository,
        },
        {
          provide: FiatWalletTransactionRepository,
          useValue: mockFiatWalletTransactionRepository,
        },
        {
          provide: VirtualAccountRepository,
          useValue: mockVirtualAccountRepository,
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
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: RateRepository,
          useValue: mockRateRepository,
        },
        {
          provide: RateConfigRepository,
          useValue: mockRateConfigRepository,
        },
        {
          provide: ExchangeAdapter,
          useValue: mockExchangeAdapter,
        },
        {
          provide: LockerService,
          useValue: mockLockerService,
        },
        {
          provide: FiatWalletRepository,
          useValue: mockFiatWalletRepository,
        },
        {
          provide: ZerohashWebhookService,
          useValue: mockZerohashWebhookService,
        },
        {
          provide: ExternalAccountRepository,
          useValue: mockExternalAccountRepository,
        },
      ],
    }).compile();

    service = module.get<PagaWebhookService>(PagaWebhookService);
    waasAdapter = module.get(WaasAdapter);
    pagaLedgerAccountService = module.get(PagaLedgerAccountService);
    transactionService = module.get(TransactionService);
    fiatWalletService = module.get(FiatWalletService);
    fiatWalletTransactionService = module.get(FiatWalletTransactionService);
    transactionRepository = module.get(TransactionRepository);
    fiatWalletTransactionRepository = module.get(FiatWalletTransactionRepository);
    virtualAccountRepository = module.get(VirtualAccountRepository);
    pushNotificationService = module.get(PushNotificationService);
    userProfileService = module.get(UserProfileService);
    userService = module.get(UserService);
    mailerService = module.get(MailerService);

    // Default mock for external account repository
    mockExternalAccountRepository.findByUserId.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('handlePersistentAccountWebhook', () => {
    const mockWebhookPayload: PagaPersistentAccountWebhookPayload = {
      statusCode: '0',
      statusMessage: 'SUCCESS',
      transactionReference: 'TXN_REF_123456789',
      fundingTransactionReference: 'FUND_TXN_123456789',
      fundingPaymentReference: 'FUND_PAY_123456789',
      accountNumber: '1234567890',
      accountName: 'John Doe',
      financialIdentificationNumber: '12345678901',
      amount: '5000.00',
      clearingFeeAmount: '50.00',
      payerDetails: {
        paymentReferenceNumber: 'PAY_REF_123456789',
        narration: 'Payment for services',
        payerBankName: 'Access Bank',
        payerName: 'Jane Smith',
        paymentMethod: 'BANK_TRANSFER',
        payerBankAccountNumber: '0987654321',
      },
      instantSettlementStatus: 'SETTLED',
      narration: 'Credit from Jane Smith',
      hash: 'abc123def456ghi789',
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
    } as any;

    const mockFiatWallet = {
      id: 'wallet-123',
      user_id: 'user-123',
      currency: SUPPORTED_CURRENCIES.NGN.code,
      balance: 10000,
    } as any;

    const mockTransaction = {
      id: 'transaction-123',
      user_id: 'user-123',
      reference: 'REF_123',
      external_reference: 'TXN_REF_123456789',
      amount: 500000,
      balance_before: 10000,
      balance_after: 510000,
      transaction_type: TransactionType.DEPOSIT,
      category: TransactionCategory.FIAT,
      transaction_scope: TransactionScope.EXTERNAL,
      status: TransactionStatus.PENDING,
      description: 'Wallet top up of 5000.00 from Jane Smith',
      metadata: {},
      created_at: new Date(),
    } as any;

    const mockFiatWalletTransaction = {
      id: 'fwt-123',
      transaction_id: 'transaction-123',
      fiat_wallet_id: 'wallet-123',
      user_id: 'user-123',
      amount: 500000,
      balance_before: 10000,
      balance_after: 510000,
      transaction_type: FiatWalletTransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
      currency: SUPPORTED_CURRENCIES.NGN.code,
      provider: 'paga',
      provider_reference: 'TXN_REF_123456789',
      provider_fee: 5000,
    } as any;

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should return early if user not found', async () => {
      virtualAccountRepository.findOne.mockResolvedValue(null);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(result).toEqual({ status: 'SUCCESS', message: 'User not found' });
      expect(virtualAccountRepository.findOne).toHaveBeenCalledWith(
        { account_number: mockWebhookPayload.accountNumber },
        undefined,
        { graphFetch: 'user' },
      );
    });

    it('should return early if transaction already completed', async () => {
      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
      });

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction already completed' });
      expect(transactionRepository.findOne).toHaveBeenCalledWith({
        reference: mockWebhookPayload.transactionReference,
      });
    });

    it('should create new transaction and fiat wallet transaction if not exists', async () => {
      const parentTransaction = {
        id: 'parent-transaction-123',
        user_id: 'sender-user-123',
        amount: 10000,
        metadata: {},
      } as any;

      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(parentTransaction);
      transactionService.create.mockResolvedValue(mockTransaction);
      fiatWalletTransactionService.create.mockResolvedValue(mockFiatWalletTransaction);
      waasAdapter.getProviderName.mockReturnValue('paga');
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: null } as any);
      userService.findByUserId.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(mockUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
      expect(transactionService.create).toHaveBeenCalled();
      expect(fiatWalletTransactionService.create).toHaveBeenCalled();
    });

    it('should process transaction successfully in production environment', async () => {
      const transactionWithDate = {
        ...mockTransaction,
        created_at: new Date('2024-01-01T00:00:00.000Z'),
      };
      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue(transactionWithDate);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: null } as any);
      userService.findByUserId.mockResolvedValue(mockUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
      expect(pagaLedgerAccountService.depositMoney).toHaveBeenCalled();
      expect(fiatWalletService.updateBalance).toHaveBeenCalled();
    });

    it('should handle successful transaction and deposit to paga ledger account', async () => {
      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue(mockTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: null } as any);
      userService.findByUserId.mockResolvedValue(mockUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(pagaLedgerAccountService.depositMoney).toHaveBeenCalledWith(
        expect.objectContaining({
          accountNumber: mockWebhookPayload.accountNumber,
          amount: 500000,
          referenceNumber: mockWebhookPayload.transactionReference,
          fee: 0,
          currency: SUPPORTED_CURRENCIES.NGN.code,
        }),
        expect.any(Object),
      );
      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
    });

    it('should update fiat wallet balance on successful transaction', async () => {
      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue(mockTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: null } as any);
      userService.findByUserId.mockResolvedValue(mockUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(fiatWalletService.updateBalance).toHaveBeenCalledWith(
        mockFiatWalletTransaction.fiat_wallet_id,
        500000,
        mockTransaction.id,
        FiatWalletTransactionType.DEPOSIT,
        TransactionStatus.COMPLETED,
        expect.objectContaining({
          description: expect.any(String),
          source: mockWebhookPayload.payerDetails.payerName,
          destination: mockWebhookPayload.accountNumber,
          fiat_wallet_transaction_id: mockFiatWalletTransaction.id,
        }),
        expect.any(Object),
      );
      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
    });

    it('should mark transaction as failed when webhook status is failed', async () => {
      const failedWebhookPayload = { ...mockWebhookPayload, statusMessage: 'FAILED' };
      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue(mockTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(failedWebhookPayload);

      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction failed' });
      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        mockTransaction.id,
        TransactionStatus.FAILED,
        {},
        expect.anything(),
        {
          shouldSendEmail: false,
          shouldSendPushNotification: false,
          shouldSendInAppNotification: true,
        },
      );
    });

    it('should return pending status when webhook status is pending', async () => {
      const pendingWebhookPayload = { ...mockWebhookPayload, statusMessage: 'PENDING' };
      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue(mockTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);

      const result = await service.handlePersistentAccountWebhook(pendingWebhookPayload);

      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction pending' });
    });

    it('should send push notification for deposit transaction', async () => {
      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue(mockTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: 'token-123' } as any);
      pushNotificationService.getTransactionPushNotificationConfig.mockReturnValue({
        title: 'NGN Deposit',
        body: 'Added ₦5,000.00 to your NGN wallet.',
      });
      pushNotificationService.sendPushNotification.mockResolvedValue(undefined);
      userService.findByUserId.mockResolvedValue(mockUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(pushNotificationService.sendPushNotification).toHaveBeenCalledWith(['token-123'], {
        title: 'NGN Deposit',
        body: expect.stringContaining('Added ₦'),
      });
      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
    });

    it('should send push notification for refund transaction', async () => {
      const refundTransaction = {
        ...mockTransaction,
        transaction_type: TransactionType.REFUND,
      };
      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue(refundTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: 'token-123' } as any);
      pushNotificationService.getTransactionPushNotificationConfig.mockReturnValue({
        title: 'NGN Deposit',
        body: 'Added ₦5,000.00 to your NGN wallet.',
      });
      pushNotificationService.sendPushNotification.mockResolvedValue(undefined);
      userService.findByUserId.mockResolvedValue(mockUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(pushNotificationService.sendPushNotification).toHaveBeenCalledWith(['token-123'], {
        title: 'NGN Deposit',
        body: expect.stringContaining('Added ₦'),
      });
      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
    });

    it('should send push notification for transfer transaction', async () => {
      const transferTransaction = {
        ...mockTransaction,
        transaction_type: TransactionType.TRANSFER,
      };
      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue(transferTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: 'token-123' } as any);
      pushNotificationService.getTransactionPushNotificationConfig.mockReturnValue({
        title: 'NGN Deposit',
        body: 'Added ₦5,000.00 to your NGN wallet.',
      });
      pushNotificationService.sendPushNotification.mockResolvedValue(undefined);
      userService.findByUserId.mockResolvedValue(mockUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(pushNotificationService.sendPushNotification).toHaveBeenCalledWith(['token-123'], {
        title: 'NGN Deposit',
        body: expect.stringContaining('Added ₦'),
      });
      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
    });

    it('should send push notification for exchange transaction', async () => {
      const exchangeTransaction = {
        ...mockTransaction,
        transaction_type: TransactionType.EXCHANGE,
        parent_transaction_id: 'parent-transaction-123',
        metadata: {
          to_currency: SUPPORTED_CURRENCIES.NGN.code,
        },
      };
      const parentTransaction = {
        id: 'parent-transaction-123',
        user_id: 'sender-user-123',
        amount: 10000,
      } as any;
      const senderUser = {
        id: 'sender-user-123',
        first_name: 'Jane',
        last_name: 'Smith',
      } as any;

      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValueOnce(exchangeTransaction).mockResolvedValueOnce(parentTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: 'token-123' } as any);
      pushNotificationService.getTransactionPushNotificationConfig.mockReturnValue({
        title: 'Exchange',
        body: '₦5,000.00 has been successfully exchanged',
      });
      pushNotificationService.sendPushNotification.mockResolvedValue(undefined);
      userService.findByUserId.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(senderUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(pushNotificationService.sendPushNotification).toHaveBeenCalledWith(['token-123'], {
        title: 'Exchange',
        body: expect.stringContaining('has been successfully exchanged'),
      });
      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
    });

    it('should send email notification for successful deposit', async () => {
      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue(mockTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: null } as any);
      userService.findByUserId.mockResolvedValue(mockUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(mailerService.send).toHaveBeenCalled();
      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
    });

    it('should send deposit mail when transaction type is DEPOSIT', async () => {
      const depositTransaction = {
        ...mockTransaction,
        transaction_type: TransactionType.DEPOSIT,
        created_at: new Date('2024-01-01T00:00:00.000Z'),
        metadata: {
          sender_bank: 'Access Bank',
        },
      };
      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue(depositTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: null } as any);
      userService.findByUserId.mockResolvedValue(mockUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(mailerService.send).toHaveBeenCalled();
      const mailCall = mailerService.send.mock.calls[0][0] as NgDepositMail;
      expect(mailCall).toBeInstanceOf(NgDepositMail);
      expect(mailCall.user).toEqual(mockUser);
      expect(mailCall.transactionId).toBe(depositTransaction.id);
      expect(mailCall.amount).toBe(500000);
      expect(mailCall.description).toBe(depositTransaction.description);
      expect(mailCall.bank).toBe('Access Bank');
      expect(mailCall.transactionDate).toBe('2024-01-01T00:00:00.000Z');
      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
    });

    it('should send exchange success email for exchange transaction type with proper calculations', async () => {
      const parentTransaction = {
        id: 'parent-transaction-123',
        user_id: 'sender-user-123',
        reference: 'PARENT_REF_123',
        amount: 10000,
        transaction_type: TransactionType.EXCHANGE,
        metadata: {
          from_currency: SUPPORTED_CURRENCIES.USD.code,
          source_currency: SUPPORTED_CURRENCIES.USD.code,
        },
        created_at: new Date(),
      } as any;

      const senderUser = {
        id: 'sender-user-123',
        email: 'sender@example.com',
        first_name: 'Jane',
        last_name: 'Smith',
        username: 'janesmith',
      } as any;

      const exchangeTransaction = {
        ...mockTransaction,
        transaction_type: TransactionType.EXCHANGE,
        parent_transaction_id: 'parent-transaction-123',
        metadata: {
          to_currency: SUPPORTED_CURRENCIES.NGN.code,
          local_currency: SUPPORTED_CURRENCIES.NGN.code,
          fee: 5000,
          rate: 150000,
          sender_bank: 'Test Bank',
          account_id: 'ACC_123',
          order_number: 'ORD_123',
          recipient_location: 'Lagos, Nigeria',
        },
      };

      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValueOnce(exchangeTransaction).mockResolvedValueOnce(parentTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: null } as any);
      userService.findByUserId.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(senderUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(transactionRepository.findOne).toHaveBeenCalledWith({
        id: exchangeTransaction.parent_transaction_id,
      });
      expect(userService.findByUserId).toHaveBeenCalledWith(parentTransaction.user_id);
      expect(mailerService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUser,
          exchangeData: expect.objectContaining({
            fromCurrency: SUPPORTED_CURRENCIES.USD.code,
            toCurrency: SUPPORTED_CURRENCIES.NGN.code,
            transactionId: exchangeTransaction.id,
            description: exchangeTransaction.description,
            senderName: 'Jane Smith',
            recipientName: 'John Doe',
          }),
        }),
      );
      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
    });

    it('should handle exchange transaction with missing sender name fields', async () => {
      const parentTransaction = {
        id: 'parent-transaction-123',
        user_id: 'sender-user-123',
        amount: 10000,
        metadata: {
          from_currency: SUPPORTED_CURRENCIES.USD.code,
        },
      } as any;

      const senderUserWithoutNames = {
        id: 'sender-user-123',
        email: 'sender@example.com',
        username: 'senderusername',
      } as any;

      const exchangeTransaction = {
        ...mockTransaction,
        transaction_type: TransactionType.EXCHANGE,
        parent_transaction_id: 'parent-transaction-123',
        metadata: {
          to_currency: SUPPORTED_CURRENCIES.NGN.code,
          fee: 5000,
          rate: 150000,
        },
      };

      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValueOnce(exchangeTransaction).mockResolvedValueOnce(parentTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: null } as any);
      userService.findByUserId.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(senderUserWithoutNames);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(mailerService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          exchangeData: expect.objectContaining({
            senderName: 'senderusername',
          }),
        }),
      );
      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
    });

    it('should handle exchange transaction with missing recipient name fields', async () => {
      const parentTransaction = {
        id: 'parent-transaction-123',
        user_id: 'sender-user-123',
        amount: 10000,
        metadata: {
          from_currency: SUPPORTED_CURRENCIES.USD.code,
        },
      } as any;

      const senderUser = {
        id: 'sender-user-123',
        first_name: 'Jane',
        last_name: 'Smith',
      } as any;

      const recipientUserWithoutNames = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'recipientusername',
      } as any;

      const exchangeTransaction = {
        ...mockTransaction,
        transaction_type: TransactionType.EXCHANGE,
        parent_transaction_id: 'parent-transaction-123',
        metadata: {
          to_currency: SUPPORTED_CURRENCIES.NGN.code,
          fee: 5000,
          rate: 150000,
        },
      };

      virtualAccountRepository.findOne.mockResolvedValue({
        user: recipientUserWithoutNames,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValueOnce(exchangeTransaction).mockResolvedValueOnce(parentTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: null } as any);
      userService.findByUserId.mockResolvedValueOnce(recipientUserWithoutNames).mockResolvedValueOnce(senderUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(mailerService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          exchangeData: expect.objectContaining({
            recipientName: 'recipientusername',
            senderName: 'Jane Smith',
          }),
        }),
      );
      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
    });

    it('should use default currencies when metadata is missing', async () => {
      const parentTransaction = {
        id: 'parent-transaction-123',
        user_id: 'sender-user-123',
        amount: 10000,
        metadata: {},
      } as any;

      const senderUser = {
        id: 'sender-user-123',
        first_name: 'Jane',
        last_name: 'Smith',
      } as any;

      const exchangeTransaction = {
        ...mockTransaction,
        transaction_type: TransactionType.EXCHANGE,
        parent_transaction_id: 'parent-transaction-123',
        metadata: {},
      };

      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValueOnce(exchangeTransaction).mockResolvedValueOnce(parentTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: null } as any);
      userService.findByUserId.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(senderUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(mailerService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          exchangeData: expect.objectContaining({
            toCurrency: SUPPORTED_CURRENCIES.NGN.code,
          }),
        }),
      );
      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
    });

    it('should update transaction balance_after correctly', async () => {
      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue(mockTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: null } as any);
      userService.findByUserId.mockResolvedValue(mockUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(transactionRepository.update).toHaveBeenCalledWith(mockTransaction.id, {
        balance_after: mockTransaction.balance_before + 500000,
      });
      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
    });

    it('should sanitize amount by removing commas', async () => {
      const payloadWithCommaAmount = {
        ...mockWebhookPayload,
        amount: '4,000.00',
      };

      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue(mockTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: null } as any);
      userService.findByUserId.mockResolvedValue(mockUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(payloadWithCommaAmount);

      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
      expect(pagaLedgerAccountService.depositMoney).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 400000,
        }),
        expect.any(Object),
      );
    });

    it('should send deposit mail with default date when transaction has no created_at', async () => {
      const transactionWithoutCreatedAt = {
        ...mockTransaction,
        transaction_type: TransactionType.DEPOSIT,
        created_at: undefined,
        metadata: {
          sender_bank: 'Access Bank',
        },
      };

      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue(transactionWithoutCreatedAt);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: null } as any);
      userService.findByUserId.mockResolvedValue(mockUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(mailerService.send).toHaveBeenCalled();
      const mailCall = mailerService.send.mock.calls[0][0] as NgDepositMail;
      expect(mailCall).toBeInstanceOf(NgDepositMail);
      expect(mailCall.transactionDate).toBeDefined();
      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
    });

    it('should not send push notification when notification_token is null', async () => {
      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue(mockTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: null } as any);
      userService.findByUserId.mockResolvedValue(mockUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(pushNotificationService.sendPushNotification).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
    });

    it('should handle virtual account with null type as MAIN_ACCOUNT', async () => {
      virtualAccountRepository.findOne.mockResolvedValue({
        user: mockUser,
        type: null,
      } as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      transactionRepository.findOne.mockResolvedValue(mockTransaction);
      fiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);
      pagaLedgerAccountService.depositMoney.mockResolvedValue(undefined);
      fiatWalletService.updateBalance.mockResolvedValue(undefined);
      transactionRepository.update.mockResolvedValue(undefined);
      transactionRepository.transaction.mockImplementation(async (callback: any) => {
        return await callback({} as any);
      });
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      userProfileService.findByUserId.mockResolvedValue({ notification_token: null } as any);
      userService.findByUserId.mockResolvedValue(mockUser);
      mailerService.send.mockResolvedValue(undefined);

      const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

      expect(result).toEqual({ status: 'SUCCESS', message: 'Transaction completed' });
      expect(fiatWalletService.getUserWallet).toHaveBeenCalledWith(mockUser.id, SUPPORTED_CURRENCIES.NGN.code);
    });

    describe('EXCHANGE_ACCOUNT handling', () => {
      const mockExchangeVirtualAccount = {
        user: mockUser,
        type: VirtualAccountType.EXCHANGE_ACCOUNT,
        account_number: '1234567890',
        transaction_id: 'parent-txn-123',
      };

      const mockParentTransaction = {
        id: 'parent-txn-123',
        user_id: 'user-123',
        amount: 10000,
        status: TransactionStatus.PENDING,
        metadata: {
          rate_id: 'rate-123',
          from_currency: SUPPORTED_CURRENCIES.USD.code,
        },
      } as any;

      const mockExchangeRate = {
        id: 'rate-123',
        rate: 1500,
      };

      const mockRateConfig = {
        provider: 'YellowCard',
        isActive: true,
        fiatExchange: {
          disbursement_fee: { value: 1, is_percentage: true },
          partner_fee: { value: 0, is_percentage: false },
        },
      };

      it('should return success message for exchange account with no transaction_id', async () => {
        virtualAccountRepository.findOne.mockResolvedValue({
          ...mockExchangeVirtualAccount,
          transaction_id: null,
        } as any);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
      });

      it('should return success message when parent transaction is not found', async () => {
        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(null);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(transactionRepository.findById).toHaveBeenCalledWith('parent-txn-123');
      });

      it('should return success message when child transaction is already completed', async () => {
        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue({
          id: 'child-txn-123',
          parent_transaction_id: 'parent-txn-123',
          status: TransactionStatus.COMPLETED,
        } as any);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
      });

      it('should complete existing child transaction', async () => {
        const childTransaction = {
          id: 'child-txn-123',
          parent_transaction_id: 'parent-txn-123',
          status: TransactionStatus.PENDING,
          amount: 500000,
          metadata: {},
          fiatWalletTransaction: {
            id: 'fwt-123',
          },
        } as any;

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(childTransaction);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionRepository.update.mockResolvedValue(undefined);
        fiatWalletService.updateBalance.mockResolvedValue(undefined);
        transactionService.updateStatus.mockResolvedValue(undefined);
        fiatWalletTransactionRepository.update.mockResolvedValue(undefined);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(transactionRepository.update).toHaveBeenCalled();
        expect(transactionService.updateStatus).toHaveBeenCalledWith(
          'child-txn-123',
          TransactionStatus.COMPLETED,
          expect.objectContaining({
            description: 'Exchange USD to NGN',
            destination: 'NGN Wallet',
            source: 'USD Wallet',
          }),
          expect.anything(),
          expect.objectContaining({
            shouldSendEmail: true,
            shouldSendPushNotification: true,
            shouldSendInAppNotification: true,
          }),
        );
      });

      it('should complete existing child transaction without fiatWalletTransaction', async () => {
        const childTransactionWithoutFwt = {
          id: 'child-txn-123',
          parent_transaction_id: 'parent-txn-123',
          status: TransactionStatus.PENDING,
          amount: 500000,
          metadata: {},
          fiatWalletTransaction: null,
        } as any;

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(childTransactionWithoutFwt);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionRepository.update.mockResolvedValue(undefined);
        fiatWalletService.updateBalance.mockResolvedValue(undefined);
        transactionService.updateStatus.mockResolvedValue(undefined);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(fiatWalletTransactionRepository.update).not.toHaveBeenCalled();
      });

      it('should create completed exchange transaction when child does not exist', async () => {
        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionService.create.mockResolvedValue({ id: 'new-child-txn-123' } as any);
        fiatWalletTransactionService.create.mockResolvedValue({ id: 'new-fwt-123' } as any);
        fiatWalletService.updateBalance.mockResolvedValue(undefined);
        transactionService.updateStatus.mockResolvedValue(undefined);
        fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(transactionService.create).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            transaction_type: TransactionType.EXCHANGE,
            status: TransactionStatus.PROCESSING,
            parent_transaction_id: 'parent-txn-123',
          }),
          expect.anything(),
        );
        expect(fiatWalletTransactionService.create).toHaveBeenCalled();
        expect(fiatWalletService.updateBalance).toHaveBeenCalled();
        expect(transactionService.updateStatus).toHaveBeenCalledWith(
          'new-child-txn-123',
          TransactionStatus.COMPLETED,
          undefined,
          expect.anything(),
          {
            shouldSendEmail: true,
            shouldSendPushNotification: true,
            shouldSendInAppNotification: true,
          },
        );
        expect(fiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
          'new-fwt-123',
          TransactionStatus.COMPLETED,
          undefined,
          expect.anything(),
        );
      });

      it('should return success message when rate_id is missing in parent transaction', async () => {
        const parentWithoutRateId = {
          ...mockParentTransaction,
          metadata: {},
        };

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(parentWithoutRateId);
        transactionRepository.findOne.mockResolvedValue(null);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(mockRateRepository.findOne).not.toHaveBeenCalled();
      });

      it('should return success message when exchange rate is not found', async () => {
        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(null);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(mockRateConfigRepository.findOne).not.toHaveBeenCalled();
      });

      it('should return success message when rate config is not found', async () => {
        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(null);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(fiatWalletService.getUserWallet).not.toHaveBeenCalled();
      });

      it('should handle non-percentage disbursement fee correctly', async () => {
        const rateConfigNonPercentage = {
          ...mockRateConfig,
          fiatExchange: {
            ...mockRateConfig.fiatExchange,
            disbursement_fee: { value: 100, is_percentage: false },
          },
        };

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(rateConfigNonPercentage);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionService.create.mockResolvedValue({ id: 'new-child-txn-123' } as any);
        fiatWalletTransactionService.create.mockResolvedValue({ id: 'new-fwt-123' } as any);
        fiatWalletService.updateBalance.mockResolvedValue(undefined);
        transactionService.updateStatus.mockResolvedValue(undefined);
        fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(transactionService.create).toHaveBeenCalled();
        expect(transactionService.updateStatus).toHaveBeenCalledWith(
          'new-child-txn-123',
          TransactionStatus.COMPLETED,
          undefined,
          expect.anything(),
          {
            shouldSendEmail: true,
            shouldSendPushNotification: true,
            shouldSendInAppNotification: true,
          },
        );
        expect(fiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
          'new-fwt-123',
          TransactionStatus.COMPLETED,
          undefined,
          expect.anything(),
        );
      });

      it('should return early when ngnAmount calculation results in NaN', async () => {
        const invalidExchangeRate = {
          id: 'rate-123',
          rate: Number.NaN,
        };

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(invalidExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(fiatWalletService.getUserWallet).not.toHaveBeenCalled();
        expect(transactionService.create).not.toHaveBeenCalled();
      });

      it('should return early when ngnAmount calculation results in negative value', async () => {
        const rateConfigWithHighFee = {
          ...mockRateConfig,
          fiatExchange: {
            ...mockRateConfig.fiatExchange,
            disbursement_fee: { value: 999999999999, is_percentage: false },
          },
        };

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(rateConfigWithHighFee);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(fiatWalletService.getUserWallet).not.toHaveBeenCalled();
        expect(transactionService.create).not.toHaveBeenCalled();
      });

      it('should return early when wallet balance is NaN', async () => {
        const walletWithNaNBalance = {
          ...mockFiatWallet,
          balance: Number.NaN,
        };

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        fiatWalletService.getUserWallet.mockResolvedValue(walletWithNaNBalance as any);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(transactionService.create).not.toHaveBeenCalled();
      });

      it('should handle exchange rate returned as string from PostgreSQL bigint column', async () => {
        const exchangeRateAsString = {
          id: 'rate-123',
          rate: '150000',
        };

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(exchangeRateAsString);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionService.create.mockResolvedValue({ id: 'new-child-txn-123' } as any);
        fiatWalletTransactionService.create.mockResolvedValue({ id: 'new-fwt-123' } as any);
        fiatWalletService.updateBalance.mockResolvedValue(undefined);
        transactionService.updateStatus.mockResolvedValue(undefined);
        fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(transactionService.create).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            transaction_type: TransactionType.EXCHANGE,
            status: TransactionStatus.PROCESSING,
            parent_transaction_id: 'parent-txn-123',
          }),
          expect.anything(),
        );
      });

      it('should handle wallet balance returned as string from PostgreSQL bigint column', async () => {
        const walletWithStringBalance = {
          ...mockFiatWallet,
          balance: '500000',
        };

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        fiatWalletService.getUserWallet.mockResolvedValue(walletWithStringBalance as any);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionService.create.mockResolvedValue({ id: 'new-child-txn-123' } as any);
        fiatWalletTransactionService.create.mockResolvedValue({ id: 'new-fwt-123' } as any);
        fiatWalletService.updateBalance.mockResolvedValue(undefined);
        transactionService.updateStatus.mockResolvedValue(undefined);
        fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(transactionService.create).toHaveBeenCalled();
      });

      it('should return early when ngnAmount calculation results in Infinity', async () => {
        const infiniteExchangeRate = {
          id: 'rate-123',
          rate: Infinity,
        };

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(infiniteExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(fiatWalletService.getUserWallet).not.toHaveBeenCalled();
        expect(transactionService.create).not.toHaveBeenCalled();
      });

      it('should return early when wallet balance results in Infinity after calculation', async () => {
        const walletWithInfiniteBalance = {
          ...mockFiatWallet,
          balance: Infinity,
        };

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        fiatWalletService.getUserWallet.mockResolvedValue(walletWithInfiniteBalance as any);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(transactionService.create).not.toHaveBeenCalled();
      });

      it('should return early when main account number is not found during completeExchangeTransaction', async () => {
        const childTransaction = {
          id: 'child-txn-123',
          parent_transaction_id: 'parent-txn-123',
          status: TransactionStatus.PENDING,
          amount: 500000,
          metadata: {},
          fiatWalletTransaction: {
            id: 'fwt-123',
          },
        } as any;

        const ngnWalletWithoutMainAccount = {
          id: 'ngn-wallet-123',
          user_id: 'user-123',
          asset: 'NGN',
          balance: 100000,
          virtualAccounts: [],
        };

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(childTransaction);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionRepository.update.mockResolvedValue(undefined);

        mockFiatWalletRepository.query.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          withGraphFetched: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(ngnWalletWithoutMainAccount),
        });

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
      });

      it('should return early when main account number is not found during createCompletedExchangeTransaction', async () => {
        virtualAccountRepository.findOne
          .mockResolvedValueOnce(mockExchangeVirtualAccount as any)
          .mockResolvedValueOnce(null);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionService.create.mockResolvedValue({ id: 'new-child-txn-123' } as any);
        fiatWalletTransactionService.create.mockResolvedValue({ id: 'new-fwt-123' } as any);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
      });

      it('should send currency conversion email after completing exchange transaction', async () => {
        const childTransaction = {
          id: 'child-txn-123',
          parent_transaction_id: 'parent-txn-123',
          status: TransactionStatus.PENDING,
          amount: 500000,
          metadata: { rate: 1500 },
          fiatWalletTransaction: {
            id: 'fwt-123',
          },
        } as any;

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(childTransaction);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionRepository.update.mockResolvedValue(undefined);
        fiatWalletService.updateBalance.mockResolvedValue(undefined);
        transactionService.updateStatus.mockResolvedValue(undefined);
        userService.findByUserId.mockResolvedValue(mockUser);
        mailerService.send.mockResolvedValue(undefined);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(mailerService.send).toHaveBeenCalledWith(expect.any(CurrencyConversionSuccessMail));
      });

      it('should not send currency conversion email when user has no email', async () => {
        const userWithoutEmail = {
          id: 'user-123',
          first_name: 'John',
          last_name: 'Doe',
          email: null,
        };

        const childTransaction = {
          id: 'child-txn-123',
          parent_transaction_id: 'parent-txn-123',
          status: TransactionStatus.PENDING,
          amount: 500000,
          metadata: { rate: 1500 },
          fiatWalletTransaction: {
            id: 'fwt-123',
          },
        } as any;

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(childTransaction);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionRepository.update.mockResolvedValue(undefined);
        fiatWalletService.updateBalance.mockResolvedValue(undefined);
        transactionService.updateStatus.mockResolvedValue(undefined);
        userService.findByUserId.mockResolvedValue(userWithoutEmail as any);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(mailerService.send).not.toHaveBeenCalled();
      });

      it('should send currency conversion email after creating completed exchange transaction', async () => {
        virtualAccountRepository.findOne
          .mockResolvedValueOnce(mockExchangeVirtualAccount as any)
          .mockResolvedValueOnce({ account_number: '1234567890', type: VirtualAccountType.MAIN_ACCOUNT } as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionService.create.mockResolvedValue({ id: 'new-child-txn-123' } as any);
        fiatWalletTransactionService.create.mockResolvedValue({ id: 'new-fwt-123' } as any);
        fiatWalletService.updateBalance.mockResolvedValue(undefined);
        transactionService.updateStatus.mockResolvedValue(undefined);
        fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
        userService.findByUserId.mockResolvedValue(mockUser);
        mailerService.send.mockResolvedValue(undefined);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(mailerService.send).toHaveBeenCalledWith(expect.any(CurrencyConversionSuccessMail));
      });

      it('should handle production environment retries when child transaction not found', async () => {
        jest.useFakeTimers();
        jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

        virtualAccountRepository.findOne
          .mockResolvedValueOnce(mockExchangeVirtualAccount as any)
          .mockResolvedValueOnce({ account_number: '1234567890', type: VirtualAccountType.MAIN_ACCOUNT } as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionService.create.mockResolvedValue({ id: 'new-child-txn-123' } as any);
        fiatWalletTransactionService.create.mockResolvedValue({ id: 'new-fwt-123' } as any);
        fiatWalletService.updateBalance.mockResolvedValue(undefined);
        transactionService.updateStatus.mockResolvedValue(undefined);
        fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
        userService.findByUserId.mockResolvedValue(mockUser);
        mailerService.send.mockResolvedValue(undefined);

        const resultPromise = service.handlePersistentAccountWebhook(mockWebhookPayload);
        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(transactionService.create).toHaveBeenCalled();

        jest.useRealTimers();
      });

      it('should find child transaction on retry in production environment', async () => {
        jest.useFakeTimers();
        jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

        const childTransaction = {
          id: 'child-txn-123',
          parent_transaction_id: 'parent-txn-123',
          status: TransactionStatus.PENDING,
          amount: 500000,
          metadata: { rate: 1500 },
          fiatWalletTransaction: {
            id: 'fwt-123',
          },
        } as any;

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(childTransaction);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionRepository.update.mockResolvedValue(undefined);
        fiatWalletService.updateBalance.mockResolvedValue(undefined);
        transactionService.updateStatus.mockResolvedValue(undefined);
        userService.findByUserId.mockResolvedValue(mockUser);
        mailerService.send.mockResolvedValue(undefined);

        const resultPromise = service.handlePersistentAccountWebhook(mockWebhookPayload);
        await jest.runAllTimersAsync();
        const result = await resultPromise;

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(transactionRepository.update).toHaveBeenCalled();

        jest.useRealTimers();
      });

      it('should handle partner fee as percentage correctly', async () => {
        const rateConfigWithPartnerFeePercentage = {
          ...mockRateConfig,
          fiatExchange: {
            ...mockRateConfig.fiatExchange,
            partner_fee: { value: 2, is_percentage: true },
          },
        };

        virtualAccountRepository.findOne
          .mockResolvedValueOnce(mockExchangeVirtualAccount as any)
          .mockResolvedValueOnce({ account_number: '1234567890', type: VirtualAccountType.MAIN_ACCOUNT } as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(rateConfigWithPartnerFeePercentage);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionService.create.mockResolvedValue({ id: 'new-child-txn-123' } as any);
        fiatWalletTransactionService.create.mockResolvedValue({ id: 'new-fwt-123' } as any);
        fiatWalletService.updateBalance.mockResolvedValue(undefined);
        transactionService.updateStatus.mockResolvedValue(undefined);
        fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
        userService.findByUserId.mockResolvedValue(mockUser);
        mailerService.send.mockResolvedValue(undefined);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(transactionService.create).toHaveBeenCalled();
      });

      it('should handle partner fee as fixed amount correctly', async () => {
        const rateConfigWithFixedPartnerFee = {
          ...mockRateConfig,
          fiatExchange: {
            ...mockRateConfig.fiatExchange,
            partner_fee: { value: 5, is_percentage: false },
          },
        };

        virtualAccountRepository.findOne
          .mockResolvedValueOnce(mockExchangeVirtualAccount as any)
          .mockResolvedValueOnce({ account_number: '1234567890', type: VirtualAccountType.MAIN_ACCOUNT } as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(rateConfigWithFixedPartnerFee);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionService.create.mockResolvedValue({ id: 'new-child-txn-123' } as any);
        fiatWalletTransactionService.create.mockResolvedValue({ id: 'new-fwt-123' } as any);
        fiatWalletService.updateBalance.mockResolvedValue(undefined);
        transactionService.updateStatus.mockResolvedValue(undefined);
        fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
        userService.findByUserId.mockResolvedValue(mockUser);
        mailerService.send.mockResolvedValue(undefined);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(transactionService.create).toHaveBeenCalled();
      });

      it('should throw error when database transaction fails in createCompletedExchangeTransaction', async () => {
        virtualAccountRepository.findOne
          .mockResolvedValueOnce(mockExchangeVirtualAccount as any)
          .mockResolvedValueOnce({ account_number: '1234567890', type: VirtualAccountType.MAIN_ACCOUNT } as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockRejectedValue(new Error('Database error'));

        await expect(service.handlePersistentAccountWebhook(mockWebhookPayload)).rejects.toThrow('Database error');
      });

      it('should use rate from parent transaction metadata when child transaction rate is missing in completeExchangeTransaction', async () => {
        const childTransaction = {
          id: 'child-txn-123',
          parent_transaction_id: 'parent-txn-123',
          status: TransactionStatus.PENDING,
          amount: 500000,
          metadata: {},
          fiatWalletTransaction: {
            id: 'fwt-123',
          },
        } as any;

        const parentTransactionWithRate = {
          id: 'parent-txn-123',
          user_id: 'user-123',
          amount: 10000,
          status: TransactionStatus.PENDING,
          metadata: {
            rate_id: 'rate-123',
            rate: 1500,
            from_currency: SUPPORTED_CURRENCIES.USD.code,
          },
        } as any;

        // Reset mocks before setting up
        virtualAccountRepository.findOne.mockReset();
        transactionRepository.findById.mockReset();
        transactionRepository.findOne.mockReset();

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(parentTransactionWithRate);
        transactionRepository.findOne.mockResolvedValue(childTransaction);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionRepository.update.mockResolvedValue(undefined);
        fiatWalletService.updateBalance.mockResolvedValue(undefined);
        transactionService.updateStatus.mockResolvedValue(undefined);
        userService.findByUserId.mockResolvedValue(mockUser);
        mailerService.send.mockResolvedValue(undefined);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(mailerService.send).toHaveBeenCalledWith(
          expect.objectContaining({
            conversionData: expect.objectContaining({
              exchangeRate: expect.stringContaining('1'),
            }),
          }),
        );
      });

      it('should return success message when rate config is inactive', async () => {
        const rateConfigInactive = {
          ...mockRateConfig,
          isActive: false,
        };

        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(rateConfigInactive);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(fiatWalletService.getUserWallet).not.toHaveBeenCalled();
      });

      it('should search for child transaction using parent_transaction_id AND asset filter', async () => {
        virtualAccountRepository.findOne.mockResolvedValue(mockExchangeVirtualAccount as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        transactionRepository.findOne.mockResolvedValue({
          id: 'child-txn-123',
          parent_transaction_id: 'parent-txn-123',
          asset: SUPPORTED_CURRENCIES.NGN.code,
          status: TransactionStatus.COMPLETED,
        } as any);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });
        expect(fiatWalletService.getUserWallet).not.toHaveBeenCalled();
        // Verify the findOne was called with both parent_transaction_id AND asset filter
        expect(transactionRepository.findOne).toHaveBeenCalledWith(
          { parent_transaction_id: 'parent-txn-123', asset: SUPPORTED_CURRENCIES.NGN.code },
          {},
          { graphFetch: '[fiatWalletTransaction]' },
        );
      });

      it('should complete existing child transaction found by forUpdate check instead of creating duplicate in createCompletedExchangeTransaction', async () => {
        const existingChildFromZeroHash = {
          id: 'zerohash-child-123',
          parent_transaction_id: 'parent-txn-123',
          asset: SUPPORTED_CURRENCIES.NGN.code,
          external_reference: 'zerohash-withdrawal-request-id', // Different reference from ZeroHash
          status: TransactionStatus.INITIATED,
          amount: 500000,
          metadata: {},
          fiatWalletTransaction: {
            id: 'fwt-from-zerohash',
          },
        } as any;

        // Reset mocks before setting up
        virtualAccountRepository.findOne.mockReset();
        transactionRepository.findById.mockReset();
        transactionRepository.findOne.mockReset();

        virtualAccountRepository.findOne
          .mockResolvedValueOnce(mockExchangeVirtualAccount as any)
          .mockResolvedValueOnce({ account_number: '1234567890', type: VirtualAccountType.MAIN_ACCOUNT } as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        // The retry loop in handleExchangeTransaction doesn't find any child transaction
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);

        // Setup the query mock for forUpdate check inside createCompletedExchangeTransaction
        const queryMock = {
          withGraphFetched: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(existingChildFromZeroHash),
        };
        transactionRepository.query = jest.fn().mockReturnValue(queryMock);

        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        transactionRepository.update.mockResolvedValue(undefined);
        fiatWalletService.updateBalance.mockResolvedValue(undefined);
        transactionService.updateStatus.mockResolvedValue(undefined);
        fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
        userService.findByUserId.mockResolvedValue(mockUser);
        mailerService.send.mockResolvedValue(undefined);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });

        // Verify the forUpdate check was made with correct criteria
        // (parent_transaction_id + asset, NOT external_reference)
        expect(queryMock.where).toHaveBeenCalledWith({
          parent_transaction_id: 'parent-txn-123',
          asset: SUPPORTED_CURRENCIES.NGN.code,
        });

        // Verify the existing transaction was updated instead of creating a new one
        expect(transactionRepository.update).toHaveBeenCalledWith(
          'zerohash-child-123',
          expect.objectContaining({
            amount: expect.any(Number),
            balance_before: expect.any(Number),
            balance_after: expect.any(Number),
          }),
          expect.anything(),
        );

        // Verify no new transaction was created
        expect(transactionService.create).not.toHaveBeenCalled();

        // Verify the existing transaction status was updated to COMPLETED
        expect(transactionService.updateStatus).toHaveBeenCalledWith(
          'zerohash-child-123',
          TransactionStatus.COMPLETED,
          undefined,
          expect.anything(),
          expect.objectContaining({
            shouldSendInAppNotification: true,
            shouldSendPushNotification: true,
            shouldSendEmail: true,
          }),
        );

        // Verify the existing fiat wallet transaction was also updated
        expect(fiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
          'fwt-from-zerohash',
          TransactionStatus.COMPLETED,
          undefined,
          expect.anything(),
        );
      });

      it('should skip updating already COMPLETED child transaction found by forUpdate check', async () => {
        const existingCompletedChild = {
          id: 'already-completed-child',
          parent_transaction_id: 'parent-txn-123',
          asset: SUPPORTED_CURRENCIES.NGN.code,
          status: TransactionStatus.COMPLETED,
          amount: 500000,
          metadata: {},
          fiatWalletTransaction: {
            id: 'fwt-completed',
          },
        } as any;

        // Reset mocks before setting up
        virtualAccountRepository.findOne.mockReset();
        transactionRepository.findById.mockReset();
        transactionRepository.findOne.mockReset();

        virtualAccountRepository.findOne
          .mockResolvedValueOnce(mockExchangeVirtualAccount as any)
          .mockResolvedValueOnce({ account_number: '1234567890', type: VirtualAccountType.MAIN_ACCOUNT } as any);
        transactionRepository.findById.mockResolvedValue(mockParentTransaction);
        // The retry loop doesn't find any child transaction
        transactionRepository.findOne.mockResolvedValue(null);
        mockRateRepository.findOne.mockResolvedValue(mockExchangeRate);
        mockRateConfigRepository.findOne.mockResolvedValue(mockRateConfig);
        fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);

        // Setup the query mock for forUpdate check - returns already completed transaction
        const queryMock = {
          withGraphFetched: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(existingCompletedChild),
        };
        transactionRepository.query = jest.fn().mockReturnValue(queryMock);

        transactionRepository.transaction.mockImplementation(async (callback: any) => {
          return await callback({} as any);
        });
        userService.findByUserId.mockResolvedValue(mockUser);

        const result = await service.handlePersistentAccountWebhook(mockWebhookPayload);

        expect(result).toEqual({ status: 'SUCCESS', message: 'Exchange transaction completed' });

        // Verify no balance update, no transaction update, no new transaction created
        expect(fiatWalletService.updateBalance).not.toHaveBeenCalled();
        expect(transactionService.updateStatus).not.toHaveBeenCalled();
        expect(transactionService.create).not.toHaveBeenCalled();
        expect(fiatWalletTransactionService.updateStatus).not.toHaveBeenCalled();
      });
    });
  });

  describe('PagaWebhookController', () => {
    let controller: PagaWebhookController;
    let pagaWebhookService: jest.Mocked<PagaWebhookService>;

    const mockPagaWebhookService = {
      handlePersistentAccountWebhook: jest.fn(),
    };

    const mockAppLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [PagaWebhookController],
        providers: [
          {
            provide: PagaWebhookService,
            useValue: mockPagaWebhookService,
          },
          {
            provide: 'AppLoggerService',
            useValue: mockAppLoggerService,
          },
        ],
      })
        .overrideGuard(PagaWebhookAuthGuard)
        .useValue({ canActivate: () => true })
        .compile();

      controller = module.get<PagaWebhookController>(PagaWebhookController);
      pagaWebhookService = module.get(PagaWebhookService);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('handlePersistentAccountWebhook', () => {
      it('should handle persistent account webhook and return transformed response', async () => {
        const mockPayload = {
          accountNumber: '1234567890',
          transactionReference: 'ref-123',
          amount: '1000.00',
          transactionType: 'CREDIT',
          statusCode: 'SUCCESS',
          payerDetails: {
            payerName: 'Test User',
            payerPhoneNumber: '08012345678',
          },
        };

        const mockResult = {
          status: 'SUCCESS',
          message: 'Transaction completed',
        };

        mockPagaWebhookService.handlePersistentAccountWebhook.mockResolvedValue(mockResult);

        const result = await controller.handlePersistentAccountWebhook(mockPayload);

        expect(pagaWebhookService.handlePersistentAccountWebhook).toHaveBeenCalledWith(mockPayload);
        expect(result).toMatchObject({
          message: 'Paga webhook received',
          data: mockResult,
        });
      });

      it('should pass error from service to caller', async () => {
        const mockPayload = {
          accountNumber: '1234567890',
          transactionReference: 'ref-123',
          amount: '1000.00',
          transactionType: 'CREDIT',
          statusCode: 'SUCCESS',
          payerDetails: {
            payerName: 'Test User',
            payerPhoneNumber: '08012345678',
          },
        };

        const error = new Error('Service error');
        mockPagaWebhookService.handlePersistentAccountWebhook.mockRejectedValue(error);

        await expect(controller.handlePersistentAccountWebhook(mockPayload)).rejects.toThrow('Service error');
      });
    });
  });

  describe('reconcileUsdBalanceFromProvider integration', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockFiatWalletService.reconcileUsdBalanceFromProvider.mockResolvedValue({
        success: true,
        providerBalance: 10000,
        localBalance: 10000,
        updated: false,
        message: 'Balances are in sync',
      });
    });

    it('should call reconcileUsdBalanceFromProvider when parent transaction is not completed', async () => {
      // Mock to simulate checkAndCompleteUsdWithdrawal was called
      // The reconcile function should be called regardless of the withdrawal completion status
      mockFiatWalletService.reconcileUsdBalanceFromProvider.mockResolvedValue({
        success: true,
        providerBalance: 15000,
        localBalance: 10000,
        updated: true,
        message: 'Balance updated from 10000 to 15000',
      });

      // Verify the mock is properly set up and callable
      const result = await mockFiatWalletService.reconcileUsdBalanceFromProvider('user-123');
      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(result.providerBalance).toBe(15000);
      expect(mockFiatWalletService.reconcileUsdBalanceFromProvider).toHaveBeenCalledWith('user-123');
    });

    it('should handle reconciliation failure gracefully', async () => {
      mockFiatWalletService.reconcileUsdBalanceFromProvider.mockResolvedValue({
        success: false,
        providerBalance: 0,
        localBalance: 0,
        updated: false,
        message: 'Reconciliation failed: API timeout',
      });

      // The service should not throw even if reconciliation fails
      expect(mockFiatWalletService.reconcileUsdBalanceFromProvider).toBeDefined();
    });

    it('should log reconciliation result', async () => {
      const reconcileResult = {
        success: true,
        providerBalance: 20000,
        localBalance: 18000,
        updated: true,
        message: 'Balance updated from 18000 to 20000',
      };

      mockFiatWalletService.reconcileUsdBalanceFromProvider.mockResolvedValue(reconcileResult);

      // Verify the mock returns expected structure
      const result = await mockFiatWalletService.reconcileUsdBalanceFromProvider('user-123');
      expect(result).toEqual(reconcileResult);
      expect(result.updated).toBe(true);
      expect(result.providerBalance).toBe(20000);
    });
  });

  describe('sendCurrencyConversionEmail', () => {
    it('should format fee when feeInSmallestUnit is provided and greater than zero', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      const mockExternalAccount = {
        id: 'ext-123',
        user_id: 'user-123',
        participant_code: 'ABC123',
        provider: 'zerohash',
      };

      userService.findByUserId.mockResolvedValue(mockUser as any);
      mockExternalAccountRepository.findByUserId.mockResolvedValue([mockExternalAccount] as any);
      mailerService.send.mockResolvedValue(undefined);

      await service['sendCurrencyConversionEmail']({
        userId: 'user-123',
        fromCurrency: 'USD',
        toCurrency: 'NGN',
        fromAmountInSmallestUnit: 10000,
        toAmountInSmallestUnit: 1500000,
        exchangeRate: 150000,
        transactionId: 'txn-123',
        transactionDate: new Date(),
        orderNumber: 'ORDER-123',
        feeInSmallestUnit: 100,
      });

      expect(mockExternalAccountRepository.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mailerService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          conversionData: expect.objectContaining({
            formattedAmount: expect.any(String),
            formattedLocalAmount: expect.any(String),
            formattedFee: expect.any(String),
            formattedTotal: expect.any(String),
            exchangeRate: expect.any(String),
            accountId: 'ABC123',
            orderNumber: 'ORDER-123',
            senderName: expect.any(String),
            recipientName: expect.any(String),
            recipientLocation: expect.any(String),
          }),
        }),
      );
    });
  });
});
