import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainWaasAdapter } from '../../adapters/blockchain-waas/blockchain-waas-adapter';
import {
  IBlockchainResendWebhookResponse,
  IFeeEstimateResponse,
} from '../../adapters/blockchain-waas/blockchain-waas-adapter.interface';
import { EnvironmentService } from '../../config/environment/environment.service';
import { StableCoinsService } from '../../config/onedosh/stablecoins.config';
import { BlockchainWalletModel } from '../../database/models/blockchain_wallet/blockchain_wallet.model';
import { BlockchainWalletProvider } from '../../database/models/blockchain_wallet/blockchain_wallet.interface';
import { BlockchainWalletTransactionType } from '../../database/models/blockchain_wallet_transaction/blockchain_wallet_transaction.interface';
import { TransactionScope, TransactionStatus } from '../../database/models/transaction/transaction.interface';
import { IUser } from '../../database/models/user/user.interface';
import { UserModel } from '../../database/models/user/user.model';
import { BlockchainService } from '../../services/blockchain/blockchain.service';
import { EventEmitterService } from '../../services/eventEmitter/eventEmitter.service';
import { LockerService } from '../../services/locker/locker.service';
import { AssetAmount } from '../../utils/asset-amount';

import { UtilsService } from '../../utils/utils.service';
import { UserRepository } from '../auth/user/user.repository';
import { BlockchainAccountsService } from '../blockchainAccounts/blockchainAccounts.service';
import { BlockchainGasFundTransactionService } from '../blockchainGasFundTransaction/blockchainGasFundTransaction.service';
import { BlockchainWalletKeyRepository } from '../blockchainWalletKey/blockchainWalletKey.repository';
import { BlockchainWalletTransactionRepository } from '../blockchainWalletTransaction/blockchainWalletTransaction.repository';
import { BlockchainWalletTransactionService } from '../blockchainWalletTransaction/blockchainWalletTransaction.service';
import { DepositAddressService } from '../depositAddress/depositAddress.service';
import { InAppNotificationService } from '../inAppNotification';
import { TransactionRepository, TransactionService } from '../transaction';
import {
  ICreateWallet,
  ICreateCustomWallet,
  IEstimateFeeParams,
  IInitiateTransactionParams,
} from './blockchainWallet.interface';
import { BlockchainWalletRepository } from './blockchainWallet.repository';
import { BlockchainWalletService } from './blockchainWallet.service';

