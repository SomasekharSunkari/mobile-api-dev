import { Test, TestingModule } from '@nestjs/testing';
import { WaasAdapter } from '../../../../adapters/waas/waas.adapter';
import { WaasTransactionStatus } from '../../../../adapters/waas/waas.adapter.interface';
import { PlatformServiceKey } from '../../../../database/models/platformStatus/platformStatus.interface';
import { TransactionStatus } from '../../../../database/models/transaction';
import { UserRepository } from '../../../../modules/auth/user/user.repository';
import { FiatWalletWithdrawalService } from '../../../../modules/fiatWallet/fiatWalletWithdrawal.service';
import { FiatWalletTransactionRepository } from '../../../../modules/fiatWalletTransactions/fiatWalletTransactions.repository';
import { TransactionRepository } from '../../../../modules/transaction/transaction.repository';
import { EventEmitterEventsEnum } from '../../../eventEmitter/eventEmitter.interface';
import { EventEmitterService } from '../../../eventEmitter/eventEmitter.service';
import { QueueService } from '../../queue.service';
import { MailerService } from '../mailer/mailer.service';
import { NgnWithdrawalStatusJobData, NgnWithdrawalStatusProcessor } from './ngn-withdrawal-status.processor';

describe('NgnWithdrawalStatusProcessor', () => {
  let processor: NgnWithdrawalStatusProcessor;

  const mockQueueService = {
    processJobs: jest.fn(),
    addJob: jest.fn(),
  };

  const mockWaasAdapter = {
    getTransactionStatus: jest.fn(),
  };

  const mockTransactionRepository = {
    findById: jest.fn(),
    update: jest.fn(),
  };

  const mockFiatWalletTransactionRepository = {
    update: jest.fn(),
  };

  const mockUserRepository = {
    findById: jest.fn(),
  };

  const mockEventEmitterService = {
    emit: jest.fn(),
  };

  const mockMailerService = {
    send: jest.fn(),
  };

  const mockFiatWalletWithdrawalService = {
    revertWithdrawalBalance: jest.fn(),
  };

  const mockJobData: NgnWithdrawalStatusJobData = {
    transactionId: 'txn-123',
    fiatWalletTransactionId: 'fwt-123',
    userId: 'user-123',
    providerReference: 'prov-ref-123',
    amount: 10000,
    recipientInfo: 'John Doe - 0123456789',
    remark: 'Test withdrawal',
  };

  const mockTransaction = {
    id: 'txn-123',
    status: TransactionStatus.PENDING,
    reference: 'REF-123',
  };

  const mockUser = {
    id: 'user-123',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NgnWithdrawalStatusProcessor,
        { provide: QueueService, useValue: mockQueueService },
        { provide: WaasAdapter, useValue: mockWaasAdapter },
        { provide: TransactionRepository, useValue: mockTransactionRepository },
        { provide: FiatWalletTransactionRepository, useValue: mockFiatWalletTransactionRepository },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: EventEmitterService, useValue: mockEventEmitterService },
        { provide: MailerService, useValue: mockMailerService },
        { provide: FiatWalletWithdrawalService, useValue: mockFiatWalletWithdrawalService },
      ],
    }).compile();

    processor = module.get<NgnWithdrawalStatusProcessor>(NgnWithdrawalStatusProcessor);
  });

  afterEach(() => {
    (processor as any).processorsRegistered = false;
  });

  describe('registerProcessors', () => {
    it('should register processors on first call', async () => {
      await processor.queueStatusPoll(mockJobData, 1);

      expect(mockQueueService.processJobs).toHaveBeenCalledWith(
        'ngn-withdrawal-status',
        'poll-status',
        expect.any(Function),
        5,
      );
    });

    it('should not register processors multiple times', async () => {
      await processor.queueStatusPoll(mockJobData, 1);
      await processor.queueStatusPoll(mockJobData, 1);

      expect(mockQueueService.processJobs).toHaveBeenCalledTimes(1);
    });
  });

  describe('queueStatusPoll', () => {
    it('should queue job with correct delay for attempt 1', async () => {
      await processor.queueStatusPoll(mockJobData, 1);

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'ngn-withdrawal-status',
        'poll-status',
        { ...mockJobData, attemptNumber: 1 },
        {
          delay: 60000,
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    });

    it('should queue job with increasing delay for higher attempts', async () => {
      await processor.queueStatusPoll(mockJobData, 5);

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'ngn-withdrawal-status',
        'poll-status',
        { ...mockJobData, attemptNumber: 5 },
        {
          delay: 300000,
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    });

    it('should cap delay at max 20 minutes', async () => {
      await processor.queueStatusPoll(mockJobData, 30);

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'ngn-withdrawal-status',
        'poll-status',
        { ...mockJobData, attemptNumber: 30 },
        {
          delay: 1200000,
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    });

    it('should default to attempt 1 when not specified', async () => {
      await processor.queueStatusPoll(mockJobData);

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'ngn-withdrawal-status',
        'poll-status',
        { ...mockJobData, attemptNumber: 1 },
        expect.objectContaining({
          delay: 60000,
        }),
      );
    });
  });

  describe('processStatusPoll', () => {
    it('should skip processing when transaction is not found', async () => {
      mockTransactionRepository.findById.mockResolvedValue(null);

      const processStatusPoll = (processor as any).processStatusPoll.bind(processor);
      await processStatusPoll({ data: mockJobData });

      expect(mockWaasAdapter.getTransactionStatus).not.toHaveBeenCalled();
    });

    it('should skip processing when transaction is no longer pending', async () => {
      mockTransactionRepository.findById.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
      });

      const processStatusPoll = (processor as any).processStatusPoll.bind(processor);
      await processStatusPoll({ data: mockJobData });

      expect(mockWaasAdapter.getTransactionStatus).not.toHaveBeenCalled();
    });

    it('should handle completed withdrawal when provider returns SUCCESS', async () => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: WaasTransactionStatus.SUCCESS,
        message: 'Transaction successful',
      });
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const processStatusPoll = (processor as any).processStatusPoll.bind(processor);
      await processStatusPoll({ data: mockJobData });

      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        mockJobData.transactionId,
        expect.objectContaining({
          status: TransactionStatus.COMPLETED,
        }),
      );
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        mockJobData.fiatWalletTransactionId,
        expect.objectContaining({
          status: TransactionStatus.COMPLETED,
        }),
      );
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS, {
        serviceKey: PlatformServiceKey.NGN_TRANSFER_OUT,
      });
    });

    it('should handle failed withdrawal when provider returns FAILED', async () => {
      const failureMessage = 'Insufficient funds';
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: WaasTransactionStatus.FAILED,
        message: failureMessage,
      });

      const processStatusPoll = (processor as any).processStatusPoll.bind(processor);
      await processStatusPoll({ data: mockJobData });

      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        mockJobData.transactionId,
        expect.objectContaining({
          status: TransactionStatus.FAILED,
          failure_reason: failureMessage,
        }),
      );
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        mockJobData.fiatWalletTransactionId,
        expect.objectContaining({
          status: TransactionStatus.FAILED,
          failure_reason: failureMessage,
        }),
      );
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
        serviceKey: PlatformServiceKey.NGN_TRANSFER_OUT,
        reason: failureMessage,
      });
      expect(mockFiatWalletWithdrawalService.revertWithdrawalBalance).toHaveBeenCalledWith(mockJobData.transactionId);
    });

    it('should queue another poll when provider returns PENDING and under max attempts', async () => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: WaasTransactionStatus.PENDING,
        message: 'Transaction pending',
      });

      const processStatusPoll = (processor as any).processStatusPoll.bind(processor);
      await processStatusPoll({ data: { ...mockJobData, attemptNumber: 3 } });

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'ngn-withdrawal-status',
        'poll-status',
        expect.objectContaining({ attemptNumber: 4 }),
        expect.any(Object),
      );
    });

    it('should handle max attempts reached when provider returns PENDING', async () => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: WaasTransactionStatus.PENDING,
        message: 'Transaction pending',
      });

      const processStatusPoll = (processor as any).processStatusPoll.bind(processor);
      await processStatusPoll({ data: { ...mockJobData, attemptNumber: 10 } });

      expect(mockTransactionRepository.update).toHaveBeenCalledWith(mockJobData.transactionId, {
        status: TransactionStatus.REVIEW,
        failure_reason: 'Max polling attempts reached - requires manual review',
      });
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(mockJobData.fiatWalletTransactionId, {
        status: TransactionStatus.REVIEW,
        failure_reason: 'Max polling attempts reached - requires manual review',
      });
    });

    it('should retry on error if under max attempts', async () => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockWaasAdapter.getTransactionStatus.mockRejectedValue(new Error('Network error'));

      const processStatusPoll = (processor as any).processStatusPoll.bind(processor);
      await processStatusPoll({ data: { ...mockJobData, attemptNumber: 5 } });

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'ngn-withdrawal-status',
        'poll-status',
        expect.objectContaining({ attemptNumber: 6 }),
        expect.any(Object),
      );
    });

    it('should not retry on error if at max attempts', async () => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockWaasAdapter.getTransactionStatus.mockRejectedValue(new Error('Network error'));

      const processStatusPoll = (processor as any).processStatusPoll.bind(processor);
      await processStatusPoll({ data: { ...mockJobData, attemptNumber: 10 } });

      expect(mockQueueService.addJob).not.toHaveBeenCalled();
    });

    it('should default attemptNumber to 1 when not provided', async () => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: WaasTransactionStatus.PENDING,
        message: 'Transaction pending',
      });

      const processStatusPoll = (processor as any).processStatusPoll.bind(processor);
      await processStatusPoll({ data: mockJobData });

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'ngn-withdrawal-status',
        'poll-status',
        expect.objectContaining({ attemptNumber: 2 }),
        expect.any(Object),
      );
    });
  });

  describe('handleCompletedWithdrawal', () => {
    beforeEach(() => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
    });

    it('should update transaction status to COMPLETED', async () => {
      const handleCompletedWithdrawal = (processor as any).handleCompletedWithdrawal.bind(processor);
      await handleCompletedWithdrawal(mockJobData.transactionId, mockJobData.fiatWalletTransactionId, mockJobData);

      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        mockJobData.transactionId,
        expect.objectContaining({
          status: TransactionStatus.COMPLETED,
          completed_at: expect.any(String),
        }),
      );
    });

    it('should update fiat wallet transaction status to COMPLETED', async () => {
      const handleCompletedWithdrawal = (processor as any).handleCompletedWithdrawal.bind(processor);
      await handleCompletedWithdrawal(mockJobData.transactionId, mockJobData.fiatWalletTransactionId, mockJobData);

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        mockJobData.fiatWalletTransactionId,
        expect.objectContaining({
          status: TransactionStatus.COMPLETED,
          completed_at: expect.any(String),
        }),
      );
    });

    it('should emit success event', async () => {
      const handleCompletedWithdrawal = (processor as any).handleCompletedWithdrawal.bind(processor);
      await handleCompletedWithdrawal(mockJobData.transactionId, mockJobData.fiatWalletTransactionId, mockJobData);

      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(EventEmitterEventsEnum.SERVICE_STATUS_SUCCESS, {
        serviceKey: PlatformServiceKey.NGN_TRANSFER_OUT,
      });
    });

    it('should send success email', async () => {
      const handleCompletedWithdrawal = (processor as any).handleCompletedWithdrawal.bind(processor);
      await handleCompletedWithdrawal(mockJobData.transactionId, mockJobData.fiatWalletTransactionId, mockJobData);

      expect(mockMailerService.send).toHaveBeenCalled();
    });
  });

  describe('handleFailedWithdrawal', () => {
    const failureReason = 'Insufficient funds';

    it('should update transaction status to FAILED with failure reason', async () => {
      const handleFailedWithdrawal = (processor as any).handleFailedWithdrawal.bind(processor);
      await handleFailedWithdrawal(mockJobData.transactionId, mockJobData.fiatWalletTransactionId, failureReason);

      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        mockJobData.transactionId,
        expect.objectContaining({
          status: TransactionStatus.FAILED,
          failure_reason: failureReason,
          failed_at: expect.any(String),
        }),
      );
    });

    it('should update fiat wallet transaction status to FAILED', async () => {
      const handleFailedWithdrawal = (processor as any).handleFailedWithdrawal.bind(processor);
      await handleFailedWithdrawal(mockJobData.transactionId, mockJobData.fiatWalletTransactionId, failureReason);

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        mockJobData.fiatWalletTransactionId,
        expect.objectContaining({
          status: TransactionStatus.FAILED,
          failure_reason: failureReason,
          failed_at: expect.any(String),
        }),
      );
    });

    it('should emit failure event with reason', async () => {
      const handleFailedWithdrawal = (processor as any).handleFailedWithdrawal.bind(processor);
      await handleFailedWithdrawal(mockJobData.transactionId, mockJobData.fiatWalletTransactionId, failureReason);

      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(EventEmitterEventsEnum.SERVICE_STATUS_FAILURE, {
        serviceKey: PlatformServiceKey.NGN_TRANSFER_OUT,
        reason: failureReason,
      });
    });

    it('should call revertWithdrawalBalance', async () => {
      const handleFailedWithdrawal = (processor as any).handleFailedWithdrawal.bind(processor);
      await handleFailedWithdrawal(mockJobData.transactionId, mockJobData.fiatWalletTransactionId, failureReason);

      expect(mockFiatWalletWithdrawalService.revertWithdrawalBalance).toHaveBeenCalledWith(mockJobData.transactionId);
    });
  });

  describe('handleMaxAttemptsReached', () => {
    it('should update transaction status to REVIEW', async () => {
      const handleMaxAttemptsReached = (processor as any).handleMaxAttemptsReached.bind(processor);
      await handleMaxAttemptsReached(mockJobData.transactionId, mockJobData.fiatWalletTransactionId);

      expect(mockTransactionRepository.update).toHaveBeenCalledWith(mockJobData.transactionId, {
        status: TransactionStatus.REVIEW,
        failure_reason: 'Max polling attempts reached - requires manual review',
      });
    });

    it('should update fiat wallet transaction status to REVIEW', async () => {
      const handleMaxAttemptsReached = (processor as any).handleMaxAttemptsReached.bind(processor);
      await handleMaxAttemptsReached(mockJobData.transactionId, mockJobData.fiatWalletTransactionId);

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(mockJobData.fiatWalletTransactionId, {
        status: TransactionStatus.REVIEW,
        failure_reason: 'Max polling attempts reached - requires manual review',
      });
    });
  });

  describe('sendSuccessEmail', () => {
    it('should send success email when user is found', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);

      const sendSuccessEmail = (processor as any).sendSuccessEmail.bind(processor);
      await sendSuccessEmail(mockJobData);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(mockJobData.userId);
      expect(mockMailerService.send).toHaveBeenCalled();
    });

    it('should skip email when user is not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const sendSuccessEmail = (processor as any).sendSuccessEmail.bind(processor);
      await sendSuccessEmail(mockJobData);

      expect(mockMailerService.send).not.toHaveBeenCalled();
    });

    it('should handle email sending failure gracefully', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockMailerService.send.mockImplementation(() => {
        throw new Error('Email service unavailable');
      });

      const sendSuccessEmail = (processor as any).sendSuccessEmail.bind(processor);

      await expect(sendSuccessEmail(mockJobData)).resolves.not.toThrow();
    });

    it('should use provider reference when transaction reference is not available', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockTransactionRepository.findById.mockResolvedValue({ ...mockTransaction, reference: null });

      const sendSuccessEmail = (processor as any).sendSuccessEmail.bind(processor);
      await sendSuccessEmail(mockJobData);

      expect(mockMailerService.send).toHaveBeenCalled();
    });
  });

  describe('status comparison case insensitivity', () => {
    it('should skip processing when transaction status is PENDING in different case', async () => {
      mockTransactionRepository.findById.mockResolvedValue({
        ...mockTransaction,
        status: 'Completed',
      });

      const processStatusPoll = (processor as any).processStatusPoll.bind(processor);
      await processStatusPoll({ data: mockJobData });

      expect(mockWaasAdapter.getTransactionStatus).not.toHaveBeenCalled();
    });

    it('should process when transaction status is pending in different case', async () => {
      mockTransactionRepository.findById.mockResolvedValue({
        ...mockTransaction,
        status: 'PENDING',
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: WaasTransactionStatus.SUCCESS,
        message: 'Transaction successful',
      });
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const processStatusPoll = (processor as any).processStatusPoll.bind(processor);
      await processStatusPoll({ data: mockJobData });

      expect(mockWaasAdapter.getTransactionStatus).toHaveBeenCalled();
    });
  });
});
