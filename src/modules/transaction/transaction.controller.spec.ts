import { HttpStatus, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionModel, TransactionStatus, UserModel } from '../../database';
import { GetTransactionsResponseDto } from './dto/transactionResponse.dto';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';

describe('TransactionController', () => {
  let controller: TransactionController;
  let transactionService: jest.Mocked<TransactionService>;

  const mockUser: UserModel = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    first_name: 'Test',
    last_name: 'User',
  } as UserModel;

  const mockTransaction: TransactionModel = {
    id: 'tx-123',
    user_id: 'user-123',
    asset: 'USD',
    amount: 1000,
    transaction_type: 'deposit',
    status: 'completed',
    category: 'fiat',
    transaction_scope: 'internal',
    created_at: new Date(),
    updated_at: new Date(),
  } as unknown as TransactionModel;

  const mockTransactionsResponse: GetTransactionsResponseDto = {
    transactions: [
      {
        id: 'tx-123',
        user_id: 'user-123',
        asset: 'USD',
        amount: '1000',
        transaction_type: 'deposit',
        status: 'completed',
        category: 'fiat',
        transaction_scope: 'internal',
        created_at: '2025-01-01 00:00:00',
        updated_at: '2025-01-01 00:00:00',
        processed_at: '2025-01-01 00:00:00',
      },
    ],
    pagination: {
      current_page: 1,
      next_page: 2,
      previous_page: 0,
      limit: 10,
      page_count: 1,
      total: 1,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        {
          provide: TransactionService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            updateInReviewTransactionStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TransactionController>(TransactionController);
    transactionService = module.get<TransactionService>(TransactionService) as jest.Mocked<TransactionService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated transactions successfully', async () => {
      const query = { page: 1, limit: 10 };
      transactionService.findAll.mockResolvedValue(mockTransactionsResponse);

      const result = await controller.findAll(mockUser, query);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Transactions retrieved successfully');
      expect(result.data).toEqual(mockTransactionsResponse);
      expect(result.timestamp).toBeDefined();
      expect(transactionService.findAll).toHaveBeenCalledWith(mockUser.id, query);
      expect(transactionService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should handle empty transactions list', async () => {
      const query = { page: 1, limit: 10 };
      const emptyResponse = {
        transactions: [],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 0,
          total: 0,
        },
      };

      transactionService.findAll.mockResolvedValue(emptyResponse);

      const result = await controller.findAll(mockUser, query);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Transactions retrieved successfully');
      expect(result.data).toEqual(emptyResponse);
      expect(result.data.transactions).toHaveLength(0);
    });

    it('should handle transactions with filters', async () => {
      const query = {
        page: 1,
        limit: 10,
        asset: 'USD',
        status: [TransactionStatus.COMPLETED],
      };
      transactionService.findAll.mockResolvedValue(mockTransactionsResponse);

      const result = await controller.findAll(mockUser, query);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(transactionService.findAll).toHaveBeenCalledWith(mockUser.id, query);
    });
  });

  describe('updateInReviewTransactionStatus', () => {
    it('should update transaction status successfully', async () => {
      const body = {
        transaction_id: 'tx-123',
        status: TransactionStatus.COMPLETED,
      };
      const updatedTransaction = { ...mockTransaction, status: TransactionStatus.COMPLETED };
      transactionService.updateInReviewTransactionStatus.mockResolvedValue(
        updatedTransaction as unknown as TransactionModel,
      );

      const result = await controller.updateInReviewTransactionStatus(body);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Transaction status updated successfully');
      expect(result.data).toEqual(updatedTransaction);
      expect(transactionService.updateInReviewTransactionStatus).toHaveBeenCalledWith(body.transaction_id, body);
      expect(transactionService.updateInReviewTransactionStatus).toHaveBeenCalledTimes(1);
    });

    it('should update transaction status with failure reason', async () => {
      const body = {
        transaction_id: 'tx-123',
        status: TransactionStatus.FAILED,
        failure_reason: 'Insufficient funds',
      };
      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.FAILED,
        failure_reason: 'Insufficient funds',
      };
      transactionService.updateInReviewTransactionStatus.mockResolvedValue(
        updatedTransaction as unknown as TransactionModel,
      );

      const result = await controller.updateInReviewTransactionStatus(body);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Transaction status updated successfully');
      expect(result.data.failure_reason).toBe('Insufficient funds');
    });
  });

  describe('findById', () => {
    it('should return a transaction by ID', async () => {
      transactionService.findOne.mockResolvedValue(mockTransaction);

      const result = await controller.findById(mockUser, 'tx-123');

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.message).toBe('Transaction retrieved successfully');
      expect(result.data).toEqual(mockTransaction);
      expect(transactionService.findOne).toHaveBeenCalledWith({ id: 'tx-123', user_id: mockUser.id });
      expect(transactionService.findOne).toHaveBeenCalledTimes(1);
    });

    it('should handle transaction not found', async () => {
      transactionService.findOne.mockRejectedValue(new NotFoundException('Transaction not found'));

      await expect(controller.findById(mockUser, 'non-existent-id')).rejects.toThrow(NotFoundException);
      expect(transactionService.findOne).toHaveBeenCalledWith({ id: 'non-existent-id', user_id: mockUser.id });
    });
  });
});