describe('BlockchainWalletService', () => {
  let service: BlockchainWalletService;
  let blockchainWaasAdapter: jest.Mocked<BlockchainWaasAdapter>;
  let blockchainWalletRepository: jest.Mocked<BlockchainWalletRepository>;
  let blockchainWalletTransactionRepository: jest.Mocked<BlockchainWalletTransactionRepository>;
  let lockerService: jest.Mocked<LockerService>;
  let blockchainAccountsService: jest.Mocked<BlockchainAccountsService>;
  let userRepository: jest.Mocked<UserRepository>;
  let transactionRepository: jest.Mocked<TransactionRepository>;
  let blockchainGasFundTransactionService: jest.Mocked<BlockchainGasFundTransactionService>;
  let depositAddressService: jest.Mocked<DepositAddressService>;
  let blockchainWalletTransactionService: jest.Mocked<BlockchainWalletTransactionService>;
  let blockchainService: jest.Mocked<BlockchainService>;
  let blockchainWalletKeyRepository: jest.Mocked<BlockchainWalletKeyRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainWalletService,
        {
          provide: BlockchainWaasAdapter,
          useValue: {
            getAvailableStableAssets: jest.fn(),
            createAccount: jest.fn(),
            createWallet: jest.fn(),
            internalTransfer: jest.fn(),
            externalTransfer: jest.fn(),
            estimateInternalTransferFee: jest.fn(),
            estimateExternalTransactionFee: jest.fn(),
            getVaultAssetTransactionHistory: jest.fn(),
            getTransaction: jest.fn(),
            handleWebhook: jest.fn(),
            resendWebhook: jest.fn(),
            createTransaction: jest.fn(),
          },
        },
        {
          provide: BlockchainWalletRepository,
          useValue: {
            findFirstWalletByUserId: jest.fn(),
            findActiveWalletsByUserIdAndAssets: jest.fn(),
            batchCreate: jest.fn(),
            findAllActiveWalletsByUserId: jest.fn(),
            findActiveWalletByUserIdAndAsset: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
            transaction: jest.fn(),
            findUserWalletById: jest.fn(),
            findByProviderAccountRef: jest.fn(),
          },
        },
        {
          provide: BlockchainWalletTransactionRepository,
          useValue: {
            create: jest.fn(),
            update: jest.fn(),
            findOne: jest.fn(),
            findById: jest.fn(),
            findFirstPendingByUserId: jest.fn(),
            findByProviderReference: jest.fn(),
          },
        },
        { provide: LockerService, useValue: { withLock: jest.fn() } },
        { provide: TransactionService, useValue: {} },
        {
          provide: TransactionRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: BlockchainWalletTransactionService,
          useValue: {
            getTransaction: jest.fn(),
            getUserTransactions: jest.fn(),
            markTransactionAsSuccessful: jest.fn(),
          },
        },
        {
          provide: BlockchainGasFundTransactionService,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            updateProviderReference: jest.fn(),
            markAsFailed: jest.fn(),
            findByProviderReference: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
            findActiveByUsername: jest.fn(),
          },
        },
        {
          provide: BlockchainAccountsService,
          useValue: {
            createAccount: jest.fn(),
            getUserAccounts: jest.fn().mockResolvedValue([]),
            getAccountById: jest.fn(),
          },
        },
        {
          provide: EnvironmentService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: UtilsService,
          useValue: {
            generateIdempotencyKey: jest.fn(),
          },
        },
        {
          provide: DepositAddressService,
          useValue: {
            getDepositAddresses: jest.fn(),
            createDepositAddress: jest.fn(),
          },
        },
        {
          provide: EventEmitterService,
          useValue: {
            emit: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
            removeAllListeners: jest.fn(),
            listenerCount: jest.fn(),
          },
        },
        {
          provide: InAppNotificationService,
          useValue: {
            createNotification: jest.fn(),
            findNotificationById: jest.fn(),
            findNotificationsByUserId: jest.fn(),
            markAsRead: jest.fn(),
            markAllAsRead: jest.fn(),
            deleteNotification: jest.fn(),
            getUnreadCount: jest.fn(),
          },
        },
        {
          provide: BlockchainService,
          useValue: {
            createEthereumAddress: jest.fn(),
            createSolanaAddress: jest.fn(),
            encryptPrivateKey: jest.fn(),
            decryptPrivateKey: jest.fn(),
          },
        },
        {
          provide: BlockchainWalletKeyRepository,
          useValue: {
            create: jest.fn(),
            findByWalletId: jest.fn(),
            findByWalletIdAndNetwork: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BlockchainWalletService>(BlockchainWalletService);
    blockchainWaasAdapter = module.get(BlockchainWaasAdapter);
    blockchainWalletRepository = module.get(BlockchainWalletRepository);
    blockchainWalletTransactionRepository = module.get(BlockchainWalletTransactionRepository);
    lockerService = module.get(LockerService);
    blockchainAccountsService = module.get(BlockchainAccountsService);
    userRepository = module.get(UserRepository);
    transactionRepository = module.get(TransactionRepository);
    blockchainGasFundTransactionService = module.get(BlockchainGasFundTransactionService);
    depositAddressService = module.get(DepositAddressService);
    blockchainWalletTransactionService = module.get(BlockchainWalletTransactionService);
    blockchainService = module.get(BlockchainService);
    blockchainWalletKeyRepository = module.get(BlockchainWalletKeyRepository);
    lockerService.withLock.mockImplementation(async (_key: string, cb: any) => cb());
    blockchainWalletRepository.transaction.mockImplementation(async (cb: any) => cb({}));
  });

  describe('getStableCoins', () => {
    it('should return stable coins from configuration', async () => {
      const result = await service.getStableCoins();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('type');
    });
  });

  describe('getStableCoinsFromProvider', () => {
    it('should return stable coins from external provider', async () => {
      const mockExternalAssets = [{ id: 'usdc', name: 'USD Coin', type: 'ERC20' }];
      blockchainWaasAdapter.getAvailableStableAssets.mockResolvedValue(mockExternalAssets as any);

      const result = await service.getStableCoinsFromProvider('fireblocks');
      expect(Array.isArray(result)).toBe(true);
      expect(blockchainWaasAdapter.getAvailableStableAssets).toHaveBeenCalled();
    });

    it('should fallback to configured stable coins on error', async () => {
      blockchainWaasAdapter.getAvailableStableAssets.mockRejectedValue(new Error('Provider error'));

      const result = await service.getStableCoinsFromProvider('fireblocks');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('createAccount', () => {
    it('should create account and default wallets', async () => {
      const user = { id: 'u1', username: 'alice' } as any;
      const providerAccount = { id: 'provider-acc1', name: 'alice' };
      const blockchainAccount = { id: 'acc1', provider_ref: 'provider-acc1', user_id: 'u1' };

      blockchainWaasAdapter.createAccount.mockResolvedValue(providerAccount);
      blockchainAccountsService.createAccount.mockResolvedValue(blockchainAccount as any);

      // Mock BlockchainAccountsService to return empty array (no existing accounts)
      blockchainAccountsService.getUserAccounts.mockResolvedValue([]);

      const result = await service.createBlockchainAccount(user);
      expect(result).toEqual(blockchainAccount);
      expect(blockchainWaasAdapter.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'u1',
          user_name: 'alice-crypto',
          idempotencyKey: expect.any(String),
        }),
      );
    });
    it('should throw if adapter fails', async () => {
      const user = { id: 'u1', username: 'alice' } as any;
      blockchainWaasAdapter.createAccount.mockRejectedValue(new Error('fail'));

      // Mock BlockchainAccountsService to return empty array
      blockchainAccountsService.getUserAccounts.mockResolvedValue([]);

      await expect(service.createBlockchainAccount(user)).rejects.toThrow('fail');
    });
  });

  describe('createWallet', () => {
    it('should create wallet for new assets', async () => {
      const user: IUser = { id: 'u1', username: 'alice' } as any;
      const params: ICreateWallet = { asset_ids: [{ asset_id: 'usdc' }] };
      blockchainWaasAdapter.createWallet.mockResolvedValue({ successful: [], failed: [] });
      blockchainWalletRepository.batchCreate.mockResolvedValue(undefined);
      blockchainWalletRepository.findFirstWalletByUserId.mockResolvedValue(undefined);
      blockchainWalletRepository.findActiveWalletsByUserIdAndAssets.mockResolvedValue([]);

      // Mock BlockchainAccountsService to return empty array
      blockchainAccountsService.getUserAccounts.mockResolvedValue([]);

      // Mock the createAccount method to return a valid account
      jest.spyOn(service, 'createBlockchainAccount').mockResolvedValue({ id: 'acc-123', name: 'alice' } as any);

      await expect(service.createBlockchainWallet(user, params)).resolves.toBeDefined();
    });
    it('should throw if no account found', async () => {
      const user: IUser = { id: 'u1', username: 'alice' } as any;
      const params: ICreateWallet = { asset_ids: [{ asset_id: 'usdc' }] };
      blockchainWalletRepository.findFirstWalletByUserId.mockResolvedValue(undefined);

      // Mock BlockchainAccountsService to return empty array
      blockchainAccountsService.getUserAccounts.mockResolvedValue([]);

      await expect(service.createBlockchainWallet(user, params)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserAccount', () => {
    it('should return active wallets', async () => {
      const user: IUser = { id: 'u1', username: 'alice' } as any;
      const wallets: BlockchainWalletModel[] = [{ id: 'w1' } as any];
      blockchainWalletRepository.findAllActiveWalletsByUserId.mockResolvedValue(wallets);
      await expect(service.getUserAccount(user)).resolves.toEqual([{ id: 'w1', image_url: null }]);
    });
    it('should return empty array if no wallets', async () => {
      const user: IUser = { id: 'u1', username: 'alice' } as any;
      blockchainWalletRepository.findAllActiveWalletsByUserId.mockResolvedValue([]);
      const result = await service.getUserAccount(user);
      expect(result).toEqual([]);
    });
  });

  describe('getWalletBalance', () => {
    it('should return wallet balance', async () => {
      const user: IUser = { id: 'u1', username: 'alice' } as any;
      const wallet: BlockchainWalletModel = { id: 'w1' } as any;
      blockchainWalletRepository.findActiveWalletByUserIdAndAsset.mockResolvedValue(wallet);
      await expect(service.getWalletBalance(user, 'usdc')).resolves.toEqual({ id: 'w1', image_url: null });
    });
    it('should throw if wallet not found', async () => {
      const user: IUser = { id: 'u1', username: 'alice' } as any;
      blockchainWalletRepository.findActiveWalletByUserIdAndAsset.mockResolvedValue(undefined);
      await expect(service.getWalletBalance(user, 'usdc')).rejects.toThrow(
        'No active blockchain wallet found for user and asset',
      );
    });
  });

  describe('estimateFee', () => {
    it('should estimate internal fee', async () => {
      const user: IUser = { id: 'u1', username: 'alice' } as any;
      const params: IEstimateFeeParams = {
        type: 'internal',
        asset_id: 'usdc',
        amount: '100',
        peer_username: 'bob',
      };
      const wallet = { id: 'w1', asset: 'usdc', provider_account_ref: 'acc-123' } as any;
      const destinationWallet = { id: 'w2', asset: 'usdc', provider_account_ref: 'acc-456' } as any;
      const destinationUser = { id: 'u2', username: 'bob' } as any;

      blockchainWalletRepository.findActiveWalletByUserIdAndAsset
        .mockResolvedValueOnce(wallet)
        .mockResolvedValueOnce(destinationWallet);
      jest.spyOn<any, any>(service, 'estimateInternalTransferFee').mockResolvedValue({} as IFeeEstimateResponse);

      // Mock UserRepository to return the destination user
      userRepository.findActiveByUsername.mockResolvedValue(destinationUser);

      await expect(service.estimateFee(user, params)).resolves.toBeDefined();
    });
    it('should estimate external fee', async () => {
      const user: IUser = { id: 'u1', username: 'alice' } as any;
      const params: IEstimateFeeParams = {
        type: 'external',
        asset_id: 'usdc',
        amount: '10',
        peer_address: 'addr',
      };
      const wallet: BlockchainWalletModel = { id: 'w1', provider_account_ref: 'acc' } as any;
      blockchainWalletRepository.findActiveWalletByUserIdAndAsset.mockResolvedValue(wallet);
      jest.spyOn<any, any>(service, 'estimateExternalTransactionFee').mockResolvedValue({} as IFeeEstimateResponse);
      await expect(service.estimateFee(user, params)).resolves.toBeDefined();
    });
    it('should throw for invalid type', async () => {
      const user: IUser = { id: 'u1', username: 'alice' } as any;
      const params: any = { type: 'invalid', asset_id: 'usdc', amount: '10' };
      blockchainWalletRepository.findActiveWalletByUserIdAndAsset.mockResolvedValue({
        id: 'w1',
        asset: 'usdc',
        decimal: 6,
        provider_account_ref: 'acc-123',
      } as any);
      await expect(service.estimateFee(user, params)).rejects.toThrow('Invalid fee estimation type');
    });
  });

  describe('initiateTransaction', () => {
    it('should throw if source wallet not found', async () => {
      const user: IUser = { id: 'u1', username: 'alice' } as any;
      const params: IInitiateTransactionParams = {
        type: 'internal',
        asset_id: 'usdc',
        amount: 10,
        peer_username: 'u2',
      };
      blockchainWalletRepository.findActiveWalletByUserIdAndAsset.mockResolvedValue(undefined);
      await expect(service.initiateTransaction(user, params)).rejects.toThrow(
        'Source wallet not found for the given user(s) and asset',
      );
    });
  });

  describe('debitWallet', () => {
    it('should debit wallet with lock', async () => {
      lockerService.withLock.mockImplementation(async (_key, fn) => fn());
      blockchainWalletRepository.findById.mockResolvedValue({ id: 'w1', balance: 100, asset: 'usdc' } as any);
      blockchainWalletRepository.update.mockResolvedValue({ id: 'w1', balance: 90, asset: 'usdc' } as any);
      blockchainWalletTransactionRepository.create.mockResolvedValue({ id: 'tx2' } as any);
      await expect(
        service.debitWallet('w1', 10, 'usdc', { transaction_type: BlockchainWalletTransactionType.WITHDRAWAL }),
      ).resolves.toBeDefined();
    });
    it('should throw if insufficient balance', async () => {
      lockerService.withLock.mockImplementation(async (_key, fn) => fn());
      blockchainWalletRepository.findById.mockResolvedValue({ id: 'w1', balance: 0, asset: 'usdc' } as any);
      await expect(
        service.debitWallet('w1', 10, 'usdc', { transaction_type: BlockchainWalletTransactionType.WITHDRAWAL }),
      ).rejects.toThrow('Insufficient balance for this transaction');
    });
  });

  describe('revertWalletDebit', () => {
    it('should revert debit with lock', async () => {
      lockerService.withLock.mockImplementation(async (_key, fn) => fn());
      blockchainWalletRepository.findById.mockResolvedValue({ id: 'w1', balance: 0, asset: 'usdc' } as any);
      blockchainWalletTransactionRepository.findById.mockResolvedValue({
        id: 'b1',
        amount: 10,
        status: TransactionStatus.PENDING,
        blockchain_wallet_id: 'w1',
      } as any);
      transactionRepository.create.mockResolvedValue({ id: 'tx1' } as any);
      blockchainWalletRepository.update.mockResolvedValue({ id: 'w1', balance: 10, asset: 'usdc' } as any);
      blockchainWalletTransactionRepository.update.mockResolvedValue({
        id: 'b1',
        status: TransactionStatus.FAILED,
      } as any);
      await expect(
        service.revertWalletDebit(
          'u1',
          'w1',
          10,
          'usdc',
          { id: 'b1', amount: 10, status: TransactionStatus.PENDING } as any,
          { transaction_type: BlockchainWalletTransactionType.WITHDRAWAL },
        ),
      ).resolves.toBeDefined();
    });
    it('should throw if transaction not found', async () => {
      lockerService.withLock.mockImplementation(async (_key, fn) => fn());
      blockchainWalletRepository.findById.mockResolvedValue({ id: 'w1', balance: 0, asset: 'usdc' } as any);
      blockchainWalletTransactionRepository.findById.mockResolvedValue(undefined);
      await expect(
        service.revertWalletDebit('u1', 'w1', 10, 'usdc', {
          id: 'b1',
          amount: 10,
          status: TransactionStatus.PENDING,
        } as any),
      ).rejects.toThrow('Blockchain wallet transaction not found');
    });
  });

  describe('processWebhook', () => {
    it('should process webhook and call handler', async () => {
      blockchainWaasAdapter.handleWebhook.mockResolvedValue({
        data: {
          id: 't1',
          status: 'completed',
          txHash: '0x123',
          source: 'test',
        },
      } as any);
      jest.spyOn<any, any>(service, 'handleTransactionWebhookByType').mockResolvedValue(undefined);
      await expect(service.processWebhook('{}', 'sig', 'ts', 'v2')).resolves.toEqual({
        success: true,
        message: 'Webhook processed successfully',
        transactionId: 't1',
        status: 'completed',
      });
    });
    it('should throw if adapter fails', async () => {
      blockchainWaasAdapter.handleWebhook.mockRejectedValue(new Error('fail'));
      await expect(service.processWebhook('{}', 'sig', 'ts', 'v2')).rejects.toThrow('fail');
    });
  });

  describe('resendWebhook', () => {
    it('should resend webhook for txId', async () => {
      blockchainWaasAdapter.resendWebhook.mockResolvedValue({ success: true } as IBlockchainResendWebhookResponse);
      await expect(service.resendWebhook({ txId: 't1' })).resolves.toEqual({ success: true });
    });
    it('should throw if adapter fails', async () => {
      blockchainWaasAdapter.resendWebhook.mockRejectedValue(new Error('fail'));
      await expect(service.resendWebhook({ txId: 't1' })).rejects.toThrow('fail');
    });
  });

  describe('handleTransactionBroadcasted', () => {
    const mockWebhookData = {
      id: 'provider-ref-123',
      txHash: '0x1234567890abcdef',
      status: 'BROADCASTING',
      assetId: 'USDC',
      amountInfo: { amount: '100.00' },
      source: { type: 'VAULT_ACCOUNT', id: 'vault-123' },
      destination: { type: 'VAULT_ACCOUNT', id: 'vault-456' },
      operation: 'TRANSFER',
      createdAt: new Date(),
      lastUpdated: new Date(),
    } as any;

    const mockTransaction = {
      id: 'tx-123',
      blockchain_wallet_id: 'wallet-123',
      asset: 'USDC',
      amount: '100.00',
      status: TransactionStatus.PENDING,
      type: 'debit',
      tx_hash: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as any;

    beforeEach(() => {
      // Add the new repository method to the mock
      blockchainWalletTransactionRepository.findByProviderReference = jest.fn();
    });

    it('should update transaction with hash successfully', async () => {
      blockchainWalletTransactionRepository.findByProviderReference.mockResolvedValue(mockTransaction);
      blockchainWalletTransactionRepository.update.mockResolvedValue({
        ...mockTransaction,
        tx_hash: mockWebhookData.txHash,
      });

      await service['handleTransactionBroadcasted'](mockWebhookData);

      expect(blockchainWalletTransactionRepository.findByProviderReference).toHaveBeenCalledWith(mockWebhookData.id);
      expect(blockchainWalletTransactionRepository.update).toHaveBeenCalledWith(mockTransaction.id, {
        tx_hash: mockWebhookData.txHash,
        status: TransactionStatus.PENDING,
      });
    });

    it('should handle transaction not found gracefully', async () => {
      blockchainWalletTransactionRepository.findByProviderReference.mockResolvedValue(null);

      await service['handleTransactionBroadcasted'](mockWebhookData);

      expect(blockchainWalletTransactionRepository.findByProviderReference).toHaveBeenCalledWith(mockWebhookData.id);
      expect(blockchainWalletTransactionRepository.update).not.toHaveBeenCalled();
    });

    it('should handle repository errors', async () => {
      const error = new Error('Database connection failed');
      blockchainWalletTransactionRepository.findByProviderReference.mockRejectedValue(error);

      await expect(service['handleTransactionBroadcasted'](mockWebhookData)).rejects.toThrow(error);
    });

    it('should handle update errors', async () => {
      const error = new Error('Update failed');
      blockchainWalletTransactionRepository.findByProviderReference.mockResolvedValue(mockTransaction);
      blockchainWalletTransactionRepository.update.mockRejectedValue(error);

      await expect(service['handleTransactionBroadcasted'](mockWebhookData)).rejects.toThrow(error);
    });

    it('should handle empty transaction hash', async () => {
      const webhookDataWithEmptyHash = {
        ...mockWebhookData,
        txHash: '',
      };

      blockchainWalletTransactionRepository.findByProviderReference.mockResolvedValue(mockTransaction);
      blockchainWalletTransactionRepository.update.mockResolvedValue({
        ...mockTransaction,
        tx_hash: '',
      });

      await service['handleTransactionBroadcasted'](webhookDataWithEmptyHash);

      expect(blockchainWalletTransactionRepository.update).toHaveBeenCalledWith(mockTransaction.id, {
        tx_hash: '',
        status: TransactionStatus.PENDING,
      });
    });

    it('should handle null transaction hash', async () => {
      const webhookDataWithNullHash = {
        ...mockWebhookData,
        txHash: null,
      };

      blockchainWalletTransactionRepository.findByProviderReference.mockResolvedValue(mockTransaction);
      blockchainWalletTransactionRepository.update.mockResolvedValue({
        ...mockTransaction,
        tx_hash: null,
      });

      await service['handleTransactionBroadcasted'](webhookDataWithNullHash);

      expect(blockchainWalletTransactionRepository.update).toHaveBeenCalledWith(mockTransaction.id, {
        tx_hash: null,
        status: TransactionStatus.PENDING,
      });
    });

    it('should handle very long transaction hash', async () => {
      const longHash = '0x' + 'a'.repeat(1000);
      const webhookDataWithLongHash = {
        ...mockWebhookData,
        txHash: longHash,
      };

      blockchainWalletTransactionRepository.findByProviderReference.mockResolvedValue(mockTransaction);
      blockchainWalletTransactionRepository.update.mockResolvedValue({
        ...mockTransaction,
        tx_hash: longHash,
      });

      await service['handleTransactionBroadcasted'](webhookDataWithLongHash);

      expect(blockchainWalletTransactionRepository.update).toHaveBeenCalledWith(mockTransaction.id, {
        tx_hash: longHash,
        status: TransactionStatus.PENDING,
      });
    });

    it('should handle special characters in transaction hash', async () => {
      const specialHash = '0x1234567890abcdef@#$%^&*()_+-=[]{}|;:,.<>?';
      const webhookDataWithSpecialHash = {
        ...mockWebhookData,
        txHash: specialHash,
      };

      blockchainWalletTransactionRepository.findByProviderReference.mockResolvedValue(mockTransaction);
      blockchainWalletTransactionRepository.update.mockResolvedValue({
        ...mockTransaction,
        tx_hash: specialHash,
      });

      await service['handleTransactionBroadcasted'](webhookDataWithSpecialHash);

      expect(blockchainWalletTransactionRepository.update).toHaveBeenCalledWith(mockTransaction.id, {
        tx_hash: specialHash,
        status: TransactionStatus.PENDING,
      });
    });
  });

  describe('transaction scope handling', () => {
    it('should set EXTERNAL scope for debit transactions with destination', () => {
      const metadata = {
        destination: '0x1234567890abcdef',
        description: 'External transfer',
        provider_reference: 'ref-123',
        provider_metadata: {},
        transaction_scope: TransactionScope.EXTERNAL,
      };

      const result = service['buildBlockchainWalletDebitTransactionData']({
        walletId: 'wallet-123',
        transactionType: BlockchainWalletTransactionType.WITHDRAWAL,
        debitAmount: AssetAmount.fromDecimal('USDC', '100.00', 6),
        balanceBefore: AssetAmount.fromDecimal('USDC', '500.00', 6),
        balanceAfter: AssetAmount.fromDecimal('USDC', '400.00', 6),
        asset: 'USDC',
        metadata,
        idempotencyKey: 'key-123',
        type: 'debit',
      });

      expect(result.transaction_scope).toBe(TransactionScope.EXTERNAL);
    });

    it('should set INTERNAL scope for debit transactions without destination', () => {
      const metadata = {
        destination: '',
        description: 'Internal transfer',
        provider_reference: 'ref-123',
        provider_metadata: {},
        transaction_scope: TransactionScope.INTERNAL,
      };

      const result = service['buildBlockchainWalletDebitTransactionData']({
        walletId: 'wallet-123',
        transactionType: BlockchainWalletTransactionType.TRANSFER_OUT,
        debitAmount: AssetAmount.fromDecimal('USDC', '100.00', 6),
        balanceBefore: AssetAmount.fromDecimal('USDC', '500.00', 6),
        balanceAfter: AssetAmount.fromDecimal('USDC', '400.00', 6),
        asset: 'USDC',
        metadata,
        idempotencyKey: 'key-123',
        type: 'debit',
      });

      expect(result.transaction_scope).toBe(TransactionScope.INTERNAL);
    });

    it('should set EXTERNAL scope for fund transactions with destination', () => {
      const wallet = { id: 'wallet-123', asset: 'USDC' } as any;
      const txData = {
        transaction_type: BlockchainWalletTransactionType.DEPOSIT,
        description: 'External deposit',
        provider_reference: 'ref-123',
        tx_hash: '0x1234567890abcdef',
        network_fee: '0.001',
        metadata: {},
      };

      const result = service['buildBlockchainWalletFundTransactionData']({
        wallet,
        txData,
        creditAmount: AssetAmount.fromDecimal('USDC', '100.00', 6),
        balanceBefore: AssetAmount.fromDecimal('USDC', '400.00', 6),
        balanceAfter: AssetAmount.fromDecimal('USDC', '500.00', 6),
        destination: '0x1234567890abcdef',
        transaction_scope: TransactionScope.EXTERNAL,
      });

      expect(result.transaction_scope).toBe(TransactionScope.EXTERNAL);
    });

    it('should set INTERNAL scope for fund transactions without destination', () => {
      const wallet = { id: 'wallet-123', asset: 'USDC' } as any;
      const txData = {
        transaction_type: BlockchainWalletTransactionType.TRANSFER_IN,
        description: 'Internal transfer',
        provider_reference: 'ref-123',
        tx_hash: '0x1234567890abcdef',
        network_fee: '0.001',
        metadata: {},
      };

      const result = service['buildBlockchainWalletFundTransactionData']({
        wallet,
        txData,
        creditAmount: AssetAmount.fromDecimal('USDC', '100.00', 6),
        balanceBefore: AssetAmount.fromDecimal('USDC', '400.00', 6),
        balanceAfter: AssetAmount.fromDecimal('USDC', '500.00', 6),
        destination: '',
        transaction_scope: TransactionScope.INTERNAL,
      });

      expect(result.transaction_scope).toBe(TransactionScope.INTERNAL);
    });
  });

  describe('fundWalletFromGasStation', () => {
    const mockUser = { id: 'user-123', username: 'testuser' } as IUser;
    const mockWallet = {
      id: 'wallet-123',
      user_id: 'user-123',
      asset: 'USDC',
      provider_account_ref: 'vault-123',
      balance: '100.00',
      decimal: 6,
    } as BlockchainWalletModel;

    it('should fund wallet from gas station successfully', async () => {
      const params = {
        wallet_id: 'wallet-123',
        native_asset_id: 'ETH',
        amount: 0.01,
        note: 'Gas funding',
        idempotencyKey: 'key-123',
      };

      blockchainWalletRepository.findUserWalletById.mockResolvedValue(mockWallet);
      blockchainGasFundTransactionService.create.mockResolvedValue({
        id: 'gas-tx-123',
        status: TransactionStatus.PENDING,
      } as any);
      blockchainWaasAdapter.createTransaction.mockResolvedValue({
        id: 'provider-tx-123',
        status: 'PENDING',
        externalTxId: 'gas-tx-123',
      } as any);
      blockchainGasFundTransactionService.updateProviderReference.mockResolvedValue(undefined);

      const result = await service.fundWalletFromGasStation(mockUser, params);

      expect(result.transactionId).toBe('provider-tx-123');
      expect(result.status).toBe('PENDING');
      expect(blockchainGasFundTransactionService.create).toHaveBeenCalled();
      expect(blockchainWaasAdapter.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'TRANSFER',
          assetId: 'ETH',
          amount: '0.01',
          source: { type: 'GAS_STATION' },
          destination: { type: 'VAULT_ACCOUNT', id: 'vault-123' },
        }),
      );
    });

    it('should throw if wallet not found', async () => {
      blockchainWalletRepository.findUserWalletById.mockResolvedValue(null);

      await expect(
        service.fundWalletFromGasStation(mockUser, {
          wallet_id: 'wallet-123',
          amount: 0.01,
        }),
      ).rejects.toThrow('Wallet not found or does not belong to user');
    });

    it('should throw if amount is zero or negative', async () => {
      blockchainWalletRepository.findUserWalletById.mockResolvedValue(mockWallet);

      await expect(
        service.fundWalletFromGasStation(mockUser, {
          wallet_id: 'wallet-123',
          amount: 0,
        }),
      ).rejects.toThrow('Amount must be greater than zero');
    });

    it('should mark transaction as failed on error', async () => {
      blockchainWalletRepository.findUserWalletById.mockResolvedValue(mockWallet);
      blockchainGasFundTransactionService.create.mockResolvedValue({
        id: 'gas-tx-123',
        status: TransactionStatus.PENDING,
      } as any);
      blockchainWaasAdapter.createTransaction.mockRejectedValue(new Error('Provider error'));
      blockchainGasFundTransactionService.markAsFailed.mockResolvedValue(undefined);

      await expect(
        service.fundWalletFromGasStation(mockUser, {
          wallet_id: 'wallet-123',
          amount: 0.01,
        }),
      ).rejects.toThrow('Provider error');

      expect(blockchainGasFundTransactionService.markAsFailed).toHaveBeenCalled();
    });
  });

  describe('fundWallet', () => {
    const mockWallet = {
      id: 'wallet-123',
      user_id: 'user-123',
      asset: 'USDC',
      balance: '100.00',
      decimal: 6,
    } as BlockchainWalletModel;

    it('should fund wallet successfully', async () => {
      const txData = {
        amount: '50.00',
        asset: 'USDC',
        transaction_type: BlockchainWalletTransactionType.DEPOSIT,
        description: 'External deposit',
        provider_reference: 'ref-123',
        peer_wallet_address: '0x123',
      };

      blockchainWalletRepository.findById.mockResolvedValue(mockWallet as any);
      blockchainWalletTransactionRepository.create.mockResolvedValue({
        id: 'tx-123',
        status: TransactionStatus.COMPLETED,
      } as any);
      transactionRepository.create.mockResolvedValue({ id: 'main-tx-123' } as any);
      blockchainWalletRepository.update.mockResolvedValue({
        ...mockWallet,
        balance: '150.00',
      } as any);
      blockchainWalletTransactionRepository.update.mockResolvedValue(undefined);

      const result = await service.fundWallet('wallet-123', txData);

      expect(result.blockchainWalletTransaction).toBeDefined();
      expect(result.wallet).toBeDefined();
      expect(blockchainWalletRepository.update).toHaveBeenCalledWith(
        'wallet-123',
        expect.objectContaining({ balance: expect.any(String) }),
        expect.any(Object),
      );
    });

    it('should throw if wallet not found', async () => {
      blockchainWalletRepository.findById.mockResolvedValue(null);

      await expect(
        service.fundWallet('wallet-123', {
          amount: '50.00',
          asset: 'USDC',
          transaction_type: BlockchainWalletTransactionType.DEPOSIT,
        }),
      ).rejects.toThrow('Blockchain wallet with ID wallet-123 not found');
    });

    it('should throw if required fields are missing', async () => {
      blockchainWalletRepository.findById.mockResolvedValue(mockWallet as any);

      await expect(service.fundWallet('wallet-123', {} as any)).rejects.toThrow(
        'amount, asset, and transaction_type are required in txData',
      );
    });

    it('should throw if asset mismatch', async () => {
      blockchainWalletRepository.findById.mockResolvedValue(mockWallet as any);

      await expect(
        service.fundWallet('wallet-123', {
          amount: '50.00',
          asset: 'USDT',
          transaction_type: BlockchainWalletTransactionType.DEPOSIT,
        }),
      ).rejects.toThrow('Asset does not match wallet asset');
    });
  });

  describe('createInternalBlockchainAccount', () => {
    const mockUser = { id: 'user-123', username: 'testuser' } as IUser;

    it('should create internal blockchain account and wallet', async () => {
      blockchainAccountsService.getUserAccounts.mockResolvedValue([]);
      jest.spyOn(service, 'createBlockchainAccount').mockResolvedValue({
        id: 'acc-123',
        provider_ref: 'provider-acc-123',
        rails: 'crypto',
      } as any);
      blockchainWalletRepository.findActiveWalletByUserIdAndAsset
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'wallet-123',
          asset: 'USDC_SOL',
          user_id: 'user-123',
        } as any)
        .mockResolvedValueOnce({
          id: 'wallet-123',
          asset: 'USDC_SOL',
          user_id: 'user-123',
        } as any);
      jest.spyOn(service, 'createBlockchainWallet').mockResolvedValue({
        successful: [{ asset_id: 'USDC_SOL' }],
        failed: [],
      } as any);
      blockchainWalletRepository.update.mockResolvedValue(undefined);

      const result = await service.createInternalBlockchainAccount(mockUser, 'crypto');

      expect(result).toBeDefined();
      expect(result.id).toBe('wallet-123');
    });

    it('should return existing wallet if already exists', async () => {
      const existingWallet = {
        id: 'wallet-123',
        asset: 'USDC_SOL',
        user_id: 'user-123',
      } as any;

      blockchainAccountsService.getUserAccounts.mockResolvedValue([
        { id: 'acc-123', rails: 'crypto', provider_ref: 'provider-acc-123' },
      ] as any);
      blockchainWalletRepository.findActiveWalletByUserIdAndAsset.mockResolvedValue(existingWallet);

      const result = await service.createInternalBlockchainAccount(mockUser, 'crypto');

      expect(result).toEqual(existingWallet);
    });
  });

  describe('getUserWalletTransactions', () => {
    it('should get transactions for user wallet', async () => {
      const mockTransactions = [{ id: 'tx-1' }, { id: 'tx-2' }];
      blockchainWalletRepository.findUserWalletById.mockResolvedValue({
        id: 'wallet-123',
        user_id: 'user-123',
      } as any);
      blockchainWalletTransactionService.getUserTransactions.mockResolvedValue(mockTransactions as any);

      const result = await service.getUserWalletTransactions('user-123', { walletId: 'wallet-123' } as any);

      expect(result).toEqual(mockTransactions);
      expect(blockchainWalletTransactionService.getUserTransactions).toHaveBeenCalledWith(
        'wallet-123',
        expect.any(Object),
        true,
      );
    });

    it('should throw if wallet does not belong to user', async () => {
      blockchainWalletRepository.findUserWalletById.mockResolvedValue(null);

      await expect(service.getUserWalletTransactions('user-123', { walletId: 'wallet-456' } as any)).rejects.toThrow(
        'walletId does not belong to the user',
      );
    });

    it('should use userId if no walletId provided', async () => {
      const mockTransactions = [{ id: 'tx-1' }];
      blockchainWalletTransactionService.getUserTransactions.mockResolvedValue(mockTransactions as any);

      const result = await service.getUserWalletTransactions('user-123', {} as any);

      expect(result).toEqual(mockTransactions);
      expect(blockchainWalletTransactionService.getUserTransactions).toHaveBeenCalledWith(
        'user-123',
        expect.any(Object),
        false,
      );
    });
  });

  describe('convertToCurrency', () => {
    const mockUser = { id: 'user-123', username: 'testuser' } as IUser;
    const mockWallet = {
      id: 'wallet-123',
      user_id: 'user-123',
      asset: 'USDC',
      base_asset: 'ETH',
      provider_account_ref: 'vault-123',
      balance: '100.00',
      decimal: 6,
    } as BlockchainWalletModel;

    it('should convert to USD successfully', async () => {
      blockchainWalletRepository.findUserWalletById.mockResolvedValue(mockWallet);
      blockchainWalletTransactionRepository.findFirstPendingByUserId.mockResolvedValue(null);
      depositAddressService.getDepositAddresses.mockResolvedValue([
        { provider: 'zerohash', address: '0x123', asset: 'USDC.ETH' },
      ] as any);
      jest.spyOn<any, any>(service, 'debitWallet').mockResolvedValue({
        blockchainWalletTransaction: { id: 'tx-123' },
      });
      jest.spyOn<any, any>(service, 'externalTransfer').mockResolvedValue({
        transactionId: 'provider-tx-123',
        status: 'PENDING',
      });
      blockchainWalletTransactionRepository.update.mockResolvedValue(undefined);

      const result = await service.convertToCurrency(mockUser, 'wallet-123', 50, 'USD', 'Convert to USD');

      expect(result.transactionId).toBe('tx-123');
      expect(result.status).toBe('PENDING');
      expect(depositAddressService.getDepositAddresses).toHaveBeenCalled();
    });

    it('should convert to NGN successfully', async () => {
      blockchainWalletRepository.findUserWalletById.mockResolvedValue(mockWallet);
      blockchainWalletTransactionRepository.findFirstPendingByUserId.mockResolvedValue(null);
      jest.spyOn<any, any>(service, 'debitWallet').mockResolvedValue({
        blockchainWalletTransaction: { id: 'tx-123' },
      });
      jest.spyOn<any, any>(service, 'externalTransfer').mockResolvedValue({
        transactionId: 'provider-tx-123',
        status: 'PENDING',
      });
      blockchainWalletTransactionRepository.update.mockResolvedValue(undefined);

      const result = await service.convertToCurrency(mockUser, 'wallet-123', 50, 'NGN', 'Convert to NGN');

      expect(result.transactionId).toBe('tx-123');
      expect(result.status).toBe('PENDING');
    });

    it('should throw if wallet not found', async () => {
      blockchainWalletRepository.findUserWalletById.mockResolvedValue(null);

      await expect(service.convertToCurrency(mockUser, 'wallet-123', 50, 'USD')).rejects.toThrow(
        'Wallet not found or does not belong to user',
      );
    });

    it('should throw if pending transaction exists', async () => {
      blockchainWalletRepository.findUserWalletById.mockResolvedValue(mockWallet);
      blockchainWalletTransactionRepository.findFirstPendingByUserId.mockResolvedValue({ id: 'pending-tx' } as any);

      await expect(service.convertToCurrency(mockUser, 'wallet-123', 50, 'USD')).rejects.toThrow(
        'You have a pending transaction',
      );
    });

    it('should throw if no ZeroHash deposit address for USD', async () => {
      blockchainWalletRepository.findUserWalletById.mockResolvedValue(mockWallet);
      blockchainWalletTransactionRepository.findFirstPendingByUserId.mockResolvedValue(null);
      depositAddressService.getDepositAddresses.mockResolvedValue([]);

      await expect(service.convertToCurrency(mockUser, 'wallet-123', 50, 'USD')).rejects.toThrow(
        'No ZeroHash deposit address found for user',
      );
    });

    it('should throw for invalid currency', async () => {
      blockchainWalletRepository.findUserWalletById.mockResolvedValue(mockWallet);
      blockchainWalletTransactionRepository.findFirstPendingByUserId.mockResolvedValue(null);

      await expect(service.convertToCurrency(mockUser, 'wallet-123', 50, 'EUR' as any)).rejects.toThrow(
        'Invalid currency',
      );
    });

    it('should revert debit on error', async () => {
      blockchainWalletRepository.findUserWalletById.mockResolvedValue(mockWallet);
      blockchainWalletTransactionRepository.findFirstPendingByUserId.mockResolvedValue(null);
      depositAddressService.getDepositAddresses.mockResolvedValue([
        { provider: 'zerohash', address: '0x123', asset: 'USDC.ETH' },
      ] as any);
      jest.spyOn<any, any>(service, 'debitWallet').mockResolvedValue({
        blockchainWalletTransaction: { id: 'tx-123' },
      });
      jest.spyOn<any, any>(service, 'externalTransfer').mockRejectedValue(new Error('Transfer failed'));
      jest.spyOn<any, any>(service, 'revertWalletDebit').mockResolvedValue(undefined);

      await expect(service.convertToCurrency(mockUser, 'wallet-123', 50, 'USD')).rejects.toThrow('Transfer failed');

      expect(service['revertWalletDebit']).toHaveBeenCalled();
    });
  });

  describe('sendFromMasterVaultToAddress', () => {
    it('should call externalTransfer with correct parameters using default assetId', async () => {
      const mockResponse = {
        transactionId: 'tx-123',
        status: 'PENDING',
        externalTxId: 'ext-tx-123',
      };

      jest.spyOn<any, any>(service, 'externalTransfer').mockResolvedValue(mockResponse);

      const params = {
        amount: 100,
        destinationAddress: '0x1234567890abcdef',
        note: 'Test transfer',
        idempotencyKey: 'test-key-123',
      };

      const result = await service.sendFromMasterVaultToAddress(params);

      expect(service['externalTransfer']).toHaveBeenCalledWith({
        assetId: 'USDC_ETH_TEST5_0GER',
        amount: '100',
        sourceVaultId: '17',
        destinationAddress: '0x1234567890abcdef',
        destinationTag: undefined,
        note: 'Test transfer',
        idempotencyKey: 'test-key-123',
        externalTxId: undefined,
      });

      expect(result).toEqual(mockResponse);
    });

    it('should call externalTransfer with custom assetId when provided', async () => {
      const mockResponse = {
        transactionId: 'tx-456',
        status: 'PENDING',
      };

      jest.spyOn<any, any>(service, 'externalTransfer').mockResolvedValue(mockResponse);

      const params = {
        amount: 50,
        destinationAddress: '0xabcdef1234567890',
        note: 'Custom asset transfer',
        idempotencyKey: 'custom-key-456',
        assetId: 'USDC_BASECHAIN_ETH_TEST5_8SH8',
      };

      const result = await service.sendFromMasterVaultToAddress(params);

      expect(service['externalTransfer']).toHaveBeenCalledWith({
        assetId: 'USDC_BASECHAIN_ETH_TEST5_8SH8',
        amount: '50',
        sourceVaultId: '17',
        destinationAddress: '0xabcdef1234567890',
        destinationTag: undefined,
        note: 'Custom asset transfer',
        idempotencyKey: 'custom-key-456',
        externalTxId: undefined,
      });

      expect(result).toEqual(mockResponse);
    });

    it('should pass all optional parameters correctly', async () => {
      const mockResponse = {
        transactionId: 'tx-789',
        status: 'COMPLETED',
        externalTxId: 'ext-tx-789',
      };

      jest.spyOn<any, any>(service, 'externalTransfer').mockResolvedValue(mockResponse);

      const params = {
        amount: 200,
        destinationAddress: '0x9876543210fedcba',
        note: 'Transfer with all params',
        idempotencyKey: 'full-params-key',
        assetId: 'USDC_POLYGON_TEST',
        destinationTag: 'tag123',
        externalTxId: 'external-id-789',
      };

      const result = await service.sendFromMasterVaultToAddress(params);

      expect(service['externalTransfer']).toHaveBeenCalledWith({
        assetId: 'USDC_POLYGON_TEST',
        amount: '200',
        sourceVaultId: '17',
        destinationAddress: '0x9876543210fedcba',
        destinationTag: 'tag123',
        note: 'Transfer with all params',
        idempotencyKey: 'full-params-key',
        externalTxId: 'external-id-789',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should convert amount to string', async () => {
      const mockResponse = {
        transactionId: 'tx-string-test',
        status: 'PENDING',
      };

      jest.spyOn<any, any>(service, 'externalTransfer').mockResolvedValue(mockResponse);

      const params = {
        amount: 123.45,
        destinationAddress: '0x123',
        idempotencyKey: 'string-test-key',
      };

      await service.sendFromMasterVaultToAddress(params);

      expect(service['externalTransfer']).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '123.45',
        }),
      );
    });

    it('should always use FIREBLOCKS_MASTER_VAULT_ID as sourceVaultId', async () => {
      const mockResponse = {
        transactionId: 'tx-vault-test',
        status: 'PENDING',
      };

      jest.spyOn<any, any>(service, 'externalTransfer').mockResolvedValue(mockResponse);

      const params = {
        amount: 100,
        destinationAddress: '0x123',
        idempotencyKey: 'vault-test-key',
      };

      await service.sendFromMasterVaultToAddress(params);

      expect(service['externalTransfer']).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceVaultId: '17',
        }),
      );
    });

    it('should propagate errors from externalTransfer', async () => {
      const error = new Error('Transfer failed');
      jest.spyOn<any, any>(service, 'externalTransfer').mockRejectedValue(error);

      const params = {
        amount: 100,
        destinationAddress: '0x123',
        idempotencyKey: 'error-test-key',
      };

      await expect(service.sendFromMasterVaultToAddress(params)).rejects.toThrow('Transfer failed');
    });
  });

  describe('createCustomWallet', () => {
    const mockUser = { id: 'user-123', username: 'testuser' } as UserModel;

    beforeEach(() => {
      jest.spyOn(StableCoinsService, 'getProviderAssetId').mockReturnValue('USDC');
      jest.spyOn(StableCoinsService, 'getProviderNativeAsset').mockReturnValue('eth');
      jest.spyOn(StableCoinsService, 'getStableCoinConfigBySymbol').mockReturnValue({
        name: 'USD Coin',
        symbol: 'USDC',
        type: 'ERC20',
        decimals: 6,
        image_url: '/images/usdc.png',
        provider_mappings: {},
        network: 'ETH' as any,
        is_active: true,
      });
    });

    it('should create custom Ethereum wallet successfully', async () => {
      const mockAddressResult = {
        address: '0x1234567890123456789012345678901234567890',
        privateKey: 'private-key',
        encryptedPrivateKey: 'encrypted-key',
        encryptionIv: 'encryption-iv',
        publicKey: 'public-key',
      };

      blockchainService.createEthereumAddress.mockReturnValue(mockAddressResult);
      blockchainWalletRepository.findActiveWalletByUserIdAndAsset.mockResolvedValue(null);
      blockchainWalletRepository.create.mockResolvedValue({
        id: 'wallet-123',
        address: mockAddressResult.address,
        asset: 'USDC',
      } as any);
      blockchainWalletKeyRepository.create.mockResolvedValue({} as any);

      const params: ICreateCustomWallet = {
        network: 'ethereum',
        asset: 'USDC',
      };

      const result = await service.createCustomWallet(mockUser, params);

      expect(result).toBeDefined();
      expect(result.id).toBe('wallet-123');
      expect(blockchainService.createEthereumAddress).toHaveBeenCalled();
      expect(blockchainWalletRepository.create).toHaveBeenCalled();
      expect(blockchainWalletKeyRepository.create).toHaveBeenCalled();
    });

    it('should create custom Solana wallet successfully', async () => {
      const mockAddressResult = {
        address: 'SolanaAddress123456789012345678901234567890',
        privateKey: 'private-key',
        encryptedPrivateKey: 'encrypted-key',
        encryptionIv: 'encryption-iv',
        publicKey: 'public-key',
      };

      blockchainService.createSolanaAddress.mockReturnValue(mockAddressResult);
      blockchainWalletRepository.findActiveWalletByUserIdAndAsset.mockResolvedValue(null);
      blockchainWalletRepository.create.mockResolvedValue({
        id: 'wallet-123',
        address: mockAddressResult.address,
        asset: 'USDC',
      } as any);
      blockchainWalletKeyRepository.create.mockResolvedValue({} as any);

      const params: ICreateCustomWallet = {
        network: 'solana',
        asset: 'USDC',
      };

      const result = await service.createCustomWallet(mockUser, params);

      expect(result).toBeDefined();
      expect(blockchainService.createSolanaAddress).toHaveBeenCalled();
    });

    it('should throw error for invalid network', async () => {
      const params: ICreateCustomWallet = {
        network: 'invalid' as any,
        asset: 'USDC',
      };

      await expect(service.createCustomWallet(mockUser, params)).rejects.toThrow(
        'Network must be either "ethereum" or "solana"',
      );
    });

    it('should throw error when asset is required but not provided', async () => {
      const params: ICreateCustomWallet = {
        network: 'ethereum',
        useDefault: false,
      };

      await expect(service.createCustomWallet(mockUser, params)).rejects.toThrow(
        'Asset is required when useDefault is false',
      );
    });

    it('should use default asset when useDefault is true', async () => {
      const mockAddressResult = {
        address: '0x1234567890123456789012345678901234567890',
        privateKey: 'private-key',
        encryptedPrivateKey: 'encrypted-key',
        encryptionIv: 'encryption-iv',
        publicKey: 'public-key',
      };

      jest.spyOn(StableCoinsService, 'getDefaultStableCoin').mockReturnValue({
        id: 'USDC',
        name: 'USD Coin',
        symbol: 'USDC',
        type: 'ERC20',
        nativeAsset: 'eth',
        imageUrl: '/images/usdc.png',
        decimals: 6,
      });

      blockchainService.createEthereumAddress.mockReturnValue(mockAddressResult);
      blockchainWalletRepository.findActiveWalletByUserIdAndAsset.mockResolvedValue(null);
      blockchainWalletRepository.create.mockResolvedValue({
        id: 'wallet-123',
        address: mockAddressResult.address,
      } as any);
      blockchainWalletKeyRepository.create.mockResolvedValue({} as any);

      const params: ICreateCustomWallet = {
        network: 'ethereum',
        useDefault: true,
      };

      const result = await service.createCustomWallet(mockUser, params);

      expect(result).toBeDefined();
      expect(StableCoinsService.getDefaultStableCoin).toHaveBeenCalledWith('custom');
    });

    it('should throw error when no default stablecoin configured', async () => {
      jest.spyOn(StableCoinsService, 'getDefaultStableCoin').mockReturnValue(undefined);

      const params: ICreateCustomWallet = {
        network: 'ethereum',
        useDefault: true,
      };

      await expect(service.createCustomWallet(mockUser, params)).rejects.toThrow('No default stablecoin configured');
    });

    it('should use base asset when useBase is true', async () => {
      const mockAddressResult = {
        address: '0x1234567890123456789012345678901234567890',
        privateKey: 'private-key',
        encryptedPrivateKey: 'encrypted-key',
        encryptionIv: 'encryption-iv',
        publicKey: 'public-key',
      };

      jest.spyOn(StableCoinsService, 'getDefaultStableCoin').mockReturnValue({
        id: 'USDC',
        name: 'USD Coin',
        symbol: 'USDC',
        type: 'ERC20',
        nativeAsset: 'eth',
        imageUrl: '/images/usdc.png',
        decimals: 6,
      });

      blockchainService.createEthereumAddress.mockReturnValue(mockAddressResult);
      blockchainWalletRepository.findActiveWalletByUserIdAndAsset.mockResolvedValue(null);
      blockchainWalletRepository.create.mockResolvedValue({
        id: 'wallet-123',
        address: mockAddressResult.address,
      } as any);
      blockchainWalletKeyRepository.create.mockResolvedValue({} as any);

      const params: ICreateCustomWallet = {
        network: 'ethereum',
        useDefault: true,
        useBase: true,
      };

      await service.createCustomWallet(mockUser, params);

      expect(blockchainWalletRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          asset: 'eth',
          base_asset: '',
        }),
      );
    });

    it('should return existing wallet if custom wallet already exists', async () => {
      const existingWallet = {
        id: 'wallet-123',
        asset: 'USDC',
        provider: BlockchainWalletProvider.CUSTOM,
      } as any;

      blockchainWalletRepository.findActiveWalletByUserIdAndAsset.mockResolvedValue(existingWallet);

      const params: ICreateCustomWallet = {
        network: 'ethereum',
        asset: 'USDC',
      };

      const result = await service.createCustomWallet(mockUser, params);

      expect(result).toEqual(existingWallet);
      expect(blockchainService.createEthereumAddress).not.toHaveBeenCalled();
      expect(blockchainWalletRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when encrypted private key is missing', async () => {
      const mockAddressResult = {
        address: '0x1234567890123456789012345678901234567890',
        privateKey: 'private-key',
        encryptedPrivateKey: undefined,
        encryptionIv: 'encryption-iv',
        publicKey: 'public-key',
      };

      blockchainService.createEthereumAddress.mockReturnValue(mockAddressResult);
      blockchainWalletRepository.findActiveWalletByUserIdAndAsset.mockResolvedValue(null);

      const params: ICreateCustomWallet = {
        network: 'ethereum',
        asset: 'USDC',
      };

      await expect(service.createCustomWallet(mockUser, params)).rejects.toThrow('Failed to encrypt private key');
    });

    it('should throw error when asset not found in configuration', async () => {
      jest.spyOn(StableCoinsService, 'getStableCoinConfigBySymbol').mockReturnValue(undefined);

      const params: ICreateCustomWallet = {
        network: 'ethereum',
        asset: 'INVALID',
      };

      await expect(service.createCustomWallet(mockUser, params)).rejects.toThrow(
        'Asset INVALID not found in configuration',
      );
    });

    it('should handle crypto rail correctly', async () => {
      const mockAddressResult = {
        address: '0x1234567890123456789012345678901234567890',
        privateKey: 'private-key',
        encryptedPrivateKey: 'encrypted-key',
        encryptionIv: 'encryption-iv',
        publicKey: 'public-key',
      };

      blockchainService.createEthereumAddress.mockReturnValue(mockAddressResult);
      blockchainWalletRepository.findActiveWalletByUserIdAndAsset.mockResolvedValue(null);
      blockchainWalletRepository.create.mockResolvedValue({
        id: 'wallet-123',
        address: mockAddressResult.address,
      } as any);
      blockchainWalletKeyRepository.create.mockResolvedValue({} as any);

      const params: ICreateCustomWallet = {
        network: 'ethereum',
        asset: 'USDC',
        rail: 'crypto' as any,
      };

      await service.createCustomWallet(mockUser, params);

      expect(blockchainWalletRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rails: 'crypto',
        }),
      );
    });
  });
});
