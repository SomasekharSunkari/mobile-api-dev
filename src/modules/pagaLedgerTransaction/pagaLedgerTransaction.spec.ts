import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FetchQuery } from '../../database/base/base.interface';
import {
  IPagaLedgerTransaction,
  PagaLedgerTransactionStatus,
  PagaLedgerTransactionType,
} from '../../database/models/pagaLedgerTransaction/pagaLedgerTransaction.interface';
import { PagaLedgerTransactionModel } from '../../database/models/pagaLedgerTransaction/pagaLedgerTransaction.model';
import { PagaLedgerTransactionRepository } from './pagaLedgerTransaction.repository';
import { PagaLedgerTransactionService } from './pagaLedgerTransaction.service';

const mockPagaLedgerTransaction: Partial<PagaLedgerTransactionModel> = {
  id: 'trans-1',
  account_number: 'PAGA12345',
  reference_number: 'REF123',
  transaction_type: 'DEPOSIT' as PagaLedgerTransactionType,
  amount: 1000,
  fee: 50,
  currency: 'NGN',
  status: 'PENDING' as PagaLedgerTransactionStatus,
  description: 'Test transaction',
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

const mockPaginatedResponse = {
  data: [mockPagaLedgerTransaction],
  pagination: {
    total: 1,
    page: 1,
    per_page: 10,
    total_pages: 1,
    has_next_page: false,
    has_prev_page: false,
  },
};

describe('PagaLedgerTransactionService', () => {
  let service: PagaLedgerTransactionService;

  const mockRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PagaLedgerTransactionService, { provide: PagaLedgerTransactionRepository, useValue: mockRepository }],
    }).compile();

    service = module.get<PagaLedgerTransactionService>(PagaLedgerTransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createData: Omit<IPagaLedgerTransaction, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> = {
      account_number: 'PAGA12345',
      reference_number: 'REF123',
      transaction_type: 'DEPOSIT' as PagaLedgerTransactionType,
      amount: 1000,
      fee: 50,
      currency: 'NGN',
      status: 'PENDING' as PagaLedgerTransactionStatus,
      description: 'Test transaction',
      transaction_reference: 'REF123',
      balance_before: 1000,
      balance_after: 1000,
    };

    it('should create a new Paga ledger transaction successfully', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockPagaLedgerTransaction);

      const result = await service.create(createData);

      expect(mockRepository.findOne).toHaveBeenCalledWith(
        { reference_number: createData.reference_number },
        undefined,
        { trx: undefined },
      );
      expect(mockRepository.create).toHaveBeenCalledWith(
        {
          ...createData,
          status: 'PENDING',
        },
        undefined,
      );
      expect(result).toEqual(mockPagaLedgerTransaction);
    });

    it('should create transaction with provided status', async () => {
      const dataWithStatus = { ...createData, status: 'COMPLETED' as PagaLedgerTransactionStatus };
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockPagaLedgerTransaction);

      await service.create(dataWithStatus);

      expect(mockRepository.create).toHaveBeenCalledWith(
        {
          ...dataWithStatus,
          status: 'COMPLETED',
        },
        undefined,
      );
    });

    it('should throw InternalServerErrorException when repository fails', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createData)).rejects.toThrow(InternalServerErrorException);
      await expect(service.create(createData)).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    const transactionId = 'trans-1';
    const newStatus: PagaLedgerTransactionStatus = 'COMPLETED' as PagaLedgerTransactionStatus;

    it('should update transaction status successfully', async () => {
      mockRepository.findById.mockResolvedValue(mockPagaLedgerTransaction);
      mockRepository.update.mockResolvedValue({
        ...mockPagaLedgerTransaction,
        status: 'COMPLETED',
      });

      const result = await service.update(transactionId, newStatus);

      expect(mockRepository.findById).toHaveBeenCalledWith(transactionId, undefined, undefined);
      expect(mockRepository.update).toHaveBeenCalledWith(transactionId, { status: newStatus }, { trx: undefined });
      expect(result.status).toBe('COMPLETED');
    });

    it('should throw InternalServerErrorException when update fails', async () => {
      mockRepository.findById.mockResolvedValue(mockPagaLedgerTransaction);
      mockRepository.update.mockRejectedValue(new Error('Database error'));

      await expect(service.update(transactionId, newStatus)).rejects.toThrow(InternalServerErrorException);
      await expect(service.update(transactionId, newStatus)).rejects.toThrow(
        'Failed to update Paga ledger transaction status',
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated Paga ledger transactions', async () => {
      const params: FetchQuery = { page: 1, limit: 10 };
      mockRepository.findAll.mockResolvedValue(mockPaginatedResponse);

      const result = await service.findAll(params);

      expect(mockRepository.findAll).toHaveBeenCalledWith({}, params);
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should handle findAll without params', async () => {
      mockRepository.findAll.mockResolvedValue(mockPaginatedResponse);

      const result = await service.findAll();

      expect(mockRepository.findAll).toHaveBeenCalledWith({}, undefined);
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should throw InternalServerErrorException when findAll fails', async () => {
      mockRepository.findAll.mockRejectedValue(new Error('Database error'));

      await expect(service.findAll()).rejects.toThrow(InternalServerErrorException);
      await expect(service.findAll()).rejects.toThrow('Failed to retrieve Paga ledger transactions');
    });
  });

  describe('findOne', () => {
    const filter: Partial<IPagaLedgerTransaction> = { reference_number: 'REF123' };

    it('should find one Paga ledger transaction by filter', async () => {
      mockRepository.findOne.mockResolvedValue(mockPagaLedgerTransaction);

      const result = await service.findOne(filter);

      expect(mockRepository.findOne).toHaveBeenCalledWith(filter, undefined, { trx: undefined });
      expect(result).toEqual(mockPagaLedgerTransaction);
    });

    it('should return null when transaction not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne(filter);

      expect(result).toBeNull();
    });

    it('should throw InternalServerErrorException when findOne fails', async () => {
      mockRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.findOne(filter)).rejects.toThrow(InternalServerErrorException);
      await expect(service.findOne(filter)).rejects.toThrow('Failed to find Paga ledger transaction');
    });
  });

  describe('delete', () => {
    const transactionId = 'trans-1';

    it('should delete Paga ledger transaction successfully', async () => {
      mockRepository.findById.mockResolvedValue(mockPagaLedgerTransaction);
      mockRepository.delete.mockResolvedValue(undefined);

      await service.delete(transactionId);

      expect(mockRepository.findById).toHaveBeenCalledWith(transactionId);
      expect(mockRepository.delete).toHaveBeenCalledWith(transactionId);
    });

    it('should throw InternalServerErrorException when delete fails', async () => {
      mockRepository.findById.mockResolvedValue(mockPagaLedgerTransaction);
      mockRepository.delete.mockRejectedValue(new Error('Database error'));

      await expect(service.delete(transactionId)).rejects.toThrow(InternalServerErrorException);
      await expect(service.delete(transactionId)).rejects.toThrow('Failed to delete Paga ledger transaction');
    });
  });
});
