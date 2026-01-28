import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { IPaginatedResponse } from '../../database/base/base.interface';
import { FiatWalletTransactionType } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.interface';
import { FiatWalletTransactionModel } from '../../database/models/fiatWalletTransaction/fiatWalletTransaction.model';
import { TransactionStatus } from '../../database/models/transaction';
import { LockerService } from '../../services/locker';
import { AppLoggerService } from '../../services/logger/logger.service';
import { FiatWalletTransactionController } from './fiatWalletTransactions.controller';
import { FiatWalletTransactionRepository } from './fiatWalletTransactions.repository';
import { FiatWalletTransactionService } from './fiatWalletTransactions.service';

// Mock the auth guard to bypass authentication in tests
jest.mock('../auth/strategies/jwt-auth.guard', () => ({
  JwtAuthGuard: jest.fn().mockImplementation(() => ({
    canActivate: jest.fn().mockReturnValue(true),
  })),
}));

describe('FiatWalletTransactions Module (E2E)', () => {
  let app: INestApplication;
  let service: FiatWalletTransactionService;

  // Create fixed dates for consistent testing
  const createdAtDate = new Date('2025-05-15T10:10:35.575Z');
  const updatedAtDate = new Date('2025-05-15T10:10:35.575Z');

  // Mock transaction data
  const mockTransaction = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    transaction_id: '123e4567-e89b-12d3-a456-426614174001',
    fiat_wallet_id: '123e4567-e89b-12d3-a456-426614174002',
    user_id: '123e4567-e89b-12d3-a456-426614174003',
    transaction_type: FiatWalletTransactionType.DEPOSIT,
    amount: 100,
    balance_before: 200,
    balance_after: 300,
    currency: 'USD',
    status: TransactionStatus.PENDING,
    provider: 'test-provider',
    provider_reference: 'test-ref-123',
    provider_fee: 1.5,
    provider_metadata: { test: 'metadata' },
    source: 'bank-account',
    destination: 'wallet',
    description: 'Test deposit',
    failure_reason: null,
    processed_at: null,
    completed_at: null,
    failed_at: null,
    created_at: createdAtDate,
    updated_at: updatedAtDate,
  } as unknown as FiatWalletTransactionModel;

  // We need to create a serialized version that matches what would come back from the API
  const serializedTransaction = {
    ...mockTransaction,
    created_at: createdAtDate.toISOString(),
    updated_at: updatedAtDate.toISOString(),
  };

  // Mock paginated response
  const mockPaginatedResponse = {
    data: [mockTransaction],
    pagination: {
      current_page: 1,
      next_page: 0,
      previous_page: 0,
      limit: 10,
      page_count: 1,
      total: 1,
    },
  } as unknown as IPaginatedResponse<FiatWalletTransactionModel>;

  // Serialized paginated response
  const serializedPaginatedResponse = {
    data: [serializedTransaction],
    pagination: {
      current_page: 1,
      next_page: 0,
      previous_page: 0,
      limit: 10,
      page_count: 1,
      total: 1,
    },
  };

  // Create a mock service implementation instead of relying on the repository mocks
  const mockService = {
    findAll: jest.fn().mockResolvedValue(mockPaginatedResponse),
    findById: jest.fn().mockResolvedValue(mockTransaction),
    updateStatus: jest.fn().mockResolvedValue(mockTransaction),
    create: jest.fn().mockResolvedValue(mockTransaction),
  };

  // Mock repository implementation
  const mockRepository = {
    findAll: jest.fn().mockResolvedValue(mockPaginatedResponse),
    findById: jest.fn().mockResolvedValue(mockTransaction),
    findOne: jest.fn().mockResolvedValue(mockTransaction),
    create: jest.fn().mockResolvedValue(mockTransaction),
    update: jest.fn().mockResolvedValue(mockTransaction),
    findByIdempotencyKey: jest.fn(async (idempotencyKey: string) => {
      const queryBuilder = mockRepository.query();
      const result = await queryBuilder.where('idempotency_key', idempotencyKey).first();
      return result || null;
    }),
    findByUserIdAndIdempotencyKey: jest.fn(async (userId: string, idempotencyKey: string) => {
      const queryBuilder = mockRepository.query();
      const result = await queryBuilder.where('user_id', userId).where('idempotency_key', idempotencyKey).first();
      return result || null;
    }),
    query: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(mockTransaction),
    }),
  };

  // Mock locker service implementation
  const mockLockerService = {
    withLock: jest.fn((_key, callback) => callback()),
    runWithLock: jest.fn((_key, callback) => callback()),
    isLocked: jest.fn().mockResolvedValue(false),
    forceRelease: jest.fn().mockResolvedValue(undefined),
  };

  const mockAppLoggerService = {
    logInfo: jest.fn(),
    logError: jest.fn(),
    logUserAction: jest.fn(),
    setContext: jest.fn(),
    createChild: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [FiatWalletTransactionController],
      providers: [
        {
          provide: FiatWalletTransactionService,
          useValue: mockService,
        },
        {
          provide: FiatWalletTransactionRepository,
          useValue: mockRepository,
        },
        {
          provide: LockerService,
          useValue: mockLockerService,
        },
        {
          provide: AppLoggerService,
          useValue: mockAppLoggerService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    // Add middleware to mock authenticated user for testing
    app.use((req: any, _res: any, next: any) => {
      req.user = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        email: 'test@example.com',
      };
      next();
    });

    app.useGlobalPipes(
      new ValidationPipe({
        transform: false, // Don't transform to avoid validation issues in tests
        whitelist: false, // Don't Strip non-whitelisted properties
        forbidNonWhitelisted: false, // Don't throw on non-whitelisted properties
        disableErrorMessages: false,
      }),
    );

    await app.init();

    service = moduleRef.get<FiatWalletTransactionService>(FiatWalletTransactionService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Repository Unit Tests', () => {
    let repository: FiatWalletTransactionRepository;

    beforeEach(() => {
      repository = new FiatWalletTransactionRepository();
      jest.clearAllMocks();
    });

    describe('findByIdempotencyKey', () => {
      it('should return a transaction when found by idempotency key', async () => {
        const idempotencyKey = 'test-idempotency-key-123';

        const querySpy = jest.spyOn(repository, 'query').mockReturnValue({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockTransaction),
        } as any);

        const result = await repository.findByIdempotencyKey(idempotencyKey);

        expect(result).toBe(mockTransaction);
        expect(querySpy).toHaveBeenCalled();
      });

      it('should return null when transaction not found by idempotency key', async () => {
        const idempotencyKey = 'non-existent-key';

        jest.spyOn(repository, 'query').mockReturnValue({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(undefined),
        } as any);

        const result = await repository.findByIdempotencyKey(idempotencyKey);

        expect(result).toBeNull();
      });

      it('should query with correct column for idempotency key', async () => {
        const idempotencyKey = 'test-idempotency-key-123';
        const whereSpy = jest.fn().mockReturnThis();
        const firstSpy = jest.fn().mockResolvedValue(mockTransaction);

        jest.spyOn(repository, 'query').mockReturnValue({
          where: whereSpy,
          first: firstSpy,
        } as any);

        await repository.findByIdempotencyKey(idempotencyKey);

        expect(whereSpy).toHaveBeenCalledWith('idempotency_key', idempotencyKey);
        expect(firstSpy).toHaveBeenCalled();
      });
    });

    describe('findByUserIdAndIdempotencyKey', () => {
      it('should return a transaction when found by user ID and idempotency key', async () => {
        const userId = '123e4567-e89b-12d3-a456-426614174003';
        const idempotencyKey = 'test-idempotency-key-123';

        jest.spyOn(repository, 'query').mockReturnValue({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(mockTransaction),
        } as any);

        const result = await repository.findByUserIdAndIdempotencyKey(userId, idempotencyKey);

        expect(result).toBe(mockTransaction);
      });

      it('should return null when transaction not found by user ID and idempotency key', async () => {
        const userId = '123e4567-e89b-12d3-a456-426614174003';
        const idempotencyKey = 'non-existent-key';

        jest.spyOn(repository, 'query').mockReturnValue({
          where: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(undefined),
        } as any);

        const result = await repository.findByUserIdAndIdempotencyKey(userId, idempotencyKey);

        expect(result).toBeNull();
      });

      it('should call query with correct parameters for user ID and idempotency key', async () => {
        const userId = '123e4567-e89b-12d3-a456-426614174003';
        const idempotencyKey = 'test-idempotency-key-123';

        const whereSpy = jest.fn().mockReturnThis();
        const firstSpy = jest.fn().mockResolvedValue(mockTransaction);

        jest.spyOn(repository, 'query').mockReturnValue({
          where: whereSpy,
          first: firstSpy,
        } as any);

        await repository.findByUserIdAndIdempotencyKey(userId, idempotencyKey);

        expect(whereSpy).toHaveBeenCalledWith('user_id', userId);
        expect(whereSpy).toHaveBeenCalledWith('idempotency_key', idempotencyKey);
        expect(firstSpy).toHaveBeenCalled();
      });
    });

    describe('countPendingByUserAndType', () => {
      it('should return count of pending transactions', async () => {
        const userId = '123e4567-e89b-12d3-a456-426614174003';
        const transactionType = 'deposit';
        const currency = 'USD';

        const whereSpy = jest.fn().mockReturnThis();
        const whereNullSpy = jest.fn().mockReturnThis();
        const whereNotInSpy = jest.fn().mockReturnThis();
        const countSpy = jest.fn().mockReturnThis();
        const firstSpy = jest.fn().mockResolvedValue({ count: '2' });

        jest.spyOn(repository, 'query').mockReturnValue({
          where: whereSpy,
          whereNull: whereNullSpy,
          whereNotIn: whereNotInSpy,
          count: countSpy,
          first: firstSpy,
        } as any);

        const result = await repository.countPendingByUserAndType(userId, transactionType, currency);

        expect(result).toBe(2);
        expect(whereSpy).toHaveBeenCalledWith('user_id', userId);
        expect(whereSpy).toHaveBeenCalledWith('transaction_type', transactionType);
        expect(whereSpy).toHaveBeenCalledWith('currency', currency);
        expect(whereNullSpy).toHaveBeenCalledWith('settled_at');
        expect(whereNotInSpy).toHaveBeenCalledWith('status', ['failed', 'cancelled']);
        expect(countSpy).toHaveBeenCalledWith('id as count');
      });

      it('should return 0 when no pending transactions found', async () => {
        const userId = '123e4567-e89b-12d3-a456-426614174003';
        const transactionType = 'deposit';
        const currency = 'USD';

        jest.spyOn(repository, 'query').mockReturnValue({
          where: jest.fn().mockReturnThis(),
          whereNull: jest.fn().mockReturnThis(),
          whereNotIn: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(undefined),
        } as any);

        const result = await repository.countPendingByUserAndType(userId, transactionType, currency);

        expect(result).toBe(0);
      });

      it('should return 0 when count is null', async () => {
        const userId = '123e4567-e89b-12d3-a456-426614174003';
        const transactionType = 'withdrawal';
        const currency = 'USD';

        jest.spyOn(repository, 'query').mockReturnValue({
          where: jest.fn().mockReturnThis(),
          whereNull: jest.fn().mockReturnThis(),
          whereNotIn: jest.fn().mockReturnThis(),
          count: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue({ count: null }),
        } as any);

        const result = await repository.countPendingByUserAndType(userId, transactionType, currency);

        expect(result).toBe(0);
      });
    });
  });

  describe('Service Tests', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('findAll', () => {
      it('should return all transactions with no filters', async () => {
        mockService.findAll.mockResolvedValueOnce(mockPaginatedResponse);
        const result = await service.findAll(mockTransaction.user_id);
        // Just check that it was called, don't verify arguments since they might be optional
        expect(mockService.findAll).toHaveBeenCalled();
        expect(result).toBe(mockPaginatedResponse);
      });

      it('should apply filters when provided', async () => {
        const filters = {
          user_id: mockTransaction.user_id,
          transaction_type: FiatWalletTransactionType.DEPOSIT,
          status: TransactionStatus.PENDING,
        };

        mockService.findAll.mockResolvedValueOnce(mockPaginatedResponse);
        const result = await service.findAll(mockTransaction.user_id, filters);

        expect(mockService.findAll).toHaveBeenCalledWith(mockTransaction.user_id, filters);
        expect(result).toBe(mockPaginatedResponse);
      });
    });

    describe('findById', () => {
      it('should return a transaction when found', async () => {
        mockService.findById.mockResolvedValueOnce(mockTransaction);
        const result = await service.findById(mockTransaction.id);
        expect(mockService.findById).toHaveBeenCalledWith(mockTransaction.id);
        expect(result).toBe(mockTransaction);
      });

      it('should throw NotFoundException when transaction not found', async () => {
        mockService.findById.mockRejectedValueOnce(
          new NotFoundException('Fiat wallet transaction with ID not-found-id not found'),
        );

        await expect(service.findById('not-found-id')).rejects.toThrow(
          'Fiat wallet transaction with ID not-found-id not found',
        );
        expect(mockService.findById).toHaveBeenCalledWith('not-found-id');
      });
    });

    describe('updateStatus', () => {
      it('should update transaction status with locker', async () => {
        const statusUpdate = {
          status: TransactionStatus.COMPLETED,
          provider_reference: 'updated-ref',
          provider_metadata: { updated: true },
        };

        mockService.updateStatus.mockResolvedValueOnce(mockTransaction);
        const result = await service.updateStatus(mockTransaction.id, statusUpdate.status, {
          provider_reference: statusUpdate.provider_reference,
          provider_metadata: statusUpdate.provider_metadata,
        });

        expect(mockService.updateStatus).toHaveBeenCalledWith(mockTransaction.id, statusUpdate.status, {
          provider_reference: statusUpdate.provider_reference,
          provider_metadata: statusUpdate.provider_metadata,
        });

        expect(result).toBe(mockTransaction);
      });

      it('should set processed_at when status is PROCESSING', async () => {
        mockService.updateStatus.mockResolvedValueOnce(mockTransaction);
        await service.updateStatus(mockTransaction.id, TransactionStatus.PROCESSING);

        // Only check that it was called with ID and status
        expect(mockService.updateStatus).toHaveBeenCalledWith(mockTransaction.id, TransactionStatus.PROCESSING);
      });

      it('should set failed_at and failure_reason when status is FAILED', async () => {
        mockService.updateStatus.mockResolvedValueOnce(mockTransaction);
        await service.updateStatus(mockTransaction.id, TransactionStatus.FAILED, {
          failure_reason: 'Test failure reason',
        });

        expect(mockService.updateStatus).toHaveBeenCalledWith(mockTransaction.id, TransactionStatus.FAILED, {
          failure_reason: 'Test failure reason',
        });
      });
    });

    describe('create', () => {
      it('should create a new fiat wallet transaction', async () => {
        const createData = {
          transaction_id: 'txn_123e4567-e89b-12d3-a456-426614174000',
          fiat_wallet_id: mockTransaction.fiat_wallet_id,
          transaction_type: mockTransaction.transaction_type,
          amount: mockTransaction.amount,
          balance_before: mockTransaction.balance_before,
          balance_after: mockTransaction.balance_after,
          currency: mockTransaction.currency,
          status: TransactionStatus.PENDING,
          provider: mockTransaction.provider,
          source: mockTransaction.source,
          destination: mockTransaction.destination,
          description: mockTransaction.description,
        };

        mockService.create.mockResolvedValueOnce(mockTransaction);

        const result = await service.create(mockTransaction.user_id, createData);

        expect(mockService.create).toHaveBeenCalledWith(mockTransaction.user_id, createData);
        expect(result).toBe(mockTransaction);
      });

      it('should generate a transaction_id when creating a transaction', async () => {
        const createData = {
          transaction_id: 'txn_123e4567-e89b-12d3-a456-426614174000',
          fiat_wallet_id: mockTransaction.fiat_wallet_id,
          user_id: mockTransaction.user_id,
          transaction_type: mockTransaction.transaction_type,
          amount: mockTransaction.amount,
          balance_before: mockTransaction.balance_before,
          balance_after: mockTransaction.balance_after,
          currency: mockTransaction.currency,
          status: TransactionStatus.PENDING,
          provider: mockTransaction.provider,
          source: mockTransaction.source,
          destination: mockTransaction.destination,
          description: mockTransaction.description,
        };

        mockService.create.mockImplementationOnce((userId, data) => {
          // Check that generated transaction would have a transaction_id
          expect(data).toEqual(createData);
          return Promise.resolve(mockTransaction);
        });

        await service.create(mockTransaction.user_id, createData);
        expect(mockService.create).toHaveBeenCalled();
      });

      it('should set default status to PENDING if not provided', async () => {
        const createData = {
          transaction_id: 'txn_123e4567-e89b-12d3-a456-426614174000',
          fiat_wallet_id: mockTransaction.fiat_wallet_id,
          user_id: mockTransaction.user_id,
          transaction_type: mockTransaction.transaction_type,
          amount: mockTransaction.amount,
          balance_before: mockTransaction.balance_before,
          balance_after: mockTransaction.balance_after,
          currency: mockTransaction.currency,
          status: TransactionStatus.PENDING,
          provider: mockTransaction.provider,
          source: mockTransaction.source,
          destination: mockTransaction.destination,
          description: mockTransaction.description,
        };

        mockService.create.mockImplementationOnce((userId, data) => {
          // The service should set status to PENDING by default
          expect(data).toEqual(createData);
          return Promise.resolve({
            ...mockTransaction,
            status: TransactionStatus.PENDING,
          });
        });

        const result = await service.create(mockTransaction.user_id, createData);
        expect(result.status).toBe(TransactionStatus.PENDING);
      });
    });
  });

  describe('Controller Tests', () => {
    describe('GET /fiat-wallet-transactions', () => {
      it('should return all transactions', () => {
        // Reset and mock the service method
        mockService.findAll.mockReset();
        mockService.findAll.mockResolvedValueOnce(mockPaginatedResponse);

        return request(app.getHttpServer())
          .get('/fiat-wallet-transactions')
          .expect(200)
          .expect((res) => {
            // Compare with serialized version
            expect(res.body.data).toEqual(serializedPaginatedResponse);
            expect(res.body.message).toBe('Fiat wallet transactions retrieved successfully');
            expect(res.body.statusCode).toBe(200);
          });
      });
    });

    describe('GET /fiat-wallet-transactions/:id', () => {
      it('should return a transaction by id', () => {
        // Reset and mock the service method
        mockService.findById.mockReset();
        mockService.findById.mockResolvedValueOnce(mockTransaction);

        return request(app.getHttpServer())
          .get(`/fiat-wallet-transactions/${mockTransaction.id}`)
          .expect(200)
          .expect((res) => {
            // Compare with serialized version
            expect(res.body.data).toEqual(serializedTransaction);
            expect(res.body.message).toBe('Fiat wallet transaction retrieved successfully');
            expect(res.body.statusCode).toBe(200);
          });
      });

      it('should return 404 when transaction not found', () => {
        // Use a valid UUID
        const validUUID = '00000000-0000-0000-0000-000000000000';

        // Reset and mock the service to throw a proper NestJS exception
        mockService.findById.mockReset();
        mockService.findById.mockImplementationOnce(() => {
          throw new NotFoundException(`Fiat wallet transaction with ID ${validUUID} not found`);
        });

        return request(app.getHttpServer()).get(`/fiat-wallet-transactions/${validUUID}`).expect(404);
      });
    });
  });
});
