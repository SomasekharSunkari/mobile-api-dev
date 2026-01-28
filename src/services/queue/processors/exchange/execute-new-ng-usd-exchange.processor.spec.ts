import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { ExchangeAdapter } from '../../../../adapters/exchange/exchange.adapter';
import { TransactionStatus } from '../../../../database';
import { FiatExchangeService } from '../../../../modules/exchange/fiat-exchange/fiat-exchange.service';
import { NewNgToUsdExchangeService } from '../../../../modules/exchange/fiat-exchange/ng-to-usd-exchange.service/new-ng-to-usd-exchange.service';
import { FiatWalletService } from '../../../../modules/fiatWallet/fiatWallet.service';
import { FiatWalletTransactionService } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.service';
import { PagaLedgerAccountService } from '../../../../modules/pagaLedgerAccount/pagaLedgerAccount.service';
import { PagaLedgerTransactionService } from '../../../../modules/pagaLedgerTransaction/pagaLedgerTransaction.service';
import { TransactionRepository } from '../../../../modules/transaction/transaction.repository';
import { TransactionService } from '../../../../modules/transaction/transaction.service';
import { QueueService } from '../../queue.service';
import {
  ExecuteNewNgUsdExchangeJobData,
  ExecuteNewNgUsdExchangeProcessor,
} from './execute-new-ng-usd-exchange.processor';

