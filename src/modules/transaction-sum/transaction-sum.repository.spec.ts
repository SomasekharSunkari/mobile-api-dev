import { Test, TestingModule } from '@nestjs/testing';
import { TransactionSumRepository } from './transaction-sum.repository';
import { TransactionStatus } from '../../database/models/transaction/transaction.interface';

describe('TransactionSumRepository', () => {
  let repository: TransactionSumRepository;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransactionSumRepository],
    }).compile();

    repository = module.get<TransactionSumRepository>(TransactionSumRepository);

    // Mock the model's knex method instead of transaction
    const mockKnex = {
      select: jest.fn().mockReturnValue(mockQueryBuilder),
      raw: jest.fn(),
    };

    jest.spyOn(repository.model, 'knex').mockReturnValue(mockKnex as any);

    // Make sure the query builder chain works properly
    mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.from.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.whereNull.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.groupBy.mockReturnValue(mockQueryBuilder);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('getFiatWalletTransactionSum', () => {
    const asset = 'USD';
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2023-01-31');
    const status = TransactionStatus.COMPLETED;
    const userId = 'user-123';

    beforeEach(() => {
      // Mock the raw method on the knex instance
      const mockKnex = repository.model.knex() as any;
      mockKnex.raw
        .mockReturnValueOnce('COALESCE(SUM(amount), 0) as total_sum' as any)
        .mockReturnValueOnce('COUNT(id) as total_count' as any);

      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.from.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.whereNull.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.groupBy.mockReturnValue(mockQueryBuilder);
    });

    it('should return transaction sums grouped by transaction type', async () => {
      const mockResults = [
        {
          transaction_type: 'deposit',
          total_sum: '500000',
          total_count: '5',
        },
        {
          transaction_type: 'withdrawal',
          total_sum: '300000',
          total_count: '3',
        },
      ];

      // Mock the final query execution
      mockQueryBuilder.groupBy.mockResolvedValue(mockResults);

      const result = await repository.getFiatWalletTransactionSum(asset, startDate, endDate, status, userId);

      expect(repository.model.knex().select).toHaveBeenCalledWith(
        'transaction_type',
        expect.any(String),
        expect.any(String),
      );
      expect(mockQueryBuilder.from).toHaveBeenCalledWith('api_service.fiat_wallet_transactions');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('currency', asset);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('status', status);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('user_id', userId);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('created_at', '>=', startDate.toISOString());
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('created_at', '<=', endDate.toISOString());
      expect(mockQueryBuilder.whereNull).toHaveBeenCalledWith('deleted_at');
      expect(mockQueryBuilder.groupBy).toHaveBeenCalledWith('transaction_type');

      expect(result).toEqual({
        deposit: {
          totalSum: 500000,
          totalCount: 5,
        },
        withdrawal: {
          totalSum: 300000,
          totalCount: 3,
        },
      });
    });

    it('should handle empty results', async () => {
      const mockResults: any[] = [];
      mockQueryBuilder.groupBy.mockResolvedValue(mockResults);

      const result = await repository.getFiatWalletTransactionSum(asset, startDate, endDate, status, userId);

      expect(result).toEqual({});
    });

    it('should handle null/undefined total_sum values', async () => {
      const mockResults = [
        {
          transaction_type: 'deposit',
          total_sum: null,
          total_count: '0',
        },
        {
          transaction_type: 'withdrawal',
          total_sum: undefined,
          total_count: '0',
        },
      ];

      mockQueryBuilder.groupBy.mockResolvedValue(mockResults);

      const result = await repository.getFiatWalletTransactionSum(asset, startDate, endDate, status, userId);

      expect(result).toEqual({
        deposit: {
          totalSum: 0,
          totalCount: 0,
        },
        withdrawal: {
          totalSum: 0,
          totalCount: 0,
        },
      });
    });

    it('should handle null/undefined total_count values', async () => {
      const mockResults = [
        {
          transaction_type: 'deposit',
          total_sum: '100000',
          total_count: null,
        },
        {
          transaction_type: 'withdrawal',
          total_sum: '50000',
          total_count: undefined,
        },
      ];

      mockQueryBuilder.groupBy.mockResolvedValue(mockResults);

      const result = await repository.getFiatWalletTransactionSum(asset, startDate, endDate, status, userId);

      expect(result).toEqual({
        deposit: {
          totalSum: 100000,
          totalCount: 0,
        },
        withdrawal: {
          totalSum: 50000,
          totalCount: 0,
        },
      });
    });

    it('should handle string values that cannot be parsed as integers', async () => {
      const mockResults = [
        {
          transaction_type: 'deposit',
          total_sum: 'invalid_number',
          total_count: 'invalid_count',
        },
      ];

      mockQueryBuilder.groupBy.mockResolvedValue(mockResults);

      const result = await repository.getFiatWalletTransactionSum(asset, startDate, endDate, status, userId);

      expect(result).toEqual({
        deposit: {
          totalSum: 0,
          totalCount: 0,
        },
      });
    });

    it('should convert string numbers to integers correctly', async () => {
      const mockResults = [
        {
          transaction_type: 'transfer_in',
          total_sum: '1500000',
          total_count: '10',
        },
        {
          transaction_type: 'transfer_out',
          total_sum: '750000',
          total_count: '7',
        },
      ];

      mockQueryBuilder.groupBy.mockResolvedValue(mockResults);

      const result = await repository.getFiatWalletTransactionSum(asset, startDate, endDate, status, userId);

      expect(result).toEqual({
        transfer_in: {
          totalSum: 1500000,
          totalCount: 10,
        },
        transfer_out: {
          totalSum: 750000,
          totalCount: 7,
        },
      });
    });

    it('should work with different transaction statuses', async () => {
      const mockResults = [
        {
          transaction_type: 'deposit',
          total_sum: '200000',
          total_count: '2',
        },
      ];

      mockQueryBuilder.groupBy.mockResolvedValue(mockResults);

      await repository.getFiatWalletTransactionSum(asset, startDate, endDate, TransactionStatus.PENDING, userId);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('status', TransactionStatus.PENDING);
    });

    it('should work with different assets', async () => {
      const mockResults = [
        {
          transaction_type: 'deposit',
          total_sum: '100000',
          total_count: '1',
        },
      ];

      mockQueryBuilder.groupBy.mockResolvedValue(mockResults);

      await repository.getFiatWalletTransactionSum('EUR', startDate, endDate, status, userId);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('currency', 'EUR');
    });

    it('should work with different date ranges', async () => {
      const customStartDate = new Date('2023-06-01');
      const customEndDate = new Date('2023-06-30');
      const mockResults = [
        {
          transaction_type: 'deposit',
          total_sum: '100000',
          total_count: '1',
        },
      ];

      mockQueryBuilder.groupBy.mockResolvedValue(mockResults);

      await repository.getFiatWalletTransactionSum(asset, customStartDate, customEndDate, status, userId);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('created_at', '>=', customStartDate.toISOString());
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('created_at', '<=', customEndDate.toISOString());
    });

    it('should work with different user IDs', async () => {
      const differentUserId = 'user-456';
      const mockResults = [
        {
          transaction_type: 'deposit',
          total_sum: '100000',
          total_count: '1',
        },
      ];

      mockQueryBuilder.groupBy.mockResolvedValue(mockResults);

      await repository.getFiatWalletTransactionSum(asset, startDate, endDate, status, differentUserId);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('user_id', differentUserId);
    });
  });
});
