import { LimitExceededException, LimitExceededExceptionType } from './limit_exceeded_exception';

describe('LimitExceededException', () => {
  describe('WEEKLY_COUNT_LIMIT_EXCEEDED_EXCEPTION', () => {
    it('should format message correctly for deposit count limit', () => {
      const exception = new LimitExceededException(
        'deposit',
        2,
        3,
        'count',
        LimitExceededExceptionType.WEEKLY_COUNT_LIMIT_EXCEEDED_EXCEPTION,
      );

      expect(exception.type).toBe(LimitExceededExceptionType.WEEKLY_COUNT_LIMIT_EXCEEDED_EXCEPTION);
      expect(exception.message).toBe(
        "You've reached your weekly deposit limit of 3 transactions. Please try again later.",
      );
    });

    it('should format message correctly for withdrawal count limit', () => {
      const exception = new LimitExceededException(
        'withdrawal',
        5,
        5,
        'count',
        LimitExceededExceptionType.WEEKLY_COUNT_LIMIT_EXCEEDED_EXCEPTION,
      );

      expect(exception.type).toBe(LimitExceededExceptionType.WEEKLY_COUNT_LIMIT_EXCEEDED_EXCEPTION);
      expect(exception.message).toBe(
        "You've reached your weekly withdrawal limit of 5 transactions. Please try again later.",
      );
    });
  });

  describe('PENDING_LIMIT_EXCEEDED_EXCEPTION', () => {
    it('should format message correctly for deposit pending limit', () => {
      const exception = new LimitExceededException(
        'deposit',
        2,
        2,
        'count',
        LimitExceededExceptionType.PENDING_LIMIT_EXCEEDED_EXCEPTION,
      );

      expect(exception.type).toBe(LimitExceededExceptionType.PENDING_LIMIT_EXCEEDED_EXCEPTION);
      expect(exception.message).toBe(
        "You've reached your pending deposit limit of 2. Please wait for your existing transactions to complete.",
      );
    });

    it('should format message correctly for withdrawal pending limit', () => {
      const exception = new LimitExceededException(
        'withdrawal',
        1,
        1,
        'count',
        LimitExceededExceptionType.PENDING_LIMIT_EXCEEDED_EXCEPTION,
      );

      expect(exception.type).toBe(LimitExceededExceptionType.PENDING_LIMIT_EXCEEDED_EXCEPTION);
      expect(exception.message).toBe(
        "You've reached your pending withdrawal limit of 1. Please wait for your existing transactions to complete.",
      );
    });
  });

  describe('Amount-based exceptions', () => {
    it('should format DAILY_LIMIT_EXCEEDED_EXCEPTION correctly', () => {
      const exception = new LimitExceededException(
        'deposit',
        200000,
        250000,
        'USD',
        LimitExceededExceptionType.DAILY_LIMIT_EXCEEDED_EXCEPTION,
      );

      expect(exception.type).toBe(LimitExceededExceptionType.DAILY_LIMIT_EXCEEDED_EXCEPTION);
      expect(exception.message).toContain('daily deposit limit');
      expect(exception.message).toContain('2,500.00');
    });

    it('should format WEEKLY_LIMIT_EXCEEDED_EXCEPTION correctly', () => {
      const exception = new LimitExceededException(
        'withdrawal',
        500000,
        750000,
        'USD',
        LimitExceededExceptionType.WEEKLY_LIMIT_EXCEEDED_EXCEPTION,
      );

      expect(exception.type).toBe(LimitExceededExceptionType.WEEKLY_LIMIT_EXCEEDED_EXCEPTION);
      expect(exception.message).toContain('weekly withdrawal limit');
      expect(exception.message).toContain('7,500.00');
    });

    it('should format MONTHLY_LIMIT_EXCEEDED_EXCEPTION correctly', () => {
      const exception = new LimitExceededException(
        'deposit',
        1800000,
        2000000,
        'USD',
        LimitExceededExceptionType.MONTHLY_LIMIT_EXCEEDED_EXCEPTION,
      );

      expect(exception.type).toBe(LimitExceededExceptionType.MONTHLY_LIMIT_EXCEEDED_EXCEPTION);
      expect(exception.message).toContain('monthly deposit limit');
      expect(exception.message).toContain('20,000.00');
    });

    it('should format TRANSACTION_LIMIT_EXCEEDED_EXCEPTION correctly for USD', () => {
      const exception = new LimitExceededException(
        'deposit transaction',
        300000,
        250000,
        'USD',
        LimitExceededExceptionType.TRANSACTION_LIMIT_EXCEEDED_EXCEPTION,
      );

      expect(exception.type).toBe(LimitExceededExceptionType.TRANSACTION_LIMIT_EXCEEDED_EXCEPTION);
      expect(exception.message).toBe(
        'The amount entered exceeds your transaction limit of $2,500.00. Please enter a lower amount or upgrade your account to continue.',
      );
    });

    it('should format TRANSACTION_LIMIT_EXCEEDED_EXCEPTION correctly for NGN', () => {
      const exception = new LimitExceededException(
        'transfer transaction',
        1500000,
        1000000,
        'NGN',
        LimitExceededExceptionType.TRANSACTION_LIMIT_EXCEEDED_EXCEPTION,
      );

      expect(exception.type).toBe(LimitExceededExceptionType.TRANSACTION_LIMIT_EXCEEDED_EXCEPTION);
      expect(exception.message).toBe(
        'The amount entered exceeds your transaction limit of ₦10,000.00. Please enter a lower amount or upgrade your account to continue.',
      );
    });

    it('should format default/unknown exception type correctly', () => {
      const exception = new LimitExceededException(
        'transfer',
        500000,
        250000,
        'USD',
        LimitExceededExceptionType.LIMIT_EXCEEDED_EXCEPTION,
      );

      expect(exception.type).toBe(LimitExceededExceptionType.LIMIT_EXCEEDED_EXCEPTION);
      expect(exception.message).toBe(
        'The amount entered exceeds your transfer limit of $2,500.00. Please enter a lower amount or upgrade your account to continue.',
      );
    });
  });

  it('should have BAD_REQUEST status code', () => {
    const exception = new LimitExceededException(
      'deposit',
      100,
      50,
      'USD',
      LimitExceededExceptionType.DAILY_LIMIT_EXCEEDED_EXCEPTION,
    );

    expect(exception.statusCode).toBe(400);
  });
});
