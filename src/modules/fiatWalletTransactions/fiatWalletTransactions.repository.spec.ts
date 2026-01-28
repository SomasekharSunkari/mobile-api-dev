import { DateTime } from 'luxon';
import { abs } from 'mathjs';
import { FiatWalletTransactionRepository } from './fiatWalletTransactions.repository';
import { FiatWalletTransactionModel } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.model';

describe('FiatWalletTransactionRepository', () => {
  let repository: FiatWalletTransactionRepository;
  let mockQuery: any;

  beforeEach(() => {
    repository = new FiatWalletTransactionRepository();
    mockQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      whereNotIn: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      first: jest.fn(),
    };
    jest.spyOn(repository, 'query').mockReturnValue(mockQuery as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('countPendingByUserAndType', () => {
    it('should count pending transactions for user and type', async () => {
      mockQuery.first.mockResolvedValue({ count: '3' });

      const result = await repository.countPendingByUserAndType('user-1', 'deposit', 'USD');

      expect(result).toBe(3);
      expect(mockQuery.where).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQuery.where).toHaveBeenCalledWith('transaction_type', 'deposit');
      expect(mockQuery.where).toHaveBeenCalledWith('currency', 'USD');
      expect(mockQuery.whereNull).toHaveBeenCalledWith('settled_at');
      expect(mockQuery.whereNotIn).toHaveBeenCalledWith('status', ['failed', 'cancelled']);
      expect(mockQuery.count).toHaveBeenCalledWith('id as count');
    });

    it('should return 0 when no pending transactions found', async () => {
      mockQuery.first.mockResolvedValue(undefined);

      const result = await repository.countPendingByUserAndType('user-1', 'withdrawal', 'USD');

      expect(result).toBe(0);
    });

    it('should return 0 when count is null', async () => {
      mockQuery.first.mockResolvedValue({ count: null });

      const result = await repository.countPendingByUserAndType('user-1', 'deposit', 'NGN');

      expect(result).toBe(0);
    });
  });

  describe('countTransactionsByTypeInPastWeek', () => {
    it('should count transactions in the past 7 days', async () => {
      mockQuery.first.mockResolvedValue({ count: '5' });

      const result = await repository.countTransactionsByTypeInPastWeek('user-1', 'deposit', 'USD');

      expect(result).toBe(5);
      expect(mockQuery.where).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQuery.where).toHaveBeenCalledWith('transaction_type', 'deposit');
      expect(mockQuery.where).toHaveBeenCalledWith('currency', 'USD');
      expect(mockQuery.whereNotIn).toHaveBeenCalledWith('status', ['failed', 'cancelled']);
      expect(mockQuery.count).toHaveBeenCalledWith('id as count');

      // Verify the date filter is called with a date 7 days ago
      const whereCallsWithCreatedAt = mockQuery.where.mock.calls.filter((call: any) => call[0] === 'created_at');
      expect(whereCallsWithCreatedAt.length).toBe(1);
      expect(whereCallsWithCreatedAt[0][1]).toBe('>=');

      // Verify the date is approximately 7 days ago (within 1 second tolerance)
      const providedDate = whereCallsWithCreatedAt[0][2];
      const expectedDate = DateTime.now().minus({ days: 7 }).toJSDate();
      const timeDiff = abs(providedDate.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    it('should return 0 when no transactions found in past week', async () => {
      mockQuery.first.mockResolvedValue(undefined);

      const result = await repository.countTransactionsByTypeInPastWeek('user-1', 'withdrawal', 'USD');

      expect(result).toBe(0);
    });

    it('should return 0 when count is null', async () => {
      mockQuery.first.mockResolvedValue({ count: null });

      const result = await repository.countTransactionsByTypeInPastWeek('user-1', 'deposit', 'NGN');

      expect(result).toBe(0);
    });

    it('should handle different transaction types', async () => {
      mockQuery.first.mockResolvedValue({ count: '2' });

      const result = await repository.countTransactionsByTypeInPastWeek('user-1', 'withdrawal', 'USD');

      expect(result).toBe(2);
      expect(mockQuery.where).toHaveBeenCalledWith('transaction_type', 'withdrawal');
    });

    it('should handle different currencies', async () => {
      mockQuery.first.mockResolvedValue({ count: '4' });

      const result = await repository.countTransactionsByTypeInPastWeek('user-1', 'deposit', 'NGN');

      expect(result).toBe(4);
      expect(mockQuery.where).toHaveBeenCalledWith('currency', 'NGN');
    });
  });

  describe('findByIdempotencyKey', () => {
    it('should find transaction by idempotency key', async () => {
      const mockTransaction = { id: 'txn-1', idempotency_key: 'key-123' } as unknown as FiatWalletTransactionModel;
      mockQuery.first.mockResolvedValue(mockTransaction);

      const result = await repository.findByIdempotencyKey('key-123');

      expect(result).toEqual(mockTransaction);
      expect(mockQuery.where).toHaveBeenCalledWith('idempotency_key', 'key-123');
    });

    it('should return null when no transaction found', async () => {
      mockQuery.first.mockResolvedValue(undefined);

      const result = await repository.findByIdempotencyKey('non-existent-key');

      expect(result).toBeNull();
    });
  });

  describe('findByUserIdAndIdempotencyKey', () => {
    it('should find transaction by user ID and idempotency key', async () => {
      const mockTransaction = {
        id: 'txn-1',
        user_id: 'user-1',
        idempotency_key: 'key-123',
      } as unknown as FiatWalletTransactionModel;
      mockQuery.first.mockResolvedValue(mockTransaction);

      const result = await repository.findByUserIdAndIdempotencyKey('user-1', 'key-123');

      expect(result).toEqual(mockTransaction);
      expect(mockQuery.where).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQuery.where).toHaveBeenCalledWith('idempotency_key', 'key-123');
    });

    it('should return null when no transaction found', async () => {
      mockQuery.first.mockResolvedValue(undefined);

      const result = await repository.findByUserIdAndIdempotencyKey('user-1', 'non-existent-key');

      expect(result).toBeNull();
    });
  });
});
