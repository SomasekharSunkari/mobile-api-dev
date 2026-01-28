import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { ExchangeAdapter } from '../../adapters/exchange/exchange.adapter';
import { RateTransactionStatus, RateTransactionType } from '../../database/models/rateTransaction';
import { LockerService } from '../../services/locker';
import { RateTransactionRepository } from './rateTransaction.repository';
import { RateTransactionService } from './rateTransaction.service';

describe('RateTransactionService', () => {
  let service: RateTransactionService;

  const mockRateTransactionRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
  };

  const mockLockerService = {
    withLock: jest.fn((key, callback) => callback()),
  };

  const mockExchangeAdapter = {
    getExchangeRates: jest.fn(),
    getProviderName: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateTransactionService,
        {
          provide: RateTransactionRepository,
          useValue: mockRateTransactionRepository,
        },
        {
          provide: LockerService,
          useValue: mockLockerService,
        },
        {
          provide: ExchangeAdapter,
          useValue: mockExchangeAdapter,
        },
      ],
    }).compile();

    service = module.get<RateTransactionService>(RateTransactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a rate transaction successfully', async () => {
      const expectedRateTransaction = { id: 'rt-1' };
      mockRateTransactionRepository.create.mockResolvedValue(expectedRateTransaction);

      // Mock the exchange rates response
      mockExchangeAdapter.getExchangeRates.mockResolvedValue([
        {
          code: 'NGN',
          buy: 800,
          sell: 750,
        },
      ]);

      mockExchangeAdapter.getProviderName.mockReturnValue('test-provider');

      const result = await service.create('user123', {
        amount: 100000,
        currency: 'NGN',
        type: RateTransactionType.BUY,
        transaction_id: 'tx123',
      });

      expect(mockExchangeAdapter.getExchangeRates).toHaveBeenCalledWith({ currencyCode: 'NGN' });
      expect(mockRateTransactionRepository.create).toHaveBeenCalledWith(
        {
          converted_amount: 12500, // 125 * 100 (kobo for NGN)
          amount: 10000000, // 100000 * 100 (kobo for NGN)
          type: RateTransactionType.BUY,
          status: RateTransactionStatus.PENDING,
          provider: 'test-provider',
          base_currency: 'USD',
          converted_currency: 'NGN',
          user_id: 'user123',
          transaction_id: 'tx123',
          rate: 800,
        },
        undefined, // trx parameter
      );
      expect(result).toEqual(expectedRateTransaction);
    });
  });

  describe('findOne', () => {
    it('should return a rate transaction when found', async () => {
      const expectedRateTransaction = {
        id: 'rt-1',
        user_id: 'user123',
        transaction_id: 'tx123',
        rate: 1.25,
        type: RateTransactionType.BUY,
        status: RateTransactionStatus.PENDING,
      };

      mockRateTransactionRepository.findOne.mockResolvedValue(expectedRateTransaction);

      const result = await service.findOne({ user_id: 'user123' });

      expect(mockRateTransactionRepository.findOne).toHaveBeenCalledWith({ user_id: 'user123' });
      expect(result).toEqual(expectedRateTransaction);
    });

    it('should return null when rate transaction is not found', async () => {
      mockRateTransactionRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne({ user_id: 'nonexistent' });

      expect(mockRateTransactionRepository.findOne).toHaveBeenCalledWith({ user_id: 'nonexistent' });
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return paginated rate transactions with no filters', async () => {
      const expectedResponse = {
        data: [
          {
            id: 'rt-1',
            user_id: 'user123',
            transaction_id: 'tx123',
            rate: 1.25,
            type: RateTransactionType.BUY,
            status: RateTransactionStatus.PENDING,
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
        },
      };

      mockRateTransactionRepository.findAll.mockResolvedValue(expectedResponse);

      const result = await service.findAll();

      expect(mockRateTransactionRepository.findAll).toHaveBeenCalledWith({}, { page: 1, limit: 10 });
      expect(result).toEqual(expectedResponse);
    });

    it('should apply filters when provided', async () => {
      const filters = {
        user_id: 'user123',
        status: RateTransactionStatus.COMPLETED,
        type: RateTransactionType.BUY,
        base_currency: 'NGN',
        converted_currency: 'USD',
      };

      const expectedResponse = {
        data: [
          {
            id: 'rt-1',
            user_id: 'user123',
            transaction_id: 'tx123',
            rate: 1.25,
            type: RateTransactionType.BUY,
            status: RateTransactionStatus.COMPLETED,
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
        },
      };

      mockRateTransactionRepository.findAll.mockResolvedValue(expectedResponse);

      const result = await service.findAll(1, 10, filters);

      expect(mockRateTransactionRepository.findAll).toHaveBeenCalledWith(filters, { page: 1, limit: 10 });
      expect(result).toEqual(expectedResponse);
    });

    it('should handle partial filters', async () => {
      const filters = {
        user_id: 'user123',
        type: RateTransactionType.SELL,
      };

      const expectedResponse = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
        },
      };

      mockRateTransactionRepository.findAll.mockResolvedValue(expectedResponse);

      const result = await service.findAll(1, 10, filters);

      expect(mockRateTransactionRepository.findAll).toHaveBeenCalledWith(filters, { page: 1, limit: 10 });
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('findById', () => {
    it('should return a rate transaction when found', async () => {
      const expectedRateTransaction = {
        id: 'rt-1',
        user_id: 'user123',
        transaction_id: 'tx123',
        rate: 1.25,
        type: RateTransactionType.BUY,
        status: RateTransactionStatus.PENDING,
      };

      mockRateTransactionRepository.findById.mockResolvedValue(expectedRateTransaction);

      const result = await service.findById('rt-1');

      expect(mockRateTransactionRepository.findById).toHaveBeenCalledWith('rt-1');
      expect(result).toEqual(expectedRateTransaction);
    });

    it('should throw NotFoundException when rate transaction is not found', async () => {
      mockRateTransactionRepository.findById.mockResolvedValue(null);

      await expect(service.findById('rt-1')).rejects.toThrow(NotFoundException);
      await expect(service.findById('rt-1')).rejects.toThrow('Rate transaction with ID rt-1 not found');
    });
  });

  describe('update', () => {
    it('should update a rate transaction successfully', async () => {
      const updateData = {
        rate: 1.25,
        amount: 100000,
        converted_amount: 800,
        expires_at: '2024-01-01T00:00:00Z',
      };

      const expectedRateTransaction = {
        id: 'rt-1',
        user_id: 'user123',
        transaction_id: 'tx123',
        type: RateTransactionType.BUY,
        ...updateData,
        status: RateTransactionStatus.COMPLETED,
        completed_at: '2024-01-01T00:00:00Z',
      };

      mockRateTransactionRepository.update.mockResolvedValue(expectedRateTransaction);

      const result = await service.update('rt-1', updateData);

      expect(mockRateTransactionRepository.update).toHaveBeenCalledWith('rt-1', updateData);
      expect(result).toEqual(expectedRateTransaction);
    });
  });

  describe('updateStatus', () => {
    const mockRateTransaction = {
      id: 'rt-1',
      user_id: 'user123',
      transaction_id: 'tx123',
      rate: 1.25,
      type: RateTransactionType.BUY,
      status: RateTransactionStatus.PENDING,
    };

    beforeEach(() => {
      mockRateTransactionRepository.findById.mockResolvedValue(mockRateTransaction);
    });

    it('should update status to PROCESSING and set processed_at', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const expectedUpdate = {
        status: RateTransactionStatus.PROCESSING,
        processed_at: now,
      };

      mockRateTransactionRepository.update.mockResolvedValue({ ...mockRateTransaction, ...expectedUpdate });

      const result = await service.updateStatus('rt-1', RateTransactionStatus.PROCESSING);

      expect(mockLockerService.withLock).toHaveBeenCalledWith(
        'rate-transaction:rt-1:update-status',
        expect.any(Function),
      );
      expect(mockRateTransactionRepository.update).toHaveBeenCalledWith('rt-1', expectedUpdate);
      expect(result).toEqual({ ...mockRateTransaction, ...expectedUpdate });
    });

    it('should update status to COMPLETED and set completed_at', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const expectedUpdate = {
        status: RateTransactionStatus.COMPLETED,
        completed_at: now,
      };

      mockRateTransactionRepository.update.mockResolvedValue({ ...mockRateTransaction, ...expectedUpdate });

      const result = await service.updateStatus('rt-1', RateTransactionStatus.COMPLETED);

      expect(mockRateTransactionRepository.update).toHaveBeenCalledWith('rt-1', expectedUpdate);
      expect(result).toEqual({ ...mockRateTransaction, ...expectedUpdate });
    });

    it('should update status to FAILED and set failed_at with failure reason', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const metadata = {
        failure_reason: 'Exchange rate expired',
      };

      const expectedUpdate = {
        status: RateTransactionStatus.FAILED,
        failed_at: now,
        failure_reason: metadata.failure_reason,
      };

      mockRateTransactionRepository.update.mockResolvedValue({ ...mockRateTransaction, ...expectedUpdate });

      const result = await service.updateStatus('rt-1', RateTransactionStatus.FAILED, metadata);

      expect(mockRateTransactionRepository.update).toHaveBeenCalledWith('rt-1', expectedUpdate);
      expect(result).toEqual({ ...mockRateTransaction, ...expectedUpdate });
    });

    it('should update status to INITIATED without setting timestamp', async () => {
      const expectedUpdate = {
        status: RateTransactionStatus.INITIATED,
      };

      mockRateTransactionRepository.update.mockResolvedValue({ ...mockRateTransaction, ...expectedUpdate });

      const result = await service.updateStatus('rt-1', RateTransactionStatus.INITIATED);

      expect(mockRateTransactionRepository.update).toHaveBeenCalledWith('rt-1', expectedUpdate);
      expect(result).toEqual({ ...mockRateTransaction, ...expectedUpdate });
    });

    it('should update status to CANCELLED without setting timestamp', async () => {
      const expectedUpdate = {
        status: RateTransactionStatus.CANCELLED,
      };

      mockRateTransactionRepository.update.mockResolvedValue({ ...mockRateTransaction, ...expectedUpdate });

      const result = await service.updateStatus('rt-1', RateTransactionStatus.CANCELLED);

      expect(mockRateTransactionRepository.update).toHaveBeenCalledWith('rt-1', expectedUpdate);
      expect(result).toEqual({ ...mockRateTransaction, ...expectedUpdate });
    });
  });
});
