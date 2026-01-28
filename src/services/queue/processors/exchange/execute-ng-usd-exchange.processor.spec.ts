import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';

// Mock environment service before any other imports
jest.mock('../../../../config/environment', () => ({
  EnvironmentService: {
    isProduction: jest.fn().mockReturnValue(false),
    getValue: jest.fn().mockReturnValue('test-value'),
    getValues: jest.fn(() => ({
      db_host: 'localhost',
      db_password: 'test',
      db_user: 'test',
      db_name: 'test',
      db_port: 5432,
      db_ssl: false,
    })),
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

// Mock NgToUsdExchangeService to break circular dependency
jest.mock('../../../../modules/exchange/fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.service', () => ({
  NgToUsdExchangeService: jest.fn().mockImplementation(() => ({
    getUserCountryAndProfileOrThrow: jest.fn(),
    createAllSourceTransactionsOrThrow: jest.fn(),
    calculateNgnWithdrawalFee: jest.fn(),
    deductFundsFromUser: jest.fn(),
    updateSourceTransactionsToFailed: jest.fn(),
  })),
}));

import { ExchangeAdapter } from '../../../../adapters/exchange/exchange.adapter';
import { WaasAdapter } from '../../../../adapters/waas/waas.adapter';
import { WaasTransactionStatus } from '../../../../adapters/waas/waas.adapter.interface';
import { EnvironmentService } from '../../../../config';
import { CardTransactionStatus } from '../../../../database/models/cardTransaction/cardTransaction.interface';
import { TransactionStatus } from '../../../../database/models/transaction/transaction.interface';
import { CardTransactionRepository } from '../../../../modules/card/repository/cardTransaction.repository';
import { NgToUsdExchangeEscrowService } from '../../../../modules/exchange/fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.escrow.service';
import { NgToUsdExchangeService } from '../../../../modules/exchange/fiat-exchange/ng-to-usd-exchange.service/ng-to-usd-exchange.service';
import { FiatWalletService } from '../../../../modules/fiatWallet';
import { FiatWalletTransactionRepository } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.service';
import { PagaLedgerAccountService } from '../../../../modules/pagaLedgerAccount/pagaLedgerAccount.service';
import { PagaLedgerTransactionService } from '../../../../modules/pagaLedgerTransaction/pagaLedgerTransaction.service';
import { RateService } from '../../../../modules/rate/rate.service';
import { TransactionRepository } from '../../../../modules/transaction';
import { TransactionService } from '../../../../modules/transaction/transaction.service';
import { VirtualAccountService } from '../../../../modules/virtualAccount/virtualAccount.service';
import { QueueService } from '../../queue.service';
import { ExecuteNgToUSDExchangeJobData, ExecuteNgUsdExchangeProcessor } from './execute-ng-usd-exchange.processor';

describe('ExecuteNgUsdExchangeProcessor', () => {
  let processor: ExecuteNgUsdExchangeProcessor;
  let queueService: jest.Mocked<QueueService>;
  let exchangeAdapter: jest.Mocked<ExchangeAdapter>;
  let transactionService: jest.Mocked<TransactionService>;
  let fiatWalletTransactionService: jest.Mocked<FiatWalletTransactionService>;
  let waasAdapter: jest.Mocked<WaasAdapter>;
  let transactionRepository: jest.Mocked<TransactionRepository>;
  let ngToUsdExchangeService: jest.Mocked<NgToUsdExchangeService>;
  let fiatWalletService: jest.Mocked<FiatWalletService>;
  let pagaLedgerAccountService: jest.Mocked<PagaLedgerAccountService>;
  let virtualAccountService: jest.Mocked<VirtualAccountService>;
  let pagaLedgerTransactionService: jest.Mocked<PagaLedgerTransactionService>;
  let rateService: jest.Mocked<RateService>;
  let ngToUsdExchangeEscrowService: jest.Mocked<NgToUsdExchangeEscrowService>;
  let cardTransactionRepository: jest.Mocked<CardTransactionRepository>;

  const mockJobData: ExecuteNgToUSDExchangeJobData = {
    transactionReference: 'txn-ref-123',
    accountNumber: '1234567890',
    rateId: 'rate-123',
    userId: 'user-123',
    isCardFunding: false,
    cardTransactionId: undefined,
    depositAddress: undefined,
  };

  const mockTransactionData = {
    amount: 160000,
    fromCurrency: 'NGN',
    to: 'USD',
    from: 'NGN',
    destinationWalletAddress: '0x123456789',
    rate: { id: 'rate-123', rate: 1600 },
    activeChannelRef: 'channel-123',
    activeNetworkRef: 'network-123',
    transferType: 'deposit',
    totalFee: 100,
  };

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    country: { code: 'NG' },
  };

  const mockPayInRequest = {
    ref: 'payin-ref-123',
    feeLocal: 50,
    networkFeeLocal: 25,
    partnerFeeLocal: 10,
    feeUSD: 0.05,
    networkFeeUSD: 0.025,
    partnerFeeUSD: 0.01,
    convertedAmount: 160000,
    receiverCryptoInfo: {
      cryptoAmount: 10.5,
    },
    bankInfo: {
      name: 'Test Bank',
      accountNumber: '9876543210',
    },
  };

  const mockTransaction = {
    id: 'txn-123',
    user_id: 'user-123',
    reference: 'txn-ref-123',
    status: TransactionStatus.INITIATED,
    metadata: {
      from: 'NGN',
    },
  };

  const mockFiatTransaction = {
    id: 'fiat-txn-123',
    transaction_id: 'txn-123',
    currency: 'NGN',
    fiat_wallet_id: 'wallet-123',
  };

  const mockFiatWallet = {
    id: 'wallet-123',
    user_id: 'user-123',
    balance: 1000000,
  };

  const mockVirtualAccount = {
    id: 'va-123',
    account_number: '1234567890',
    user_id: 'user-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecuteNgUsdExchangeProcessor,
        {
          provide: QueueService,
          useValue: {
            processJobs: jest.fn(),
            addJob: jest.fn(),
          },
        },
        {
          provide: ExchangeAdapter,
          useValue: {
            getPayInRequestByTransactionRef: jest.fn(),
            acceptPayInRequest: jest.fn(),
          },
        },
        {
          provide: TransactionService,
          useValue: {
            findOne: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: FiatWalletTransactionService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: WaasAdapter,
          useValue: {
            getBankList: jest.fn(),
            transferToOtherBank: jest.fn(),
            getTransactionStatus: jest.fn(),
            getProvider: jest.fn(() => ({
              getProviderName: () => 'paga',
            })),
          },
        },
        {
          provide: TransactionRepository,
          useValue: {
            findOne: jest.fn(),
            transaction: jest.fn((cb) => cb()),
          },
        },
        {
          provide: FiatWalletTransactionRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: NgToUsdExchangeService,
          useValue: {
            getUserCountryAndProfileOrThrow: jest.fn(),
            createAllSourceTransactionsOrThrow: jest.fn(),
            calculateNgnWithdrawalFee: jest.fn(),
            deductFundsFromUser: jest.fn(),
            updateSourceTransactionsToFailed: jest.fn(),
          },
        },
        {
          provide: FiatWalletService,
          useValue: {
            checkIfUserHasEnoughBalanceOrThrow: jest.fn(),
            getUserWallet: jest.fn(),
          },
        },
        {
          provide: PagaLedgerAccountService,
          useValue: {
            findOne: jest.fn(),
            updateBalance: jest.fn(),
          },
        },
        {
          provide: VirtualAccountService,
          useValue: {
            findOneByUserIdOrThrow: jest.fn(),
          },
        },
        {
          provide: PagaLedgerTransactionService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: RateService,
          useValue: {
            validateRateOrThrow: jest.fn(),
          },
        },
        {
          provide: NgToUsdExchangeEscrowService,
          useValue: {
            getTransactionData: jest.fn(),
          },
        },
        {
          provide: CardTransactionRepository,
          useValue: {
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<ExecuteNgUsdExchangeProcessor>(ExecuteNgUsdExchangeProcessor);
    queueService = module.get(QueueService);
    exchangeAdapter = module.get(ExchangeAdapter);
    transactionService = module.get(TransactionService);
    fiatWalletTransactionService = module.get(FiatWalletTransactionService);
    waasAdapter = module.get(WaasAdapter);
    transactionRepository = module.get(TransactionRepository);
    ngToUsdExchangeService = module.get(NgToUsdExchangeService);
    fiatWalletService = module.get(FiatWalletService);
    pagaLedgerAccountService = module.get(PagaLedgerAccountService);
    virtualAccountService = module.get(VirtualAccountService);
    pagaLedgerTransactionService = module.get(PagaLedgerTransactionService);
    rateService = module.get(RateService);
    ngToUsdExchangeEscrowService = module.get(NgToUsdExchangeEscrowService);
    cardTransactionRepository = module.get(CardTransactionRepository);

    jest.clearAllMocks();
  });

  describe('queueExecuteNgToUSDExchange', () => {
    it('should queue exchange execution job with correct parameters', async () => {
      const mockJob = { id: 'job-123' };
      queueService.addJob.mockResolvedValue(mockJob as any);

      const result = await processor.queueExecuteNgToUSDExchange(mockJobData);

      expect(queueService.addJob).toHaveBeenCalledWith(
        'execute-ng-usd-exchange',
        'execute-ng-to-usd-exchange',
        mockJobData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
      expect(result).toEqual(mockJob);
    });

    it('should register processor on first call', async () => {
      const mockJob = { id: 'job-123' };
      queueService.addJob.mockResolvedValue(mockJob as any);

      await processor.queueExecuteNgToUSDExchange(mockJobData);

      expect(queueService.processJobs).toHaveBeenCalledWith(
        'execute-ng-usd-exchange',
        'execute-ng-to-usd-exchange',
        expect.any(Function),
        2,
      );
    });

    it('should not register processor on subsequent calls', async () => {
      const mockJob = { id: 'job-123' };
      queueService.addJob.mockResolvedValue(mockJob as any);

      await processor.queueExecuteNgToUSDExchange(mockJobData);
      await processor.queueExecuteNgToUSDExchange(mockJobData);

      expect(queueService.processJobs).toHaveBeenCalledTimes(1);
    });
  });

  describe('processExecuteNgToUSDExchange', () => {
    beforeEach(() => {
      ngToUsdExchangeEscrowService.getTransactionData.mockResolvedValue(mockTransactionData as any);
      ngToUsdExchangeService.getUserCountryAndProfileOrThrow.mockResolvedValue(mockUser as any);
      exchangeAdapter.getPayInRequestByTransactionRef.mockResolvedValue(mockPayInRequest as any);
      ngToUsdExchangeService.calculateNgnWithdrawalFee.mockResolvedValue(50);
      fiatWalletService.checkIfUserHasEnoughBalanceOrThrow.mockResolvedValue(undefined);
      ngToUsdExchangeService.createAllSourceTransactionsOrThrow.mockResolvedValue({
        parentTransaction: mockTransaction,
        fiatTransaction: mockFiatTransaction,
      } as any);
      rateService.validateRateOrThrow.mockResolvedValue(undefined);
      exchangeAdapter.acceptPayInRequest.mockResolvedValue(mockPayInRequest as any);
      waasAdapter.getBankList.mockResolvedValue([
        { bankName: 'Test Bank', nibssBankCode: '001', bankRef: 'test-ref' },
      ] as any);
      transactionService.findOne.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatTransaction as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      ngToUsdExchangeService.deductFundsFromUser.mockResolvedValue(undefined);
      waasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      } as any);
      waasAdapter.getTransactionStatus.mockResolvedValue({
        status: WaasTransactionStatus.PENDING,
      } as any);
      virtualAccountService.findOneByUserIdOrThrow.mockResolvedValue(mockVirtualAccount as any);
      pagaLedgerAccountService.findOne.mockResolvedValue({
        account_number: '1234567890',
        available_balance: 1000000,
      } as any);
      pagaLedgerTransactionService.create.mockResolvedValue({ id: 'paga-txn-123' } as any);
    });

    it('should throw error when transaction data not found', async () => {
      const mockJob: Partial<Job<ExecuteNgToUSDExchangeJobData>> = {
        data: mockJobData,
      };

      ngToUsdExchangeEscrowService.getTransactionData.mockResolvedValue(null);

      const processMethod = (processor as any).processExecuteNgToUSDExchange.bind(processor);

      await expect(processMethod(mockJob as Job<ExecuteNgToUSDExchangeJobData>)).rejects.toThrow(BadRequestException);
    });

    it('should throw error when pay in request not found', async () => {
      const mockJob: Partial<Job<ExecuteNgToUSDExchangeJobData>> = {
        data: mockJobData,
      };

      exchangeAdapter.getPayInRequestByTransactionRef.mockResolvedValue(null);

      const processMethod = (processor as any).processExecuteNgToUSDExchange.bind(processor);

      await expect(processMethod(mockJob as Job<ExecuteNgToUSDExchangeJobData>)).rejects.toThrow(BadRequestException);
    });

    it('should throw error when account number is missing', async () => {
      const mockJob: Partial<Job<ExecuteNgToUSDExchangeJobData>> = {
        data: { ...mockJobData, accountNumber: '' },
      };

      const processMethod = (processor as any).processExecuteNgToUSDExchange.bind(processor);

      await expect(processMethod(mockJob as Job<ExecuteNgToUSDExchangeJobData>)).rejects.toThrow(BadRequestException);
    });

    it('should handle card funding scenario with deposit address', async () => {
      const cardFundingJobData: ExecuteNgToUSDExchangeJobData = {
        ...mockJobData,
        isCardFunding: true,
        cardTransactionId: 'card-txn-123',
        depositAddress: '0xRainDepositAddress',
      };

      const mockJob: Partial<Job<ExecuteNgToUSDExchangeJobData>> = {
        data: cardFundingJobData,
      };

      const processMethod = (processor as any).processExecuteNgToUSDExchange.bind(processor);
      const result = await processMethod(mockJob as Job<ExecuteNgToUSDExchangeJobData>);

      expect(result.status).toBe('processing');
      expect(result.cardTransactionId).toBe('card-txn-123');
      expect(cardTransactionRepository.update).toHaveBeenCalledWith(
        { id: 'card-txn-123' },
        {
          status: CardTransactionStatus.PENDING,
          parent_exchange_transaction_id: 'txn-123',
        },
      );
    });

    it('should update card transaction to DECLINED on error for card funding', async () => {
      const cardFundingJobData: ExecuteNgToUSDExchangeJobData = {
        ...mockJobData,
        isCardFunding: true,
        cardTransactionId: 'card-txn-123',
        depositAddress: '0xRainDepositAddress',
      };

      const mockJob: Partial<Job<ExecuteNgToUSDExchangeJobData>> = {
        data: cardFundingJobData,
      };

      ngToUsdExchangeEscrowService.getTransactionData.mockResolvedValue(null);

      const processMethod = (processor as any).processExecuteNgToUSDExchange.bind(processor);

      try {
        await processMethod(mockJob as Job<ExecuteNgToUSDExchangeJobData>);
      } catch {
        // Expected to throw
      }

      expect(cardTransactionRepository.update).toHaveBeenCalledWith(
        { id: 'card-txn-123' },
        expect.objectContaining({
          status: CardTransactionStatus.DECLINED,
          declined_reason: expect.any(String),
        }),
      );
    });

    it('should truncate long error messages for declined reason', async () => {
      const cardFundingJobData: ExecuteNgToUSDExchangeJobData = {
        ...mockJobData,
        isCardFunding: true,
        cardTransactionId: 'card-txn-123',
        depositAddress: '0xRainDepositAddress',
      };

      const mockJob: Partial<Job<ExecuteNgToUSDExchangeJobData>> = {
        data: cardFundingJobData,
      };

      const longErrorMessage = 'A'.repeat(300);
      ngToUsdExchangeEscrowService.getTransactionData.mockRejectedValue(new Error(longErrorMessage));

      const processMethod = (processor as any).processExecuteNgToUSDExchange.bind(processor);

      try {
        await processMethod(mockJob as Job<ExecuteNgToUSDExchangeJobData>);
      } catch {
        // Expected to throw
      }

      expect(cardTransactionRepository.update).toHaveBeenCalledWith(
        { id: 'card-txn-123' },
        expect.objectContaining({
          status: CardTransactionStatus.DECLINED,
          declined_reason: expect.stringMatching(/^A{252}\.\.\.$/),
        }),
      );
    });
  });

  describe('sendMoneyToYellowcard', () => {
    beforeEach(() => {
      transactionService.findOne.mockResolvedValue(mockTransaction as any);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatTransaction as any);
      fiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      ngToUsdExchangeService.calculateNgnWithdrawalFee.mockResolvedValue(50);
      ngToUsdExchangeService.deductFundsFromUser.mockResolvedValue(undefined);
      waasAdapter.getBankList.mockResolvedValue([
        { bankName: 'Test Bank', nibssBankCode: '001', bankRef: 'test-ref' },
      ] as any);
      waasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'waas-ref-123',
      } as any);
      waasAdapter.getTransactionStatus.mockResolvedValue({
        status: WaasTransactionStatus.PENDING,
      } as any);
      virtualAccountService.findOneByUserIdOrThrow.mockResolvedValue(mockVirtualAccount as any);
      pagaLedgerAccountService.findOne.mockResolvedValue({
        account_number: '1234567890',
        available_balance: 1000000,
      } as any);
      pagaLedgerTransactionService.create.mockResolvedValue({ id: 'paga-txn-123' } as any);
      pagaLedgerAccountService.updateBalance.mockResolvedValue(undefined);
    });

    it('should throw error when bank not found in bank list', async () => {
      waasAdapter.getBankList.mockResolvedValue([
        { bankName: 'Other Bank', nibssBankCode: '002', bankRef: 'other-ref' },
      ] as any);

      const sendMoneyMethod = (processor as any).sendMoneyToYellowcard.bind(processor);

      await expect(
        sendMoneyMethod(160000, '1234567890', { name: 'Test Bank', accountNumber: '9876543210' }, 'txn-ref-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when user wallet not found', async () => {
      fiatWalletService.getUserWallet.mockResolvedValue(null);

      const sendMoneyMethod = (processor as any).sendMoneyToYellowcard.bind(processor);

      await expect(
        sendMoneyMethod(160000, '1234567890', { name: 'Test Bank', accountNumber: '9876543210' }, 'txn-ref-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when transfer fails', async () => {
      waasAdapter.getTransactionStatus.mockResolvedValue({
        status: WaasTransactionStatus.FAILED,
      } as any);

      const sendMoneyMethod = (processor as any).sendMoneyToYellowcard.bind(processor);

      await expect(
        sendMoneyMethod(160000, '1234567890', { name: 'Test Bank', accountNumber: '9876543210' }, 'txn-ref-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip fund deduction when transaction is already completed', async () => {
      transactionService.findOne.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
      } as any);

      const sendMoneyMethod = (processor as any).sendMoneyToYellowcard.bind(processor);

      await sendMoneyMethod(160000, '1234567890', { name: 'Test Bank', accountNumber: '9876543210' }, 'txn-ref-123');

      expect(ngToUsdExchangeService.deductFundsFromUser).not.toHaveBeenCalled();
    });

    it('should use development bank account number in non-production', async () => {
      (EnvironmentService.isProduction as jest.Mock).mockReturnValue(false);

      const sendMoneyMethod = (processor as any).sendMoneyToYellowcard.bind(processor);

      await sendMoneyMethod(160000, '1234567890', { name: 'Test Bank', accountNumber: '9876543210' }, 'txn-ref-123');

      expect(waasAdapter.transferToOtherBank).toHaveBeenCalledWith(
        expect.objectContaining({
          receiver: expect.objectContaining({
            // In development, uses PAGA_DEVELOPMENT_BANK_ACCOUNT_NUMBER
            accountNumber: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('createAFeeRecordForTheTransactionForThePagaLedgerAccounts', () => {
    beforeEach(() => {
      virtualAccountService.findOneByUserIdOrThrow.mockResolvedValue(mockVirtualAccount as any);
      pagaLedgerAccountService.findOne.mockResolvedValue({
        account_number: '1234567890',
        available_balance: 1000000,
      } as any);
      transactionRepository.transaction.mockImplementation((cb: any) => cb());
      pagaLedgerTransactionService.create.mockResolvedValue({ id: 'paga-txn-123' } as any);
    });

    it('should create fee record for paga ledger accounts', async () => {
      const createFeeMethod = (processor as any).createAFeeRecordForTheTransactionForThePagaLedgerAccounts.bind(
        processor,
      );

      await createFeeMethod('user-123', 50);

      expect(virtualAccountService.findOneByUserIdOrThrow).toHaveBeenCalledWith('user-123');
      expect(pagaLedgerAccountService.findOne).toHaveBeenCalledWith({
        account_number: '1234567890',
      });
      expect(pagaLedgerTransactionService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          account_number: '1234567890',
          transaction_type: 'DEBIT',
          status: 'PENDING',
        }),
        undefined,
      );
    });
  });
});
