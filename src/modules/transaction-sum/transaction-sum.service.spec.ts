import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { TransactionStatus } from '../../database/models/transaction/transaction.interface';
import { TransactionSumRepository } from './transaction-sum.repository';
import { TransactionSumService } from './transaction-sum.service';

describe('TransactionSumService', () => {
  let service: TransactionSumService;
  let repository: jest.Mocked<TransactionSumRepository>;

  const mockTransactionSumData = {
    deposit: { totalSum: 500000, totalCount: 2 },
    withdrawal: { totalSum: -250000, totalCount: 1 },
    transfer_in: { totalSum: 100000, totalCount: 1 },
    transfer_out: { totalSum: -150000, totalCount: 1 },
  };

  beforeEach(async () => {
    const mockRepository = {
      getFiatWalletTransactionSum: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionSumService,
        {
          provide: TransactionSumRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TransactionSumService>(TransactionSumService);
    repository = module.get(TransactionSumRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPastOneDayTransactionSum', () => {
    it('should return transaction sum for past one day for USD asset', async () => {
      repository.getFiatWalletTransactionSum.mockResolvedValue(mockTransactionSumData);

      const result = await service.getPastOneDayTransactionSum('USD', TransactionStatus.COMPLETED, 'user123');

      expect(repository.getFiatWalletTransactionSum).toHaveBeenCalledWith(
        'USD',
        expect.any(Date),
        expect.any(Date),
        TransactionStatus.COMPLETED,
        'user123',
      );
      expect(result.transactionTypeTotals).toEqual(mockTransactionSumData);
      expect(result.asset).toBe('USD');
      expect(result.status).toBe(TransactionStatus.COMPLETED);
      expect(result.userId).toBe('user123');
    });

    it('should handle empty transaction data', async () => {
      repository.getFiatWalletTransactionSum.mockResolvedValue({});

      const result = await service.getPastOneDayTransactionSum('USD', TransactionStatus.COMPLETED, 'user123');

      expect(result.transactionTypeTotals).toEqual({});
      expect(result.asset).toBe('USD');
    });

    it('should throw error when repository fails', async () => {
      const error = new Error('Database error');
      repository.getFiatWalletTransactionSum.mockRejectedValue(error);

      await expect(service.getPastOneDayTransactionSum('USD', TransactionStatus.COMPLETED, 'user123')).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('getPastOneWeekTransactionSum', () => {
    it('should return transaction sum for past one week', async () => {
      repository.getFiatWalletTransactionSum.mockResolvedValue(mockTransactionSumData);

      const result = await service.getPastOneWeekTransactionSum('NGN', TransactionStatus.PENDING, 'user456');

      expect(repository.getFiatWalletTransactionSum).toHaveBeenCalledWith(
        'NGN',
        expect.any(Date),
        expect.any(Date),
        TransactionStatus.PENDING,
        'user456',
      );
      expect(result.asset).toBe('NGN');
      expect(result.status).toBe(TransactionStatus.PENDING);
    });
  });

  describe('getPastOneMonthTransactionSum', () => {
    it('should return transaction sum for past one month', async () => {
      repository.getFiatWalletTransactionSum.mockResolvedValue(mockTransactionSumData);

      const result = await service.getPastOneMonthTransactionSum('EUR', TransactionStatus.COMPLETED, 'user789');

      expect(repository.getFiatWalletTransactionSum).toHaveBeenCalledWith(
        'EUR',
        expect.any(Date),
        expect.any(Date),
        TransactionStatus.COMPLETED,
        'user789',
      );
      expect(result.asset).toBe('EUR');
    });
  });

  describe('getPastTransactionSum', () => {
    it('should return transaction sum for custom date range', async () => {
      repository.getFiatWalletTransactionSum.mockResolvedValue(mockTransactionSumData);

      const startDate = DateTime.now().minus({ days: 5 }).toJSDate();
      const endDate = DateTime.now().toJSDate();

      const result = await service.getPastTransactionSum(
        'USD',
        { startDate, endDate },
        TransactionStatus.COMPLETED,
        'user123',
      );

      expect(repository.getFiatWalletTransactionSum).toHaveBeenCalledWith(
        'USD',
        startDate,
        endDate,
        TransactionStatus.COMPLETED,
        'user123',
      );
      expect(result.startDate).toEqual(startDate);
      expect(result.endDate).toEqual(endDate);
      expect(result.asset).toBe('USD');
    });
  });

  describe('date range calculations', () => {
    beforeEach(() => {
      repository.getFiatWalletTransactionSum.mockResolvedValue(mockTransactionSumData);
    });

    it('should calculate correct date ranges for different periods', async () => {
      // Test daily range - should start from beginning of current day
      await service.getPastOneDayTransactionSum('USD', TransactionStatus.COMPLETED, 'user123');
      const dailyCall = repository.getFiatWalletTransactionSum.mock.calls[0];
      const dailyStart = new Date(dailyCall[1]);

      // Daily start should be at midnight (00:00:00)
      expect(dailyStart.getHours()).toBe(0);
      expect(dailyStart.getMinutes()).toBe(0);
      expect(dailyStart.getSeconds()).toBe(0);
      expect(dailyStart.getMilliseconds()).toBe(0);

      // Test weekly range - should start from beginning of current week
      await service.getPastOneWeekTransactionSum('USD', TransactionStatus.COMPLETED, 'user123');
      const weeklyCall = repository.getFiatWalletTransactionSum.mock.calls[1];
      const weeklyStart = new Date(weeklyCall[1]);

      // Weekly start should be at the beginning of the week
      expect(weeklyStart.getDay()).toBe(1); // Monday (Luxon default)
      expect(weeklyStart.getHours()).toBe(0);
      expect(weeklyStart.getMinutes()).toBe(0);

      // Test monthly range - should start from beginning of current month
      await service.getPastOneMonthTransactionSum('USD', TransactionStatus.COMPLETED, 'user123');
      const monthlyCall = repository.getFiatWalletTransactionSum.mock.calls[2];
      const monthlyStart = new Date(monthlyCall[1]);

      // Monthly start should be the 1st day of the month
      expect(monthlyStart.getDate()).toBe(1);
      expect(monthlyStart.getHours()).toBe(0);
      expect(monthlyStart.getMinutes()).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should log and re-throw repository errors with asset context', async () => {
      const error = new Error('Database connection failed');
      repository.getFiatWalletTransactionSum.mockRejectedValue(error);

      const loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

      await expect(service.getPastOneDayTransactionSum('USD', TransactionStatus.COMPLETED, 'user123')).rejects.toThrow(
        'Database connection failed',
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get USD fiat wallet transaction sum'),
        expect.any(String),
      );
    });
  });

  describe('asset-based functionality', () => {
    it('should work with different asset types', async () => {
      repository.getFiatWalletTransactionSum.mockResolvedValue(mockTransactionSumData);

      const assets = ['USD', 'NGN', 'EUR', 'GBP'];

      for (const asset of assets) {
        const result = await service.getPastOneDayTransactionSum(asset, TransactionStatus.COMPLETED, 'user123');
        expect(result.asset).toBe(asset);
        expect(repository.getFiatWalletTransactionSum).toHaveBeenCalledWith(
          asset,
          expect.any(Date),
          expect.any(Date),
          TransactionStatus.COMPLETED,
          'user123',
        );
      }
    });
  });
});
