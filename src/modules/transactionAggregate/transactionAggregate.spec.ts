import { Test, TestingModule } from '@nestjs/testing';
import { TransactionAggregateModel } from '../../database/models/transactionAggregate/transactionAggregate.model';
import { LimitExceededExceptionType } from '../../exceptions/limit_exceeded_exception';
import { LockerService } from '../../services/locker/locker.service';
import { ProviderLimitService } from '../providerLimit/providerLimit.service';
import { TransactionAggregateRepository } from './transactionAggregate.repository';
import { TransactionAggregateService } from './transactionAggregate.service';

describe('TransactionAggregate Module', () => {
  describe('TransactionAggregateRepository', () => {
    let repository: TransactionAggregateRepository;

    beforeEach(() => {
      repository = new TransactionAggregateRepository();
    });

    it('should be defined', () => {
      expect(repository).toBeDefined();
    });

    describe('constructor', () => {
      it('should initialize with TransactionAggregateModel', () => {
        expect(repository.model).toBeDefined();
        expect(repository.model.tableName).toBe('api_service.transaction_aggregates');
      });
    });

    describe('custom methods', () => {
      it('should have findByDateAndProviderAndType method', () => {
        expect(repository.findByDateAndProviderAndType).toBeDefined();
        expect(typeof repository.findByDateAndProviderAndType).toBe('function');
      });
    });

    describe('inherited methods', () => {
      it('should have query method', () => {
        expect(typeof repository.query).toBe('function');
      });

      it('should have findAll method', () => {
        expect(typeof repository.findAll).toBe('function');
      });

      it('should have findOne method', () => {
        expect(typeof repository.findOne).toBe('function');
      });

      it('should have findById method', () => {
        expect(typeof repository.findById).toBe('function');
      });

      it('should have create method', () => {
        expect(typeof repository.create).toBe('function');
      });

      it('should have update method', () => {
        expect(typeof repository.update).toBe('function');
      });

      it('should have delete method', () => {
        expect(typeof repository.delete).toBe('function');
      });

      it('should have transaction method', () => {
        expect(typeof repository.transaction).toBe('function');
      });
    });
  });

  describe('TransactionAggregateService', () => {
    let service: TransactionAggregateService;
    let repository: jest.Mocked<TransactionAggregateRepository>;
    let lockerService: jest.Mocked<any>;
    let mockQueryBuilder: any;

    const mockProvider = 'zerohash';
    const mockTransactionType = 'deposit';
    const mockAmount = 1000.5;

    const mockExistingAggregate: Partial<TransactionAggregateModel> = {
      id: 'aggregate-123',
      date: new Date().toISOString().split('T')[0],
      provider: mockProvider,
      transaction_type: mockTransactionType,
      amount: 500.25,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const mockUpdatedAggregate: Partial<TransactionAggregateModel> = {
      ...mockExistingAggregate,
      amount: 1500.75,
      updated_at: new Date(),
    };

    const mockNewAggregate: Partial<TransactionAggregateModel> = {
      id: 'aggregate-456',
      date: new Date().toISOString().split('T')[0],
      provider: mockProvider,
      transaction_type: mockTransactionType,
      amount: mockAmount,
      created_at: new Date(),
      updated_at: new Date(),
    };

    beforeEach(async () => {
      // Create a chainable mock query builder that resolves to an array
      let resolveValue = [];
      mockQueryBuilder = {
        where: jest.fn().mockImplementation(() => mockQueryBuilder),
        then: jest.fn((resolve) => resolve(resolveValue)),
        catch: jest.fn(() => Promise.resolve(resolveValue)),
        __setResolveValue: (value: any) => {
          resolveValue = value;
        },
      };

      const mockRepository = {
        findByDateAndProviderAndType: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        query: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      const mockLockerService = {
        withLock: jest.fn((lockKey, callback) => callback()),
      };

      const mockProviderLimitService = {
        getProviderLimitValue: jest.fn().mockResolvedValue(10000000),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TransactionAggregateService,
          {
            provide: TransactionAggregateRepository,
            useValue: mockRepository,
          },
          {
            provide: LockerService,
            useValue: mockLockerService,
          },
          {
            provide: ProviderLimitService,
            useValue: mockProviderLimitService,
          },
        ],
      }).compile();

      service = module.get<TransactionAggregateService>(TransactionAggregateService);
      repository = module.get(TransactionAggregateRepository) as jest.Mocked<TransactionAggregateRepository>;
      lockerService = module.get(LockerService);

      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    describe('findAndUpdate', () => {
      it('should update existing aggregate when record exists for today', async () => {
        repository.findByDateAndProviderAndType.mockResolvedValue(mockExistingAggregate as TransactionAggregateModel);
        repository.update.mockResolvedValue(mockUpdatedAggregate as TransactionAggregateModel);

        const result = await service.findAndUpdate(mockProvider, mockTransactionType, mockAmount);

        const today = new Date().toISOString().split('T')[0];
        const lockKey = `transaction-aggregate:${today}:${mockProvider}:${mockTransactionType}`;

        expect(lockerService.withLock).toHaveBeenCalledWith(lockKey, expect.any(Function), {
          ttl: 30000,
          retryCount: 5,
          retryDelay: 500,
        });
        expect(repository.findByDateAndProviderAndType).toHaveBeenCalledWith(today, mockProvider, mockTransactionType);
        expect(repository.update).toHaveBeenCalledWith(mockExistingAggregate.id, {
          amount: 1500.75,
        });
        expect(repository.create).not.toHaveBeenCalled();
        expect(result).toEqual(mockUpdatedAggregate);
      });

      it('should create new aggregate when no record exists for today', async () => {
        repository.findByDateAndProviderAndType.mockResolvedValue(undefined);
        repository.create.mockResolvedValue(mockNewAggregate as TransactionAggregateModel);

        const result = await service.findAndUpdate(mockProvider, mockTransactionType, mockAmount);

        const today = new Date().toISOString().split('T')[0];
        const lockKey = `transaction-aggregate:${today}:${mockProvider}:${mockTransactionType}`;

        expect(lockerService.withLock).toHaveBeenCalledWith(lockKey, expect.any(Function), {
          ttl: 30000,
          retryCount: 5,
          retryDelay: 500,
        });
        expect(repository.findByDateAndProviderAndType).toHaveBeenCalledWith(today, mockProvider, mockTransactionType);
        expect(repository.create).toHaveBeenCalledWith({
          date: today,
          provider: mockProvider,
          transaction_type: mockTransactionType,
          amount: mockAmount,
        });
        expect(repository.update).not.toHaveBeenCalled();
        expect(result).toEqual(mockNewAggregate);
      });

      it('should correctly add amounts using mathjs', async () => {
        const existingAmount = 100.1;
        const newAmount = 200.2;

        const aggregate = {
          ...mockExistingAggregate,
          amount: existingAmount,
        };

        repository.findByDateAndProviderAndType.mockResolvedValue(aggregate as TransactionAggregateModel);
        repository.update.mockResolvedValue({
          ...aggregate,
          amount: 300.3,
        } as TransactionAggregateModel);

        await service.findAndUpdate(mockProvider, mockTransactionType, newAmount);

        const updateCall = repository.update.mock.calls[0];
        expect(updateCall[0]).toBe(aggregate.id);
        expect(updateCall[1].amount).toBeCloseTo(300.3, 1);
      });

      it('should handle different providers separately', async () => {
        const provider1 = 'zerohash';
        const provider2 = 'plaid';

        repository.findByDateAndProviderAndType.mockResolvedValueOnce(undefined);
        repository.findByDateAndProviderAndType.mockResolvedValueOnce(undefined);
        repository.create.mockResolvedValueOnce(mockNewAggregate as TransactionAggregateModel);
        repository.create.mockResolvedValueOnce({
          ...mockNewAggregate,
          id: 'aggregate-789',
          provider: provider2,
        } as TransactionAggregateModel);

        await service.findAndUpdate(provider1, mockTransactionType, mockAmount);
        await service.findAndUpdate(provider2, mockTransactionType, mockAmount);

        expect(repository.create).toHaveBeenCalledTimes(2);
        expect(repository.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ provider: provider1 }));
        expect(repository.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ provider: provider2 }));
      });

      it('should handle different transaction types separately', async () => {
        const type1 = 'deposit';
        const type2 = 'withdrawal';

        repository.findByDateAndProviderAndType.mockResolvedValueOnce(undefined);
        repository.findByDateAndProviderAndType.mockResolvedValueOnce(undefined);
        repository.create.mockResolvedValueOnce(mockNewAggregate as TransactionAggregateModel);
        repository.create.mockResolvedValueOnce({
          ...mockNewAggregate,
          id: 'aggregate-789',
          transaction_type: type2,
        } as TransactionAggregateModel);

        await service.findAndUpdate(mockProvider, type1, mockAmount);
        await service.findAndUpdate(mockProvider, type2, mockAmount);

        expect(repository.create).toHaveBeenCalledTimes(2);
        expect(repository.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ transaction_type: type1 }));
        expect(repository.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ transaction_type: type2 }));
      });

      it('should log when finding and updating aggregate', async () => {
        const logSpy = jest.spyOn(service['logger'], 'log');
        repository.findByDateAndProviderAndType.mockResolvedValue(undefined);
        repository.create.mockResolvedValue(mockNewAggregate as TransactionAggregateModel);

        await service.findAndUpdate(mockProvider, mockTransactionType, mockAmount);

        const today = new Date().toISOString().split('T')[0];
        expect(logSpy).toHaveBeenCalledWith(
          `Finding and updating aggregate for date: ${today}, provider: ${mockProvider}, type: ${mockTransactionType}, amount: ${mockAmount}`,
        );
      });

      it('should log when existing aggregate is found', async () => {
        const logSpy = jest.spyOn(service['logger'], 'log');
        repository.findByDateAndProviderAndType.mockResolvedValue(mockExistingAggregate as TransactionAggregateModel);
        repository.update.mockResolvedValue(mockUpdatedAggregate as TransactionAggregateModel);

        await service.findAndUpdate(mockProvider, mockTransactionType, mockAmount);

        expect(logSpy).toHaveBeenCalledWith(
          `Existing aggregate found with ID: ${mockExistingAggregate.id}, updating amount`,
        );
      });

      it('should log when no existing aggregate is found', async () => {
        const logSpy = jest.spyOn(service['logger'], 'log');
        repository.findByDateAndProviderAndType.mockResolvedValue(undefined);
        repository.create.mockResolvedValue(mockNewAggregate as TransactionAggregateModel);

        await service.findAndUpdate(mockProvider, mockTransactionType, mockAmount);

        expect(logSpy).toHaveBeenCalledWith(`No existing aggregate found for today, creating new record`);
      });

      it('should log when aggregate is updated', async () => {
        const logSpy = jest.spyOn(service['logger'], 'log');
        repository.findByDateAndProviderAndType.mockResolvedValue(mockExistingAggregate as TransactionAggregateModel);
        repository.update.mockResolvedValue(mockUpdatedAggregate as TransactionAggregateModel);

        await service.findAndUpdate(mockProvider, mockTransactionType, mockAmount);

        expect(logSpy).toHaveBeenCalledWith(`Aggregate updated with new amount: ${mockUpdatedAggregate.amount}`);
      });

      it('should log when new aggregate is created', async () => {
        const logSpy = jest.spyOn(service['logger'], 'log');
        repository.findByDateAndProviderAndType.mockResolvedValue(undefined);
        repository.create.mockResolvedValue(mockNewAggregate as TransactionAggregateModel);

        await service.findAndUpdate(mockProvider, mockTransactionType, mockAmount);

        expect(logSpy).toHaveBeenCalledWith(`New aggregate created with ID: ${mockNewAggregate.id}`);
      });

      it('should handle repository errors when finding aggregate', async () => {
        const error = new Error('Database error');
        repository.findByDateAndProviderAndType.mockRejectedValue(error);

        await expect(service.findAndUpdate(mockProvider, mockTransactionType, mockAmount)).rejects.toThrow(
          'Database error',
        );
        expect(repository.create).not.toHaveBeenCalled();
        expect(repository.update).not.toHaveBeenCalled();
      });

      it('should handle repository errors when updating aggregate', async () => {
        const error = new Error('Database error');
        repository.findByDateAndProviderAndType.mockResolvedValue(mockExistingAggregate as TransactionAggregateModel);
        repository.update.mockRejectedValue(error);

        await expect(service.findAndUpdate(mockProvider, mockTransactionType, mockAmount)).rejects.toThrow(
          'Database error',
        );
      });

      it('should handle repository errors when creating aggregate', async () => {
        const error = new Error('Database error');
        repository.findByDateAndProviderAndType.mockResolvedValue(undefined);
        repository.create.mockRejectedValue(error);

        await expect(service.findAndUpdate(mockProvider, mockTransactionType, mockAmount)).rejects.toThrow(
          'Database error',
        );
      });

      it('should handle decimal amounts correctly', async () => {
        const decimalAmount1 = 123.456789;
        const decimalAmount2 = 876.543211;

        const aggregate = {
          ...mockExistingAggregate,
          amount: decimalAmount1,
        };

        repository.findByDateAndProviderAndType.mockResolvedValue(aggregate as TransactionAggregateModel);
        repository.update.mockResolvedValue({
          ...aggregate,
          amount: 1000,
        } as TransactionAggregateModel);

        await service.findAndUpdate(mockProvider, mockTransactionType, decimalAmount2);

        const updateCall = repository.update.mock.calls[0];
        expect(updateCall[0]).toBe(aggregate.id);
        expect(updateCall[1].amount).toBeCloseTo(1000, 5);
      });

      it('should handle zero amounts', async () => {
        repository.findByDateAndProviderAndType.mockResolvedValue(undefined);
        repository.create.mockResolvedValue({
          ...mockNewAggregate,
          amount: 0,
        } as TransactionAggregateModel);

        await service.findAndUpdate(mockProvider, mockTransactionType, 0);

        expect(repository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 0,
          }),
        );
      });

      it('should handle large amounts', async () => {
        const largeAmount = 1000000000;
        repository.findByDateAndProviderAndType.mockResolvedValue(undefined);
        repository.create.mockResolvedValue({
          ...mockNewAggregate,
          amount: largeAmount,
        } as TransactionAggregateModel);

        await service.findAndUpdate(mockProvider, mockTransactionType, largeAmount);

        expect(repository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: largeAmount,
          }),
        );
      });

      it('should use correct lock key for different dates, providers, and types', async () => {
        const today = new Date().toISOString().split('T')[0];
        const expectedLockKey = `transaction-aggregate:${today}:${mockProvider}:${mockTransactionType}`;

        repository.findByDateAndProviderAndType.mockResolvedValue(undefined);
        repository.create.mockResolvedValue(mockNewAggregate as TransactionAggregateModel);

        await service.findAndUpdate(mockProvider, mockTransactionType, mockAmount);

        expect(lockerService.withLock).toHaveBeenCalledWith(
          expectedLockKey,
          expect.any(Function),
          expect.objectContaining({
            ttl: 30000,
            retryCount: 5,
            retryDelay: 500,
          }),
        );
      });

      it('should throw error if lock cannot be acquired', async () => {
        const lockError = new Error('Could not acquire lock');
        lockerService.withLock.mockRejectedValue(lockError);

        await expect(service.findAndUpdate(mockProvider, mockTransactionType, mockAmount)).rejects.toThrow(
          'Could not acquire lock',
        );
      });

      it('should ensure ACID principles by executing all operations within lock', async () => {
        const operationOrder: string[] = [];

        lockerService.withLock.mockImplementation(async (lockKey, callback) => {
          operationOrder.push('lock-acquired');
          const result = await callback();
          operationOrder.push('lock-released');
          return result;
        });

        repository.findByDateAndProviderAndType.mockImplementation(async () => {
          operationOrder.push('find-called');
          return undefined;
        });

        repository.create.mockImplementation(async () => {
          operationOrder.push('create-called');
          return mockNewAggregate as TransactionAggregateModel;
        });

        await service.findAndUpdate(mockProvider, mockTransactionType, mockAmount);

        expect(operationOrder).toEqual(['lock-acquired', 'find-called', 'create-called', 'lock-released']);
      });
    });

    describe('validateProviderPlatformWeeklyLimit', () => {
      const mockUserId = 'user-123';
      const mockProvider = 'zerohash';
      const mockCurrency = 'USD';
      const mockTransactionType = 'deposit';
      const mockAmount = 1000000; // $10k in cents

      beforeEach(() => {
        // Mock is already set up in the main beforeEach
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it('should pass validation when within limit', async () => {
        const mockAggregates = [
          { amount: 5000000 }, // $50k existing
        ];

        mockQueryBuilder.__setResolveValue(mockAggregates);

        await expect(
          service.validateProviderPlatformWeeklyLimit(
            mockProvider,
            mockUserId,
            mockTransactionType,
            mockAmount, // Adding $10k to $50k = $60k total
            mockCurrency,
          ),
        ).resolves.not.toThrow();
      });

      it('should throw LimitExceededException when exceeding limit', async () => {
        const mockAggregates = [
          { amount: 9500000 }, // $95k existing
        ];

        mockQueryBuilder.__setResolveValue(mockAggregates);

        await expect(
          service.validateProviderPlatformWeeklyLimit(
            mockProvider,
            mockUserId,
            mockTransactionType,
            mockAmount, // Adding $10k to $95k = $105k total (exceeds $100k limit)
            mockCurrency,
          ),
        ).rejects.toMatchObject({
          type: LimitExceededExceptionType.PLATFORM_WEEKLY_LIMIT_EXCEEDED_EXCEPTION,
          statusCode: 400,
        });
      });

      it('should skip validation if limit not configured', async () => {
        const providerLimitService = (service as any).providerLimitService;
        providerLimitService.getProviderLimitValue.mockRejectedValue(new Error('Not found'));
        const warnSpy = jest.spyOn(service['logger'], 'warn');

        await service.validateProviderPlatformWeeklyLimit(
          mockProvider,
          mockUserId,
          mockTransactionType,
          mockAmount,
          mockCurrency,
        );

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Platform weekly limit not configured'),
          'Not found',
        );
      });

      it('should handle withdrawals with absolute values', async () => {
        const mockAggregates = [
          { amount: -5000000 }, // $50k withdrawn (stored as negative)
        ];

        mockQueryBuilder.__setResolveValue(mockAggregates);

        await expect(
          service.validateProviderPlatformWeeklyLimit(
            mockProvider,
            mockUserId,
            'withdrawal',
            1000000, // Adding $10k withdrawal
            mockCurrency,
          ),
        ).resolves.not.toThrow();
      });

      it('should query correct date range for rolling 7-day window', async () => {
        mockQueryBuilder.__setResolveValue([]);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const expectedDateString = sevenDaysAgo.toISOString().split('T')[0];

        await service.validateProviderPlatformWeeklyLimit(
          mockProvider,
          mockUserId,
          mockTransactionType,
          mockAmount,
          mockCurrency,
        );

        expect(mockQueryBuilder.where).toHaveBeenCalledWith('provider', mockProvider);
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('transaction_type', mockTransactionType);
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('date', '>=', expectedDateString);
      });

      it('should sum multiple aggregate records correctly', async () => {
        const mockAggregates = [
          { amount: 2000000 }, // $20k
          { amount: 3000000 }, // $30k
          { amount: 1000000 }, // $10k
        ]; // Total: $60k

        mockQueryBuilder.__setResolveValue(mockAggregates);

        await expect(
          service.validateProviderPlatformWeeklyLimit(
            mockProvider,
            mockUserId,
            mockTransactionType,
            mockAmount, // Adding $10k to $60k = $70k total
            mockCurrency,
          ),
        ).resolves.not.toThrow();
      });

      it('should handle empty aggregates (first transaction)', async () => {
        mockQueryBuilder.__setResolveValue([]);

        await expect(
          service.validateProviderPlatformWeeklyLimit(
            mockProvider,
            mockUserId,
            mockTransactionType,
            mockAmount, // First $10k transaction
            mockCurrency,
          ),
        ).resolves.not.toThrow();
      });

      it('should log debug message when check passes', async () => {
        const debugSpy = jest.spyOn(service['logger'], 'debug');

        mockQueryBuilder.__setResolveValue([]);

        await service.validateProviderPlatformWeeklyLimit(
          mockProvider,
          mockUserId,
          mockTransactionType,
          mockAmount,
          mockCurrency,
        );

        expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('check passed'));
      });

      it('should log warn message when limit exceeded', async () => {
        const mockAggregates = [{ amount: 9500000 }];
        mockQueryBuilder.__setResolveValue(mockAggregates);

        const warnSpy = jest.spyOn(service['logger'], 'warn');

        try {
          await service.validateProviderPlatformWeeklyLimit(
            mockProvider,
            mockUserId,
            mockTransactionType,
            mockAmount,
            mockCurrency,
          );
          fail('Should have thrown LimitExceededException');
        } catch (error) {
          expect(error).toBeDefined();
          expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('exceeds'));
        }
      });

      it('should use correct limit type for deposit', async () => {
        const providerLimitService = (service as any).providerLimitService;
        mockQueryBuilder.__setResolveValue([]);

        await service.validateProviderPlatformWeeklyLimit(
          mockProvider,
          mockUserId,
          'deposit',
          mockAmount,
          mockCurrency,
        );

        expect(providerLimitService.getProviderLimitValue).toHaveBeenCalledWith(
          mockProvider,
          'weekly_deposit',
          mockCurrency,
        );
      });

      it('should use correct limit type for withdrawal', async () => {
        const providerLimitService = (service as any).providerLimitService;
        mockQueryBuilder.__setResolveValue([]);

        await service.validateProviderPlatformWeeklyLimit(
          mockProvider,
          mockUserId,
          'withdrawal',
          mockAmount,
          mockCurrency,
        );

        expect(providerLimitService.getProviderLimitValue).toHaveBeenCalledWith(
          mockProvider,
          'weekly_withdrawal',
          mockCurrency,
        );
      });
    });
  });
});
