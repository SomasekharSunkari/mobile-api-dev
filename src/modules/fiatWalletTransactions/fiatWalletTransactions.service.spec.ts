import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FiatWalletTransactionType } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import { FiatWalletTransactionModel } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.model';
import { TransactionStatus } from '../../database/models/transaction';
import { LockerService } from '../../services/locker';
import { FiatWalletRepository } from '../fiatWallet/fiatWallet.repository';
import { CreateFiatTransactionDto } from './dto/createFiatTransaction.dto';
import { FiatWalletTransactionRepository } from './fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from './fiatWalletTransactions.service';

describe('FiatWalletTransactionService', () => {
  let service: FiatWalletTransactionService;

  const mockFiatWallet = {
    id: 'wallet-123',
    user_id: 'user-123',
    balance: 5000,
    currency: 'USD',
  };

  const mockFiatWalletTransaction = {
    id: 'fwt-123',
    transaction_id: 'txn-123',
    fiat_wallet_id: 'wallet-123',
    user_id: 'user-123',
    transaction_type: FiatWalletTransactionType.DEPOSIT,
    amount: 1000,
    balance_before: 5000,
    balance_after: 6000,
    currency: 'USD',
    status: TransactionStatus.PENDING,
    provider: 'test-provider',
    provider_reference: 'ref-123',
    created_at: new Date(),
    updated_at: new Date(),
  } as unknown as FiatWalletTransactionModel;

  const mockFiatWalletTransactionRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockFiatWalletRepository = {
    findById: jest.fn(),
  };

  const mockLockerService = {
    withLock: jest.fn((key, callback) => callback()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FiatWalletTransactionService,
        {
          provide: FiatWalletTransactionRepository,
          useValue: mockFiatWalletTransactionRepository,
        },
        {
          provide: FiatWalletRepository,
          useValue: mockFiatWalletRepository,
        },
        {
          provide: LockerService,
          useValue: mockLockerService,
        },
      ],
    }).compile();

    service = module.get<FiatWalletTransactionService>(FiatWalletTransactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateFiatTransactionDto = {
      transaction_id: 'txn-123',
      fiat_wallet_id: 'wallet-123',
      transaction_type: FiatWalletTransactionType.DEPOSIT,
      amount: 1000,
      currency: 'USD',
      status: TransactionStatus.PENDING,
    };

    it('should create a fiat wallet transaction successfully', async () => {
      mockFiatWalletRepository.findById.mockResolvedValue(mockFiatWallet);
      mockFiatWalletTransactionRepository.create.mockResolvedValue(mockFiatWalletTransaction);

      const result = await service.create('user-123', createDto);

      expect(mockFiatWalletRepository.findById).toHaveBeenCalledWith('wallet-123');
      expect(mockFiatWalletTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000,
          currency: 'USD',
          transaction_id: 'txn-123',
          transaction_type: FiatWalletTransactionType.DEPOSIT,
          fiat_wallet_id: 'wallet-123',
          user_id: 'user-123',
          status: TransactionStatus.PENDING,
          balance_before: 5000,
          balance_after: 6000,
        }),
        undefined,
      );
      expect(result).toEqual(mockFiatWalletTransaction);
    });

    it('should use provided balance_before and balance_after when specified', async () => {
      const createDtoWithBalance: CreateFiatTransactionDto = {
        ...createDto,
        balance_before: 3000,
        balance_after: 4000,
      };

      mockFiatWalletRepository.findById.mockResolvedValue(mockFiatWallet);
      mockFiatWalletTransactionRepository.create.mockResolvedValue(mockFiatWalletTransaction);

      await service.create('user-123', createDtoWithBalance);

      expect(mockFiatWalletTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          balance_before: 3000,
          balance_after: 4000,
        }),
        undefined,
      );
    });

    it('should throw NotFoundException when fiat wallet not found', async () => {
      mockFiatWalletRepository.findById.mockResolvedValue(null);

      await expect(service.create('user-123', createDto)).rejects.toThrow(NotFoundException);
      await expect(service.create('user-123', createDto)).rejects.toThrow('Fiat wallet not found');
    });

    it('should throw BadRequestException when creation fails', async () => {
      mockFiatWalletRepository.findById.mockResolvedValue(mockFiatWallet);
      mockFiatWalletTransactionRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create('user-123', createDto)).rejects.toThrow(BadRequestException);
    });

    it('should pass transaction object when provided', async () => {
      const mockTrx = {} as any;
      mockFiatWalletRepository.findById.mockResolvedValue(mockFiatWallet);
      mockFiatWalletTransactionRepository.create.mockResolvedValue(mockFiatWalletTransaction);

      await service.create('user-123', createDto, mockTrx);

      expect(mockFiatWalletTransactionRepository.create).toHaveBeenCalledWith(expect.any(Object), mockTrx);
    });

    it('should use default INITIATED status when status not provided', async () => {
      const createDtoWithoutStatus = {
        transaction_id: 'txn-123',
        fiat_wallet_id: 'wallet-123',
        transaction_type: FiatWalletTransactionType.DEPOSIT,
        amount: 1000,
        currency: 'USD',
      } as CreateFiatTransactionDto;

      mockFiatWalletRepository.findById.mockResolvedValue(mockFiatWallet);
      mockFiatWalletTransactionRepository.create.mockResolvedValue(mockFiatWalletTransaction);

      await service.create('user-123', createDtoWithoutStatus);

      expect(mockFiatWalletTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TransactionStatus.INITIATED,
        }),
        undefined,
      );
    });
  });

  describe('findAll', () => {
    const mockPaginatedResponse = {
      data: [mockFiatWalletTransaction],
      pagination: {
        current_page: 1,
        next_page: 0,
        previous_page: 0,
        limit: 10,
        page_count: 1,
        total: 1,
      },
    };

    it('should return paginated transactions with no filters', async () => {
      mockFiatWalletTransactionRepository.findAll.mockResolvedValue(mockPaginatedResponse);

      const result = await service.findAll('user-123');

      expect(mockFiatWalletTransactionRepository.findAll).toHaveBeenCalledWith(
        { user_id: 'user-123' },
        { page: undefined, limit: undefined },
      );
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should apply fiat_wallet_id filter when provided', async () => {
      mockFiatWalletTransactionRepository.findAll.mockResolvedValue(mockPaginatedResponse);

      await service.findAll('user-123', { fiat_wallet_id: 'wallet-123' });

      expect(mockFiatWalletTransactionRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          fiat_wallet_id: 'wallet-123',
        }),
        expect.any(Object),
      );
    });

    it('should apply transaction_type filter when provided', async () => {
      mockFiatWalletTransactionRepository.findAll.mockResolvedValue(mockPaginatedResponse);

      await service.findAll('user-123', { transaction_type: FiatWalletTransactionType.DEPOSIT });

      expect(mockFiatWalletTransactionRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          transaction_type: FiatWalletTransactionType.DEPOSIT,
        }),
        expect.any(Object),
      );
    });

    it('should apply status filter when provided', async () => {
      mockFiatWalletTransactionRepository.findAll.mockResolvedValue(mockPaginatedResponse);

      await service.findAll('user-123', { status: TransactionStatus.COMPLETED });

      expect(mockFiatWalletTransactionRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          status: TransactionStatus.COMPLETED,
        }),
        expect.any(Object),
      );
    });

    it('should apply currency filter when provided', async () => {
      mockFiatWalletTransactionRepository.findAll.mockResolvedValue(mockPaginatedResponse);

      await service.findAll('user-123', { currency: 'NGN' });

      expect(mockFiatWalletTransactionRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          currency: 'NGN',
        }),
        expect.any(Object),
      );
    });

    it('should apply transaction_id filter when provided', async () => {
      mockFiatWalletTransactionRepository.findAll.mockResolvedValue(mockPaginatedResponse);

      await service.findAll('user-123', { transaction_id: 'txn-123' });

      expect(mockFiatWalletTransactionRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          transaction_id: 'txn-123',
        }),
        expect.any(Object),
      );
    });

    it('should apply provider_reference filter when provided', async () => {
      mockFiatWalletTransactionRepository.findAll.mockResolvedValue(mockPaginatedResponse);

      await service.findAll('user-123', { provider_reference: 'ref-123' });

      expect(mockFiatWalletTransactionRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          provider_reference: 'ref-123',
        }),
        expect.any(Object),
      );
    });

    it('should apply pagination when provided', async () => {
      mockFiatWalletTransactionRepository.findAll.mockResolvedValue(mockPaginatedResponse);

      await service.findAll('user-123', { page: 2, limit: 20 });

      expect(mockFiatWalletTransactionRepository.findAll).toHaveBeenCalledWith(expect.any(Object), {
        page: 2,
        limit: 20,
      });
    });

    it('should apply multiple filters together', async () => {
      mockFiatWalletTransactionRepository.findAll.mockResolvedValue(mockPaginatedResponse);

      await service.findAll('user-123', {
        fiat_wallet_id: 'wallet-123',
        transaction_type: FiatWalletTransactionType.WITHDRAWAL,
        status: TransactionStatus.PENDING,
        currency: 'USD',
      });

      expect(mockFiatWalletTransactionRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          fiat_wallet_id: 'wallet-123',
          transaction_type: FiatWalletTransactionType.WITHDRAWAL,
          status: TransactionStatus.PENDING,
          currency: 'USD',
        }),
        expect.any(Object),
      );
    });
  });

  describe('findOne', () => {
    it('should return a transaction when found', async () => {
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);

      const result = await service.findOne({ id: 'fwt-123' });

      expect(mockFiatWalletTransactionRepository.findOne).toHaveBeenCalledWith({ id: 'fwt-123' });
      expect(result).toEqual(mockFiatWalletTransaction);
    });

    it('should throw NotFoundException when transaction not found', async () => {
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne({ id: 'non-existent' })).rejects.toThrow(NotFoundException);
      await expect(service.findOne({ id: 'non-existent' })).rejects.toThrow('Fiat wallet transaction not found');
    });
  });

  describe('findOneOrNull', () => {
    it('should return a transaction when found', async () => {
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(mockFiatWalletTransaction);

      const result = await service.findOneOrNull({ id: 'fwt-123' });

      expect(mockFiatWalletTransactionRepository.findOne).toHaveBeenCalledWith({ id: 'fwt-123' });
      expect(result).toEqual(mockFiatWalletTransaction);
    });

    it('should return null when transaction not found', async () => {
      mockFiatWalletTransactionRepository.findOne.mockResolvedValue(null);

      const result = await service.findOneOrNull({ id: 'non-existent' });

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a transaction when found', async () => {
      mockFiatWalletTransactionRepository.findById.mockResolvedValue(mockFiatWalletTransaction);

      const result = await service.findById('fwt-123');

      expect(mockFiatWalletTransactionRepository.findById).toHaveBeenCalledWith('fwt-123');
      expect(result).toEqual(mockFiatWalletTransaction);
    });

    it('should throw NotFoundException when transaction not found', async () => {
      mockFiatWalletTransactionRepository.findById.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
      await expect(service.findById('non-existent')).rejects.toThrow(
        'Fiat wallet transaction with ID non-existent not found',
      );
    });
  });

  describe('updateStatus', () => {
    const existingTransaction = {
      ...mockFiatWalletTransaction,
      status: TransactionStatus.PENDING,
    };

    beforeEach(() => {
      mockFiatWalletTransactionRepository.findById.mockResolvedValue(existingTransaction);
    });

    it('should update status to PROCESSING and set processed_at', async () => {
      const updatedTransaction = {
        ...existingTransaction,
        status: TransactionStatus.PROCESSING,
        processed_at: expect.any(String),
      };
      mockFiatWalletTransactionRepository.update.mockResolvedValue(updatedTransaction);

      const result = await service.updateStatus('fwt-123', TransactionStatus.PROCESSING);

      expect(mockLockerService.withLock).toHaveBeenCalledWith(
        'fiat-wallet-transaction:fwt-123:update-status',
        expect.any(Function),
      );
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-123',
        expect.objectContaining({
          status: TransactionStatus.PROCESSING,
          processed_at: expect.any(String),
        }),
        { trx: undefined },
      );
      expect(result).toEqual(updatedTransaction);
    });

    it('should update status to COMPLETED and set completed_at', async () => {
      const updatedTransaction = {
        ...existingTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: expect.any(String),
      };
      mockFiatWalletTransactionRepository.update.mockResolvedValue(updatedTransaction);

      const result = await service.updateStatus('fwt-123', TransactionStatus.COMPLETED);

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-123',
        expect.objectContaining({
          status: TransactionStatus.COMPLETED,
          completed_at: expect.any(String),
        }),
        { trx: undefined },
      );
      expect(result).toEqual(updatedTransaction);
    });

    it('should update status to FAILED and set failed_at with failure_reason', async () => {
      const metadata = { failure_reason: 'Insufficient funds' };
      const updatedTransaction = {
        ...existingTransaction,
        status: TransactionStatus.FAILED,
        failed_at: expect.any(String),
        failure_reason: 'Insufficient funds',
      };
      mockFiatWalletTransactionRepository.update.mockResolvedValue(updatedTransaction);

      const result = await service.updateStatus('fwt-123', TransactionStatus.FAILED, metadata);

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-123',
        expect.objectContaining({
          status: TransactionStatus.FAILED,
          failed_at: expect.any(String),
          failure_reason: 'Insufficient funds',
        }),
        { trx: undefined },
      );
      expect(result).toEqual(updatedTransaction);
    });

    it('should update status to REVIEW and set failure_reason', async () => {
      const metadata = { failure_reason: 'Requires manual review' };
      const updatedTransaction = {
        ...existingTransaction,
        status: TransactionStatus.REVIEW,
        failure_reason: 'Requires manual review',
      };
      mockFiatWalletTransactionRepository.update.mockResolvedValue(updatedTransaction);

      const result = await service.updateStatus('fwt-123', TransactionStatus.REVIEW, metadata);

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-123',
        expect.objectContaining({
          status: TransactionStatus.REVIEW,
          failure_reason: 'Requires manual review',
        }),
        { trx: undefined },
      );
      expect(result).toEqual(updatedTransaction);
    });

    it('should update provider_reference when provided in metadata', async () => {
      const metadata = { provider_reference: 'new-ref-123' };
      const updatedTransaction = {
        ...existingTransaction,
        status: TransactionStatus.COMPLETED,
        provider_reference: 'new-ref-123',
      };
      mockFiatWalletTransactionRepository.update.mockResolvedValue(updatedTransaction);

      await service.updateStatus('fwt-123', TransactionStatus.COMPLETED, metadata);

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-123',
        expect.objectContaining({
          provider_reference: 'new-ref-123',
        }),
        { trx: undefined },
      );
    });

    it('should update provider_request_ref when provided in metadata', async () => {
      const metadata = { provider_request_ref: 'req-ref-123' };
      const updatedTransaction = {
        ...existingTransaction,
        status: TransactionStatus.COMPLETED,
        provider_request_ref: 'req-ref-123',
      };
      mockFiatWalletTransactionRepository.update.mockResolvedValue(updatedTransaction);

      await service.updateStatus('fwt-123', TransactionStatus.COMPLETED, metadata);

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-123',
        expect.objectContaining({
          provider_request_ref: 'req-ref-123',
        }),
        { trx: undefined },
      );
    });

    it('should update provider_metadata when provided in metadata', async () => {
      const metadata = { provider_metadata: { key: 'value' } };
      const updatedTransaction = {
        ...existingTransaction,
        status: TransactionStatus.COMPLETED,
        provider_metadata: { key: 'value' },
      };
      mockFiatWalletTransactionRepository.update.mockResolvedValue(updatedTransaction);

      await service.updateStatus('fwt-123', TransactionStatus.COMPLETED, metadata);

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-123',
        expect.objectContaining({
          provider_metadata: { key: 'value' },
        }),
        { trx: undefined },
      );
    });

    it('should throw NotFoundException when transaction not found', async () => {
      mockFiatWalletTransactionRepository.findById.mockResolvedValue(null);

      await expect(service.updateStatus('non-existent', TransactionStatus.COMPLETED)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not allow transition from COMPLETED terminal state', async () => {
      const completedTransaction = {
        ...existingTransaction,
        status: TransactionStatus.COMPLETED,
      };
      mockFiatWalletTransactionRepository.findById.mockResolvedValue(completedTransaction);

      const result = await service.updateStatus('fwt-123', TransactionStatus.FAILED);

      expect(mockFiatWalletTransactionRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual(completedTransaction);
    });

    it('should not allow transition from FAILED terminal state', async () => {
      const failedTransaction = {
        ...existingTransaction,
        status: TransactionStatus.FAILED,
      };
      mockFiatWalletTransactionRepository.findById.mockResolvedValue(failedTransaction);

      const result = await service.updateStatus('fwt-123', TransactionStatus.COMPLETED);

      expect(mockFiatWalletTransactionRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual(failedTransaction);
    });

    it('should not allow transition from CANCELLED terminal state', async () => {
      const cancelledTransaction = {
        ...existingTransaction,
        status: TransactionStatus.CANCELLED,
      };
      mockFiatWalletTransactionRepository.findById.mockResolvedValue(cancelledTransaction);

      const result = await service.updateStatus('fwt-123', TransactionStatus.COMPLETED);

      expect(mockFiatWalletTransactionRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual(cancelledTransaction);
    });

    it('should allow updating to same status even in terminal state', async () => {
      const completedTransaction = {
        ...existingTransaction,
        status: TransactionStatus.COMPLETED,
      };
      mockFiatWalletTransactionRepository.findById.mockResolvedValue(completedTransaction);
      mockFiatWalletTransactionRepository.update.mockResolvedValue(completedTransaction);

      await service.updateStatus('fwt-123', TransactionStatus.COMPLETED);

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalled();
    });

    it('should pass transaction object when provided', async () => {
      const mockTrx = {} as any;
      const updatedTransaction = {
        ...existingTransaction,
        status: TransactionStatus.COMPLETED,
      };
      mockFiatWalletTransactionRepository.update.mockResolvedValue(updatedTransaction);

      await service.updateStatus('fwt-123', TransactionStatus.COMPLETED, undefined, mockTrx);

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith('fwt-123', expect.any(Object), {
        trx: mockTrx,
      });
    });

    it('should update provider_reference even when status is terminal and cannot transition', async () => {
      const terminalTransaction = {
        ...existingTransaction,
        status: TransactionStatus.COMPLETED,
        provider_reference: 'old-trade-id',
      };
      mockFiatWalletTransactionRepository.findById.mockResolvedValue(terminalTransaction);
      mockFiatWalletTransactionRepository.update.mockResolvedValue({
        ...terminalTransaction,
        provider_reference: 'new-trade-id',
      });

      const result = await service.updateStatus('fwt-123', TransactionStatus.PROCESSING, {
        provider_reference: 'new-trade-id',
      });

      // Should update provider_reference despite blocking status transition
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-123',
        {
          provider_reference: 'new-trade-id',
        },
        { trx: undefined },
      );
      expect(result.provider_reference).toBe('new-trade-id');
    });

    it('should update provider_metadata even when status is terminal and cannot transition', async () => {
      const terminalTransaction = {
        ...existingTransaction,
        status: TransactionStatus.FAILED,
        provider_metadata: { old_data: 'value' },
      };
      mockFiatWalletTransactionRepository.findById.mockResolvedValue(terminalTransaction);
      mockFiatWalletTransactionRepository.update.mockResolvedValue({
        ...terminalTransaction,
        provider_metadata: { new_data: 'value' },
      });

      const result = await service.updateStatus('fwt-123', TransactionStatus.PENDING, {
        provider_metadata: { new_data: 'value' },
      });

      // Should update provider_metadata despite blocking status transition
      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-123',
        {
          provider_metadata: { new_data: 'value' },
        },
        { trx: undefined },
      );
      expect(result.provider_metadata).toEqual({ new_data: 'value' });
    });

    it('should update both provider_reference and provider_metadata when status is terminal', async () => {
      const terminalTransaction = {
        ...existingTransaction,
        status: TransactionStatus.CANCELLED,
      };
      mockFiatWalletTransactionRepository.findById.mockResolvedValue(terminalTransaction);
      mockFiatWalletTransactionRepository.update.mockResolvedValue({
        ...terminalTransaction,
        provider_reference: 'trade-456',
        provider_metadata: { webhook_data: 'test' },
      });

      await service.updateStatus('fwt-123', TransactionStatus.COMPLETED, {
        provider_reference: 'trade-456',
        provider_metadata: { webhook_data: 'test' },
      });

      expect(mockFiatWalletTransactionRepository.update).toHaveBeenCalledWith(
        'fwt-123',
        {
          provider_reference: 'trade-456',
          provider_metadata: { webhook_data: 'test' },
        },
        { trx: undefined },
      );
    });

    it('should return existing transaction when terminal and no metadata to update', async () => {
      const terminalTransaction = {
        ...existingTransaction,
        status: TransactionStatus.COMPLETED,
      };
      mockFiatWalletTransactionRepository.findById.mockResolvedValue(terminalTransaction);

      const result = await service.updateStatus('fwt-123', TransactionStatus.PENDING, {});

      // Should not call update when there's no metadata to update
      expect(mockFiatWalletTransactionRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual(terminalTransaction);
    });
  });
});
