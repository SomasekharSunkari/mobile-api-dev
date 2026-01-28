import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { ExternalAccountAdapter } from '../../../../adapters/external-account';
import { TransactionStatus } from '../../../../database/models/transaction';
import { FiatWalletTransactionService } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.service';
import { TransactionService } from '../../../../modules/transaction/transaction.service';
import { QueueService } from '../../queue.service';
import { ExecuteWalletJobData, ExecuteWalletProcessor } from './execute-wallet.processor';

describe('ExecuteWalletProcessor', () => {
  let executeWalletProcessor: ExecuteWalletProcessor;
  let queueService: jest.Mocked<QueueService>;
  let externalAccountAdapter: jest.Mocked<ExternalAccountAdapter>;
  let transactionService: jest.Mocked<TransactionService>;
  let fiatWalletTransactionService: jest.Mocked<FiatWalletTransactionService>;

  const mockJob: Partial<Job<ExecuteWalletJobData>> = {
    id: 'test-job-id',
    data: {
      transactionId: 'txn-123',
      fundingRequest: {
        providerUserRef: 'user-ref-456',
        quoteRef: 'quote-ref-789',
        achSignedAgreement: 1,
        externalAccountRef: 'ext-account-101',
        description: 'Test funding',
      },
      countryCode: 'US',
    },
    updateProgress: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecuteWalletProcessor,
        {
          provide: QueueService,
          useValue: {
            processJobs: jest.fn(),
            addJob: jest.fn(),
          },
        },
        {
          provide: ExternalAccountAdapter,
          useValue: {
            executePayment: jest.fn(),
          },
        },
        {
          provide: TransactionService,
          useValue: {
            updateStatus: jest.fn(),
          },
        },
        {
          provide: FiatWalletTransactionService,
          useValue: {
            findOne: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    executeWalletProcessor = module.get<ExecuteWalletProcessor>(ExecuteWalletProcessor);
    queueService = module.get(QueueService);
    externalAccountAdapter = module.get(ExternalAccountAdapter);
    transactionService = module.get(TransactionService);
    fiatWalletTransactionService = module.get(FiatWalletTransactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    (executeWalletProcessor as any).processorsRegistered = false;
  });

  describe('registerProcessors', () => {
    it('should register processors on first call', async () => {
      await executeWalletProcessor.queueExecuteWalletTransaction(mockJob.data);

      expect(queueService.processJobs).toHaveBeenCalledWith(
        'execute-wallet',
        'execute-wallet',
        expect.any(Function),
        2,
      );
    });

    it('should not register processors multiple times', async () => {
      await executeWalletProcessor.queueExecuteWalletTransaction(mockJob.data);
      await executeWalletProcessor.queueExecuteWalletTransaction(mockJob.data);

      expect(queueService.processJobs).toHaveBeenCalledTimes(1);
    });
  });

  describe('processExecuteWalletTransaction', () => {
    it('should successfully process wallet transaction with submitted status', async () => {
      const mockFundingResponse = {
        requestRef: 'request-ref-123',
        transactionRef: 'txn-ref-456',
        status: 'submitted',
      };

      const mockFiatWalletTransaction = { id: 'fwt-789' };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction as any);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      const result = await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

      expect(mockJob.updateProgress).toHaveBeenCalledWith(25);
      expect(externalAccountAdapter.executePayment).toHaveBeenCalledWith(
        mockJob.data.fundingRequest,
        mockJob.data.countryCode,
      );
      expect(mockJob.updateProgress).toHaveBeenCalledWith(75);
      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        mockJob.data.transactionId,
        TransactionStatus.PROCESSING,
        expect.objectContaining({
          provider_reference: mockFundingResponse.transactionRef,
          provider_metadata: expect.objectContaining({
            funding_response: mockFundingResponse,
          }),
        }),
      );
      expect(fiatWalletTransactionService.findOne).toHaveBeenCalledWith({
        transaction_id: mockJob.data.transactionId,
      });
      expect(fiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        mockFiatWalletTransaction.id,
        TransactionStatus.PROCESSING,
        expect.objectContaining({
          provider_request_ref: mockFundingResponse.requestRef,
        }),
      );
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
      expect(result).toEqual({
        status: 'completed',
        transactionId: mockJob.data.transactionId,
        fundingReference: mockFundingResponse.transactionRef,
      });
    });

    it('should set status to FAILED when payment status is not submitted', async () => {
      const mockFundingResponse = {
        requestRef: 'request-ref-123',
        transactionRef: 'txn-ref-456',
        status: 'failed',
      };

      const mockFiatWalletTransaction = { id: 'fwt-789' };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction as any);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        mockJob.data.transactionId,
        TransactionStatus.FAILED,
        expect.any(Object),
      );
      expect(fiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        mockFiatWalletTransaction.id,
        TransactionStatus.FAILED,
        expect.any(Object),
      );
    });

    it('should update progress at different stages', async () => {
      const mockFundingResponse = {
        requestRef: 'request-ref-123',
        transactionRef: 'txn-ref-456',
        status: 'submitted',
      };

      const mockFiatWalletTransaction = { id: 'fwt-789' };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction as any);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

      expect(mockJob.updateProgress).toHaveBeenNthCalledWith(1, 25);
      expect(mockJob.updateProgress).toHaveBeenNthCalledWith(2, 75);
      expect(mockJob.updateProgress).toHaveBeenNthCalledWith(3, 100);
    });

    it('should handle executePayment failure', async () => {
      const mockError = new Error('Payment execution failed');
      const mockFiatWalletTransaction = {
        id: 'fiat-wallet-txn-123',
        transaction_id: 'txn-123',
      } as any;

      externalAccountAdapter.executePayment.mockRejectedValue(mockError);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      await expect((executeWalletProcessor as any).processExecuteWalletTransaction(mockJob)).rejects.toThrow(
        'Payment execution failed',
      );

      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        mockJob.data.transactionId,
        TransactionStatus.FAILED,
        expect.objectContaining({
          failure_reason: 'Fund wallet failed: Payment execution failed',
          provider_metadata: expect.objectContaining({
            error: 'Payment execution failed',
          }),
        }),
      );
    });

    it('should update fiat wallet transaction to FAILED on executePayment failure', async () => {
      const mockError = new Error('Payment execution failed');
      const mockFiatWalletTransaction = {
        id: 'fiat-wallet-txn-123',
        transaction_id: 'txn-123',
        fiat_wallet_id: 'wallet-123',
        user_id: 'user-123',
        transaction_type: 'deposit',
        amount: '10000',
        balance_before: '0',
        balance_after: '10000',
        currency: 'USD',
        status: 'processing',
        provider: 'zerohash',
      } as any;

      externalAccountAdapter.executePayment.mockRejectedValue(mockError);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      await expect((executeWalletProcessor as any).processExecuteWalletTransaction(mockJob)).rejects.toThrow(
        'Payment execution failed',
      );

      // Verify main transaction is updated to FAILED
      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        mockJob.data.transactionId,
        TransactionStatus.FAILED,
        expect.objectContaining({
          failure_reason: 'Fund wallet failed: Payment execution failed',
        }),
      );

      // Verify fiat wallet transaction is also updated to FAILED
      expect(fiatWalletTransactionService.findOne).toHaveBeenCalledWith({
        transaction_id: mockJob.data.transactionId,
      });
      expect(fiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        mockFiatWalletTransaction.id,
        TransactionStatus.FAILED,
        expect.objectContaining({
          failure_reason: 'Fund wallet failed: Payment execution failed',
        }),
      );
    });

    it('should throw fiat wallet transaction update failure on executePayment failure', async () => {
      const mockError = new Error('Payment execution failed');
      const mockFiatWalletTransaction = {
        id: 'fiat-wallet-txn-123',
        transaction_id: 'txn-123',
        fiat_wallet_id: 'wallet-123',
        user_id: 'user-123',
        transaction_type: 'deposit',
        amount: '10000',
        balance_before: '0',
        balance_after: '10000',
        currency: 'USD',
        status: 'processing',
        provider: 'zerohash',
      } as any;

      externalAccountAdapter.executePayment.mockRejectedValue(mockError);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      fiatWalletTransactionService.updateStatus.mockRejectedValue(new Error('Update failed'));

      await expect((executeWalletProcessor as any).processExecuteWalletTransaction(mockJob)).rejects.toThrow(
        'Update failed',
      );

      // Verify main transaction is still updated to FAILED
      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        mockJob.data.transactionId,
        TransactionStatus.FAILED,
        expect.objectContaining({
          failure_reason: 'Fund wallet failed: Payment execution failed',
        }),
      );

      // Since we removed the try/catch wrapper, the error is now thrown instead of logged
      // The fiat wallet transaction update failure is no longer handled gracefully
    });

    it('should handle fiat wallet transaction not found gracefully', async () => {
      const mockFundingResponse = {
        requestRef: 'request-ref-123',
        transactionRef: 'txn-ref-456',
        status: 'submitted',
      };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockRejectedValue(new Error('Not found'));

      const loggerSpy = jest.spyOn((executeWalletProcessor as any).logger, 'warn');

      const result = await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

      expect(result.status).toBe('completed');
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not update fiat wallet transaction'),
        'Not found',
      );
    });

    it('should handle fiat wallet transaction update failure gracefully', async () => {
      const mockFundingResponse = {
        requestRef: 'request-ref-123',
        transactionRef: 'txn-ref-456',
        status: 'submitted',
      };

      const mockFiatWalletTransaction = { id: 'fwt-789' };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction as any);
      fiatWalletTransactionService.updateStatus.mockRejectedValue(new Error('Update failed'));

      const loggerSpy = jest.spyOn((executeWalletProcessor as any).logger, 'warn');

      const result = await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

      expect(result.status).toBe('completed');
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not update fiat wallet transaction'),
        'Update failed',
      );
    });

    it('should include provider metadata in transaction update', async () => {
      const mockFundingResponse = {
        requestRef: 'request-ref-789',
        transactionRef: 'txn-ref-101',
        status: 'submitted',
      };

      const mockFiatWalletTransaction = { id: 'fwt-202' };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction as any);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        mockJob.data.transactionId,
        TransactionStatus.PROCESSING,
        expect.objectContaining({
          provider_metadata: expect.objectContaining({
            funding_response: mockFundingResponse,
            processed_at: expect.any(String),
          }),
        }),
      );
    });

    it('should include provider request ref in fiat wallet transaction update', async () => {
      const mockFundingResponse = {
        requestRef: 'unique-request-ref-303',
        transactionRef: 'txn-ref-404',
        status: 'submitted',
      };

      const mockFiatWalletTransaction = { id: 'fwt-505' };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction as any);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

      expect(fiatWalletTransactionService.updateStatus).toHaveBeenCalledWith(
        mockFiatWalletTransaction.id,
        TransactionStatus.PROCESSING,
        expect.objectContaining({
          provider_request_ref: 'unique-request-ref-303',
        }),
      );
    });

    it('should log error details on failure', async () => {
      const mockError = new Error('Network timeout');
      const mockFiatWalletTransaction = {
        id: 'fiat-wallet-txn-123',
        transaction_id: 'txn-123',
      } as any;

      externalAccountAdapter.executePayment.mockRejectedValue(mockError);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      const loggerSpy = jest.spyOn((executeWalletProcessor as any).logger, 'error');

      await expect((executeWalletProcessor as any).processExecuteWalletTransaction(mockJob)).rejects.toThrow(
        'Network timeout',
      );

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Fund wallet failed for transaction'), mockError);
    });

    it('should include timestamp in failure metadata', async () => {
      const mockError = new Error('Test error');
      const mockFiatWalletTransaction = {
        id: 'fiat-wallet-txn-123',
        transaction_id: 'txn-123',
      } as any;

      externalAccountAdapter.executePayment.mockRejectedValue(mockError);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      await expect((executeWalletProcessor as any).processExecuteWalletTransaction(mockJob)).rejects.toThrow(
        'Test error',
      );

      expect(transactionService.updateStatus).toHaveBeenCalledWith(
        mockJob.data.transactionId,
        TransactionStatus.FAILED,
        expect.objectContaining({
          provider_metadata: expect.objectContaining({
            failed_at: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('queueExecuteWalletTransaction', () => {
    it('should queue execute wallet transaction job with correct parameters', async () => {
      const jobData: ExecuteWalletJobData = {
        transactionId: 'txn-999',
        fundingRequest: {
          providerUserRef: 'user-ref-888',
          quoteRef: 'quote-ref-777',
          achSignedAgreement: 1,
          externalAccountRef: 'ext-account-666',
          description: 'Test funding',
        },
        countryCode: 'US',
      };

      queueService.addJob.mockResolvedValue({} as any);

      await executeWalletProcessor.queueExecuteWalletTransaction(jobData);

      expect(queueService.addJob).toHaveBeenCalledWith('execute-wallet', 'execute-wallet', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });
    });

    it('should register processors before queueing', async () => {
      queueService.addJob.mockResolvedValue({} as any);

      await executeWalletProcessor.queueExecuteWalletTransaction(mockJob.data);

      expect(queueService.processJobs).toHaveBeenCalled();
      expect(queueService.addJob).toHaveBeenCalled();
    });

    it('should return the queued job', async () => {
      const mockQueuedJob = { id: 'job-123', data: mockJob.data } as any;
      queueService.addJob.mockResolvedValue(mockQueuedJob);

      const result = await executeWalletProcessor.queueExecuteWalletTransaction(mockJob.data);

      expect(result).toEqual(mockQueuedJob);
    });

    it('should configure retry with exponential backoff', async () => {
      queueService.addJob.mockResolvedValue({} as any);

      await executeWalletProcessor.queueExecuteWalletTransaction(mockJob.data);

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

  describe('integration scenarios', () => {
    it('should handle complete wallet funding flow end-to-end', async () => {
      const mockFundingResponse = {
        requestRef: 'complete-request-ref',
        transactionRef: 'complete-txn-ref',
        status: 'submitted',
      };

      const mockFiatWalletTransaction = { id: 'fwt-complete' };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction as any);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);
      queueService.addJob.mockResolvedValue(mockJob as any);

      const queuedJob = await executeWalletProcessor.queueExecuteWalletTransaction(mockJob.data);
      const processResult = await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

      expect(queuedJob).toBeDefined();
      expect(processResult.status).toBe('completed');
      expect(processResult.fundingReference).toBe('complete-txn-ref');
    });

    it('should handle different payment statuses', async () => {
      const statuses = ['submitted', 'pending', 'failed'];

      for (const status of statuses) {
        jest.clearAllMocks();

        const mockFundingResponse = {
          requestRef: `request-ref-${status}`,
          transactionRef: `txn-ref-${status}`,
          status,
        };

        const mockFiatWalletTransaction = { id: `fwt-${status}` };
        const expectedStatus = status === 'submitted' ? TransactionStatus.PROCESSING : TransactionStatus.FAILED;

        externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
        transactionService.updateStatus.mockResolvedValue(undefined);
        fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction as any);
        fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

        await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

        expect(transactionService.updateStatus).toHaveBeenCalledWith(
          mockJob.data.transactionId,
          expectedStatus,
          expect.any(Object),
        );
      }
    });

    it('should handle transaction service update failure', async () => {
      const mockFundingResponse = {
        requestRef: 'request-ref-123',
        transactionRef: 'txn-ref-456',
        status: 'submitted',
      };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockRejectedValue(new Error('Database error'));

      await expect((executeWalletProcessor as any).processExecuteWalletTransaction(mockJob)).rejects.toThrow();
    });

    it('should continue processing even if fiat wallet transaction update fails', async () => {
      const mockFundingResponse = {
        requestRef: 'request-ref-789',
        transactionRef: 'txn-ref-101',
        status: 'submitted',
      };

      const mockFiatWalletTransaction = { id: 'fwt-202' };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction as any);
      fiatWalletTransactionService.updateStatus.mockRejectedValue(new Error('Fiat wallet update failed'));

      const result = await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

      expect(result.status).toBe('completed');
      expect(transactionService.updateStatus).toHaveBeenCalled();
    });
  });

  describe('logging', () => {
    it('should log when starting wallet transaction processing', async () => {
      const loggerSpy = jest.spyOn((executeWalletProcessor as any).logger, 'log');
      const mockFundingResponse = {
        requestRef: 'request-ref-123',
        transactionRef: 'txn-ref-456',
        status: 'submitted',
      };

      const mockFiatWalletTransaction = { id: 'fwt-789' };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction as any);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing execute wallet transaction for transaction'),
      );
    });

    it('should log when wallet transaction is executed', async () => {
      const loggerSpy = jest.spyOn((executeWalletProcessor as any).logger, 'log');
      const mockFundingResponse = {
        requestRef: 'request-ref-456',
        transactionRef: 'txn-ref-789',
        status: 'submitted',
      };

      const mockFiatWalletTransaction = { id: 'fwt-101' };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction as any);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Wallet transaction executed'));
    });

    it('should log when wallet transaction is completed', async () => {
      const loggerSpy = jest.spyOn((executeWalletProcessor as any).logger, 'log');
      const mockFundingResponse = {
        requestRef: 'request-ref-789',
        transactionRef: 'txn-ref-101',
        status: 'submitted',
      };

      const mockFiatWalletTransaction = { id: 'fwt-202' };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction as any);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Execute wallet transaction completed for transaction'),
      );
    });

    it('should log when processors are registered', async () => {
      const loggerSpy = jest.spyOn((executeWalletProcessor as any).logger, 'log');
      queueService.addJob.mockResolvedValue({} as any);

      await executeWalletProcessor.queueExecuteWalletTransaction(mockJob.data);

      expect(loggerSpy).toHaveBeenCalledWith('Execute wallet processors registered');
    });
  });

  describe('edge cases and error scenarios', () => {
    describe('processExecuteWalletTransaction edge cases', () => {
      it('should handle empty funding request', async () => {
        const emptyJob = {
          ...mockJob,
          data: {
            transactionId: 'txn-empty',
            fundingRequest: {} as any,
            countryCode: 'US',
          },
        };

        externalAccountAdapter.executePayment.mockRejectedValue(new Error('Invalid funding request'));
        transactionService.updateStatus.mockResolvedValue(undefined);

        await expect((executeWalletProcessor as any).processExecuteWalletTransaction(emptyJob)).rejects.toThrow();
        expect(transactionService.updateStatus).toHaveBeenCalledWith(
          'txn-empty',
          TransactionStatus.FAILED,
          expect.any(Object),
        );
      });

      it('should handle funding response without transaction reference', async () => {
        const mockFundingResponse = {
          requestRef: 'request-ref-123',
          transactionRef: null,
          status: 'submitted',
        };

        externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse as any);
        transactionService.updateStatus.mockResolvedValue(undefined);
        fiatWalletTransactionService.findOne.mockResolvedValue({ id: 'fwt-123' } as any);
        fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

        const result = await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

        expect(result.fundingReference).toBeNull();
      });

      it('should handle different country codes', async () => {
        const ukJob = {
          ...mockJob,
          data: {
            ...mockJob.data,
            countryCode: 'GB',
          },
        };

        const mockFundingResponse = {
          requestRef: 'request-ref-uk',
          transactionRef: 'txn-ref-uk',
          status: 'submitted',
        };

        externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
        transactionService.updateStatus.mockResolvedValue(undefined);
        fiatWalletTransactionService.findOne.mockResolvedValue({ id: 'fwt-uk' } as any);
        fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

        await (executeWalletProcessor as any).processExecuteWalletTransaction(ukJob);

        expect(externalAccountAdapter.executePayment).toHaveBeenCalledWith(ukJob.data.fundingRequest, 'GB');
      });

      it('should handle very long transaction IDs', async () => {
        const longTxnId = 'a'.repeat(500);
        const longJob = {
          ...mockJob,
          data: {
            ...mockJob.data,
            transactionId: longTxnId,
          },
        };

        const mockFundingResponse = {
          requestRef: 'request-ref-long',
          transactionRef: 'txn-ref-long',
          status: 'submitted',
        };

        externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
        transactionService.updateStatus.mockResolvedValue(undefined);
        fiatWalletTransactionService.findOne.mockResolvedValue({ id: 'fwt-long' } as any);
        fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

        const result = await (executeWalletProcessor as any).processExecuteWalletTransaction(longJob);

        expect(result.transactionId).toBe(longTxnId);
      });
    });
  });

  describe('concurrent operations and race conditions', () => {
    it('should handle multiple concurrent wallet transactions', async () => {
      const jobs = Array.from({ length: 5 }, (_, i) => ({
        ...mockJob,
        id: `job-${i}`,
        data: {
          ...mockJob.data,
          transactionId: `txn-concurrent-${i}`,
        },
      }));

      const mockFundingResponse = {
        requestRef: 'request-ref-concurrent',
        transactionRef: 'txn-ref-concurrent',
        status: 'submitted',
      };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue({ id: 'fwt-concurrent' } as any);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      const results = await Promise.all(
        jobs.map((job) => (executeWalletProcessor as any).processExecuteWalletTransaction(job)),
      );

      expect(results).toHaveLength(5);
      for (const result of results) {
        expect(result.status).toBe('completed');
      }
    });

    it('should handle race condition in queue registration', async () => {
      queueService.addJob.mockResolvedValue({} as any);

      const promises = Array.from({ length: 10 }, () =>
        executeWalletProcessor.queueExecuteWalletTransaction(mockJob.data),
      );

      await Promise.all(promises);

      expect(queueService.processJobs).toHaveBeenCalledTimes(1);
    });
  });

  describe('performance and stress scenarios', () => {
    it('should handle large funding request payloads', async () => {
      const largeFundingRequest = {
        ...mockJob.data.fundingRequest,
        description: 'A'.repeat(10000),
        metadata: { key: 'B'.repeat(10000) },
      };

      const largeJob = {
        ...mockJob,
        data: {
          ...mockJob.data,
          fundingRequest: largeFundingRequest,
        },
      };

      const mockFundingResponse = {
        requestRef: 'request-ref-large',
        transactionRef: 'txn-ref-large',
        status: 'submitted',
      };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue({ id: 'fwt-large' } as any);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      const result = await (executeWalletProcessor as any).processExecuteWalletTransaction(largeJob);

      expect(result.status).toBe('completed');
    });

    it('should handle queue job with many retry attempts', async () => {
      queueService.addJob.mockResolvedValue({} as any);

      await executeWalletProcessor.queueExecuteWalletTransaction(mockJob.data);

      expect(queueService.addJob).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          attempts: 3,
        }),
      );
    });
  });

  describe('logging and monitoring', () => {
    it('should log all steps in successful wallet transaction', async () => {
      const loggerSpy = jest.spyOn((executeWalletProcessor as any).logger, 'log');
      const mockFundingResponse = {
        requestRef: 'request-ref-log',
        transactionRef: 'txn-ref-log',
        status: 'submitted',
      };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockResolvedValue({ id: 'fwt-log' } as any);
      fiatWalletTransactionService.updateStatus.mockResolvedValue(undefined);

      await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

      expect(loggerSpy).toHaveBeenCalledTimes(4);
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Processing execute wallet transaction'));
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Wallet transaction executed'));
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Execute wallet transaction completed'));
    });

    it('should log warning when fiat wallet transaction update fails', async () => {
      const warnSpy = jest.spyOn((executeWalletProcessor as any).logger, 'warn');
      const mockFundingResponse = {
        requestRef: 'request-ref-warn',
        transactionRef: 'txn-ref-warn',
        status: 'submitted',
      };

      externalAccountAdapter.executePayment.mockResolvedValue(mockFundingResponse);
      transactionService.updateStatus.mockResolvedValue(undefined);
      fiatWalletTransactionService.findOne.mockRejectedValue(new Error('Fiat wallet not found'));

      await (executeWalletProcessor as any).processExecuteWalletTransaction(mockJob);

      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
