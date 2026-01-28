import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainGasFundTransactionService } from './blockchainGasFundTransaction.service';
import { BlockchainGasFundTransactionRepository } from './blockchainGasFundTransaction.repository';
import {
  BlockchainGasFundTransactionModel,
  IBlockchainGasFundTransaction,
} from '../../database/models/blockchain_gas_fund_transaction';
import { TransactionStatus } from '../../database/models/transaction';

describe('BlockchainGasFundTransactionService', () => {
  let service: BlockchainGasFundTransactionService;
  let repository: jest.Mocked<BlockchainGasFundTransactionRepository>;

  const mockGasFundTransaction = {
    id: 'gas-fund-tx-1',
    user_id: 'user-1',
    blockchain_wallet_id: 'wallet-1',
    native_asset_id: 'ETH_TEST5',
    amount: '0.02',
    status: TransactionStatus.PENDING,
    provider_reference: 'provider-ref-123',
    tx_hash: null,
    failure_reason: null,
    network_fee: null,
    idempotency_key: 'idempotency-key-123',
    metadata: { source: 'gas_station' },
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  } as unknown as BlockchainGasFundTransactionModel;

  const mockCreateData: Partial<IBlockchainGasFundTransaction> = {
    user_id: 'user-1',
    blockchain_wallet_id: 'wallet-1',
    native_asset_id: 'ETH_TEST5',
    amount: '0.02',
    status: TransactionStatus.PENDING,
    idempotency_key: 'idempotency-key-123',
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUser: jest.fn(),
      findByWallet: jest.fn(),
      findByStatus: jest.fn(),
      findByProviderReference: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findByUserAndWallet: jest.fn(),
      findPendingByUser: jest.fn(),
      findFirstPendingByUser: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainGasFundTransactionService,
        {
          provide: BlockchainGasFundTransactionRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BlockchainGasFundTransactionService>(BlockchainGasFundTransactionService);
    repository = module.get(
      BlockchainGasFundTransactionRepository,
    ) as jest.Mocked<BlockchainGasFundTransactionRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a gas fund transaction and return the model', async () => {
      repository.create.mockResolvedValue(mockGasFundTransaction);

      const result = await service.create(mockCreateData);

      expect(repository.create).toHaveBeenCalledWith(mockCreateData);
      expect(result).toEqual(mockGasFundTransaction);
    });

    it('should log the creation process', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      repository.create.mockResolvedValue(mockGasFundTransaction);

      await service.create(mockCreateData);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Creating gas fund transaction for user ${mockCreateData.user_id} and wallet ${mockCreateData.blockchain_wallet_id}`,
      );
      expect(loggerSpy).toHaveBeenCalledWith(`Gas fund transaction created with ID: ${mockGasFundTransaction.id}`);
    });
  });

  describe('findById', () => {
    it('should return a gas fund transaction by id', async () => {
      repository.findById.mockResolvedValue(mockGasFundTransaction as any);

      const result = await service.findById('gas-fund-tx-1');

      expect(repository.findById).toHaveBeenCalledWith('gas-fund-tx-1');
      expect(result).toEqual(mockGasFundTransaction);
    });

    it('should return null if transaction not found', async () => {
      repository.findById.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByUser', () => {
    it('should return gas fund transactions for a user', async () => {
      const transactions = [mockGasFundTransaction];
      repository.findByUser.mockResolvedValue(transactions);

      const result = await service.findByUser('user-1');

      expect(repository.findByUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(transactions);
    });
  });

  describe('findByWallet', () => {
    it('should return gas fund transactions for a wallet', async () => {
      const transactions = [mockGasFundTransaction];
      repository.findByWallet.mockResolvedValue(transactions);

      const result = await service.findByWallet('wallet-1');

      expect(repository.findByWallet).toHaveBeenCalledWith('wallet-1');
      expect(result).toEqual(transactions);
    });
  });

  describe('findByStatus', () => {
    it('should return gas fund transactions by status', async () => {
      const transactions = [mockGasFundTransaction];
      repository.findByStatus.mockResolvedValue(transactions);

      const result = await service.findByStatus(TransactionStatus.PENDING);

      expect(repository.findByStatus).toHaveBeenCalledWith(TransactionStatus.PENDING);
      expect(result).toEqual(transactions);
    });
  });

  describe('findByProviderReference', () => {
    it('should return a gas fund transaction by provider reference', async () => {
      repository.findByProviderReference.mockResolvedValue(mockGasFundTransaction);

      const result = await service.findByProviderReference('provider-ref-123');

      expect(repository.findByProviderReference).toHaveBeenCalledWith('provider-ref-123');
      expect(result).toEqual(mockGasFundTransaction);
    });

    it('should return null if transaction not found', async () => {
      repository.findByProviderReference.mockResolvedValue(null);

      const result = await service.findByProviderReference('non-existent-ref');

      expect(result).toBeNull();
    });
  });

  describe('findByIdempotencyKey', () => {
    it('should return a gas fund transaction by idempotency key', async () => {
      repository.findByIdempotencyKey.mockResolvedValue(mockGasFundTransaction);

      const result = await service.findByIdempotencyKey('idempotency-key-123');

      expect(repository.findByIdempotencyKey).toHaveBeenCalledWith('idempotency-key-123');
      expect(result).toEqual(mockGasFundTransaction);
    });
  });

  describe('findByUserAndWallet', () => {
    it('should return gas fund transactions for a user and wallet', async () => {
      const transactions = [mockGasFundTransaction];
      repository.findByUserAndWallet.mockResolvedValue(transactions);

      const result = await service.findByUserAndWallet('user-1', 'wallet-1');

      expect(repository.findByUserAndWallet).toHaveBeenCalledWith('user-1', 'wallet-1');
      expect(result).toEqual(transactions);
    });
  });

  describe('findPendingByUser', () => {
    it('should return pending gas fund transactions for a user', async () => {
      const transactions = [mockGasFundTransaction];
      repository.findPendingByUser.mockResolvedValue(transactions);

      const result = await service.findPendingByUser('user-1');

      expect(repository.findPendingByUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(transactions);
    });
  });

  describe('findFirstPendingByUser', () => {
    it('should return the first pending gas fund transaction for a user', async () => {
      repository.findFirstPendingByUser.mockResolvedValue(mockGasFundTransaction);

      const result = await service.findFirstPendingByUser('user-1');

      expect(repository.findFirstPendingByUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockGasFundTransaction);
    });

    it('should return null if no pending transactions found', async () => {
      repository.findFirstPendingByUser.mockResolvedValue(null);

      const result = await service.findFirstPendingByUser('user-1');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a gas fund transaction and return the updated model', async () => {
      const updateData = { status: TransactionStatus.COMPLETED };
      const updatedTransaction = { ...mockGasFundTransaction, ...updateData } as BlockchainGasFundTransactionModel;
      repository.update.mockResolvedValue(updatedTransaction);

      const result = await service.update('gas-fund-tx-1', updateData);

      expect(repository.update).toHaveBeenCalledWith('gas-fund-tx-1', updateData);
      expect(result).toEqual(updatedTransaction);
    });

    it('should log the update process', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      repository.update.mockResolvedValue(mockGasFundTransaction);

      await service.update('gas-fund-tx-1', { status: TransactionStatus.COMPLETED });

      expect(loggerSpy).toHaveBeenCalledWith('Updating gas fund transaction gas-fund-tx-1');
      expect(loggerSpy).toHaveBeenCalledWith('Gas fund transaction gas-fund-tx-1 updated');
    });
  });

  describe('updateStatus', () => {
    it('should update transaction status and return the updated model', async () => {
      const updatedTransaction = {
        ...mockGasFundTransaction,
        status: TransactionStatus.COMPLETED,
      } as BlockchainGasFundTransactionModel;
      repository.update.mockResolvedValue(updatedTransaction);

      const result = await service.updateStatus('gas-fund-tx-1', TransactionStatus.COMPLETED);

      expect(repository.update).toHaveBeenCalledWith('gas-fund-tx-1', { status: TransactionStatus.COMPLETED });
      expect(result).toEqual(updatedTransaction);
    });

    it('should update status with metadata', async () => {
      const metadata = { tx_hash: '0x123' };
      const updatedTransaction = {
        ...mockGasFundTransaction,
        status: TransactionStatus.COMPLETED,
        metadata,
      } as unknown as BlockchainGasFundTransactionModel;
      repository.update.mockResolvedValue(updatedTransaction);

      const result = await service.updateStatus('gas-fund-tx-1', TransactionStatus.COMPLETED, metadata);

      expect(repository.update).toHaveBeenCalledWith('gas-fund-tx-1', {
        status: TransactionStatus.COMPLETED,
        metadata,
      });
      expect(result).toEqual(updatedTransaction);
    });

    it('should merge metadata with existing metadata', async () => {
      const existingMetadata = { source: 'gas_station' };
      const newMetadata = { tx_hash: '0x123' };
      const existingTransaction = {
        ...mockGasFundTransaction,
        metadata: existingMetadata,
      } as unknown as BlockchainGasFundTransactionModel;
      const transactionWithMetadata = {
        ...mockGasFundTransaction,
        metadata: { ...existingMetadata, ...newMetadata },
      } as unknown as BlockchainGasFundTransactionModel;

      repository.findById.mockResolvedValue(existingTransaction as any);
      repository.update.mockResolvedValue(transactionWithMetadata);

      await service.updateStatus('gas-fund-tx-1', TransactionStatus.COMPLETED, newMetadata);

      expect(repository.findById).toHaveBeenCalledWith('gas-fund-tx-1');
      expect(repository.update).toHaveBeenCalledWith('gas-fund-tx-1', {
        status: TransactionStatus.COMPLETED,
        metadata: { ...existingMetadata, ...newMetadata },
      });
    });
  });

  describe('updateProviderReference', () => {
    it('should update provider reference and return the updated model', async () => {
      const updatedTransaction = {
        ...mockGasFundTransaction,
        provider_reference: 'new-ref-456',
      } as BlockchainGasFundTransactionModel;
      repository.update.mockResolvedValue(updatedTransaction);

      const result = await service.updateProviderReference('gas-fund-tx-1', 'new-ref-456');

      expect(repository.update).toHaveBeenCalledWith('gas-fund-tx-1', { provider_reference: 'new-ref-456' });
      expect(result).toEqual(updatedTransaction);
    });

    it('should log the update process', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      repository.update.mockResolvedValue(mockGasFundTransaction);

      await service.updateProviderReference('gas-fund-tx-1', 'new-ref-456');

      expect(loggerSpy).toHaveBeenCalledWith(
        'Updating gas fund transaction gas-fund-tx-1 provider reference to new-ref-456',
      );
      expect(loggerSpy).toHaveBeenCalledWith('Gas fund transaction gas-fund-tx-1 provider reference updated');
    });
  });

  describe('updateTxHash', () => {
    it('should update tx hash and return the updated model', async () => {
      const updatedTransaction = {
        ...mockGasFundTransaction,
        tx_hash: '0x123456',
      } as BlockchainGasFundTransactionModel;
      repository.update.mockResolvedValue(updatedTransaction);

      const result = await service.updateTxHash('gas-fund-tx-1', '0x123456');

      expect(repository.update).toHaveBeenCalledWith('gas-fund-tx-1', { tx_hash: '0x123456' });
      expect(result).toEqual(updatedTransaction);
    });

    it('should log the update process', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      repository.update.mockResolvedValue(mockGasFundTransaction);

      await service.updateTxHash('gas-fund-tx-1', '0x123456');

      expect(loggerSpy).toHaveBeenCalledWith('Updating gas fund transaction gas-fund-tx-1 tx hash to 0x123456');
      expect(loggerSpy).toHaveBeenCalledWith('Gas fund transaction gas-fund-tx-1 tx hash updated');
    });
  });

  describe('markAsFailed', () => {
    it('should mark transaction as failed with failure reason', async () => {
      const failedTransaction = {
        ...mockGasFundTransaction,
        status: TransactionStatus.FAILED,
        failure_reason: 'Insufficient gas',
      } as BlockchainGasFundTransactionModel;
      repository.update.mockResolvedValue(failedTransaction);

      const result = await service.markAsFailed('gas-fund-tx-1', 'Insufficient gas');

      expect(repository.update).toHaveBeenCalledWith('gas-fund-tx-1', {
        status: TransactionStatus.FAILED,
        failure_reason: 'Insufficient gas',
      });
      expect(result).toEqual(failedTransaction);
    });

    it('should log the failure process', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      repository.update.mockResolvedValue(mockGasFundTransaction);

      await service.markAsFailed('gas-fund-tx-1', 'Insufficient gas');

      expect(loggerSpy).toHaveBeenCalledWith('Marking gas fund transaction gas-fund-tx-1 as failed: Insufficient gas');
      expect(loggerSpy).toHaveBeenCalledWith('Gas fund transaction gas-fund-tx-1 marked as failed');
    });
  });

  describe('markAsCompleted', () => {
    it('should mark transaction as completed without optional parameters', async () => {
      const completedTransaction = {
        ...mockGasFundTransaction,
        status: TransactionStatus.COMPLETED,
      } as BlockchainGasFundTransactionModel;
      repository.update.mockResolvedValue(completedTransaction);

      const result = await service.markAsCompleted('gas-fund-tx-1');

      expect(repository.update).toHaveBeenCalledWith('gas-fund-tx-1', {
        status: TransactionStatus.COMPLETED,
      });
      expect(result).toEqual(completedTransaction);
    });

    it('should mark transaction as completed with tx hash', async () => {
      const completedTransaction = {
        ...mockGasFundTransaction,
        status: TransactionStatus.COMPLETED,
        tx_hash: '0x123456',
      } as BlockchainGasFundTransactionModel;
      repository.update.mockResolvedValue(completedTransaction);

      const result = await service.markAsCompleted('gas-fund-tx-1', '0x123456');

      expect(repository.update).toHaveBeenCalledWith('gas-fund-tx-1', {
        status: TransactionStatus.COMPLETED,
        tx_hash: '0x123456',
      });
      expect(result).toEqual(completedTransaction);
    });

    it('should mark transaction as completed with tx hash and network fee', async () => {
      const completedTransaction = {
        ...mockGasFundTransaction,
        status: TransactionStatus.COMPLETED,
        tx_hash: '0x123456',
        network_fee: '0.001',
      } as BlockchainGasFundTransactionModel;
      repository.update.mockResolvedValue(completedTransaction);

      const result = await service.markAsCompleted('gas-fund-tx-1', '0x123456', '0.001');

      expect(repository.update).toHaveBeenCalledWith('gas-fund-tx-1', {
        status: TransactionStatus.COMPLETED,
        tx_hash: '0x123456',
        network_fee: '0.001',
      });
      expect(result).toEqual(completedTransaction);
    });

    it('should log the completion process', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      repository.update.mockResolvedValue(mockGasFundTransaction);

      await service.markAsCompleted('gas-fund-tx-1');

      expect(loggerSpy).toHaveBeenCalledWith('Marking gas fund transaction gas-fund-tx-1 as completed');
      expect(loggerSpy).toHaveBeenCalledWith('Gas fund transaction gas-fund-tx-1 marked as completed');
    });
  });

  describe('delete', () => {
    it('should delete a gas fund transaction', async () => {
      repository.delete.mockResolvedValue(undefined);

      await service.delete('gas-fund-tx-1');

      expect(repository.delete).toHaveBeenCalledWith('gas-fund-tx-1');
    });

    it('should log the deletion process', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      repository.delete.mockResolvedValue(undefined);

      await service.delete('gas-fund-tx-1');

      expect(loggerSpy).toHaveBeenCalledWith('Deleting gas fund transaction gas-fund-tx-1');
      expect(loggerSpy).toHaveBeenCalledWith('Gas fund transaction gas-fund-tx-1 deleted');
    });
  });
});
