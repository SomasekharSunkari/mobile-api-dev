import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DateTime } from 'luxon';
import {
  TransactionCategory,
  TransactionScope,
  TransactionStatus,
  TransactionType,
  UserProfileModel,
} from '../../database';
import { LockerService } from '../../services/locker';
import { PushNotificationService } from '../../services/pushNotification/pushNotification.service';
import { MailerService } from '../../services/queue/processors/mailer/mailer.service';
import { UserService } from '../auth/user/user.service';
import { UserProfileService } from '../auth/userProfile/userProfile.service';
import { FiatWalletService } from '../fiatWallet/fiatWallet.service';
import { FiatWalletEscrowService } from '../fiatWallet/fiatWalletEscrow.service';
import { FiatWalletTransactionService } from '../fiatWalletTransactions/fiatWalletTransactions.service';
import { IN_APP_NOTIFICATION_TYPE } from '../inAppNotification/inAppNotification.enum';
import { InAppNotificationService } from '../inAppNotification/inAppNotification.service';
import { CreateTransactionDto } from './dto/createTransaction.dto';
import { GetTransactionsDto } from './dto/getTransactions.dto';
import { TransactionRepository } from './transaction.repository';
import { TransactionService } from './transaction.service';

describe('TransactionService', () => {
  let service: TransactionService;

  const mockQueryBuilder = {
    where: jest.fn().mockImplementation(function (this: any, arg?: any) {
      if (typeof arg === 'function') {
        arg(this);
      }
      return this;
    }),
    whereIn: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    withGraphFetched: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    orWhereExists: jest.fn().mockReturnThis(),
    orWhereRaw: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    whereExists: jest.fn().mockReturnThis(),
  };

  const mockTransactionRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn(),
    model: {
      relatedQuery: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orWhereRaw: jest.fn().mockReturnThis(),
      })),
      knex: jest.fn(() => ({
        raw: jest.fn().mockReturnValue('mock_raw_query'),
      })),
    },
    query: jest.fn(() => mockQueryBuilder),
    paginateData: jest.fn(),
  };

  const mockLockerService = {
    withLock: jest.fn((_key, callback) => callback()),
  };

  const mockInAppNotificationService = {
    createNotification: jest.fn(),
    findAll: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    getTransactionNotificationConfig: jest.fn(),
  };

  const mockMailerService = {
    send: jest.fn(),
  };

  const mockUserService = {
    findByUserId: jest.fn(),
  };

  const mockPushNotificationService = {
    sendPushNotification: jest.fn(),
    getTransactionPushNotificationConfig: jest.fn(),
  };

  const mockUserProfileService = {
    findByUserId: jest.fn(),
    populateAvatarUrl: jest.fn(),
  };

  const mockFiatWalletService = {
    getUserWallet: jest.fn(),
    updateBalance: jest.fn(),
  };

  const mockFiatWalletTransactionService = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockFiatWalletEscrowService = {
    getEscrowAmount: jest.fn(),
    releaseMoneyFromEscrow: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: TransactionRepository,
          useValue: mockTransactionRepository,
        },
        {
          provide: LockerService,
          useValue: mockLockerService,
        },
        {
          provide: InAppNotificationService,
          useValue: mockInAppNotificationService,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: PushNotificationService,
          useValue: mockPushNotificationService,
        },
        {
          provide: UserProfileService,
          useValue: mockUserProfileService,
        },
        {
          provide: FiatWalletService,
          useValue: mockFiatWalletService,
        },
        {
          provide: FiatWalletTransactionService,
          useValue: mockFiatWalletTransactionService,
        },
        {
          provide: FiatWalletEscrowService,
          useValue: mockFiatWalletEscrowService,
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);

    // Set default return value for push notification config
    mockPushNotificationService.getTransactionPushNotificationConfig.mockReturnValue({
      title: 'Transaction Completed',
      body: 'Your transaction has been completed successfully.',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset mock query builder calls
    Object.values(mockQueryBuilder).forEach((mock) => {
      if (typeof mock === 'function' && mock.mockClear) {
        mock.mockClear();
      }
    });
  });

  describe('create', () => {
    it('should create a transaction successfully', async () => {
      const transactionData: CreateTransactionDto = {
        reference: 'TX123',
        asset: 'USD',
        amount: 1000,
        balance_before: 2000,
        balance_after: 3000,
        transaction_type: TransactionType.DEPOSIT,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        status: TransactionStatus.PENDING,
      };

      const expectedTransaction = { ...transactionData, id: 'tx-1' };
      mockTransactionRepository.create.mockResolvedValue(expectedTransaction);

      const result = await service.create('user123', transactionData);

      // The service adds additional fields to the data passed to repository
      expect(mockTransactionRepository.create).toHaveBeenCalledWith(
        {
          ...transactionData,
          user_id: 'user123',
          processed_at: expect.any(String),
          metadata: undefined,
          external_reference: undefined,
          description: undefined,
          parent_transaction_id: undefined,
        },
        undefined, // trx parameter
      );
      expect(result).toEqual(expectedTransaction);
    });
  });

  describe('findAll', () => {
    it('should return paginated transactions with no filters', async () => {
      const mockPaginatedResponse = {
        transactions: [
          {
            id: 'tx-1',
            status: TransactionStatus.PENDING,
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

      mockTransactionRepository.paginateData.mockResolvedValue(mockPaginatedResponse);

      const result = await service.findAll('user123');

      expect(mockTransactionRepository.paginateData).toHaveBeenCalledWith(expect.any(Object), 10, 1);
      expect(result).toEqual({
        transactions: mockPaginatedResponse.transactions,
        pagination: mockPaginatedResponse.pagination,
      });
    });

    it('should apply single value filters when provided', async () => {
      const filters = {
        user_id: 'user123',
        status: [TransactionStatus.COMPLETED],
        transaction_type: [TransactionType.DEPOSIT],
      };

      const expectedResponse = {
        transactions: [
          {
            id: 'tx-1',
            status: TransactionStatus.COMPLETED,
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

      mockTransactionRepository.paginateData.mockResolvedValue({
        transactions: expectedResponse.transactions,
        pagination: expectedResponse.pagination,
      });

      const result = await service.findAll('user123', filters);

      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith('status', [TransactionStatus.COMPLETED]);
      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith('transaction_type', [TransactionType.DEPOSIT]);
      expect(mockTransactionRepository.paginateData).toHaveBeenCalledWith(expect.any(Object), 10, 1);
      expect(result).toEqual(expectedResponse);
    });

    it('should apply multiple value filters when provided', async () => {
      const filters = {
        status: [TransactionStatus.COMPLETED, TransactionStatus.PENDING],
        transaction_type: [TransactionType.DEPOSIT, TransactionType.WITHDRAWAL],
        category: [TransactionCategory.FIAT, TransactionCategory.BLOCKCHAIN],
      };

      const expectedResponse = {
        transactions: [
          {
            id: 'tx-1',
            status: TransactionStatus.COMPLETED,
          },
          {
            id: 'tx-2',
            status: TransactionStatus.PENDING,
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 2,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 2,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue({
        transactions: expectedResponse.transactions,
        pagination: expectedResponse.pagination,
      });

      const result = await service.findAll('user123', filters);

      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith('status', [
        TransactionStatus.COMPLETED,
        TransactionStatus.PENDING,
      ]);
      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith('transaction_type', [
        TransactionType.DEPOSIT,
        TransactionType.WITHDRAWAL,
      ]);
      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith('category', [
        TransactionCategory.FIAT,
        TransactionCategory.BLOCKCHAIN,
      ]);
      expect(mockTransactionRepository.paginateData).toHaveBeenCalledWith(expect.any(Object), 10, 1);
      expect(result).toEqual(expectedResponse);
    });

    it('should not apply filters when empty arrays are provided', async () => {
      const filters = {
        status: [],
        transaction_type: [],
        category: [],
      };

      const expectedResponse = {
        transactions: [
          {
            id: 'tx-1',
            status: TransactionStatus.PENDING,
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

      mockTransactionRepository.paginateData.mockResolvedValue({
        transactions: expectedResponse.transactions,
        pagination: expectedResponse.pagination,
      });

      const result = await service.findAll('user123', filters);

      // whereIn should not be called for empty arrays
      expect(mockQueryBuilder.whereIn).not.toHaveBeenCalled();
      expect(mockTransactionRepository.paginateData).toHaveBeenCalledWith(expect.any(Object), 10, 1);
      expect(result).toEqual(expectedResponse);
    });

    it('should filter by asset when provided', async () => {
      const filters = {
        asset: 'USD',
      };

      const expectedResponse = {
        transactions: [
          {
            id: 'tx-1',
            status: TransactionStatus.COMPLETED,
            asset: 'USD',
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

      mockTransactionRepository.paginateData.mockResolvedValue({
        transactions: expectedResponse.transactions,
        pagination: expectedResponse.pagination,
      });

      const result = await service.findAll('user123', filters);

      expect(mockTransactionRepository.paginateData).toHaveBeenCalledWith(expect.any(Object), 10, 1);
      expect(result).toEqual(expectedResponse);
    });

    it('should apply search across transaction fields when search term is provided', async () => {
      const filters = {
        search: 'chase',
        page: 1,
        limit: 10,
      };

      const expectedResponse = {
        transactions: [
          {
            id: 'tx-1',
            status: TransactionStatus.COMPLETED,
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

      mockTransactionRepository.paginateData.mockResolvedValue({
        transactions: expectedResponse.transactions,
        pagination: expectedResponse.pagination,
      });

      const result = await service.findAll('user123', filters);

      // Verify search query builder methods were called
      expect(mockTransactionRepository.query).toHaveBeenCalled();
      expect(mockTransactionRepository.paginateData).toHaveBeenCalledWith(expect.any(Object), 10, 1);
      expect(result).toEqual(expectedResponse);
    });

    it('should apply custom pagination when provided', async () => {
      const filters = {
        page: 2,
        limit: 5,
      };

      const expectedResponse = {
        transactions: [],
        pagination: {
          current_page: 2,
          next_page: 3,
          previous_page: 1,
          limit: 5,
          page_count: 0,
          total: 0,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue({
        transactions: expectedResponse.transactions,
        pagination: expectedResponse.pagination,
      });

      const result = await service.findAll('user123', filters);

      expect(mockTransactionRepository.paginateData).toHaveBeenCalledWith(expect.any(Object), 5, 2);
      expect(result).toEqual(expectedResponse);
    });

    it('should apply date range filters when provided', async () => {
      const filters = {
        start_date: '2025-01-01',
        end_date: '2025-12-31',
      };

      const expectedResponse = {
        transactions: [
          {
            id: 'tx-1',
            status: TransactionStatus.COMPLETED,
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

      mockTransactionRepository.paginateData.mockResolvedValue({
        transactions: expectedResponse.transactions,
        pagination: expectedResponse.pagination,
      });

      const result = await service.findAll('user123', filters);

      expect(mockTransactionRepository.paginateData).toHaveBeenCalledWith(expect.any(Object), 10, 1);
      expect(result).toEqual(expectedResponse);
    });

    it('should accept card category in filters', async () => {
      const filters = {
        category: ['fiat', 'blockchain', 'card'] as any,
      };

      const expectedResponse = {
        transactions: [
          {
            id: 'tx-1',
            category: 'card',
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue(expectedResponse);

      const result = await service.findAll('user123', filters);

      expect(mockTransactionRepository.paginateData).toHaveBeenCalledWith(expect.any(Object), 10, 1);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('findById', () => {
    it('should return a transaction when found', async () => {
      const expectedTransaction = {
        id: 'tx-1',
        reference: 'TX123',
        status: TransactionStatus.PENDING,
      };

      mockTransactionRepository.findById.mockResolvedValue(expectedTransaction);

      const result = await service.findById('tx-1');

      expect(mockTransactionRepository.findById).toHaveBeenCalledWith('tx-1');
      expect(result).toEqual(expectedTransaction);
    });

    it('should throw NotFoundException when transaction is not found', async () => {
      mockTransactionRepository.findById.mockResolvedValue(null);

      await expect(service.findById('tx-1')).rejects.toThrow('Transaction with ID tx-1 not found');
    });
  });

  describe('updateStatus', () => {
    const mockTransaction = {
      id: 'tx-1',
      reference: 'TX123',
      status: TransactionStatus.PENDING,
      metadata: undefined as any,
    };

    beforeEach(() => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
    });

    it('should update status to PROCESSING and set processed_at', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const expectedUpdate = {
        status: TransactionStatus.PROCESSING,
        processed_at: now,
      };

      mockTransactionRepository.update.mockResolvedValue({ ...mockTransaction, ...expectedUpdate });

      const result = await service.updateStatus('tx-1', TransactionStatus.PROCESSING);

      expect(mockLockerService.withLock).toHaveBeenCalledWith('transaction:tx-1:update-status', expect.any(Function));
      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-1', expectedUpdate, { trx: undefined });
      expect(result).toEqual({ ...mockTransaction, ...expectedUpdate });
    });

    it('should update status to COMPLETED and set completed_at', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const expectedUpdate = {
        status: TransactionStatus.COMPLETED,
        completed_at: now,
      };

      const updatedTransaction = {
        ...mockTransaction,
        ...expectedUpdate,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'deposit',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message:
          'Your deposit of 10.00 USD has been processed and added to your wallet. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-1', expectedUpdate, { trx: undefined });
      expect(mockInAppNotificationService.getTransactionNotificationConfig).toHaveBeenCalled();
      expect(mockInAppNotificationService.createNotification).toHaveBeenCalled();
      expect(result).toEqual(updatedTransaction);
    });

    it('should merge metadata when provider_metadata is provided', async () => {
      const existingMetadata = {
        destination_name: 'Card ****6890',
        destination_type: 'rain_deposit_address',
      };

      const mockTransactionWithMetadata = {
        ...mockTransaction,
        metadata: existingMetadata,
      };

      mockTransactionRepository.findById.mockResolvedValue(mockTransactionWithMetadata);

      const metadata = {
        failure_reason: 'Insufficient funds',
        provider_reference: 'PROV123',
        provider_metadata: { error_code: 'INSUFFICIENT_FUNDS' },
      };

      const expectedUpdate = {
        status: TransactionStatus.FAILED,
        failed_at: expect.any(String),
        failure_reason: metadata.failure_reason,
        external_reference: metadata.provider_reference,
        metadata: {
          ...existingMetadata,
          ...metadata.provider_metadata,
        },
      };

      const updatedTransaction = {
        ...mockTransactionWithMetadata,
        ...expectedUpdate,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'deposit',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);

      const result = await service.updateStatus('tx-1', TransactionStatus.FAILED, metadata);

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-1', expectedUpdate, { trx: undefined });
      expect(result).toEqual(updatedTransaction);
    });

    it('should update status to FAILED and set failed_at with failure reason', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const metadata = {
        failure_reason: 'Insufficient funds',
        provider_reference: 'PROV123',
        provider_metadata: { error_code: 'INSUFFICIENT_FUNDS' },
      };

      const expectedUpdate = {
        status: TransactionStatus.FAILED,
        failed_at: now,
        failure_reason: metadata.failure_reason,
        external_reference: metadata.provider_reference,
        metadata: {
          ...metadata.provider_metadata,
        },
      };

      const updatedTransaction = {
        ...mockTransaction,
        ...expectedUpdate,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'deposit',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);

      const result = await service.updateStatus('tx-1', TransactionStatus.FAILED, metadata);

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-1', expectedUpdate, { trx: undefined });
      expect(mockInAppNotificationService.createNotification).toHaveBeenCalledWith({
        user_id: 'user-123',
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_FAILED,
        title: 'Transaction Failed',
        message: 'Your 10.00 USD transaction has failed.',
        metadata: {
          transactionId: 'tx-1',
          amount: '1000',
          asset: 'USD',
          transactionType: 'deposit',
          failureReason: 'Insufficient funds',
        },
      });
      expect(result).toEqual(updatedTransaction);
    });

    it('should use destination_name from metadata for card funding transfer_out notifications', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const existingMetadata = {
        destination_name: 'Card ****6890',
        destination_type: 'rain_deposit_address',
      };

      const mockTransactionWithMetadata = {
        ...mockTransaction,
        metadata: existingMetadata,
        user_id: 'user-123',
        amount: '-3000',
        asset: 'USD',
        transaction_type: TransactionType.TRANSFER_OUT,
        status: TransactionStatus.PENDING,
      };

      mockTransactionRepository.findById.mockResolvedValue(mockTransactionWithMetadata);

      const updatedTransaction = {
        ...mockTransactionWithMetadata,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        metadata: existingMetadata,
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Funds Sent Successfully',
        message: 'You sent 30.00 USD to Card ****6890 successfully. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED, {
        recipient: 'Some Recipient',
      });

      expect(mockInAppNotificationService.getTransactionNotificationConfig).toHaveBeenCalledWith(
        TransactionType.TRANSFER_OUT,
        '30.00',
        'USD',
        'Card ****6890',
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(updatedTransaction);
    });

    it('should use recipient from metadata param when destination_name is not Card format', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const existingMetadata = {
        destination_name: 'Jane Smith',
        destination_type: 'bank_account',
      };

      const mockTransactionWithMetadata = {
        ...mockTransaction,
        metadata: existingMetadata,
        user_id: 'user-123',
        amount: '-3000',
        asset: 'USD',
        transaction_type: TransactionType.TRANSFER_OUT,
        status: TransactionStatus.PENDING,
      };

      mockTransactionRepository.findById.mockResolvedValue(mockTransactionWithMetadata);

      const updatedTransaction = {
        ...mockTransactionWithMetadata,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        metadata: existingMetadata,
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Funds Sent Successfully',
        message: 'You sent 30.00 USD to Jane Smith successfully. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED, {
        recipient: 'John Doe',
      });

      expect(mockInAppNotificationService.getTransactionNotificationConfig).toHaveBeenCalledWith(
        TransactionType.TRANSFER_OUT,
        '30.00',
        'USD',
        'John Doe',
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(updatedTransaction);
    });

    it('should handle metadata as JSON string when parsing destination_name', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const existingMetadataString = JSON.stringify({
        destination_name: 'Card ****6890',
        destination_type: 'rain_deposit_address',
      });

      const mockTransactionWithMetadata = {
        ...mockTransaction,
        metadata: existingMetadataString,
        user_id: 'user-123',
        amount: '-3000',
        asset: 'USD',
        transaction_type: TransactionType.TRANSFER_OUT,
        status: TransactionStatus.PENDING,
      };

      mockTransactionRepository.findById.mockResolvedValue(mockTransactionWithMetadata);

      const updatedTransaction = {
        ...mockTransactionWithMetadata,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        metadata: existingMetadataString,
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Funds Sent Successfully',
        message: 'You sent 30.00 USD to Card ****6890 successfully. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockInAppNotificationService.getTransactionNotificationConfig).toHaveBeenCalledWith(
        TransactionType.TRANSFER_OUT,
        '30.00',
        'USD',
        'Card ****6890',
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(updatedTransaction);
    });

    it('should send in-app and email notifications when status is COMPLETED for USD deposit', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const mockExistingTransaction = {
        ...mockTransaction,
        user: {
          id: 'user-123',
          first_name: 'John',
          last_name: 'Doe',
        },
      };

      mockTransactionRepository.findById.mockResolvedValueOnce(mockExistingTransaction);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'deposit',
        balance_after: '3000',
      };

      const metadata = {
        description: 'Test deposit',
        source: 'Chase Bank',
        recipient: 'John Doe',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'John',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message:
          'Your deposit of 10.00 USD has been processed and added to your wallet. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserService.findByUserId.mockResolvedValue(mockUser);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED, metadata);

      expect(mockInAppNotificationService.getTransactionNotificationConfig).toHaveBeenCalledWith(
        'deposit',
        '10.00',
        'USD',
        'John Doe',
        undefined,
        undefined,
        undefined,
      );
      expect(mockInAppNotificationService.createNotification).toHaveBeenCalledWith({
        user_id: 'user-123',
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message:
          'Your deposit of 10.00 USD has been processed and added to your wallet. A receipt has also been sent to your email.',
        metadata: {
          transactionId: 'tx-1',
          amount: '1000',
          asset: 'USD',
          transactionType: 'deposit',
        },
      });
      expect(mockUserService.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockMailerService.send).toHaveBeenCalled();
      expect(result).toEqual(updatedTransaction);
    });

    it('should send in-app notification but not email for non-USD transactions', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'NGN',
        transaction_type: 'deposit',
        balance_after: '3000',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message:
          'Your deposit of 10.00 NGN has been processed and added to your wallet. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockInAppNotificationService.createNotification).toHaveBeenCalled();
      expect(mockMailerService.send).not.toHaveBeenCalled();
      expect(result).toEqual(updatedTransaction);
    });

    it('should handle transfer notifications with recipient names', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const mockExistingTransaction = {
        ...mockTransaction,
        user: {
          id: 'user-123',
          first_name: 'John',
          last_name: 'Smith',
        },
      };

      mockTransactionRepository.findById.mockResolvedValueOnce(mockExistingTransaction);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '2000',
        asset: 'USD',
        transaction_type: 'transfer_out',
        balance_after: '1000',
      };

      const metadata = {
        recipient: 'Jane Smith',
        description: 'Transfer to friend',
        provider_fee: 100,
        sender_name: 'John Smith',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'John',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Funds Sent Successfully',
        message: 'You sent 20.00 USD to Jane Smith successfully. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserService.findByUserId.mockResolvedValue(mockUser);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED, metadata);

      expect(mockInAppNotificationService.getTransactionNotificationConfig).toHaveBeenCalledWith(
        'transfer_out',
        '20.00',
        'USD',
        'Jane Smith',
        'John Smith',
        undefined,
        undefined,
      );
      expect(mockInAppNotificationService.createNotification).toHaveBeenCalledWith({
        user_id: 'user-123',
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Funds Sent Successfully',
        message: 'You sent 20.00 USD to Jane Smith successfully. A receipt has also been sent to your email.',
        metadata: {
          transactionId: 'tx-1',
          amount: '2000',
          asset: 'USD',
          transactionType: 'transfer_out',
        },
      });
      expect(result).toEqual(updatedTransaction);
    });

    it('should update status to REVIEW and set failure reason', async () => {
      const metadata = {
        failure_reason: 'Requires manual review',
        provider_reference: 'PROV123',
        provider_metadata: { review_reason: 'HIGH_RISK' },
      };

      const expectedUpdate = {
        status: TransactionStatus.REVIEW,
        failure_reason: metadata.failure_reason,
        external_reference: metadata.provider_reference,
        metadata: metadata.provider_metadata,
      };

      const updatedTransaction = {
        ...mockTransaction,
        ...expectedUpdate,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'deposit',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);

      const result = await service.updateStatus('tx-1', TransactionStatus.REVIEW, metadata);

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-1', expectedUpdate, { trx: undefined });
      expect(result).toEqual(updatedTransaction);
    });

    it('should handle withdrawal email notification', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1500',
        asset: 'USD',
        transaction_type: 'withdrawal',
      };

      const metadata = {
        description: 'Withdrawal to bank account',
        destination: 'Chase Bank ****1234',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'John',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Withdrawal Successful',
        message:
          'Your withdrawal of 15.00 USD has been processed successfully. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserService.findByUserId.mockResolvedValue(mockUser);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED, metadata);

      expect(mockUserService.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockMailerService.send).toHaveBeenCalled();
      expect(result).toEqual(updatedTransaction);
    });

    it('should handle reward email notification', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'reward',
        balance_after: '5000',
        external_reference: 'reward-ref-123',
      };

      const metadata = {
        description: 'First deposit match reward',
        participant_code: 'participant-123',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'John',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Reward Processed',
        message:
          'Your reward of 10.00 USD has been credited to your account. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserService.findByUserId.mockResolvedValue(mockUser);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED, metadata);

      expect(mockUserService.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockMailerService.send).toHaveBeenCalled();
      expect(result).toEqual(updatedTransaction);
    });

    it('should skip email notification for non-USD transactions', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'NGN',
        transaction_type: 'deposit',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message:
          'Your deposit of 10.00 NGN has been processed and added to your wallet. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockInAppNotificationService.createNotification).toHaveBeenCalled();
      expect(mockUserService.findByUserId).not.toHaveBeenCalled();
      expect(mockMailerService.send).not.toHaveBeenCalled();
      expect(result).toEqual(updatedTransaction);
    });

    it('should skip email notification for unsupported transaction types', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'exchange',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Exchange Completed Successfully',
        message:
          'Your currency exchange of 10.00 USD has been completed successfully. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockInAppNotificationService.createNotification).toHaveBeenCalled();
      expect(mockUserService.findByUserId).not.toHaveBeenCalled();
      expect(mockMailerService.send).not.toHaveBeenCalled();
      expect(result).toEqual(updatedTransaction);
    });

    it('should handle email notification errors gracefully', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'deposit',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'John',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message:
          'Your deposit of 10.00 USD has been processed and added to your wallet. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserService.findByUserId.mockResolvedValue(mockUser);
      mockMailerService.send.mockRejectedValue(new Error('Email service unavailable'));

      const loggerSpy = jest.spyOn(service['logger'], 'error');

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockInAppNotificationService.createNotification).toHaveBeenCalled();
      expect(mockUserService.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockMailerService.send).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalled();
      expect(result).toEqual(updatedTransaction);
    });

    it('should update balance_after when provided in metadata', async () => {
      const metadata = {
        balance_after: 5000,
        provider_reference: 'PROV123',
        provider_metadata: { webhook_data: 'test' },
      };

      const expectedUpdate = {
        status: TransactionStatus.COMPLETED,
        completed_at: expect.any(String),
        balance_after: 5000,
        external_reference: 'PROV123',
        metadata: { webhook_data: 'test' },
      };

      const updatedTransaction = {
        ...mockTransaction,
        ...expectedUpdate,
        user_id: 'user-123',
        amount: '500',
        asset: 'USD',
        transaction_type: 'transfer_in',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED, metadata);

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-1', expectedUpdate, { trx: undefined });
      expect(result).toEqual(updatedTransaction);
    });

    it('should not update balance_after when not provided in metadata', async () => {
      const metadata = {
        provider_reference: 'PROV123',
      };

      const expectedUpdate = {
        status: TransactionStatus.COMPLETED,
        completed_at: expect.any(String),
        external_reference: 'PROV123',
      };

      const updatedTransaction = {
        ...mockTransaction,
        ...expectedUpdate,
        user_id: 'user-123',
        amount: '500',
        asset: 'USD',
        transaction_type: 'transfer_out',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED, metadata);

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-1', expectedUpdate, { trx: undefined });
      expect(result).toEqual(updatedTransaction);
    });

    it('should update balance_after to 0 when explicitly set to 0', async () => {
      const metadata = {
        balance_after: 0,
      };

      const expectedUpdate = {
        status: TransactionStatus.COMPLETED,
        completed_at: expect.any(String),
        balance_after: 0,
      };

      const updatedTransaction = {
        ...mockTransaction,
        ...expectedUpdate,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'withdrawal',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED, metadata);

      expect(mockTransactionRepository.update).toHaveBeenCalledWith('tx-1', expectedUpdate, { trx: undefined });
      expect(result).toEqual(updatedTransaction);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when transaction is not found', async () => {
      mockTransactionRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne({ id: 'non-existent' })).rejects.toThrow(NotFoundException);
      expect(mockTransactionRepository.findOne).toHaveBeenCalledWith({ id: 'non-existent' }, undefined, {
        graphFetch: '[fiatWalletTransaction, blockchainWalletTransaction]',
      });
    });

    it('should return transaction when found', async () => {
      const mockTransaction = { id: 'tx-1', status: 'completed' };
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.findOne({ id: 'tx-1' });

      expect(result).toEqual(mockTransaction);
      expect(mockTransactionRepository.findOne).toHaveBeenCalledWith({ id: 'tx-1' }, undefined, {
        graphFetch: '[fiatWalletTransaction, blockchainWalletTransaction]',
      });
    });
  });

  describe('exchange transaction notifications', () => {
    const mockTransaction = {
      id: 'tx-1',
      reference: 'TX123',
      status: TransactionStatus.PENDING,
    };

    beforeEach(() => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
    });

    it('should use parent transaction amount for exchange notification', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const parentTransaction = {
        id: 'parent-tx-1',
        amount: '5000',
        asset: 'USD',
        transaction_type: 'exchange',
        user_id: 'user-123',
      };

      const exchangeTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '3000000',
        asset: 'NGN',
        transaction_type: TransactionType.EXCHANGE,
        parent_transaction_id: 'parent-tx-1',
      };

      const metadata = {
        recipient: 'NGN Wallet',
        sender_name: 'John Doe',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Exchange Completed Successfully',
        message:
          'Your currency exchange of 50.00 USD has been completed successfully. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(exchangeTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(parentTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED, metadata);

      expect(mockTransactionRepository.findOne).toHaveBeenCalledWith({
        id: 'parent-tx-1',
      });
      expect(mockInAppNotificationService.getTransactionNotificationConfig).toHaveBeenCalledWith(
        TransactionType.EXCHANGE,
        '50',
        'USD',
        'NGN Wallet',
        'John Doe',
        undefined,
        undefined,
      );
      expect(mockInAppNotificationService.createNotification).toHaveBeenCalledWith({
        user_id: 'user-123',
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Exchange Completed Successfully',
        message:
          'Your currency exchange of 50.00 USD has been completed successfully. A receipt has also been sent to your email.',
        metadata: {
          transactionId: 'tx-1',
          amount: '3000000',
          asset: 'NGN',
          transactionType: TransactionType.EXCHANGE,
        },
      });
      expect(result).toEqual(exchangeTransaction);
    });

    it('should handle exchange transaction without parent transaction', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const exchangeTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '3000000',
        asset: 'NGN',
        transaction_type: TransactionType.EXCHANGE,
        parent_transaction_id: null,
      };

      const metadata = {
        recipient: 'NGN Wallet',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Exchange Completed Successfully',
        message:
          'Your currency exchange of 30,000.00 NGN has been completed successfully. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(exchangeTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED, metadata);

      expect(mockTransactionRepository.findOne).not.toHaveBeenCalled();
      expect(mockInAppNotificationService.getTransactionNotificationConfig).toHaveBeenCalledWith(
        TransactionType.EXCHANGE,
        '30000',
        'NGN',
        'NGN Wallet',
        undefined,
        undefined,
        undefined,
      );
      expect(mockInAppNotificationService.createNotification).toHaveBeenCalled();
      expect(result).toEqual(exchangeTransaction);
    });

    it('should handle exchange transaction with uppercase transaction type', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const parentTransaction = {
        id: 'parent-tx-1',
        amount: '10000',
        asset: 'USD',
        transaction_type: 'exchange',
        user_id: 'user-123',
      };

      const exchangeTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '8000000',
        asset: 'NGN',
        transaction_type: 'EXCHANGE',
        parent_transaction_id: 'parent-tx-1',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Exchange Completed Successfully',
        message:
          'Your currency exchange of 100.00 USD has been completed successfully. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(exchangeTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(parentTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockTransactionRepository.findOne).toHaveBeenCalledWith({
        id: 'parent-tx-1',
      });
      expect(mockInAppNotificationService.getTransactionNotificationConfig).toHaveBeenCalledWith(
        TransactionType.EXCHANGE,
        '100',
        'USD',
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(exchangeTransaction);
    });

    it('should not send duplicate notifications if status unchanged', async () => {
      const exchangeTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        user_id: 'user-123',
        amount: '3000000',
        asset: 'NGN',
        transaction_type: TransactionType.EXCHANGE,
      };

      mockTransactionRepository.findById.mockResolvedValue(exchangeTransaction);
      mockTransactionRepository.update.mockResolvedValue(exchangeTransaction);

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockInAppNotificationService.createNotification).not.toHaveBeenCalled();
      expect(mockInAppNotificationService.getTransactionNotificationConfig).not.toHaveBeenCalled();
    });

    it('should send push notification for exchange transactions', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const parentTransaction = {
        id: 'parent-tx-1',
        amount: '2500',
        asset: 'USD',
        transaction_type: 'exchange',
        user_id: 'user-123',
      };

      const exchangeTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '2000000',
        asset: 'NGN',
        transaction_type: TransactionType.EXCHANGE,
        parent_transaction_id: 'parent-tx-1',
      };

      const mockUserProfile = {
        id: 'profile-1',
        user_id: 'user-123',
        notification_token: 'test-token-123',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Exchange Completed Successfully',
        message:
          'Your currency exchange of 25.00 USD has been completed successfully. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(exchangeTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(parentTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockPushNotificationService.getTransactionPushNotificationConfig.mockReturnValue({
        title: 'Exchange',
        body: '₦20,000.00 has been successfully exchanged',
      });
      mockUserProfileService.findByUserId.mockResolvedValue(mockUserProfile);

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockUserProfileService.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockPushNotificationService.sendPushNotification).toHaveBeenCalledWith(['test-token-123'], {
        title: 'Exchange',
        body: '₦20,000.00 has been successfully exchanged',
      });
    });

    it('should handle push notification failure gracefully for exchange', async () => {
      const now = DateTime.now().toSQL();
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const exchangeTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '3000000',
        asset: 'NGN',
        transaction_type: TransactionType.EXCHANGE,
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Exchange Completed Successfully',
        message:
          'Your currency exchange of 30,000.00 NGN has been completed successfully. A receipt has also been sent to your email.',
      };

      mockTransactionRepository.update.mockResolvedValue(exchangeTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserProfileService.findByUserId.mockRejectedValue(new Error('User profile not found'));

      const loggerSpy = jest.spyOn(service['logger'], 'error');

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(loggerSpy).toHaveBeenCalled();
      expect(result).toEqual(exchangeTransaction);
    });
  });

  describe('push notification handling', () => {
    const mockTransaction = {
      id: 'tx-1',
      reference: 'TX123',
      status: TransactionStatus.PENDING,
    };

    beforeEach(() => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
    });

    it('should skip push notification when no notification token is found', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'NGN',
        transaction_type: 'deposit',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message: 'Your deposit of 10.00 NGN has been completed.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserProfileService.findByUserId.mockResolvedValue({ id: 'profile-1', notification_token: null });

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockPushNotificationService.sendPushNotification).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('No notification token found'));
    });

    it('should send push notification when notification token exists', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'NGN',
        transaction_type: 'deposit',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message: 'Your deposit of 10.00 NGN has been completed.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockPushNotificationService.getTransactionPushNotificationConfig.mockReturnValue({
        title: 'NGN Deposit',
        body: 'Added ₦10.00 to your NGN wallet.',
      });
      mockUserProfileService.findByUserId.mockResolvedValue({
        id: 'profile-1',
        notification_token: 'fcm-token-123',
      });

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockPushNotificationService.sendPushNotification).toHaveBeenCalledWith(['fcm-token-123'], {
        title: 'NGN Deposit',
        body: 'Added ₦10.00 to your NGN wallet.',
      });
    });

    it('should send push notification for failed transaction', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.FAILED,
        failed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'deposit',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockUserProfileService.findByUserId.mockResolvedValue({
        id: 'profile-1',
        notification_token: 'fcm-token-123',
      });

      await service.updateStatus('tx-1', TransactionStatus.FAILED, { failure_reason: 'Insufficient funds' });

      expect(mockPushNotificationService.sendPushNotification).toHaveBeenCalledWith(['fcm-token-123'], {
        title: 'Transaction Failed',
        body: 'Your 10.00 USD transaction has failed.',
      });
    });
  });

  describe('transfer_in email notification', () => {
    const mockTransaction = {
      id: 'tx-1',
      reference: 'TX123',
      status: TransactionStatus.PENDING,
    };

    beforeEach(() => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
    });

    it('should send funds received email for transfer_in transaction', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '2500',
        asset: 'USD',
        transaction_type: 'transfer_in',
        balance_after: '7500',
      };

      const metadata = {
        sender_name: 'Jane Smith',
        description: 'Payment for services',
        participant_code: 'PART-123',
        recipient_name: 'John Doe',
        recipient_location: 'United States',
        provider_fee: 50,
      };

      const mockUser = {
        id: 'user-123',
        email: 'john@example.com',
        first_name: 'John',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Funds Received',
        message: 'You received 25.00 USD from Jane Smith.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserService.findByUserId.mockResolvedValue(mockUser);
      mockUserProfileService.findByUserId.mockResolvedValue({ notification_token: null });

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED, metadata);

      expect(mockUserService.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockMailerService.send).toHaveBeenCalled();
    });
  });

  describe('findAll with fiat_wallet_id filter', () => {
    it('should filter by fiat_wallet_id when provided', async () => {
      const filters = {
        fiat_wallet_id: 'wallet-123',
      };

      const expectedResponse = {
        transactions: [
          {
            id: 'tx-1',
            status: TransactionStatus.COMPLETED,
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue({
        transactions: expectedResponse.transactions,
        pagination: expectedResponse.pagination,
      });

      const result = await service.findAll('user123', filters);

      expect(mockTransactionRepository.paginateData).toHaveBeenCalledWith(expect.any(Object), 10, 1);
      expect(result).toEqual(expectedResponse);
    });

    it('should filter by transaction_scope when provided', async () => {
      const filters = {
        transaction_scope: [TransactionScope.INTERNAL, TransactionScope.EXTERNAL],
      };

      const expectedResponse = {
        transactions: [
          {
            id: 'tx-1',
            transaction_scope: TransactionScope.INTERNAL,
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue({
        transactions: expectedResponse.transactions,
        pagination: expectedResponse.pagination,
      });

      const result = await service.findAll('user123', filters);

      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith('transaction_scope', [
        TransactionScope.INTERNAL,
        TransactionScope.EXTERNAL,
      ]);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('selectAndFlattenFields', () => {
    it('should correctly flatten nested objects with custom names', async () => {
      const mockPaginatedResponse = {
        transactions: [
          {
            id: 'tx-1',
            user_id: 'user-123',
            asset: 'USD',
            amount: 1000,
            transaction_type: 'deposit',
            status: TransactionStatus.COMPLETED,
            category: TransactionCategory.FIAT,
            transaction_scope: TransactionScope.EXTERNAL,
            created_at: '2025-01-01T12:00:00Z',
            updated_at: '2025-01-01T12:00:00Z',
            fiatWalletTransaction: {
              provider_fee: 100,
              source: 'Bank Account',
              destination: 'Wallet',
              externalAccount: {
                bank_name: 'Chase',
                account_number: '****1234',
                account_name: 'John Doe',
              },
            },
            metadata: JSON.stringify({
              recipient_user_id: 'recipient-123',
              recipient_username: 'jane',
            }),
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue(mockPaginatedResponse);

      jest.spyOn(UserProfileModel, 'query').mockReturnValue({
        whereIn: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockResolvedValue([]),
      } as any);

      const result = await service.findAll('user123');

      expect(result.transactions[0]).toHaveProperty('id', 'tx-1');
      expect(result.transactions[0]).toHaveProperty('provider_fee', 100);
      expect(result.transactions[0]).toHaveProperty('source', 'Bank Account');
      expect(result.transactions[0]).toHaveProperty('bank_name', 'Chase');
    });

    it('should handle missing nested properties gracefully', async () => {
      const mockPaginatedResponse = {
        transactions: [
          {
            id: 'tx-1',
            user_id: 'user-123',
            asset: 'USD',
            amount: 1000,
            transaction_type: 'deposit',
            status: TransactionStatus.COMPLETED,
            category: TransactionCategory.FIAT,
            transaction_scope: TransactionScope.INTERNAL,
            created_at: '2025-01-01T12:00:00Z',
            updated_at: '2025-01-01T12:00:00Z',
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue(mockPaginatedResponse);

      const result = await service.findAll('user123');

      expect(result.transactions[0]).toHaveProperty('id', 'tx-1');
      expect(result.transactions[0]).not.toHaveProperty('bank_name');
      expect(result.transactions[0]).not.toHaveProperty('provider_fee');
    });

    it('should handle invalid JSON metadata gracefully', async () => {
      const mockPaginatedResponse = {
        transactions: [
          {
            id: 'tx-1',
            user_id: 'user-123',
            asset: 'USD',
            amount: 1000,
            transaction_type: 'deposit',
            status: TransactionStatus.COMPLETED,
            category: TransactionCategory.FIAT,
            transaction_scope: TransactionScope.INTERNAL,
            created_at: '2025-01-01T12:00:00Z',
            updated_at: '2025-01-01T12:00:00Z',
            metadata: 'invalid-json',
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue(mockPaginatedResponse);

      const result = await service.findAll('user123');

      expect(result.transactions[0]).toHaveProperty('id', 'tx-1');
      expect(result.transactions[0]).not.toHaveProperty('recipient_user_id');
    });

    it('should include virtual account info only for NGN external deposits', async () => {
      const mockPaginatedResponse = {
        transactions: [
          {
            id: 'tx-1',
            user_id: 'user-123',
            asset: 'NGN',
            amount: 1000,
            transaction_type: 'deposit',
            status: TransactionStatus.COMPLETED,
            category: TransactionCategory.FIAT,
            transaction_scope: 'external',
            created_at: '2025-01-01T12:00:00Z',
            updated_at: '2025-01-01T12:00:00Z',
            fiatWalletTransaction: {
              virtualAccount: {
                bank_name: 'Providus Bank',
                account_number: '0123456789',
                account_name: 'John Doe',
              },
            },
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue(mockPaginatedResponse);

      const result = await service.findAll('user123');

      expect(result.transactions[0]).toHaveProperty('virtual_bank_name', 'Providus Bank');
      expect(result.transactions[0]).toHaveProperty('virtual_account_number', '0123456789');
    });

    it('should not include virtual account info for non-NGN deposits', async () => {
      const mockPaginatedResponse = {
        transactions: [
          {
            id: 'tx-1',
            user_id: 'user-123',
            asset: 'USD',
            amount: 1000,
            transaction_type: 'deposit',
            status: TransactionStatus.COMPLETED,
            category: TransactionCategory.FIAT,
            transaction_scope: 'external',
            created_at: '2025-01-01T12:00:00Z',
            updated_at: '2025-01-01T12:00:00Z',
            fiatWalletTransaction: {
              virtualAccount: {
                bank_name: 'Some Bank',
                account_number: '0123456789',
                account_name: 'John Doe',
              },
            },
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue(mockPaginatedResponse);

      const result = await service.findAll('user123');

      expect(result.transactions[0]).not.toHaveProperty('virtual_bank_name');
      expect(result.transactions[0]).not.toHaveProperty('virtual_account_number');
    });
  });

  describe('edge cases', () => {
    it('should handle empty paginated result gracefully', async () => {
      const mockPaginatedResponse = {
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 0,
          total: 0,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue(mockPaginatedResponse);

      const result = await service.findAll('user123');

      expect(result).toEqual(mockPaginatedResponse);
    });
  });

  describe('findAll with unique_beneficiary filter', () => {
    it('should apply unique_beneficiary filter when true', async () => {
      const filters = {
        unique_beneficiary: true,
      };

      const expectedResponse = {
        transactions: [
          {
            id: 'tx-1',
            status: TransactionStatus.COMPLETED,
            transaction_type: TransactionType.TRANSFER_OUT,
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue({
        transactions: expectedResponse.transactions,
        pagination: expectedResponse.pagination,
      });

      const result = await service.findAll('user123', filters);

      expect(mockTransactionRepository.model.knex).toHaveBeenCalled();
      expect(mockQueryBuilder.whereIn).toHaveBeenCalled();
      expect(result).toEqual(expectedResponse);
    });

    it('should not apply unique_beneficiary filter when false', async () => {
      const filters = {
        unique_beneficiary: false,
      };

      const expectedResponse = {
        transactions: [
          {
            id: 'tx-1',
            status: TransactionStatus.COMPLETED,
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue({
        transactions: expectedResponse.transactions,
        pagination: expectedResponse.pagination,
      });

      const result = await service.findAll('user123', filters);

      expect(result).toEqual(expectedResponse);
    });
  });

  describe('terminal status transitions', () => {
    it('should not update when transitioning from COMPLETED to another status', async () => {
      const completedTransaction = {
        id: 'tx-1',
        reference: 'TX123',
        status: TransactionStatus.COMPLETED,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'deposit',
      };

      mockTransactionRepository.findById.mockResolvedValue(completedTransaction);

      const result = await service.updateStatus('tx-1', TransactionStatus.FAILED);

      expect(mockTransactionRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual(completedTransaction);
    });

    it('should not update when transitioning from FAILED to another status', async () => {
      const failedTransaction = {
        id: 'tx-1',
        reference: 'TX123',
        status: TransactionStatus.FAILED,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'deposit',
      };

      mockTransactionRepository.findById.mockResolvedValue(failedTransaction);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockTransactionRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual(failedTransaction);
    });

    it('should not update when transitioning from CANCELLED to another status', async () => {
      const cancelledTransaction = {
        id: 'tx-1',
        reference: 'TX123',
        status: TransactionStatus.CANCELLED,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'deposit',
      };

      mockTransactionRepository.findById.mockResolvedValue(cancelledTransaction);

      const result = await service.updateStatus('tx-1', TransactionStatus.PROCESSING);

      expect(mockTransactionRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual(cancelledTransaction);
    });

    it('should allow updating to same terminal status', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const completedTransaction = {
        id: 'tx-1',
        reference: 'TX123',
        status: TransactionStatus.COMPLETED,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'deposit',
      };

      mockTransactionRepository.findById.mockResolvedValue(completedTransaction);
      mockTransactionRepository.update.mockResolvedValue(completedTransaction);

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockTransactionRepository.update).toHaveBeenCalled();
      expect(mockInAppNotificationService.createNotification).not.toHaveBeenCalled();
      expect(result).toEqual(completedTransaction);
    });
  });

  describe('updateStatus throws NotFoundException', () => {
    it('should throw NotFoundException when transaction not found', async () => {
      mockTransactionRepository.findById.mockResolvedValue(null);

      await expect(service.updateStatus('non-existent', TransactionStatus.COMPLETED)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('metadata object parsing', () => {
    it('should handle metadata as object (not string)', async () => {
      const mockPaginatedResponse = {
        transactions: [
          {
            id: 'tx-1',
            user_id: 'user-123',
            asset: 'USD',
            amount: 1000,
            transaction_type: 'deposit',
            status: TransactionStatus.COMPLETED,
            category: TransactionCategory.FIAT,
            transaction_scope: TransactionScope.INTERNAL,
            created_at: '2025-01-01T12:00:00Z',
            updated_at: '2025-01-01T12:00:00Z',
            metadata: {
              recipient_user_id: 'recipient-123',
              recipient_username: 'jane',
            },
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue(mockPaginatedResponse);

      jest.spyOn(UserProfileModel, 'query').mockReturnValue({
        whereIn: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockResolvedValue([]),
      } as any);

      const result = await service.findAll('user123');

      expect(result.transactions[0]).toHaveProperty('recipient_user_id', 'recipient-123');
      expect(result.transactions[0]).toHaveProperty('recipient_username', 'jane');
    });
  });

  describe('create with optional parameters', () => {
    it('should create transaction with all optional parameters', async () => {
      const transactionData: CreateTransactionDto = {
        reference: 'TX123',
        asset: 'USD',
        amount: 1000,
        balance_before: 2000,
        balance_after: 3000,
        transaction_type: TransactionType.DEPOSIT,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
        status: TransactionStatus.PENDING,
        metadata: { provider: 'test' },
        external_reference: 'EXT-123',
        description: 'Test transaction',
        parent_transaction_id: 'parent-tx-1',
      };

      const expectedTransaction = { ...transactionData, id: 'tx-1' };
      mockTransactionRepository.create.mockResolvedValue(expectedTransaction);

      const result = await service.create('user123', transactionData);

      expect(mockTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { provider: 'test' },
          external_reference: 'EXT-123',
          description: 'Test transaction',
          parent_transaction_id: 'parent-tx-1',
        }),
        undefined,
      );
      expect(result).toEqual(expectedTransaction);
    });

    it('should create transaction with database transaction context', async () => {
      const transactionData: CreateTransactionDto = {
        reference: 'TX123',
        asset: 'USD',
        amount: 1000,
        balance_before: 2000,
        balance_after: 3000,
        transaction_type: TransactionType.DEPOSIT,
        category: TransactionCategory.FIAT,
        transaction_scope: TransactionScope.INTERNAL,
      };

      const mockTrx = {} as any;
      const expectedTransaction = { ...transactionData, id: 'tx-1' };
      mockTransactionRepository.create.mockResolvedValue(expectedTransaction);

      const result = await service.create('user123', transactionData, mockTrx);

      expect(mockTransactionRepository.create).toHaveBeenCalledWith(expect.any(Object), mockTrx);
      expect(result).toEqual(expectedTransaction);
    });
  });

  describe('updateStatus with transaction context', () => {
    it('should pass transaction context to repository methods', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const mockTrx = {} as any;
      const mockTransaction = {
        id: 'tx-1',
        reference: 'TX123',
        status: TransactionStatus.PENDING,
        user_id: 'user-123',
        amount: '1000',
        asset: 'NGN',
        transaction_type: 'deposit',
      };

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.PROCESSING,
        processed_at: now,
      };

      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);

      await service.updateStatus('tx-1', TransactionStatus.PROCESSING, undefined, mockTrx);

      expect(mockTransactionRepository.findById).toHaveBeenCalledWith('tx-1', '[user]', mockTrx);
      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        'tx-1',
        expect.objectContaining({ status: TransactionStatus.PROCESSING }),
        { trx: mockTrx },
      );
    });
  });

  describe('transfer_out email notification with all metadata fields', () => {
    const mockTransaction = {
      id: 'tx-1',
      reference: 'TX123',
      status: TransactionStatus.PENDING,
    };

    beforeEach(() => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
    });

    it('should send transfer email with all metadata fields', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '5000',
        asset: 'USD',
        transaction_type: 'transfer_out',
        external_reference: 'PROV-REF-123',
      };

      const metadata = {
        recipient: 'Jane Doe',
        description: 'Payment for invoice #123',
        provider_fee: 250,
        sender_name: 'John Smith',
        recipient_name: 'Jane Doe',
        recipient_location: 'New York, USA',
        participant_code: 'PART-456',
      };

      const mockUser = {
        id: 'user-123',
        email: 'john@example.com',
        first_name: 'John',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Funds Sent Successfully',
        message: 'You sent 50.00 USD to Jane Doe successfully.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserService.findByUserId.mockResolvedValue(mockUser);
      mockUserProfileService.findByUserId.mockResolvedValue({ notification_token: null });

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED, metadata);

      expect(mockUserService.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockMailerService.send).toHaveBeenCalled();
    });

    it('should handle transfer email without provider_fee', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '5000',
        asset: 'USD',
        transaction_type: 'transfer_out',
      };

      const metadata = {
        recipient: 'Jane Doe',
        description: 'Payment',
      };

      const mockUser = {
        id: 'user-123',
        email: 'john@example.com',
        first_name: 'John',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Funds Sent Successfully',
        message: 'You sent 50.00 USD to Jane Doe successfully.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserService.findByUserId.mockResolvedValue(mockUser);
      mockUserProfileService.findByUserId.mockResolvedValue({ notification_token: null });

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED, metadata);

      expect(mockMailerService.send).toHaveBeenCalled();
    });
  });

  describe('transfer_in email notification with all metadata fields', () => {
    const mockTransaction = {
      id: 'tx-1',
      reference: 'TX123',
      status: TransactionStatus.PENDING,
    };

    beforeEach(() => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
    });

    it('should send funds received email with all metadata fields', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '3000',
        asset: 'USD',
        transaction_type: 'transfer_in',
        external_reference: 'RECV-REF-456',
      };

      const metadata = {
        sender_name: 'Alice Johnson',
        description: 'Refund for order #789',
        participant_code: 'PART-789',
        recipient_name: 'Bob Williams',
        recipient_location: 'Los Angeles, USA',
        provider_fee: 100,
      };

      const mockUser = {
        id: 'user-123',
        email: 'bob@example.com',
        first_name: 'Bob',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Funds Received',
        message: 'You received 30.00 USD from Alice Johnson.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserService.findByUserId.mockResolvedValue(mockUser);
      mockUserProfileService.findByUserId.mockResolvedValue({ notification_token: null });

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED, metadata);

      expect(mockUserService.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockMailerService.send).toHaveBeenCalled();
    });
  });

  describe('deposit email notification with all metadata fields', () => {
    const mockTransaction = {
      id: 'tx-1',
      reference: 'TX123',
      status: TransactionStatus.PENDING,
    };

    beforeEach(() => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
    });

    it('should send deposit email with all metadata fields', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '10000',
        asset: 'USD',
        transaction_type: 'deposit',
        balance_after: '15000',
        external_reference: 'DEP-REF-123',
      };

      const metadata = {
        description: 'Wire transfer deposit',
        source: 'Wells Fargo ****5678',
        participant_code: 'PART-001',
        provider_fee: 500,
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        first_name: 'Test',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message: 'Your deposit of 100.00 USD has been processed.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserService.findByUserId.mockResolvedValue(mockUser);
      mockUserProfileService.findByUserId.mockResolvedValue({ notification_token: null });

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED, metadata);

      expect(mockUserService.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockMailerService.send).toHaveBeenCalled();
    });
  });

  describe('withdrawal email notification with all metadata fields', () => {
    const mockTransaction = {
      id: 'tx-1',
      reference: 'TX123',
      status: TransactionStatus.PENDING,
    };

    beforeEach(() => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
    });

    it('should send withdrawal email with all metadata fields', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '7500',
        asset: 'USD',
        transaction_type: 'withdrawal',
        external_reference: 'WD-REF-789',
      };

      const metadata = {
        description: 'Bank withdrawal',
        destination: 'Bank of America ****4321',
        participant_code: 'PART-002',
        provider_fee: 300,
      };

      const mockUser = {
        id: 'user-123',
        email: 'withdraw@example.com',
        first_name: 'Withdraw',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Withdrawal Successful',
        message: 'Your withdrawal of 75.00 USD has been processed.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserService.findByUserId.mockResolvedValue(mockUser);
      mockUserProfileService.findByUserId.mockResolvedValue({ notification_token: null });

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED, metadata);

      expect(mockUserService.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockMailerService.send).toHaveBeenCalled();
    });
  });

  describe('selectAndFlattenFields edge cases', () => {
    it('should handle nested field with custom name when path exists', async () => {
      const mockPaginatedResponse = {
        transactions: [
          {
            id: 'tx-1',
            user_id: 'user-123',
            asset: 'USD',
            amount: 1000,
            transaction_type: 'transfer_out',
            status: TransactionStatus.COMPLETED,
            category: TransactionCategory.FIAT,
            transaction_scope: TransactionScope.EXTERNAL,
            created_at: '2025-01-01T12:00:00Z',
            updated_at: '2025-01-01T12:00:00Z',
            fiatWalletTransaction: {
              provider_fee: 50,
              source: 'USD Wallet',
              destination: 'Bank Account',
              externalAccount: {
                bank_name: 'Chase Bank',
                account_number: '****9876',
                account_name: 'John Doe',
                routing_number: '021000021',
                bank_ref: 'CHASE-001',
                account_type: 'checking',
                nuban: null,
                swift_code: 'CHASUS33',
                expiration_date: null,
              },
            },
            metadata: JSON.stringify({
              recipient_user_id: null,
              recipient_username: null,
              destination_bank: 'Chase Bank',
              destination_name: 'Jane Smith',
              destination_account_number: '****5432',
              destination_bank_code: '021000021',
              destination_bank_ref: 'CHASE-002',
              recipient_first_name: 'Jane',
              recipient_last_name: 'Smith',
              sender_user_id: 'user-123',
              sender_username: 'johnd',
              sender_first_name: 'John',
              sender_last_name: 'Doe',
            }),
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue(mockPaginatedResponse);

      const result = await service.findAll('user123');

      expect(result.transactions[0]).toHaveProperty('bank_name', 'Chase Bank');
      expect(result.transactions[0]).toHaveProperty('account_number', '****9876');
      expect(result.transactions[0]).toHaveProperty('routing_number', '021000021');
      expect(result.transactions[0]).toHaveProperty('destination_bank', 'Chase Bank');
      expect(result.transactions[0]).toHaveProperty('destination_name', 'Jane Smith');
      expect(result.transactions[0]).toHaveProperty('sender_first_name', 'John');
    });
  });

  describe('findAll with only start_date filter', () => {
    it('should apply only start_date filter when end_date not provided', async () => {
      const filters = {
        start_date: '2025-01-01',
      };

      const expectedResponse = {
        transactions: [
          {
            id: 'tx-1',
            status: TransactionStatus.COMPLETED,
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue({
        transactions: expectedResponse.transactions,
        pagination: expectedResponse.pagination,
      });

      const result = await service.findAll('user123', filters);

      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('findAll with only end_date filter', () => {
    it('should apply only end_date filter when start_date not provided', async () => {
      const filters = {
        end_date: '2025-12-31',
      };

      const expectedResponse = {
        transactions: [
          {
            id: 'tx-1',
            status: TransactionStatus.COMPLETED,
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      mockTransactionRepository.paginateData.mockResolvedValue({
        transactions: expectedResponse.transactions,
        pagination: expectedResponse.pagination,
      });

      const result = await service.findAll('user123', filters);

      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('findAll with recipient avatar URLs', () => {
    const mockUserProfileModelQuery = {
      whereIn: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockResolvedValue([]),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should populate recipient avatar URLs for internal transfers', async () => {
      const mockPaginatedResponse = {
        transactions: [
          {
            id: 'tx-1',
            transaction_type: TransactionType.TRANSFER_OUT,
            transaction_scope: TransactionScope.INTERNAL,
            status: TransactionStatus.COMPLETED,
            metadata: {
              recipient_user_id: 'recipient-user-1',
              recipient_username: 'johndoe',
              recipient_first_name: 'John',
              recipient_last_name: 'Doe',
            },
          },
          {
            id: 'tx-2',
            transaction_type: TransactionType.TRANSFER_OUT,
            transaction_scope: TransactionScope.INTERNAL,
            status: TransactionStatus.COMPLETED,
            metadata: {
              recipient_user_id: 'recipient-user-2',
              recipient_username: 'janedoe',
              recipient_first_name: 'Jane',
              recipient_last_name: 'Doe',
            },
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 2,
        },
      };

      const mockProfiles = [
        { user_id: 'recipient-user-1', image_key: 'profile-images/user1.jpg', avatar_url: null },
        { user_id: 'recipient-user-2', image_key: 'profile-images/user2.jpg', avatar_url: null },
      ];

      // Mock UserProfileModel.query()
      jest.spyOn(UserProfileModel, 'query').mockReturnValue({
        whereIn: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockResolvedValue(mockProfiles),
      } as any);

      mockUserProfileService.populateAvatarUrl.mockImplementation(async (profile) => {
        profile.avatar_url = `https://s3.amazonaws.com/signed-url/${profile.user_id}`;
        return profile;
      });

      mockTransactionRepository.paginateData.mockResolvedValue(mockPaginatedResponse);

      const result = await service.findAll('user123', {
        transaction_type: [TransactionType.TRANSFER_OUT],
        transaction_scope: [TransactionScope.INTERNAL],
        unique_beneficiary: true,
      });

      expect(UserProfileModel.query).toHaveBeenCalled();
      expect(mockUserProfileService.populateAvatarUrl).toHaveBeenCalledTimes(2);
      expect(result.transactions[0].recipient_avatar_url).toBe('https://s3.amazonaws.com/signed-url/recipient-user-1');
      expect(result.transactions[1].recipient_avatar_url).toBe('https://s3.amazonaws.com/signed-url/recipient-user-2');
    });

    it('should handle transactions without recipient_user_id gracefully', async () => {
      const mockPaginatedResponse = {
        transactions: [
          {
            id: 'tx-1',
            transaction_type: TransactionType.WITHDRAWAL,
            transaction_scope: TransactionScope.EXTERNAL,
            status: TransactionStatus.COMPLETED,
            metadata: {
              destination_bank: 'Chase',
              destination_account_number: '****1234',
            },
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      jest.spyOn(UserProfileModel, 'query').mockReturnValue(mockUserProfileModelQuery as any);

      mockTransactionRepository.paginateData.mockResolvedValue(mockPaginatedResponse);

      const result = await service.findAll('user123', {
        transaction_type: [TransactionType.WITHDRAWAL],
      });

      // Should not call populateAvatarUrl since there are no recipient_user_ids
      expect(mockUserProfileService.populateAvatarUrl).not.toHaveBeenCalled();
      expect(result.transactions[0].recipient_avatar_url).toBeUndefined();
    });

    it('should set recipient_avatar_url to null when user has no profile image', async () => {
      const mockPaginatedResponse = {
        transactions: [
          {
            id: 'tx-1',
            transaction_type: TransactionType.TRANSFER_OUT,
            transaction_scope: TransactionScope.INTERNAL,
            status: TransactionStatus.COMPLETED,
            metadata: {
              recipient_user_id: 'recipient-user-1',
              recipient_username: 'johndoe',
            },
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 1,
        },
      };

      // Return empty array - user has no profile image
      jest.spyOn(UserProfileModel, 'query').mockReturnValue({
        whereIn: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockResolvedValue([]),
      } as any);

      mockTransactionRepository.paginateData.mockResolvedValue(mockPaginatedResponse);

      const result = await service.findAll('user123', {
        transaction_type: [TransactionType.TRANSFER_OUT],
      });

      expect(mockUserProfileService.populateAvatarUrl).not.toHaveBeenCalled();
      expect(result.transactions[0].recipient_avatar_url).toBeNull();
    });

    it('should deduplicate recipient user IDs when fetching profiles', async () => {
      const mockPaginatedResponse = {
        transactions: [
          {
            id: 'tx-1',
            transaction_type: TransactionType.TRANSFER_OUT,
            status: TransactionStatus.COMPLETED,
            metadata: { recipient_user_id: 'same-user' },
          },
          {
            id: 'tx-2',
            transaction_type: TransactionType.TRANSFER_OUT,
            status: TransactionStatus.COMPLETED,
            metadata: { recipient_user_id: 'same-user' },
          },
          {
            id: 'tx-3',
            transaction_type: TransactionType.TRANSFER_OUT,
            status: TransactionStatus.COMPLETED,
            metadata: { recipient_user_id: 'same-user' },
          },
        ],
        pagination: {
          current_page: 1,
          next_page: 0,
          previous_page: 0,
          limit: 10,
          page_count: 1,
          total: 3,
        },
      };

      const mockProfiles = [{ user_id: 'same-user', image_key: 'profile.jpg', avatar_url: null }];

      const mockQuery = {
        whereIn: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockResolvedValue(mockProfiles),
      };
      jest.spyOn(UserProfileModel, 'query').mockReturnValue(mockQuery as any);

      mockUserProfileService.populateAvatarUrl.mockImplementation(async (profile) => {
        profile.avatar_url = 'https://s3.amazonaws.com/signed-url';
        return profile;
      });

      mockTransactionRepository.paginateData.mockResolvedValue(mockPaginatedResponse);

      const result = await service.findAll('user123');

      // Should only fetch once for the unique user
      expect(mockQuery.whereIn).toHaveBeenCalledWith('user_id', ['same-user']);
      expect(mockUserProfileService.populateAvatarUrl).toHaveBeenCalledTimes(1);

      // All transactions should have the same avatar URL
      result.transactions.forEach((tx) => {
        expect(tx.recipient_avatar_url).toBe('https://s3.amazonaws.com/signed-url');
      });
    });
  });

  describe('amount formatting edge cases', () => {
    const mockTransaction = {
      id: 'tx-1',
      reference: 'TX123',
      status: TransactionStatus.PENDING,
    };

    beforeEach(() => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
    });

    it('should handle null amount formatting gracefully', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: null,
        asset: 'USD',
        transaction_type: 'deposit',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message: 'Your deposit has been processed.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserProfileService.findByUserId.mockResolvedValue({ notification_token: null });

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockInAppNotificationService.createNotification).toHaveBeenCalled();
      expect(result).toEqual(updatedTransaction);
    });

    it('should handle unknown asset formatting', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000000',
        asset: 'UNKNOWN_ASSET',
        transaction_type: 'deposit',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message: 'Your deposit has been processed.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserProfileService.findByUserId.mockResolvedValue({ notification_token: null });

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockInAppNotificationService.createNotification).toHaveBeenCalled();
      expect(result).toEqual(updatedTransaction);
    });
  });

  describe('notification options', () => {
    const mockTransaction = {
      id: 'tx-1',
      reference: 'TX123',
      status: TransactionStatus.PENDING,
    };

    beforeEach(() => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
    });

    it('should not send in-app notification when shouldSendInAppNotification is false', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'NGN',
        transaction_type: 'deposit',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message: 'Your deposit has been processed.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserProfileService.findByUserId.mockResolvedValue({ notification_token: 'token-123' });

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED, undefined, undefined, {
        shouldSendInAppNotification: false,
        shouldSendEmail: true,
        shouldSendPushNotification: true,
      });

      expect(mockInAppNotificationService.createNotification).not.toHaveBeenCalled();
      expect(mockPushNotificationService.sendPushNotification).toHaveBeenCalled();
    });

    it('should not send push notification when shouldSendPushNotification is false', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'NGN',
        transaction_type: 'deposit',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message: 'Your deposit has been processed.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserProfileService.findByUserId.mockResolvedValue({ notification_token: 'token-123' });

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED, undefined, undefined, {
        shouldSendInAppNotification: true,
        shouldSendEmail: true,
        shouldSendPushNotification: false,
      });

      expect(mockInAppNotificationService.createNotification).toHaveBeenCalled();
      expect(mockPushNotificationService.sendPushNotification).not.toHaveBeenCalled();
    });

    it('should not send email notification when shouldSendEmail is false', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'deposit',
        balance_after: '3000',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message: 'Your deposit has been processed.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserProfileService.findByUserId.mockResolvedValue({ notification_token: 'token-123' });

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED, undefined, undefined, {
        shouldSendInAppNotification: true,
        shouldSendEmail: false,
        shouldSendPushNotification: true,
      });

      expect(mockInAppNotificationService.createNotification).toHaveBeenCalled();
      expect(mockPushNotificationService.sendPushNotification).toHaveBeenCalled();
      expect(mockUserService.findByUserId).not.toHaveBeenCalled();
      expect(mockMailerService.send).not.toHaveBeenCalled();
    });

    it('should not send any notifications when all options are false', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'deposit',
        balance_after: '3000',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message: 'Your deposit has been processed.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED, undefined, undefined, {
        shouldSendInAppNotification: false,
        shouldSendEmail: false,
        shouldSendPushNotification: false,
      });

      expect(mockInAppNotificationService.createNotification).not.toHaveBeenCalled();
      expect(mockPushNotificationService.sendPushNotification).not.toHaveBeenCalled();
      expect(mockUserService.findByUserId).not.toHaveBeenCalled();
      expect(mockMailerService.send).not.toHaveBeenCalled();
    });

    it('should send all notifications by default when notificationOptions is not provided', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'USD',
        transaction_type: 'deposit',
        balance_after: '3000',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'John',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message: 'Your deposit has been processed.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserProfileService.findByUserId.mockResolvedValue({ notification_token: 'token-123' });
      mockUserService.findByUserId.mockResolvedValue(mockUser);

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockInAppNotificationService.createNotification).toHaveBeenCalled();
      expect(mockPushNotificationService.sendPushNotification).toHaveBeenCalled();
      expect(mockUserService.findByUserId).toHaveBeenCalled();
      expect(mockMailerService.send).toHaveBeenCalled();
    });
  });

  describe('push notification edge cases', () => {
    const mockTransaction = {
      id: 'tx-1',
      reference: 'TX123',
      status: TransactionStatus.PENDING,
    };

    beforeEach(() => {
      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
    });

    it('should handle undefined user profile gracefully', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'NGN',
        transaction_type: 'deposit',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message: 'Your deposit has been processed.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserProfileService.findByUserId.mockResolvedValue(undefined);

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockPushNotificationService.sendPushNotification).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('No notification token found'));
    });

    it('should handle push notification service failure gracefully', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const updatedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.COMPLETED,
        completed_at: now,
        user_id: 'user-123',
        amount: '1000',
        asset: 'NGN',
        transaction_type: 'deposit',
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Deposit Successful',
        message: 'Your deposit has been processed.',
      };

      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockUserProfileService.findByUserId.mockResolvedValue({
        notification_token: 'token-123',
      });
      mockPushNotificationService.sendPushNotification.mockRejectedValue(new Error('Push service unavailable'));

      const loggerSpy = jest.spyOn(service['logger'], 'error');

      const result = await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(loggerSpy).toHaveBeenCalled();
      expect(result).toEqual(updatedTransaction);
    });
  });

  describe('completeExchangeTransaction', () => {
    it('should complete exchange transaction successfully', async () => {
      const mockTransaction = {
        id: 'tx-exchange-1',
        user_id: 'user-123',
        amount: 50000,
        asset: 'USD',
        transaction_type: TransactionType.EXCHANGE,
        status: TransactionStatus.PROCESSING,
        parent_transaction_id: 'tx-parent-1',
        reference: 'EX-REF-123',
        description: 'Exchange NGN to USD',
        created_at: new Date(),
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'tx-exchange-1',
        fiat_wallet_id: 'wallet-123',
        amount: 50000,
        currency: 'USD',
      };

      const mockParentTransaction = {
        id: 'tx-parent-1',
        user_id: 'user-123',
        amount: 100000,
        asset: 'NGN',
        metadata: {
          from: 'NGN',
          to: 'USD',
          rate: 800,
          usd_fee: 100,
        },
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
        country: { name: 'Nigeria' },
      };

      const mockTrx = {} as any;

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(mockParentTransaction);
      mockUserService.findByUserId.mockResolvedValue(mockUser);
      mockTransactionRepository.transaction = jest.fn((callback) => callback(mockTrx));
      mockFiatWalletService.updateBalance.mockResolvedValue(undefined);
      mockTransactionRepository.update.mockResolvedValue({ ...mockTransaction, status: TransactionStatus.COMPLETED });
      mockMailerService.send.mockResolvedValue(undefined);

      await service.completeExchangeTransaction(mockTransaction as any, 50000);

      expect(mockFiatWalletTransactionService.findOne).toHaveBeenCalledWith({ transaction_id: 'tx-exchange-1' });
      expect(mockTransactionRepository.findOne).toHaveBeenCalledWith({ id: 'tx-parent-1' });
      expect(mockUserService.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockFiatWalletService.updateBalance).toHaveBeenCalled();
      expect(mockMailerService.send).toHaveBeenCalled();
    });

    it('should log warning and return early when fiat wallet transaction not found', async () => {
      const mockTransaction = {
        id: 'tx-exchange-1',
        user_id: 'user-123',
        amount: 50000,
        asset: 'USD',
        transaction_type: TransactionType.EXCHANGE,
        status: TransactionStatus.PROCESSING,
        parent_transaction_id: 'tx-parent-1',
      };

      mockFiatWalletTransactionService.findOne.mockResolvedValue(null);

      const loggerSpy = jest.spyOn(service['logger'], 'warn');

      await service.completeExchangeTransaction(mockTransaction as any, 50000);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('No fiat wallet transaction found for transaction'),
      );
      expect(mockTransactionRepository.findOne).not.toHaveBeenCalled();
      expect(mockFiatWalletService.updateBalance).not.toHaveBeenCalled();
    });

    it('should log warning when parent transaction not found', async () => {
      const mockTransaction = {
        id: 'tx-exchange-1',
        user_id: 'user-123',
        amount: 50000,
        asset: 'USD',
        transaction_type: TransactionType.EXCHANGE,
        status: TransactionStatus.PROCESSING,
        parent_transaction_id: 'tx-parent-1',
        reference: 'EX-REF-123',
        description: 'Exchange NGN to USD',
        created_at: new Date(),
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'tx-exchange-1',
        fiat_wallet_id: 'wallet-123',
        amount: 50000,
        currency: 'USD',
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
        country: { name: 'Nigeria' },
      };

      const mockTrx = {} as any;

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(null);
      mockUserService.findByUserId.mockResolvedValue(mockUser);
      mockTransactionRepository.transaction = jest.fn((callback) => callback(mockTrx));
      mockFiatWalletService.updateBalance.mockResolvedValue(undefined);
      mockTransactionRepository.update.mockResolvedValue({ ...mockTransaction, status: TransactionStatus.COMPLETED });
      mockMailerService.send.mockResolvedValue(undefined);

      const loggerSpy = jest.spyOn(service['logger'], 'warn');

      // This will throw an error in the actual implementation because formatCurrencyAmountToLocaleString
      // expects a valid currency code, but we're testing that the warning is logged
      await expect(service.completeExchangeTransaction(mockTransaction as any, 50000)).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('No parent transaction found for transaction'));
    });

    it('should complete exchange transaction with custom trx context', async () => {
      const mockTransaction = {
        id: 'tx-exchange-1',
        user_id: 'user-123',
        amount: 50000,
        asset: 'USD',
        transaction_type: TransactionType.EXCHANGE,
        status: TransactionStatus.PROCESSING,
        parent_transaction_id: 'tx-parent-1',
        reference: 'EX-REF-123',
        description: 'Exchange NGN to USD',
        created_at: new Date(),
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'tx-exchange-1',
        fiat_wallet_id: 'wallet-123',
        amount: 50000,
        currency: 'USD',
      };

      const mockParentTransaction = {
        id: 'tx-parent-1',
        user_id: 'user-123',
        amount: 100000,
        asset: 'NGN',
        metadata: {
          from: 'NGN',
          to: 'USD',
          rate: 800,
          usd_fee: 100,
        },
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
        country: { name: 'Nigeria' },
      };

      const customTrx = { custom: 'transaction' } as any;
      const mockInnerTrx = {} as any;

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(mockParentTransaction);
      mockUserService.findByUserId.mockResolvedValue(mockUser);
      mockTransactionRepository.transaction = jest.fn((callback) => callback(mockInnerTrx));
      mockFiatWalletService.updateBalance.mockResolvedValue(undefined);
      mockTransactionRepository.update.mockResolvedValue({ ...mockTransaction, status: TransactionStatus.COMPLETED });
      mockMailerService.send.mockResolvedValue(undefined);

      await service.completeExchangeTransaction(mockTransaction as any, 50000, customTrx);

      expect(mockFiatWalletService.updateBalance).toHaveBeenCalledWith(
        'wallet-123',
        50000,
        'tx-exchange-1',
        expect.any(String),
        TransactionStatus.COMPLETED,
        expect.objectContaining({ fiat_wallet_transaction_id: 'fwt-1' }),
        customTrx,
      );
    });

    it('should handle exchange transaction with null metadata in parent', async () => {
      const mockTransaction = {
        id: 'tx-exchange-1',
        user_id: 'user-123',
        amount: 50000,
        asset: 'USD',
        transaction_type: TransactionType.EXCHANGE,
        status: TransactionStatus.PROCESSING,
        parent_transaction_id: 'tx-parent-1',
        reference: 'EX-REF-123',
        description: 'Exchange NGN to USD',
        created_at: new Date(),
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'tx-exchange-1',
        fiat_wallet_id: 'wallet-123',
        amount: 50000,
        currency: 'USD',
      };

      const mockParentTransaction = {
        id: 'tx-parent-1',
        user_id: 'user-123',
        amount: 100000,
        asset: 'NGN',
        metadata: {
          from: 'NGN',
          to: 'USD',
        },
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
        country: { name: 'Nigeria' },
      };

      const mockTrx = {} as any;

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(mockParentTransaction);
      mockUserService.findByUserId.mockResolvedValue(mockUser);
      mockTransactionRepository.transaction = jest.fn((callback) => callback(mockTrx));
      mockFiatWalletService.updateBalance.mockResolvedValue(undefined);
      mockTransactionRepository.update.mockResolvedValue({ ...mockTransaction, status: TransactionStatus.COMPLETED });
      mockMailerService.send.mockResolvedValue(undefined);

      await service.completeExchangeTransaction(mockTransaction as any, 50000);

      expect(mockFiatWalletService.updateBalance).toHaveBeenCalled();
      expect(mockMailerService.send).toHaveBeenCalled();
    });

    it('should log success message after completing exchange transaction', async () => {
      const mockTransaction = {
        id: 'tx-exchange-1',
        user_id: 'user-123',
        amount: 50000,
        asset: 'USD',
        transaction_type: TransactionType.EXCHANGE,
        status: TransactionStatus.PROCESSING,
        parent_transaction_id: 'tx-parent-1',
        reference: 'EX-REF-123',
        description: 'Exchange NGN to USD',
        created_at: new Date(),
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'tx-exchange-1',
        fiat_wallet_id: 'wallet-123',
        amount: 50000,
        currency: 'USD',
      };

      const mockParentTransaction = {
        id: 'tx-parent-1',
        user_id: 'user-123',
        amount: 100000,
        asset: 'NGN',
        metadata: {
          from: 'NGN',
          to: 'USD',
          rate: 800,
          usd_fee: 100,
        },
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
        country: { name: 'Nigeria' },
      };

      const mockTrx = {} as any;

      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockTransactionRepository.findOne.mockResolvedValue(mockParentTransaction);
      mockUserService.findByUserId.mockResolvedValue(mockUser);
      mockTransactionRepository.transaction = jest.fn((callback) => callback(mockTrx));
      mockFiatWalletService.updateBalance.mockResolvedValue(undefined);
      mockTransactionRepository.update.mockResolvedValue({ ...mockTransaction, status: TransactionStatus.COMPLETED });
      mockMailerService.send.mockResolvedValue(undefined);

      const loggerLogSpy = jest.spyOn(service['logger'], 'log');

      await service.completeExchangeTransaction(mockTransaction as any, 50000);

      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('Completing exchange transaction'));
      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully completed exchange transaction'));
    });
  });

  describe('getParentTransaction', () => {
    it('should return the transaction itself when parent_transaction_id is null', async () => {
      const mockTransaction = {
        id: 'tx-1',
        user_id: 'user-123',
        amount: 1000,
        asset: 'USD',
        parent_transaction_id: null,
      };

      const result = await service['getParentTransaction'](mockTransaction as any);

      expect(result).toEqual(mockTransaction);
      expect(mockTransactionRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return the transaction itself when parent_transaction_id is undefined', async () => {
      const mockTransaction = {
        id: 'tx-1',
        user_id: 'user-123',
        amount: 1000,
        asset: 'USD',
      };

      const result = await service['getParentTransaction'](mockTransaction as any);

      expect(result).toEqual(mockTransaction);
      expect(mockTransactionRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fetch and return parent transaction when parent_transaction_id exists', async () => {
      const mockTransaction = {
        id: 'tx-child-1',
        user_id: 'user-123',
        amount: 1000,
        asset: 'USD',
        parent_transaction_id: 'tx-parent-1',
      };

      const mockParentTransaction = {
        id: 'tx-parent-1',
        user_id: 'user-123',
        amount: 5000,
        asset: 'NGN',
      };

      mockTransactionRepository.findOne.mockResolvedValue(mockParentTransaction);

      const result = await service['getParentTransaction'](mockTransaction as any);

      expect(mockTransactionRepository.findOne).toHaveBeenCalledWith({ id: 'tx-parent-1' });
      expect(result).toEqual(mockParentTransaction);
    });
  });

  describe('sendTransactionEmailNotification - reward type', () => {
    it('should send reward email for completed reward transaction', async () => {
      const mockTransaction = {
        id: 'tx-reward-1',
        user_id: 'user-123',
        amount: 1000,
        asset: 'USD',
        balance_after: 5000,
        transaction_type: TransactionType.REWARD,
        external_reference: 'REWARD-REF-123',
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      const metadata = {
        description: 'Referral reward',
        participant_code: 'PART-123',
      };

      mockUserService.findByUserId.mockResolvedValue(mockUser);
      mockMailerService.send.mockResolvedValue(undefined);

      await service['sendTransactionEmailNotification'](mockTransaction as any, metadata);

      expect(mockUserService.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockMailerService.send).toHaveBeenCalled();
    });
  });

  describe('sendTransactionEmailNotification - non-USD transactions', () => {
    it('should not send email for NGN transactions', async () => {
      const mockTransaction = {
        id: 'tx-1',
        user_id: 'user-123',
        amount: 10000,
        asset: 'NGN',
        transaction_type: TransactionType.DEPOSIT,
      };

      await service['sendTransactionEmailNotification'](mockTransaction as any);

      expect(mockUserService.findByUserId).not.toHaveBeenCalled();
      expect(mockMailerService.send).not.toHaveBeenCalled();
    });

    it('should not send email for GHS transactions', async () => {
      const mockTransaction = {
        id: 'tx-1',
        user_id: 'user-123',
        amount: 10000,
        asset: 'GHS',
        transaction_type: TransactionType.WITHDRAWAL,
      };

      await service['sendTransactionEmailNotification'](mockTransaction as any);

      expect(mockUserService.findByUserId).not.toHaveBeenCalled();
      expect(mockMailerService.send).not.toHaveBeenCalled();
    });
  });

  describe('sendTransactionEmailNotification - unsupported transaction types', () => {
    it('should not send email for exchange transaction type', async () => {
      const mockTransaction = {
        id: 'tx-1',
        user_id: 'user-123',
        amount: 1000,
        asset: 'USD',
        transaction_type: TransactionType.EXCHANGE,
      };

      await service['sendTransactionEmailNotification'](mockTransaction as any);

      expect(mockUserService.findByUserId).not.toHaveBeenCalled();
      expect(mockMailerService.send).not.toHaveBeenCalled();
    });
  });

  describe('sendTransactionEmailNotification - error handling', () => {
    it('should handle email sending errors gracefully without throwing', async () => {
      const mockTransaction = {
        id: 'tx-1',
        user_id: 'user-123',
        amount: 1000,
        asset: 'USD',
        balance_after: 5000,
        transaction_type: TransactionType.DEPOSIT,
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      mockUserService.findByUserId.mockResolvedValue(mockUser);
      mockMailerService.send.mockRejectedValue(new Error('Email service unavailable'));

      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await expect(service['sendTransactionEmailNotification'](mockTransaction as any, {})).resolves.not.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send email notification'),
        expect.any(Error),
      );
    });
  });

  describe('updateStatus - metadata parsing edge cases', () => {
    it('should handle invalid JSON string in metadata and set transactionMetadata to undefined', async () => {
      const existingTransaction = {
        id: 'tx-1',
        user_id: 'user-123',
        amount: 1000,
        asset: 'USD',
        transaction_type: TransactionType.TRANSFER_OUT,
        status: TransactionStatus.PENDING,
        metadata: '{invalid json',
      };

      const updatedTransaction = {
        ...existingTransaction,
        status: TransactionStatus.COMPLETED,
      };

      const mockNotificationConfig = {
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Transfer Successful',
        message: 'Your transfer has been processed.',
      };

      mockTransactionRepository.findById.mockResolvedValue(existingTransaction);
      mockTransactionRepository.update.mockResolvedValue(updatedTransaction);
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue(mockNotificationConfig);
      mockInAppNotificationService.createNotification.mockResolvedValue(undefined);
      mockPushNotificationService.sendPushNotification.mockResolvedValue(undefined);
      mockUserProfileService.findByUserId.mockResolvedValue({ notification_token: 'token-123' });

      await service.updateStatus('tx-1', TransactionStatus.COMPLETED);

      expect(mockInAppNotificationService.createNotification).toHaveBeenCalled();
    });
  });

  describe('sendTransferEmail - USDC normalization', () => {
    it('should normalize USDC to USD for currency formatting', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      const mockTransaction = {
        id: 'tx-1',
        user_id: 'user-123',
        amount: 100000,
        asset: 'USDC',
        transaction_type: TransactionType.TRANSFER_OUT,
        status: TransactionStatus.COMPLETED,
        external_reference: 'EXT-REF-123',
      };

      const metadata = {
        description: 'USDC Transfer',
        recipient: 'Jane Doe',
        provider_fee: 500,
        participant_code: 'PART-123',
        sender_name: 'John Doe',
        recipient_name: 'Jane Doe',
        recipient_location: 'USA',
      };

      mockMailerService.send.mockResolvedValue(undefined);

      await service['sendTransferEmail'](mockUser, 1000, mockTransaction as any, metadata);

      expect(mockMailerService.send).toHaveBeenCalled();
    });
  });

  describe('sendFundsReceivedEmail - logging', () => {
    it('should log when sending funds received email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      const mockTransaction = {
        id: 'tx-1',
        user_id: 'user-123',
        amount: 100000,
        asset: 'USD',
        transaction_type: TransactionType.TRANSFER_IN,
        status: TransactionStatus.COMPLETED,
        external_reference: 'EXT-REF-123',
      };

      const metadata = {
        description: 'USD Transfer',
        sender_name: 'Jane Doe',
        participant_code: 'PART-123',
        recipient_name: 'John Doe',
        recipient_location: 'USA',
        provider_fee: 500,
      };

      mockMailerService.send.mockResolvedValue(undefined);

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service['sendFundsReceivedEmail'](mockUser, 1000, mockTransaction as any, metadata);

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Attempting to send funds received email'));
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Funds received email sent'));
      expect(mockMailerService.send).toHaveBeenCalled();
    });
  });
  describe('updateInReviewTransactionStatus', () => {
    it('should throw NotFoundException when transaction not found', async () => {
      mockTransactionRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateInReviewTransactionStatus('non-existent', {
          transaction_id: 'non-existent',
          status: TransactionStatus.FAILED,
        }),
      ).rejects.toThrow('Failed to update transaction status');
    });

    it('should throw BadRequestException when transaction is not NGN', async () => {
      const mockTransaction = {
        id: 'tx-1',
        asset: 'USD',
        status: TransactionStatus.REVIEW,
      };

      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);

      await expect(
        service.updateInReviewTransactionStatus('tx-1', {
          transaction_id: 'tx-1',
          status: TransactionStatus.FAILED,
        }),
      ).rejects.toThrow('Failed to update transaction status');
    });

    it('should throw BadRequestException when transaction is already completed', async () => {
      const mockTransaction = {
        id: 'tx-1',
        asset: 'NGN',
        status: TransactionStatus.COMPLETED,
      };

      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);

      await expect(
        service.updateInReviewTransactionStatus('tx-1', {
          transaction_id: 'tx-1',
          status: TransactionStatus.FAILED,
        }),
      ).rejects.toThrow('Failed to update transaction status');
    });

    it('should throw BadRequestException when transaction is not in review status', async () => {
      const mockTransaction = {
        id: 'tx-1',
        asset: 'NGN',
        status: TransactionStatus.PENDING,
      };

      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);

      await expect(
        service.updateInReviewTransactionStatus('tx-1', {
          transaction_id: 'tx-1',
          status: TransactionStatus.FAILED,
        }),
      ).rejects.toThrow('Failed to update transaction status');
    });

    it('should throw BadRequestException when status is not FAILED', async () => {
      const mockTransaction = {
        id: 'tx-1',
        asset: 'NGN',
        status: TransactionStatus.REVIEW,
      };

      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);

      await expect(
        service.updateInReviewTransactionStatus('tx-1', {
          transaction_id: 'tx-1',
          status: TransactionStatus.COMPLETED,
        }),
      ).rejects.toThrow('Failed to update transaction status');
    });

    it('should update status to FAILED and create refund transaction when escrow amount > 0', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const mockTransaction = {
        id: 'tx-1',
        user_id: 'user-123',
        asset: 'NGN',
        amount: 100000,
        status: TransactionStatus.REVIEW,
        failure_reason: null,
        metadata: {},
        external_reference: 'EXT-REF-123',
      };

      const mockFiatWalletTransaction = {
        id: 'fwt-1',
        transaction_id: 'tx-1',
        fiat_wallet_id: 'wallet-123',
      };

      const mockFiatWallet = {
        id: 'wallet-123',
        balance: 500000,
      };

      const mockRefundTransaction = {
        id: 'tx-refund-1',
        user_id: 'user-123',
        amount: 100000,
        status: TransactionStatus.PENDING,
      };

      const mockRefundFiatTransaction = {
        id: 'fwt-refund-1',
        transaction_id: 'tx-refund-1',
      };

      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockFiatWalletEscrowService.getEscrowAmount.mockResolvedValue(100000);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => {
        const trx = {};
        return callback(trx);
      });
      mockTransactionRepository.update.mockResolvedValue({ ...mockTransaction, status: TransactionStatus.FAILED });
      mockFiatWalletTransactionService.findOne.mockResolvedValue(mockFiatWalletTransaction);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet);
      mockTransactionRepository.create.mockResolvedValue(mockRefundTransaction);
      mockFiatWalletTransactionService.create.mockResolvedValue(mockRefundFiatTransaction);
      mockFiatWalletService.updateBalance.mockResolvedValue(undefined);
      mockFiatWalletEscrowService.releaseMoneyFromEscrow.mockResolvedValue(undefined);
      mockLockerService.withLock.mockImplementation(async (_key, callback) => callback());
      mockInAppNotificationService.getTransactionNotificationConfig.mockReturnValue({
        type: IN_APP_NOTIFICATION_TYPE.TRANSACTION_SUCCESS,
        title: 'Refund Processed',
        message: 'Your refund has been processed.',
      });
      mockUserProfileService.findByUserId.mockResolvedValue({ notification_token: 'token-123' });

      const result = await service.updateInReviewTransactionStatus('tx-1', {
        transaction_id: 'tx-1',
        status: TransactionStatus.FAILED,
        failure_reason: 'Manual review failed',
      });

      expect(mockFiatWalletEscrowService.getEscrowAmount).toHaveBeenCalledWith('tx-1');
      expect(mockTransactionRepository.transaction).toHaveBeenCalled();
      expect(mockFiatWalletEscrowService.releaseMoneyFromEscrow).toHaveBeenCalledWith('tx-1');
      expect(result).toBeDefined();
    });

    it('should update status to FAILED without creating refund when escrow amount is 0', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const mockTransaction = {
        id: 'tx-1',
        user_id: 'user-123',
        asset: 'NGN',
        amount: 100000,
        status: TransactionStatus.REVIEW,
        failure_reason: 'Previous reason',
      };

      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockFiatWalletEscrowService.getEscrowAmount.mockResolvedValue(0);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => {
        const trx = {};
        return callback(trx);
      });
      mockTransactionRepository.update.mockResolvedValue({ ...mockTransaction, status: TransactionStatus.FAILED });
      mockFiatWalletEscrowService.releaseMoneyFromEscrow.mockResolvedValue(undefined);

      const result = await service.updateInReviewTransactionStatus('tx-1', {
        transaction_id: 'tx-1',
        status: TransactionStatus.FAILED,
      });

      expect(mockFiatWalletEscrowService.getEscrowAmount).toHaveBeenCalledWith('tx-1');
      expect(mockTransactionRepository.create).not.toHaveBeenCalled();
      expect(mockFiatWalletEscrowService.releaseMoneyFromEscrow).toHaveBeenCalledWith('tx-1');
      expect(result).toBeDefined();
    });

    it('should use existing failure_reason when not provided in update data', async () => {
      const now = '2025-01-01 12:00:00';
      jest.spyOn(DateTime, 'now').mockReturnValue({ toSQL: () => now } as any);

      const mockTransaction = {
        id: 'tx-1',
        user_id: 'user-123',
        asset: 'NGN',
        amount: 100000,
        status: TransactionStatus.REVIEW,
        failure_reason: 'Existing reason',
      };

      mockTransactionRepository.findById.mockResolvedValue(mockTransaction);
      mockFiatWalletEscrowService.getEscrowAmount.mockResolvedValue(0);
      mockTransactionRepository.transaction.mockImplementation(async (callback) => {
        const trx = {};
        return callback(trx);
      });
      mockTransactionRepository.update.mockResolvedValue({ ...mockTransaction, status: TransactionStatus.FAILED });
      mockFiatWalletEscrowService.releaseMoneyFromEscrow.mockResolvedValue(undefined);

      await service.updateInReviewTransactionStatus('tx-1', {
        transaction_id: 'tx-1',
        status: TransactionStatus.FAILED,
      });

      expect(mockTransactionRepository.update).toHaveBeenCalledWith(
        'tx-1',
        expect.objectContaining({
          status: TransactionStatus.FAILED,
          failure_reason: 'Existing reason',
        }),
        expect.any(Object),
      );
    });
  });
});

describe('GetTransactionsDto', () => {
  describe('page property', () => {
    it('should default to 1 when not provided', () => {
      const dto = plainToInstance(GetTransactionsDto, {});
      expect(dto.page).toBe(1);
    });

    it('should transform string to number', () => {
      const dto = plainToInstance(GetTransactionsDto, { page: '5' });
      expect(dto.page).toBe(5);
    });

    it('should accept valid page number', async () => {
      const dto = plainToInstance(GetTransactionsDto, { page: 2 });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'page')).toHaveLength(0);
    });

    it('should fail validation for page less than 1', async () => {
      const dto = plainToInstance(GetTransactionsDto, { page: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });
  });

  describe('limit property', () => {
    it('should default to 10 when not provided', () => {
      const dto = plainToInstance(GetTransactionsDto, {});
      expect(dto.limit).toBe(10);
    });

    it('should transform string to number', () => {
      const dto = plainToInstance(GetTransactionsDto, { limit: '20' });
      expect(dto.limit).toBe(20);
    });

    it('should accept valid limit number', async () => {
      const dto = plainToInstance(GetTransactionsDto, { limit: 50 });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'limit')).toHaveLength(0);
    });

    it('should fail validation for limit less than 1', async () => {
      const dto = plainToInstance(GetTransactionsDto, { limit: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });
  });

  describe('user_id property', () => {
    it('should accept valid user_id string', async () => {
      const dto = plainToInstance(GetTransactionsDto, { user_id: '123e4567-e89b-12d3-a456-426614174000' });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'user_id')).toHaveLength(0);
    });

    it('should be optional', async () => {
      const dto = plainToInstance(GetTransactionsDto, {});
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'user_id')).toHaveLength(0);
    });
  });

  describe('asset property', () => {
    it('should accept valid asset string', async () => {
      const dto = plainToInstance(GetTransactionsDto, { asset: 'USD' });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'asset')).toHaveLength(0);
    });

    it('should be optional', async () => {
      const dto = plainToInstance(GetTransactionsDto, {});
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'asset')).toHaveLength(0);
    });
  });

  describe('transaction_type property', () => {
    it('should transform comma-separated string to array', () => {
      const dto = plainToInstance(GetTransactionsDto, { transaction_type: 'deposit,withdrawal' });
      expect(dto.transaction_type).toEqual(['deposit', 'withdrawal']);
    });

    it('should trim whitespace from comma-separated values', () => {
      const dto = plainToInstance(GetTransactionsDto, { transaction_type: 'deposit , withdrawal , transfer' });
      expect(dto.transaction_type).toEqual(['deposit', 'withdrawal', 'transfer']);
    });

    it('should accept array input directly', () => {
      const dto = plainToInstance(GetTransactionsDto, {
        transaction_type: [TransactionType.DEPOSIT, TransactionType.WITHDRAWAL],
      });
      expect(dto.transaction_type).toEqual([TransactionType.DEPOSIT, TransactionType.WITHDRAWAL]);
    });

    it('should validate enum values', async () => {
      const dto = plainToInstance(GetTransactionsDto, { transaction_type: [TransactionType.DEPOSIT] });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'transaction_type')).toHaveLength(0);
    });

    it('should fail validation for invalid enum values', async () => {
      const dto = plainToInstance(GetTransactionsDto, { transaction_type: ['invalid_type'] });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'transaction_type')).toBe(true);
    });

    it('should be optional', async () => {
      const dto = plainToInstance(GetTransactionsDto, {});
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'transaction_type')).toHaveLength(0);
    });
  });

  describe('status property', () => {
    it('should transform comma-separated string to array', () => {
      const dto = plainToInstance(GetTransactionsDto, { status: 'pending,completed' });
      expect(dto.status).toEqual(['pending', 'completed']);
    });

    it('should trim whitespace from comma-separated values', () => {
      const dto = plainToInstance(GetTransactionsDto, { status: 'pending , completed , failed' });
      expect(dto.status).toEqual(['pending', 'completed', 'failed']);
    });

    it('should accept array input directly', () => {
      const dto = plainToInstance(GetTransactionsDto, {
        status: [TransactionStatus.PENDING, TransactionStatus.COMPLETED],
      });
      expect(dto.status).toEqual([TransactionStatus.PENDING, TransactionStatus.COMPLETED]);
    });

    it('should validate enum values', async () => {
      const dto = plainToInstance(GetTransactionsDto, { status: [TransactionStatus.PENDING] });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'status')).toHaveLength(0);
    });

    it('should fail validation for invalid enum values', async () => {
      const dto = plainToInstance(GetTransactionsDto, { status: ['invalid_status'] });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('should be optional', async () => {
      const dto = plainToInstance(GetTransactionsDto, {});
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'status')).toHaveLength(0);
    });
  });

  describe('category property', () => {
    it('should transform comma-separated string to array', () => {
      const dto = plainToInstance(GetTransactionsDto, { category: 'fiat,blockchain' });
      expect(dto.category).toEqual(['fiat', 'blockchain']);
    });

    it('should trim whitespace from comma-separated values', () => {
      const dto = plainToInstance(GetTransactionsDto, { category: 'fiat , blockchain , card' });
      expect(dto.category).toEqual(['fiat', 'blockchain', 'card']);
    });

    it('should accept array input directly', () => {
      const dto = plainToInstance(GetTransactionsDto, {
        category: [TransactionCategory.FIAT, TransactionCategory.BLOCKCHAIN],
      });
      expect(dto.category).toEqual([TransactionCategory.FIAT, TransactionCategory.BLOCKCHAIN]);
    });

    it('should validate enum values', async () => {
      const dto = plainToInstance(GetTransactionsDto, { category: [TransactionCategory.FIAT] });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'category')).toHaveLength(0);
    });

    it('should fail validation for invalid enum values', async () => {
      const dto = plainToInstance(GetTransactionsDto, { category: ['invalid_category'] });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'category')).toBe(true);
    });

    it('should be optional', async () => {
      const dto = plainToInstance(GetTransactionsDto, {});
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'category')).toHaveLength(0);
    });
  });

  describe('transaction_scope property', () => {
    it('should transform comma-separated string to array', () => {
      const dto = plainToInstance(GetTransactionsDto, { transaction_scope: 'internal,external' });
      expect(dto.transaction_scope).toEqual(['internal', 'external']);
    });

    it('should trim whitespace from comma-separated values', () => {
      const dto = plainToInstance(GetTransactionsDto, { transaction_scope: 'internal , external' });
      expect(dto.transaction_scope).toEqual(['internal', 'external']);
    });

    it('should accept array input directly', () => {
      const dto = plainToInstance(GetTransactionsDto, {
        transaction_scope: [TransactionScope.INTERNAL, TransactionScope.EXTERNAL],
      });
      expect(dto.transaction_scope).toEqual([TransactionScope.INTERNAL, TransactionScope.EXTERNAL]);
    });

    it('should validate enum values', async () => {
      const dto = plainToInstance(GetTransactionsDto, { transaction_scope: [TransactionScope.INTERNAL] });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'transaction_scope')).toHaveLength(0);
    });

    it('should fail validation for invalid enum values', async () => {
      const dto = plainToInstance(GetTransactionsDto, { transaction_scope: ['invalid_scope'] });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'transaction_scope')).toBe(true);
    });

    it('should be optional', async () => {
      const dto = plainToInstance(GetTransactionsDto, {});
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'transaction_scope')).toHaveLength(0);
    });
  });

  describe('date filters', () => {
    it('should accept valid start_date string', async () => {
      const dto = plainToInstance(GetTransactionsDto, { start_date: '2025-01-01' });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'start_date')).toHaveLength(0);
      expect(dto.start_date).toBe('2025-01-01');
    });

    it('should accept valid end_date string', async () => {
      const dto = plainToInstance(GetTransactionsDto, { end_date: '2025-12-31' });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'end_date')).toHaveLength(0);
      expect(dto.end_date).toBe('2025-12-31');
    });

    it('should be optional', async () => {
      const dto = plainToInstance(GetTransactionsDto, {});
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'start_date')).toHaveLength(0);
      expect(errors.filter((e) => e.property === 'end_date')).toHaveLength(0);
    });
  });

  describe('search property', () => {
    it('should accept valid search string', async () => {
      const dto = plainToInstance(GetTransactionsDto, { search: 'transfer' });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'search')).toHaveLength(0);
      expect(dto.search).toBe('transfer');
    });

    it('should be optional', async () => {
      const dto = plainToInstance(GetTransactionsDto, {});
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'search')).toHaveLength(0);
    });
  });

  describe('fiat_wallet_id property', () => {
    it('should accept valid fiat_wallet_id string', async () => {
      const dto = plainToInstance(GetTransactionsDto, { fiat_wallet_id: '123e4567-e89b-12d3-a456-426614174000' });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'fiat_wallet_id')).toHaveLength(0);
      expect(dto.fiat_wallet_id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should be optional', async () => {
      const dto = plainToInstance(GetTransactionsDto, {});
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'fiat_wallet_id')).toHaveLength(0);
    });
  });

  describe('unique_beneficiary property', () => {
    it('should transform string "true" to boolean true', () => {
      const dto = plainToInstance(GetTransactionsDto, { unique_beneficiary: 'true' });
      expect(dto.unique_beneficiary).toBe(true);
    });

    it('should transform boolean true to boolean true', () => {
      const dto = plainToInstance(GetTransactionsDto, { unique_beneficiary: true });
      expect(dto.unique_beneficiary).toBe(true);
    });

    it('should transform string "false" to boolean false', () => {
      const dto = plainToInstance(GetTransactionsDto, { unique_beneficiary: 'false' });
      expect(dto.unique_beneficiary).toBe(false);
    });

    it('should transform boolean false to boolean false', () => {
      const dto = plainToInstance(GetTransactionsDto, { unique_beneficiary: false });
      expect(dto.unique_beneficiary).toBe(false);
    });

    it('should accept valid boolean value', async () => {
      const dto = plainToInstance(GetTransactionsDto, { unique_beneficiary: true });
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'unique_beneficiary')).toHaveLength(0);
    });

    it('should be optional', async () => {
      const dto = plainToInstance(GetTransactionsDto, {});
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'unique_beneficiary')).toHaveLength(0);
    });
  });

  describe('combined validation', () => {
    it('should validate a complete valid DTO', async () => {
      const dto = plainToInstance(GetTransactionsDto, {
        page: 1,
        limit: 10,
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        asset: 'USD',
        transaction_type: 'deposit,withdrawal',
        status: 'pending,completed',
        category: 'fiat',
        transaction_scope: 'internal',
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        search: 'test',
        fiat_wallet_id: '123e4567-e89b-12d3-a456-426614174000',
        unique_beneficiary: 'true',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate an empty DTO with defaults', async () => {
      const dto = plainToInstance(GetTransactionsDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(10);
    });
  });
});
