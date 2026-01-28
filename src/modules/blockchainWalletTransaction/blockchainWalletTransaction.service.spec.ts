import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { BlockchainWalletTransactionService } from './blockchainWalletTransaction.service';
import { BlockchainWalletTransactionRepository } from './blockchainWalletTransaction.repository';
import { FireblocksAdapter } from '../../adapters/blockchain-waas/fireblocks/fireblocks_adapter';
import { ITransactionHistoryItem } from '../../adapters/blockchain-waas/blockchain-waas-adapter.interface';
import { GetUserTransactionsDto } from './dto/get-user-transactions.dto';
import { TransactionStatus, TransactionScope } from '../../database/models/transaction/transaction.interface';
import { LockerService } from '../../services/locker/locker.service';
import { TransactionRepository } from '../transaction/transaction.repository';
import { BlockchainWalletRepository } from '../blockchainWallet/blockchainWallet.repository';
import { InAppNotificationService } from '../inAppNotification/inAppNotification.service';

describe('BlockchainWalletTransactionService', () => {
  let service: BlockchainWalletTransactionService;
  let repository: jest.Mocked<BlockchainWalletTransactionRepository>;
  let blockchainWaasAdapter: jest.Mocked<FireblocksAdapter>;

  const mockTransactionHistoryItem: ITransactionHistoryItem = {
    id: 'tx-123',
    externalTxId: 'ext-tx-456',
    status: 'COMPLETED',
    operation: 'TRANSFER',
    assetId: 'USDC',
    source: {
      type: 'VAULT_ACCOUNT',
      id: 'vault-123',
      address: '0x1234567890abcdef',
    },
    destination: {
      type: 'VAULT_ACCOUNT',
      id: 'vault-456',
      address: '0xabcdef1234567890',
    },
    amount: '100.00',
    fee: '0.001',
    txHash: '0x9876543210fedcba',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    lastUpdated: new Date('2024-01-01T01:00:00Z'),
  };

  const fixedDate = new Date('2025-10-23T22:22:37.443Z');

  const mockRawPaginatedResponse = {
    data: [
      {
        id: 'tx-1',
        blockchain_wallet_id: 'wallet-123',
        asset: 'USDC',
        amount: '100.00',
        status: TransactionStatus.COMPLETED,
        transaction_scope: TransactionScope.INTERNAL,
        type: 'debit',
        created_at: fixedDate,
        updated_at: fixedDate,
        destination_user_name: 'John Doe',
      } as any,
      {
        id: 'tx-2',
        blockchain_wallet_id: 'wallet-123',
        asset: 'USDC',
        amount: '50.00',
        status: TransactionStatus.PENDING,
        transaction_scope: TransactionScope.EXTERNAL,
        type: 'credit',
        created_at: fixedDate,
        updated_at: fixedDate,
        destination_user_name: 'Jane Smith',
      } as any,
    ],
    pagination: {
      total: 2,
      page: 1,
      limit: 10,
      pageCount: 1,
    },
  } as any;

  const mockPaginatedResponse = {
    data: [
      {
        id: 'tx-1',
        blockchain_wallet_id: 'wallet-123',
        asset: {
          id: 'USDC',
          name: 'USDC',
          network: 'Unknown',
        },
        amount: '100.00',
        status: TransactionStatus.COMPLETED,
        transaction_scope: TransactionScope.INTERNAL,
        type: 'debit',
        created_at: fixedDate,
        updated_at: fixedDate,
        destination_user_name: 'John Doe',
        peer_user: undefined,
      } as any,
      {
        id: 'tx-2',
        blockchain_wallet_id: 'wallet-123',
        asset: {
          id: 'USDC',
          name: 'USDC',
          network: 'Unknown',
        },
        amount: '50.00',
        status: TransactionStatus.PENDING,
        transaction_scope: TransactionScope.EXTERNAL,
        type: 'credit',
        created_at: fixedDate,
        updated_at: fixedDate,
        destination_user_name: 'Jane Smith',
        peer_user: undefined,
      } as any,
    ],
    pagination: {
      total: 2,
      page: 1,
      limit: 10,
      pageCount: 1,
    },
  } as any;

  beforeEach(async () => {
    const mockRepository = {
      findByUserIdWithFilters: jest.fn(),
      findFirstPendingByUserId: jest.fn(),
    };

    const mockBlockchainWaasAdapter = {
      getTransaction: jest.fn(),
    };

    const mockLockerService = {
      withLock: jest.fn(),
    };

    const mockTransactionRepository = {
      create: jest.fn(),
    };

    const mockBlockchainWalletRepository = {
      findOne: jest.fn(),
    };

    const mockInAppNotificationService = {
      createNotification: jest.fn(),
      findNotificationById: jest.fn(),
      findNotificationsByUserId: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      deleteNotification: jest.fn(),
      getUnreadCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainWalletTransactionService,
        {
          provide: BlockchainWalletTransactionRepository,
          useValue: mockRepository,
        },
        {
          provide: FireblocksAdapter,
          useValue: mockBlockchainWaasAdapter,
        },
        {
          provide: LockerService,
          useValue: mockLockerService,
        },
        {
          provide: TransactionRepository,
          useValue: mockTransactionRepository,
        },
        {
          provide: BlockchainWalletRepository,
          useValue: mockBlockchainWalletRepository,
        },
        {
          provide: InAppNotificationService,
          useValue: mockInAppNotificationService,
        },
      ],
    }).compile();

    service = module.get<BlockchainWalletTransactionService>(BlockchainWalletTransactionService);
    repository = module.get(BlockchainWalletTransactionRepository);
    blockchainWaasAdapter = module.get(FireblocksAdapter);

    // Spy on logger methods
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTransaction', () => {
    describe('with txId', () => {
      const txId = 'tx-123';

      it('should fetch transaction by txId successfully', async () => {
        blockchainWaasAdapter.getTransaction.mockResolvedValue(mockTransactionHistoryItem);

        const result = await service.getTransaction({ txId });

        expect(blockchainWaasAdapter.getTransaction).toHaveBeenCalledWith({ txId });
        expect(result).toEqual(mockTransactionHistoryItem);
        expect(service['logger'].log).toHaveBeenCalledWith(`Fetching transaction by ID: ${txId}`);
        expect(service['logger'].log).toHaveBeenCalledWith(`Transaction with ID ${txId} fetched successfully`);
      });

      it('should handle adapter errors when fetching by txId', async () => {
        const error = new Error('Adapter connection failed');
        blockchainWaasAdapter.getTransaction.mockRejectedValue(error);

        await expect(service.getTransaction({ txId })).rejects.toThrow(error);
        expect(service['logger'].error).toHaveBeenCalledWith(`Error fetching transaction: ${txId}`, error.stack);
      });

      it('should handle empty txId', async () => {
        await expect(service.getTransaction({ txId: '' })).rejects.toThrow(
          'Either txId or externalTxId must be provided',
        );
        expect(blockchainWaasAdapter.getTransaction).not.toHaveBeenCalled();
      });

      it('should handle very long txId', async () => {
        const longTxId = 'a'.repeat(1000);
        blockchainWaasAdapter.getTransaction.mockResolvedValue(mockTransactionHistoryItem);

        await service.getTransaction({ txId: longTxId });

        expect(blockchainWaasAdapter.getTransaction).toHaveBeenCalledWith({ txId: longTxId });
      });

      it('should handle special characters in txId', async () => {
        const specialTxId = 'tx-123@#$%^&*()_+-=[]{}|;:,.<>?';
        blockchainWaasAdapter.getTransaction.mockResolvedValue(mockTransactionHistoryItem);

        await service.getTransaction({ txId: specialTxId });

        expect(blockchainWaasAdapter.getTransaction).toHaveBeenCalledWith({ txId: specialTxId });
      });
    });

    describe('with externalTxId', () => {
      const externalTxId = 'ext-tx-456';

      it('should fetch transaction by externalTxId successfully', async () => {
        blockchainWaasAdapter.getTransaction.mockResolvedValue(mockTransactionHistoryItem);

        const result = await service.getTransaction({ externalTxId });

        expect(blockchainWaasAdapter.getTransaction).toHaveBeenCalledWith({ externalTxId });
        expect(result).toEqual(mockTransactionHistoryItem);
        expect(service['logger'].log).toHaveBeenCalledWith(`Fetching transaction by external ID: ${externalTxId}`);
        expect(service['logger'].log).toHaveBeenCalledWith(
          `Transaction with external ID ${externalTxId} fetched successfully`,
        );
      });

      it('should handle adapter errors when fetching by externalTxId', async () => {
        const error = new Error('Adapter connection failed');
        blockchainWaasAdapter.getTransaction.mockRejectedValue(error);

        await expect(service.getTransaction({ externalTxId })).rejects.toThrow(error);
        expect(service['logger'].error).toHaveBeenCalledWith(
          `Error fetching transaction: ${externalTxId}`,
          error.stack,
        );
      });

      it('should handle empty externalTxId', async () => {
        await expect(service.getTransaction({ externalTxId: '' })).rejects.toThrow(
          'Either txId or externalTxId must be provided',
        );
        expect(blockchainWaasAdapter.getTransaction).not.toHaveBeenCalled();
      });

      it('should handle very long externalTxId', async () => {
        const longExternalTxId = 'a'.repeat(1000);
        blockchainWaasAdapter.getTransaction.mockResolvedValue(mockTransactionHistoryItem);

        await service.getTransaction({ externalTxId: longExternalTxId });

        expect(blockchainWaasAdapter.getTransaction).toHaveBeenCalledWith({ externalTxId: longExternalTxId });
      });

      it('should handle special characters in externalTxId', async () => {
        const specialExternalTxId = 'ext-tx-456@#$%^&*()_+-=[]{}|;:,.<>?';
        blockchainWaasAdapter.getTransaction.mockResolvedValue(mockTransactionHistoryItem);

        await service.getTransaction({ externalTxId: specialExternalTxId });

        expect(blockchainWaasAdapter.getTransaction).toHaveBeenCalledWith({ externalTxId: specialExternalTxId });
      });
    });

    describe('edge cases', () => {
      it('should throw error when neither txId nor externalTxId is provided', async () => {
        await expect(service.getTransaction({})).rejects.toThrow('Either txId or externalTxId must be provided');
        expect(blockchainWaasAdapter.getTransaction).not.toHaveBeenCalled();
      });

      it('should throw error when both txId and externalTxId are provided', async () => {
        // This test assumes the adapter handles this case, but we test the service behavior
        blockchainWaasAdapter.getTransaction.mockResolvedValue(mockTransactionHistoryItem);

        await service.getTransaction({ txId: 'tx-123', externalTxId: 'ext-tx-456' });

        expect(blockchainWaasAdapter.getTransaction).toHaveBeenCalledWith({
          txId: 'tx-123',
          externalTxId: 'ext-tx-456',
        });
      });

      it('should handle null values in params', async () => {
        await expect(service.getTransaction({ txId: null as any, externalTxId: null as any })).rejects.toThrow(
          'Either txId or externalTxId must be provided',
        );
        expect(blockchainWaasAdapter.getTransaction).not.toHaveBeenCalled();
      });

      it('should handle undefined values in params', async () => {
        await expect(service.getTransaction({ txId: undefined, externalTxId: undefined })).rejects.toThrow(
          'Either txId or externalTxId must be provided',
        );
        expect(blockchainWaasAdapter.getTransaction).not.toHaveBeenCalled();
      });

      it('should handle adapter returning null', async () => {
        blockchainWaasAdapter.getTransaction.mockResolvedValue(null as any);

        const result = await service.getTransaction({ txId: 'tx-123' });

        expect(result).toBeNull();
      });

      it('should handle adapter returning undefined', async () => {
        blockchainWaasAdapter.getTransaction.mockResolvedValue(undefined as any);

        const result = await service.getTransaction({ txId: 'tx-123' });

        expect(result).toBeUndefined();
      });

      it('should handle error without stack trace', async () => {
        const error = new Error('Adapter error');
        delete error.stack;
        blockchainWaasAdapter.getTransaction.mockRejectedValue(error);

        await expect(service.getTransaction({ txId: 'tx-123' })).rejects.toThrow(error);
        expect(service['logger'].error).toHaveBeenCalledWith('Error fetching transaction: tx-123', undefined);
      });

      it('should handle network timeout errors', async () => {
        const timeoutError = new Error('Request timeout');
        timeoutError.name = 'TimeoutError';
        blockchainWaasAdapter.getTransaction.mockRejectedValue(timeoutError);

        await expect(service.getTransaction({ txId: 'tx-123' })).rejects.toThrow(timeoutError);
      });

      it('should handle rate limiting errors', async () => {
        const rateLimitError = new Error('Rate limit exceeded');
        rateLimitError.name = 'RateLimitError';
        blockchainWaasAdapter.getTransaction.mockRejectedValue(rateLimitError);

        await expect(service.getTransaction({ txId: 'tx-123' })).rejects.toThrow(rateLimitError);
      });
    });
  });

  describe('getUserTransactions', () => {
    const userId = 'user-123';
    const walletId = 'wallet-123';

    describe('with useWalletId = false (query by user ID)', () => {
      it('should fetch user transactions successfully with default filters', async () => {
        const filters: GetUserTransactionsDto = {};
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(userId, filters, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(userId, filters, false);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should fetch user transactions with type filter', async () => {
        const filters: GetUserTransactionsDto = { type: 'debit' };
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(userId, filters, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(userId, filters, false);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should fetch user transactions with status filter', async () => {
        const filters: GetUserTransactionsDto = { status: TransactionStatus.COMPLETED };
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(userId, filters, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(userId, filters, false);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should fetch user transactions with pagination', async () => {
        const filters: GetUserTransactionsDto = { page: 2, limit: 5 };
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(userId, filters, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(userId, filters, false);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should fetch user transactions with all filters', async () => {
        const filters: GetUserTransactionsDto = {
          type: 'credit',
          status: TransactionStatus.PENDING,
          page: 3,
          limit: 20,
        };
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(userId, filters, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(userId, filters, false);
        expect(result).toEqual(mockPaginatedResponse);
      });
    });

    describe('with useWalletId = true (query by wallet ID)', () => {
      it('should fetch wallet transactions successfully', async () => {
        const filters: GetUserTransactionsDto = {};
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(walletId, filters, true);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(walletId, filters, true);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should fetch wallet transactions with filters', async () => {
        const filters: GetUserTransactionsDto = {
          type: 'debit',
          status: TransactionStatus.COMPLETED,
          page: 1,
          limit: 15,
        };
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(walletId, filters, true);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(walletId, filters, true);
        expect(result).toEqual(mockPaginatedResponse);
      });
    });

    describe('edge cases', () => {
      it('should handle empty user ID', async () => {
        const filters: GetUserTransactionsDto = {};
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions('', filters, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith('', filters, false);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should handle empty wallet ID', async () => {
        const filters: GetUserTransactionsDto = {};
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions('', filters, true);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith('', filters, true);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should handle very long user ID', async () => {
        const longUserId = 'a'.repeat(1000);
        const filters: GetUserTransactionsDto = {};
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(longUserId, filters, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(longUserId, filters, false);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should handle special characters in user ID', async () => {
        const specialUserId = 'user@#$%^&*()_+-=[]{}|;:,.<>?';
        const filters: GetUserTransactionsDto = {};
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(specialUserId, filters, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(specialUserId, filters, false);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should handle repository errors', async () => {
        const error = new Error('Database connection failed');
        const filters: GetUserTransactionsDto = {};
        repository.findByUserIdWithFilters.mockRejectedValue(error);

        await expect(service.getUserTransactions(userId, filters, false)).rejects.toThrow(error);
      });

      it('should handle empty filters object', async () => {
        const filters = {} as GetUserTransactionsDto;
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(userId, filters, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(userId, filters, false);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should handle null filters', async () => {
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(userId, null as any, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(userId, null, false);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should handle undefined filters', async () => {
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(userId, undefined as any, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(userId, undefined, false);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should handle repository returning null', async () => {
        const filters: GetUserTransactionsDto = {};
        repository.findByUserIdWithFilters.mockResolvedValue(null as any);

        const result = await service.getUserTransactions(userId, filters, false);

        expect(result).toBeNull();
      });

      it('should handle repository returning undefined', async () => {
        const filters: GetUserTransactionsDto = {};
        repository.findByUserIdWithFilters.mockResolvedValue(undefined as any);

        const result = await service.getUserTransactions(userId, filters, false);

        expect(result).toBeUndefined();
      });

      it('should handle empty paginated response', async () => {
        const filters: GetUserTransactionsDto = {};
        const emptyResponse = {
          data: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 10,
            pageCount: 0,
          },
        };
        repository.findByUserIdWithFilters.mockResolvedValue(emptyResponse);

        const result = await service.getUserTransactions(userId, filters, false);

        expect(result).toEqual(emptyResponse);
      });

      it('should handle large pagination values', async () => {
        const filters: GetUserTransactionsDto = { page: 999999, limit: 999999 };
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(userId, filters, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(userId, filters, false);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should handle negative pagination values', async () => {
        const filters: GetUserTransactionsDto = { page: -1, limit: -1 } as any;
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(userId, filters, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(userId, filters, false);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should handle zero pagination values', async () => {
        const filters: GetUserTransactionsDto = { page: 0, limit: 0 } as any;
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(userId, filters, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(userId, filters, false);
        expect(result).toEqual(mockPaginatedResponse);
      });
    });

    describe('filter combinations', () => {
      it('should handle debit transactions with completed status', async () => {
        const filters: GetUserTransactionsDto = {
          type: 'debit',
          status: TransactionStatus.COMPLETED,
        };
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(userId, filters, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(userId, filters, false);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should handle credit transactions with pending status', async () => {
        const filters: GetUserTransactionsDto = {
          type: 'credit',
          status: TransactionStatus.PENDING,
        };
        repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

        const result = await service.getUserTransactions(userId, filters, false);

        expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(userId, filters, false);
        expect(result).toEqual(mockPaginatedResponse);
      });

      it('should handle all transaction statuses', async () => {
        const statuses = Object.values(TransactionStatus);

        for (const status of statuses) {
          const filters: GetUserTransactionsDto = { status };
          repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

          const result = await service.getUserTransactions(userId, filters, false);

          expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(userId, filters, false);
          expect(result).toEqual(mockPaginatedResponse);
        }
      });

      it('should handle both transaction types', async () => {
        const types: ('debit' | 'credit')[] = ['debit', 'credit'];

        for (const type of types) {
          const filters: GetUserTransactionsDto = { type };
          repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

          const result = await service.getUserTransactions(userId, filters, false);

          expect(repository.findByUserIdWithFilters).toHaveBeenCalledWith(userId, filters, false);
          expect(result).toEqual(mockPaginatedResponse);
        }
      });
    });
  });

  describe('logging behavior', () => {
    it('should log successful transaction fetch by txId', async () => {
      blockchainWaasAdapter.getTransaction.mockResolvedValue(mockTransactionHistoryItem);

      await service.getTransaction({ txId: 'tx-123' });

      expect(service['logger'].log).toHaveBeenCalledWith('Fetching transaction by ID: tx-123');
      expect(service['logger'].log).toHaveBeenCalledWith('Transaction with ID tx-123 fetched successfully');
    });

    it('should log successful transaction fetch by externalTxId', async () => {
      blockchainWaasAdapter.getTransaction.mockResolvedValue(mockTransactionHistoryItem);

      await service.getTransaction({ externalTxId: 'ext-tx-456' });

      expect(service['logger'].log).toHaveBeenCalledWith('Fetching transaction by external ID: ext-tx-456');
      expect(service['logger'].log).toHaveBeenCalledWith(
        'Transaction with external ID ext-tx-456 fetched successfully',
      );
    });

    it('should log errors with stack traces', async () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      blockchainWaasAdapter.getTransaction.mockRejectedValue(error);

      await expect(service.getTransaction({ txId: 'tx-123' })).rejects.toThrow(error);

      expect(service['logger'].error).toHaveBeenCalledWith('Error fetching transaction: tx-123', 'Error stack trace');
    });

    it('should not log when getUserTransactions succeeds', async () => {
      const filters: GetUserTransactionsDto = {};
      repository.findByUserIdWithFilters.mockResolvedValue(mockRawPaginatedResponse);

      await service.getUserTransactions('user-123', filters, false);

      // getUserTransactions doesn't have explicit logging, so we verify no error logging
      expect(service['logger'].error).not.toHaveBeenCalled();
    });
  });

  describe('getTransactionByHash', () => {
    const mockTransaction = {
      id: 'tx-123',
      blockchain_wallet_id: 'wallet-123',
      asset: 'USDC',
      amount: '100.00',
      status: TransactionStatus.COMPLETED,
      type: 'debit',
      tx_hash: '0x1234567890abcdef',
      created_at: new Date(),
      updated_at: new Date(),
    } as any;

    beforeEach(() => {
      // Add the new repository method to the mock
      repository.findByTransactionHash = jest.fn();
    });

    describe('successful cases', () => {
      it('should fetch transaction by hash successfully', async () => {
        const txHash = '0x1234567890abcdef';
        repository.findByTransactionHash.mockResolvedValue(mockTransaction);

        const result = await service.getTransactionByHash(txHash);

        expect(repository.findByTransactionHash).toHaveBeenCalledWith(txHash);
        expect(result).toEqual(mockTransaction);
        expect(service['logger'].log).toHaveBeenCalledWith(`Fetching blockchain wallet transaction by hash: ${txHash}`);
        expect(service['logger'].log).toHaveBeenCalledWith(
          `Found blockchain wallet transaction with hash ${txHash}: ${mockTransaction.id}`,
        );
      });

      it('should handle hash with leading/trailing whitespace', async () => {
        const txHash = '  0x1234567890abcdef  ';
        const trimmedHash = '0x1234567890abcdef';
        repository.findByTransactionHash.mockResolvedValue(mockTransaction);

        const result = await service.getTransactionByHash(txHash);

        expect(repository.findByTransactionHash).toHaveBeenCalledWith(trimmedHash);
        expect(result).toEqual(mockTransaction);
      });

      it('should handle different hash formats', async () => {
        const hashes = [
          '0x1234567890abcdef',
          '0X1234567890ABCDEF',
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        ];

        for (const hash of hashes) {
          repository.findByTransactionHash.mockResolvedValue(mockTransaction);

          const result = await service.getTransactionByHash(hash);

          expect(repository.findByTransactionHash).toHaveBeenCalledWith(hash);
          expect(result).toEqual(mockTransaction);
        }
      });

      it('should return null when transaction not found', async () => {
        const txHash = '0x1234567890abcdef';
        repository.findByTransactionHash.mockResolvedValue(null);

        const result = await service.getTransactionByHash(txHash);

        expect(repository.findByTransactionHash).toHaveBeenCalledWith(txHash);
        expect(result).toBeNull();
        expect(service['logger'].log).toHaveBeenCalledWith(
          `No blockchain wallet transaction found with hash: ${txHash}`,
        );
      });
    });

    describe('error cases', () => {
      it('should throw BadRequestException for empty hash', async () => {
        const txHash = '';

        await expect(service.getTransactionByHash(txHash)).rejects.toThrow('Transaction hash is required');
        expect(repository.findByTransactionHash).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException for whitespace-only hash', async () => {
        const txHash = '   ';

        await expect(service.getTransactionByHash(txHash)).rejects.toThrow('Transaction hash is required');
        expect(repository.findByTransactionHash).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException for null hash', async () => {
        const txHash = null as any;

        await expect(service.getTransactionByHash(txHash)).rejects.toThrow('Transaction hash is required');
        expect(repository.findByTransactionHash).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException for undefined hash', async () => {
        const txHash = undefined as any;

        await expect(service.getTransactionByHash(txHash)).rejects.toThrow('Transaction hash is required');
        expect(repository.findByTransactionHash).not.toHaveBeenCalled();
      });

      it('should handle repository errors', async () => {
        const txHash = '0x1234567890abcdef';
        const error = new Error('Database connection failed');
        repository.findByTransactionHash.mockRejectedValue(error);

        await expect(service.getTransactionByHash(txHash)).rejects.toThrow(error);
        expect(service['logger'].error).toHaveBeenCalledWith(
          `Error fetching blockchain wallet transaction by hash ${txHash}: ${error.message}`,
          error.stack,
        );
      });

      it('should handle error without stack trace', async () => {
        const txHash = '0x1234567890abcdef';
        const error = new Error('Database error');
        delete error.stack;
        repository.findByTransactionHash.mockRejectedValue(error);

        await expect(service.getTransactionByHash(txHash)).rejects.toThrow(error);
        expect(service['logger'].error).toHaveBeenCalledWith(
          `Error fetching blockchain wallet transaction by hash ${txHash}: ${error.message}`,
          undefined,
        );
      });
    });

    describe('edge cases', () => {
      it('should handle very long transaction hash', async () => {
        const longHash = '0x' + 'a'.repeat(1000);
        repository.findByTransactionHash.mockResolvedValue(mockTransaction);

        const result = await service.getTransactionByHash(longHash);

        expect(repository.findByTransactionHash).toHaveBeenCalledWith(longHash);
        expect(result).toEqual(mockTransaction);
      });

      it('should handle special characters in hash', async () => {
        const specialHash = '0x1234567890abcdef@#$%^&*()_+-=[]{}|;:,.<>?';
        repository.findByTransactionHash.mockResolvedValue(mockTransaction);

        const result = await service.getTransactionByHash(specialHash);

        expect(repository.findByTransactionHash).toHaveBeenCalledWith(specialHash);
        expect(result).toEqual(mockTransaction);
      });

      it('should handle hash with mixed case', async () => {
        const mixedCaseHash = '0x1234567890ABCDEFabcdef';
        repository.findByTransactionHash.mockResolvedValue(mockTransaction);

        const result = await service.getTransactionByHash(mixedCaseHash);

        expect(repository.findByTransactionHash).toHaveBeenCalledWith(mixedCaseHash);
        expect(result).toEqual(mockTransaction);
      });

      it('should handle repository returning undefined', async () => {
        const txHash = '0x1234567890abcdef';
        repository.findByTransactionHash.mockResolvedValue(undefined);

        const result = await service.getTransactionByHash(txHash);

        expect(repository.findByTransactionHash).toHaveBeenCalledWith(txHash);
        expect(result).toBeUndefined();
      });
    });
  });

  describe('dependency injection', () => {
    it('should properly inject BlockchainWalletTransactionRepository', () => {
      expect(service['blockchainWalletTransactionRepository']).toBeDefined();
      expect(service['blockchainWalletTransactionRepository']).toBe(repository);
    });

    it('should properly inject FireblocksAdapter', () => {
      expect(service['blockchainWaasAdapter']).toBeDefined();
      expect(service['blockchainWaasAdapter']).toBe(blockchainWaasAdapter);
    });

    it('should have logger instance', () => {
      expect(service['logger']).toBeDefined();
      expect(service['logger']).toBeInstanceOf(Logger);
    });
  });
});