describe('ExecuteNewNgUsdExchangeProcessor', () => {
  let processor: ExecuteNewNgUsdExchangeProcessor;
  let queueService: jest.Mocked<QueueService>;
  let transactionRepository: jest.Mocked<TransactionRepository>;
  let fiatWalletTransactionService: jest.Mocked<FiatWalletTransactionService>;
  let transactionService: jest.Mocked<TransactionService>;
  let newNgToUsdExchangeService: jest.Mocked<NewNgToUsdExchangeService>;
  let exchangeAdapter: jest.Mocked<ExchangeAdapter>;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
  };

  const mockParentTransaction = {
    id: 'txn-123',
    user_id: 'user-123',
    amount: 10000,
    status: TransactionStatus.INITIATED,
    transaction_type: 'exchange',
    external_reference: 'ext-ref-123',
    reference: 'ref-123',
    metadata: {
      source_currency: 'NGN',
      destination_currency: 'USD',
      from_currency_code: 'NGN',
    },
  };

  const mockFiatTransaction = {
    id: 'fwt-123',
    transaction_id: 'txn-123',
    user_id: 'user-123',
    amount: 10000,
    status: TransactionStatus.INITIATED,
    provider_metadata: {},
  };

  const mockActiveChannel = {
    ref: 'channel-123',
    status: 'active',
    rampType: 'deposit',
    min: 1000,
    max: 1000000,
  };

  const mockActiveNetwork = {
    ref: 'network-123',
    status: 'active',
    channelRefs: ['channel-123'],
  };

  const mockPayload = {
    from: 'NGN',
    to: 'USD',
    amount: 10000,
    rate_id: 'rate-123',
  };

  const mockPayInRequest = {
    ref: 'payin-ref-123',
    convertedAmount: 6.25,
    feeLocal: 50,
    networkFeeLocal: 25,
    partnerFeeLocal: 10,
    feeUSD: 0.05,
    networkFeeUSD: 0.025,
    partnerFeeUSD: 0.01,
    receiverCryptoInfo: {
      cryptoAmount: 10.5,
    },
    bankInfo: {
      name: 'Providus Bank',
      accountNumber: '1234567890',
      accountName: 'Yellow Card',
    },
  };

  const mockSendMoneyResponse = {
    status: 'success',
    transactionReference: 'txn-ref-123',
  };

  const mockJobData: ExecuteNewNgUsdExchangeJobData = {
    localAmount: 6.25,
    user: mockUser as any,
    parentTransaction: mockParentTransaction as any,
    activeChannel: mockActiveChannel as any,
    activeNetwork: mockActiveNetwork as any,
    payload: mockPayload as any,
    fiatTransaction: mockFiatTransaction as any,
  };

  const mockJob: Partial<Job<ExecuteNewNgUsdExchangeJobData>> = {
    id: 'test-job-id',
    data: mockJobData,
    updateProgress: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecuteNewNgUsdExchangeProcessor,
        {
          provide: QueueService,
          useValue: {
            processJobs: jest.fn(),
            addJob: jest.fn(),
          },
        },
        {
          provide: TransactionRepository,
          useValue: {
            transaction: jest.fn((callback) => callback()),
            update: jest.fn(),
          },
        },
        {
          provide: FiatWalletTransactionService,
          useValue: {
            updateStatus: jest.fn(),
          },
        },
        {
          provide: FiatWalletService,
          useValue: {
            checkIfUserHasEnoughBalanceOrThrow: jest.fn(),
          },
        },
        {
          provide: TransactionService,
          useValue: {
            updateStatus: jest.fn(),
          },
        },
        {
          provide: FiatExchangeService,
          useValue: {
            getValidatedVirtualAccount: jest.fn(),
          },
        },
        {
          provide: NewNgToUsdExchangeService,
          useValue: {
            createPayInRequest: jest.fn(),
            sendMoneyFromCompanyAccountToYellowcard: jest.fn(),
            verifyTransferStatusToYellowcard: jest.fn(),
            updateTransactionsWithFees: jest.fn(),
            updateSourceTransactionsToFailed: jest.fn(),
          },
        },
        {
          provide: ExchangeAdapter,
          useValue: {
            cancelPayInRequest: jest.fn(),
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
          provide: PagaLedgerTransactionService,
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<ExecuteNewNgUsdExchangeProcessor>(ExecuteNewNgUsdExchangeProcessor);
    queueService = module.get(QueueService);
    transactionRepository = module.get(TransactionRepository);
    fiatWalletTransactionService = module.get(FiatWalletTransactionService);
    transactionService = module.get(TransactionService);
    newNgToUsdExchangeService = module.get(NewNgToUsdExchangeService);
    exchangeAdapter = module.get(ExchangeAdapter);

    jest.clearAllMocks();
  });

  describe('queueExecuteNewNgUsdExchange', () => {
    it('should register processor and queue job successfully', async () => {
      const mockJobResult = { id: 'job-123' };
      queueService.addJob.mockResolvedValue(mockJobResult as any);

      const result = await processor.queueExecuteNewNgUsdExchange(mockJobData);

      expect(queueService.addJob).toHaveBeenCalledWith(
        'execute-new-ng-usd-exchange',
        'execute-new-ng-usd-exchange',
        mockJobData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
      expect(result).toEqual(mockJobResult);
    });

    it('should register processor only once on multiple queue calls', async () => {
      queueService.addJob.mockResolvedValue({ id: 'job-123' } as any);

      await processor.queueExecuteNewNgUsdExchange(mockJobData);
      await processor.queueExecuteNewNgUsdExchange(mockJobData);

      expect(queueService.processJobs).toHaveBeenCalledTimes(1);
    });

    it('should configure job with retry options', async () => {
      queueService.addJob.mockResolvedValue({ id: 'job-123' } as any);

      await processor.queueExecuteNewNgUsdExchange(mockJobData);

      expect(queueService.addJob).toHaveBeenCalledWith(
        'execute-new-ng-usd-exchange',
        'execute-new-ng-usd-exchange',
        mockJobData,
        expect.objectContaining({
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }),
      );
    });
  });

  describe('processNewNgUsdExchange', () => {
    beforeEach(() => {
      newNgToUsdExchangeService.createPayInRequest.mockResolvedValue(mockPayInRequest as any);
      newNgToUsdExchangeService.sendMoneyFromCompanyAccountToYellowcard.mockResolvedValue(mockSendMoneyResponse as any);
      newNgToUsdExchangeService.verifyTransferStatusToYellowcard.mockResolvedValue(true);
      newNgToUsdExchangeService.updateTransactionsWithFees.mockResolvedValue(undefined);
      newNgToUsdExchangeService.updateSourceTransactionsToFailed.mockResolvedValue(undefined);
    });

    it('should successfully process new ng usd exchange', async () => {
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);

      await processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>);

      expect(newNgToUsdExchangeService.createPayInRequest).toHaveBeenCalled();
      expect(newNgToUsdExchangeService.sendMoneyFromCompanyAccountToYellowcard).toHaveBeenCalled();
      expect(newNgToUsdExchangeService.verifyTransferStatusToYellowcard).toHaveBeenCalled();
      expect(newNgToUsdExchangeService.updateTransactionsWithFees).toHaveBeenCalled();
    });

    it('should create pay in request with correct parameters', async () => {
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);

      await processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>);

      expect(newNgToUsdExchangeService.createPayInRequest).toHaveBeenCalledWith({
        forceAccept: true,
        localAmount: mockJobData.localAmount,
        user: mockJobData.user,
        parentTransactionId: mockJobData.parentTransaction.id,
        activeChannelRef: mockJobData.activeChannel.ref,
        activeNetworkRef: mockJobData.activeNetwork.ref,
        transferType: mockJobData.activeChannel.rampType,
        fromCurrency: mockJobData.parentTransaction.metadata.from_currency_code,
      });
    });

    it('should update transaction with external reference from pay in request', async () => {
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);

      await processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>);

      expect(transactionRepository.update).toHaveBeenCalledWith(
        mockJobData.parentTransaction.id,
        expect.objectContaining({
          external_reference: mockPayInRequest.ref,
        }),
      );
    });

    it('should update transaction metadata with usd_amount and local_amount', async () => {
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);

      await processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>);

      expect(transactionRepository.update).toHaveBeenCalledWith(
        mockJobData.parentTransaction.id,
        expect.objectContaining({
          metadata: expect.objectContaining({
            usd_amount: mockJobData.localAmount,
            local_amount: mockJobData.payload.amount,
          }),
        }),
      );
    });

    it('should update parent transaction status to PENDING twice (before and after transfer)', async () => {
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);

      await processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>);

      expect(transactionService.updateStatus).toHaveBeenCalledTimes(2);
      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        mockJobData.parentTransaction.id,
        TransactionStatus.PENDING,
        {},
        undefined,
      );
    });

    it('should update fiat wallet transaction status to PENDING twice (before and after transfer)', async () => {
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);

      await processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>);

      expect(fiatWalletTransactionService.updateStatus).toHaveBeenCalledTimes(2);
      expect(fiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        mockJobData.fiatTransaction.id,
        TransactionStatus.PENDING,
        {},
        undefined,
      );
    });

    it('should send money to yellowcard with correct parameters', async () => {
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);

      await processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>);

      expect(newNgToUsdExchangeService.sendMoneyFromCompanyAccountToYellowcard).toHaveBeenCalledWith(
        mockPayInRequest.convertedAmount,
        mockPayInRequest.bankInfo,
      );
    });

    it('should verify transfer status to yellowcard', async () => {
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);

      await processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>);

      expect(newNgToUsdExchangeService.verifyTransferStatusToYellowcard).toHaveBeenCalledWith(
        mockSendMoneyResponse.transactionReference,
      );
    });

    it('should calculate total fees correctly and update transactions', async () => {
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);

      await processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>);

      // totalFeeLocal = 50 + 25 + 10 = 85
      // totalFeeUSD = 0.05 + 0.025 + 0.01 = 0.085
      // amountToReceiveUSD = 10.5
      // amountToPayLocal = 10000 - 85 = 9915

      expect(newNgToUsdExchangeService.updateTransactionsWithFees).toHaveBeenCalledWith(
        mockJobData.parentTransaction,
        mockJobData.fiatTransaction,
        85, // totalFeeLocal
        0.085, // totalFeeUSD
        10.5, // amountToReceiveUSD
        9915, // amountToPayLocal
        0, // dosh amount
      );
    });

    it('should use transaction wrapper twice for atomic operations', async () => {
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);

      await processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>);

      expect(transactionRepository.transaction).toHaveBeenCalledTimes(2);
    });

    it('should cancel pay in request when transfer verification fails', async () => {
      newNgToUsdExchangeService.verifyTransferStatusToYellowcard.mockResolvedValue(false);
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);

      await expect(processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>)).rejects.toThrow(
        'Transfer to Yellowcard failed',
      );

      expect(exchangeAdapter.cancelPayInRequest).toHaveBeenCalledWith({
        ref: mockPayInRequest.ref,
      });
    });
  });

  describe('registerProcessor', () => {
    it('should register processor with correct queue name and job name', async () => {
      queueService.addJob.mockResolvedValue({ id: 'job-123' } as any);

      await processor.queueExecuteNewNgUsdExchange(mockJobData);

      expect(queueService.processJobs).toHaveBeenCalledWith(
        'execute-new-ng-usd-exchange',
        'execute-new-ng-usd-exchange',
        expect.any(Function),
        2,
      );
    });

    it('should set concurrency to 2', async () => {
      queueService.addJob.mockResolvedValue({ id: 'job-123' } as any);

      await processor.queueExecuteNewNgUsdExchange(mockJobData);

      expect(queueService.processJobs).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Function),
        2,
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      newNgToUsdExchangeService.createPayInRequest.mockResolvedValue(mockPayInRequest as any);
      newNgToUsdExchangeService.sendMoneyFromCompanyAccountToYellowcard.mockResolvedValue(mockSendMoneyResponse as any);
      newNgToUsdExchangeService.verifyTransferStatusToYellowcard.mockResolvedValue(true);
      newNgToUsdExchangeService.updateSourceTransactionsToFailed.mockResolvedValue(undefined);
    });

    it('should propagate error when createPayInRequest fails', async () => {
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);
      newNgToUsdExchangeService.createPayInRequest.mockRejectedValue(new Error('Pay in request failed'));

      await expect(processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>)).rejects.toThrow(
        'Pay in request failed',
      );
    });

    it('should call updateSourceTransactionsToFailed when an error occurs', async () => {
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);
      newNgToUsdExchangeService.createPayInRequest.mockRejectedValue(new Error('Pay in request failed'));

      await expect(processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>)).rejects.toThrow();

      expect(newNgToUsdExchangeService.updateSourceTransactionsToFailed).toHaveBeenCalledWith(
        mockJobData.parentTransaction.id,
        'Pay in request failed',
      );
    });

    it('should propagate error when sendMoneyToYellowcard fails', async () => {
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);
      newNgToUsdExchangeService.sendMoneyFromCompanyAccountToYellowcard.mockRejectedValue(
        new Error('Transfer to yellowcard failed'),
      );

      await expect(processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>)).rejects.toThrow(
        'Transfer to yellowcard failed',
      );
    });

    it('should propagate error when verifyTransferStatusToYellowcard fails', async () => {
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);
      newNgToUsdExchangeService.verifyTransferStatusToYellowcard.mockRejectedValue(new Error('Verification failed'));

      await expect(processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>)).rejects.toThrow(
        'Verification failed',
      );
    });

    it('should propagate error when updateTransactionsWithFees fails', async () => {
      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);
      newNgToUsdExchangeService.updateTransactionsWithFees.mockRejectedValue(
        new Error('Failed to update transactions'),
      );

      await expect(processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>)).rejects.toThrow(
        'Failed to update transactions',
      );
    });
  });

  describe('Fee Calculations', () => {
    beforeEach(() => {
      newNgToUsdExchangeService.sendMoneyFromCompanyAccountToYellowcard.mockResolvedValue(mockSendMoneyResponse as any);
      newNgToUsdExchangeService.verifyTransferStatusToYellowcard.mockResolvedValue(true);
      newNgToUsdExchangeService.updateTransactionsWithFees.mockResolvedValue(undefined);
      newNgToUsdExchangeService.updateSourceTransactionsToFailed.mockResolvedValue(undefined);
    });

    it('should calculate total fee local correctly with different fee values', async () => {
      const customPayInRequest = {
        ...mockPayInRequest,
        feeLocal: 100,
        networkFeeLocal: 50,
        partnerFeeLocal: 25,
      };
      newNgToUsdExchangeService.createPayInRequest.mockResolvedValue(customPayInRequest as any);

      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);
      await processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>);

      // totalFeeLocal = 100 + 50 + 25 = 175
      expect(newNgToUsdExchangeService.updateTransactionsWithFees).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        175,
        expect.anything(),
        expect.anything(),
        expect.anything(),
        0,
      );
    });

    it('should calculate total fee USD correctly with different fee values', async () => {
      const customPayInRequest = {
        ...mockPayInRequest,
        feeUSD: 1,
        networkFeeUSD: 0.5,
        partnerFeeUSD: 0.25,
      };
      newNgToUsdExchangeService.createPayInRequest.mockResolvedValue(customPayInRequest as any);

      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);
      await processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>);

      // totalFeeUSD = 1.0 + 0.5 + 0.25 = 1.75
      expect(newNgToUsdExchangeService.updateTransactionsWithFees).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        1.75,
        expect.anything(),
        expect.anything(),
        0,
      );
    });

    it('should calculate amount to receive USD from receiverCryptoInfo', async () => {
      const customPayInRequest = {
        ...mockPayInRequest,
        receiverCryptoInfo: {
          cryptoAmount: 25.5,
        },
      };
      newNgToUsdExchangeService.createPayInRequest.mockResolvedValue(customPayInRequest as any);

      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);
      await processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>);

      expect(newNgToUsdExchangeService.updateTransactionsWithFees).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        25.5,
        expect.anything(),
        0,
      );
    });

    it('should calculate amount to pay local correctly (amount - totalFeeLocal)', async () => {
      const customPayload = { ...mockPayload, amount: 50000 };
      const customJobData = { ...mockJobData, payload: customPayload };
      const customJob = { ...mockJob, data: customJobData };
      const customPayInRequest = {
        ...mockPayInRequest,
        feeLocal: 200,
        networkFeeLocal: 100,
        partnerFeeLocal: 50,
      };
      newNgToUsdExchangeService.createPayInRequest.mockResolvedValue(customPayInRequest as any);

      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);
      await processMethod(customJob as Job<ExecuteNewNgUsdExchangeJobData>);

      // amountToPayLocal = 50000 - (200 + 100 + 50) = 50000 - 350 = 49650
      expect(newNgToUsdExchangeService.updateTransactionsWithFees).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        49650,
        0,
      );
    });

    it('should handle zero fees correctly', async () => {
      const zeroFeePayInRequest = {
        ...mockPayInRequest,
        feeLocal: 0,
        networkFeeLocal: 0,
        partnerFeeLocal: 0,
        feeUSD: 0,
        networkFeeUSD: 0,
        partnerFeeUSD: 0,
      };
      newNgToUsdExchangeService.createPayInRequest.mockResolvedValue(zeroFeePayInRequest as any);

      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);
      await processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>);

      expect(newNgToUsdExchangeService.updateTransactionsWithFees).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        0, // totalFeeLocal
        0, // totalFeeUSD
        expect.anything(),
        mockJobData.payload.amount, // amountToPayLocal = amount - 0 = amount
        0, // dosh amount
      );
    });
  });

  describe('updateAllSourceTransactionsAndFiatTransactionToPending', () => {
    it('should update parent transaction and fiat transaction to PENDING', async () => {
      await processor.updateAllSourceTransactionsAndFiatTransactionToPending(
        mockParentTransaction as any,
        mockFiatTransaction as any,
      );

      expect(transactionRepository.transaction).toHaveBeenCalled();
      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        mockParentTransaction.id,
        TransactionStatus.PENDING,
        {},
        undefined,
      );
      expect(fiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        mockFiatTransaction.id,
        TransactionStatus.PENDING,
        {},
        undefined,
      );
    });
  });

  describe('updateAllSourceTransactionsToSuccessful', () => {
    it('should update parent transaction and fiat transaction to COMPLETED', async () => {
      await processor.updateAllSourceTransactionsToSuccessful(mockParentTransaction as any, mockFiatTransaction as any);

      expect(transactionRepository.transaction).toHaveBeenCalled();
      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        mockParentTransaction.id,
        TransactionStatus.COMPLETED,
        {},
        undefined,
        {
          shouldSendEmail: false,
          shouldSendPushNotification: false,
          shouldSendInAppNotification: false,
        },
      );
      expect(fiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        mockFiatTransaction.id,
        TransactionStatus.COMPLETED,
        {},
        undefined,
      );
    });
  });

  describe('updateAllTransactionsToPending', () => {
    it('should update balance and mark all transactions to PENDING', async () => {
      await processor.updateAllTransactionsToPending(mockParentTransaction as any, mockFiatTransaction as any);

      expect(transactionRepository.transaction).toHaveBeenCalled();
      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        mockParentTransaction.id,
        TransactionStatus.PENDING,
        {},
        undefined,
      );
      expect(fiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        mockFiatTransaction.id,
        TransactionStatus.PENDING,
        {},
        undefined,
      );
    });
  });

  describe('updateTransactionMetadataUsdAmountAndLocalAmount', () => {
    it('should update transaction with external reference and metadata', async () => {
      await processor.updateTransactionMetadataUsdAmountAndLocalAmount(
        mockParentTransaction as any,
        mockPayInRequest as any,
        mockPayload as any,
        6.25,
      );

      expect(transactionRepository.update).toHaveBeenCalledWith(mockParentTransaction.id, {
        external_reference: mockPayInRequest.ref,
        metadata: {
          ...mockParentTransaction.metadata,
          usd_amount: 6.25,
          local_amount: mockPayload.amount,
        },
      });
    });

    it('should preserve existing metadata fields', async () => {
      const transactionWithExtraMetadata = {
        ...mockParentTransaction,
        metadata: {
          ...mockParentTransaction.metadata,
          extra_field: 'extra_value',
        },
      };

      await processor.updateTransactionMetadataUsdAmountAndLocalAmount(
        transactionWithExtraMetadata as any,
        mockPayInRequest as any,
        mockPayload as any,
        6.25,
      );

      expect(transactionRepository.update).toHaveBeenCalledWith(transactionWithExtraMetadata.id, {
        external_reference: mockPayInRequest.ref,
        metadata: expect.objectContaining({
          extra_field: 'extra_value',
          usd_amount: 6.25,
          local_amount: mockPayload.amount,
        }),
      });
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      newNgToUsdExchangeService.createPayInRequest.mockResolvedValue(mockPayInRequest as any);
      newNgToUsdExchangeService.sendMoneyFromCompanyAccountToYellowcard.mockResolvedValue(mockSendMoneyResponse as any);
      newNgToUsdExchangeService.verifyTransferStatusToYellowcard.mockResolvedValue(true);
      newNgToUsdExchangeService.updateTransactionsWithFees.mockResolvedValue(undefined);
      newNgToUsdExchangeService.updateSourceTransactionsToFailed.mockResolvedValue(undefined);
    });

    it('should handle very large converted amounts', async () => {
      const largeAmountJobData = { ...mockJobData, localAmount: 999999999.99 };
      const largeAmountJob = { ...mockJob, data: largeAmountJobData };

      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);
      await processMethod(largeAmountJob as Job<ExecuteNewNgUsdExchangeJobData>);

      expect(newNgToUsdExchangeService.createPayInRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          localAmount: 999999999.99,
        }),
      );
    });

    it('should handle very small converted amounts', async () => {
      const smallAmountJobData = { ...mockJobData, localAmount: 0.01 };
      const smallAmountJob = { ...mockJob, data: smallAmountJobData };

      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);
      await processMethod(smallAmountJob as unknown as Job<ExecuteNewNgUsdExchangeJobData>);

      expect(newNgToUsdExchangeService.createPayInRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          localAmount: 0.01,
        }),
      );
    });

    it('should handle decimal crypto amounts from pay in response', async () => {
      const decimalCryptoPayInRequest = {
        ...mockPayInRequest,
        receiverCryptoInfo: {
          cryptoAmount: 123.456789,
        },
      };
      newNgToUsdExchangeService.createPayInRequest.mockResolvedValue(decimalCryptoPayInRequest as any);

      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);
      await processMethod(mockJob as Job<ExecuteNewNgUsdExchangeJobData>);

      expect(newNgToUsdExchangeService.updateTransactionsWithFees).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        123.456789,
        expect.anything(),
        0,
      );
    });

    it('should preserve parent transaction metadata when updating', async () => {
      const transactionWithMetadata = {
        ...mockParentTransaction,
        metadata: {
          source_currency: 'NGN',
          destination_currency: 'USD',
          from_currency_code: 'NGN',
          existing_field: 'should_be_preserved',
        },
      };
      const jobDataWithMetadata = { ...mockJobData, parentTransaction: transactionWithMetadata as any };
      const jobWithMetadata = { ...mockJob, data: jobDataWithMetadata };

      const processMethod = (processor as any).processNewNgUsdExchange.bind(processor);
      await processMethod(jobWithMetadata as any);

      expect(transactionRepository.update).toHaveBeenCalledWith(
        transactionWithMetadata.id,
        expect.objectContaining({
          metadata: expect.objectContaining({
            existing_field: 'should_be_preserved',
            usd_amount: mockJobData.localAmount,
            local_amount: mockJobData.payload.amount,
          }),
        }),
      );
    });
  });
});
