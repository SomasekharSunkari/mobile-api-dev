import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BlockchainAccountProvider,
  BlockchainAccountStatus,
} from '../../database/models/blockchain_account/blockchain_account.interface';
import { BlockchainAccountModel } from '../../database/models/blockchain_account/blockchain_account.model';
import { BlockchainAccountsRepository } from './blockchainAccounts.repository';
import { BlockchainAccountsService } from './blockchainAccounts.service';

describe('BlockchainAccountsService', () => {
  let service: BlockchainAccountsService;
  let repository: jest.Mocked<BlockchainAccountsRepository>;

  const mockAccount: BlockchainAccountModel = {
    id: 'account-123',
    user_id: 'user-123',
    provider: BlockchainAccountProvider.FIREBLOCKS,
    provider_ref: 'fireblocks-acc-456',
    status: BlockchainAccountStatus.ACTIVE,
    rails: 'crypto',
    is_visible: true,
    created_at: new Date(),
    updated_at: new Date(),
  } as BlockchainAccountModel;

  const mockInactiveAccount: BlockchainAccountModel = {
    ...mockAccount,
    id: 'account-456',
    status: BlockchainAccountStatus.INACTIVE,
  } as BlockchainAccountModel;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      findByUserId: jest.fn(),
      findActiveByUserId: jest.fn(),
      findByProviderRef: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainAccountsService,
        {
          provide: BlockchainAccountsRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BlockchainAccountsService>(BlockchainAccountsService);
    repository = module.get(BlockchainAccountsRepository);

    // Spy on logger methods
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAccount', () => {
    const userId = 'user-123';
    const providerRef = 'fireblocks-acc-456';

    it('should create a new account when user has no existing accounts', async () => {
      repository.findByUserId.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockAccount);

      const result = await service.createAccount(userId, providerRef);

      expect(repository.findByUserId).toHaveBeenCalledWith(userId);
      expect(repository.create).toHaveBeenCalledWith({
        user_id: userId,
        provider: BlockchainAccountProvider.FIREBLOCKS,
        provider_ref: providerRef,
        status: BlockchainAccountStatus.ACTIVE,
        rails: 'crypto',
        is_visible: true,
      });
      expect(result).toEqual(mockAccount);
      expect(service['logger'].log).toHaveBeenCalledWith(
        `Creating blockchain account for user ${userId} with provider ${BlockchainAccountProvider.FIREBLOCKS}`,
      );
      expect(service['logger'].log).toHaveBeenCalledWith(
        `Created blockchain account ${mockAccount.id} for user ${userId}`,
      );
    });

    it('should create account with custom provider', async () => {
      repository.findByUserId.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockAccount);

      await service.createAccount(userId, providerRef, BlockchainAccountProvider.FIREBLOCKS);

      expect(repository.create).toHaveBeenCalledWith({
        user_id: userId,
        provider: BlockchainAccountProvider.FIREBLOCKS,
        provider_ref: providerRef,
        status: BlockchainAccountStatus.ACTIVE,
        rails: 'crypto',
        is_visible: true,
      });
    });

    it('should return existing account when user already has one', async () => {
      repository.findByUserId.mockResolvedValue([mockAccount]);

      const result = await service.createAccount(userId, providerRef);

      expect(repository.findByUserId).toHaveBeenCalledWith(userId);
      expect(repository.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockAccount);
      expect(service['logger'].log).toHaveBeenCalledWith(
        `User ${userId} already has a ${mockAccount.provider} account with rails crypto and status ${mockAccount.status}`,
      );
    });

    it('should return first existing account when user has multiple accounts', async () => {
      const multipleAccounts = [mockAccount, mockInactiveAccount];
      repository.findByUserId.mockResolvedValue(multipleAccounts);

      const result = await service.createAccount(userId, providerRef);

      expect(result).toEqual(mockAccount);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should handle repository errors during account creation', async () => {
      const error = new Error('Database connection failed');
      repository.findByUserId.mockRejectedValue(error);

      await expect(service.createAccount(userId, providerRef)).rejects.toThrow(error);
      expect(service['logger'].error).toHaveBeenCalledWith(
        `Error creating blockchain account: ${error.message}`,
        error.stack,
      );
    });

    it('should handle repository errors during account lookup', async () => {
      const error = new Error('Database connection failed');
      repository.findByUserId.mockResolvedValue([]);
      repository.create.mockRejectedValue(error);

      await expect(service.createAccount(userId, providerRef)).rejects.toThrow(error);
      expect(service['logger'].error).toHaveBeenCalledWith(
        `Error creating blockchain account: ${error.message}`,
        error.stack,
      );
    });

    it('should handle empty userId', async () => {
      repository.findByUserId.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockAccount);

      await service.createAccount('', providerRef);

      expect(repository.findByUserId).toHaveBeenCalledWith('');
      expect(repository.create).toHaveBeenCalledWith({
        user_id: '',
        provider: BlockchainAccountProvider.FIREBLOCKS,
        provider_ref: providerRef,
        status: BlockchainAccountStatus.ACTIVE,
        rails: 'crypto',
        is_visible: true,
      });
    });

    it('should handle empty providerRef', async () => {
      repository.findByUserId.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockAccount);

      await service.createAccount(userId, '');

      expect(repository.create).toHaveBeenCalledWith({
        user_id: userId,
        provider: BlockchainAccountProvider.FIREBLOCKS,
        provider_ref: '',
        status: BlockchainAccountStatus.ACTIVE,
        rails: 'crypto',
        is_visible: true,
      });
    });
  });

  describe('getUserAccounts', () => {
    const userId = 'user-123';

    it('should return all user accounts', async () => {
      const accounts = [mockAccount, mockInactiveAccount];
      repository.findByUserId.mockResolvedValue(accounts);

      const result = await service.getUserAccounts(userId);

      expect(repository.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual(accounts);
      expect(service['logger'].log).toHaveBeenCalledWith(`Fetching blockchain accounts for user ${userId}`);
      expect(service['logger'].log).toHaveBeenCalledWith(
        `Found ${accounts.length} blockchain accounts for user ${userId}`,
      );
    });

    it('should return empty array when user has no accounts', async () => {
      repository.findByUserId.mockResolvedValue([]);

      const result = await service.getUserAccounts(userId);

      expect(result).toEqual([]);
      expect(service['logger'].log).toHaveBeenCalledWith(`Found 0 blockchain accounts for user ${userId}`);
    });

    it('should handle repository errors', async () => {
      const error = new Error('Database connection failed');
      repository.findByUserId.mockRejectedValue(error);

      await expect(service.getUserAccounts(userId)).rejects.toThrow(error);
      expect(service['logger'].error).toHaveBeenCalledWith(
        `Error fetching user accounts: ${error.message}`,
        error.stack,
      );
    });

    it('should handle empty userId', async () => {
      repository.findByUserId.mockResolvedValue([]);

      await service.getUserAccounts('');

      expect(repository.findByUserId).toHaveBeenCalledWith('');
    });
  });

  describe('getUserActiveAccounts', () => {
    const userId = 'user-123';

    it('should return only active user accounts', async () => {
      const activeAccounts = [mockAccount];
      repository.findActiveByUserId.mockResolvedValue(activeAccounts);

      const result = await service.getUserActiveAccounts(userId);

      expect(repository.findActiveByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual(activeAccounts);
      expect(service['logger'].log).toHaveBeenCalledWith(`Fetching active blockchain accounts for user ${userId}`);
      expect(service['logger'].log).toHaveBeenCalledWith(
        `Found ${activeAccounts.length} active blockchain accounts for user ${userId}`,
      );
    });

    it('should return empty array when user has no active accounts', async () => {
      repository.findActiveByUserId.mockResolvedValue([]);

      const result = await service.getUserActiveAccounts(userId);

      expect(result).toEqual([]);
      expect(service['logger'].log).toHaveBeenCalledWith(`Found 0 active blockchain accounts for user ${userId}`);
    });

    it('should handle repository errors', async () => {
      const error = new Error('Database connection failed');
      repository.findActiveByUserId.mockRejectedValue(error);

      await expect(service.getUserActiveAccounts(userId)).rejects.toThrow(error);
      expect(service['logger'].error).toHaveBeenCalledWith(
        `Error fetching active user accounts: ${error.message}`,
        error.stack,
      );
    });

    it('should handle empty userId', async () => {
      repository.findActiveByUserId.mockResolvedValue([]);

      await service.getUserActiveAccounts('');

      expect(repository.findActiveByUserId).toHaveBeenCalledWith('');
    });
  });

  describe('getAccountById', () => {
    const accountId = 'account-123';

    it('should return account when found', async () => {
      repository.findById.mockResolvedValue(mockAccount as any);

      const result = await service.getAccountById(accountId);

      expect(repository.findById).toHaveBeenCalledWith(accountId);
      expect(result).toEqual(mockAccount);
    });

    it('should throw NotFoundException when account not found', async () => {
      repository.findById.mockResolvedValue(null as any);

      await expect(service.getAccountById(accountId)).rejects.toThrow(
        new NotFoundException(`Blockchain account with ID ${accountId} not found`),
      );
    });

    it('should handle repository errors', async () => {
      const error = new Error('Database connection failed');
      repository.findById.mockRejectedValue(error);

      await expect(service.getAccountById(accountId)).rejects.toThrow(error);
      expect(service['logger'].error).toHaveBeenCalledWith(
        `Error fetching account by ID: ${error.message}`,
        error.stack,
      );
    });

    it('should handle empty accountId', async () => {
      repository.findById.mockResolvedValue(null as any);

      await expect(service.getAccountById('')).rejects.toThrow(
        new NotFoundException('Blockchain account with ID  not found'),
      );
    });

    it('should handle undefined accountId', async () => {
      repository.findById.mockResolvedValue(null as any);

      await expect(service.getAccountById(undefined as any)).rejects.toThrow(
        new NotFoundException('Blockchain account with ID undefined not found'),
      );
    });
  });

  describe('getAccountByProviderRef', () => {
    const providerRef = 'fireblocks-acc-456';

    it('should return account when found', async () => {
      repository.findByProviderRef.mockResolvedValue(mockAccount);

      const result = await service.getAccountByProviderRef(providerRef);

      expect(repository.findByProviderRef).toHaveBeenCalledWith(providerRef);
      expect(result).toEqual(mockAccount);
    });

    it('should throw NotFoundException when account not found', async () => {
      repository.findByProviderRef.mockResolvedValue(null);

      await expect(service.getAccountByProviderRef(providerRef)).rejects.toThrow(
        new NotFoundException(`Blockchain account with provider ref ${providerRef} not found`),
      );
    });

    it('should handle repository errors', async () => {
      const error = new Error('Database connection failed');
      repository.findByProviderRef.mockRejectedValue(error);

      await expect(service.getAccountByProviderRef(providerRef)).rejects.toThrow(error);
      expect(service['logger'].error).toHaveBeenCalledWith(
        `Error fetching account by provider ref: ${error.message}`,
        error.stack,
      );
    });

    it('should handle empty providerRef', async () => {
      repository.findByProviderRef.mockResolvedValue(null);

      await expect(service.getAccountByProviderRef('')).rejects.toThrow(
        new NotFoundException('Blockchain account with provider ref  not found'),
      );
    });

    it('should handle undefined providerRef', async () => {
      repository.findByProviderRef.mockResolvedValue(null);

      await expect(service.getAccountByProviderRef(undefined as any)).rejects.toThrow(
        new NotFoundException('Blockchain account with provider ref undefined not found'),
      );
    });
  });

  describe('updateAccountStatus', () => {
    const accountId = 'account-123';
    const newStatus = BlockchainAccountStatus.FROZEN;

    it('should update account status successfully', async () => {
      repository.findById.mockResolvedValue(mockAccount as any);
      repository.update.mockResolvedValue({ ...mockAccount, status: newStatus } as any);

      const result = await service.updateAccountStatus(accountId, newStatus);

      expect(repository.findById).toHaveBeenCalledWith(accountId);
      expect(repository.update).toHaveBeenCalledWith(accountId, { status: newStatus });
      expect(result.status).toBe(newStatus);
      expect(service['logger'].log).toHaveBeenCalledWith(`Updating account ${accountId} status to ${newStatus}`);
      expect(service['logger'].log).toHaveBeenCalledWith(`Updated account ${accountId} status to ${newStatus}`);
    });

    it('should throw NotFoundException when account not found', async () => {
      repository.findById.mockResolvedValue(null as any);

      await expect(service.updateAccountStatus(accountId, newStatus)).rejects.toThrow(
        new NotFoundException(`Blockchain account with ID ${accountId} not found`),
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should handle repository errors during find', async () => {
      const error = new Error('Database connection failed');
      repository.findById.mockRejectedValue(error);

      await expect(service.updateAccountStatus(accountId, newStatus)).rejects.toThrow(error);
      expect(service['logger'].error).toHaveBeenCalledWith(
        `Error updating account status: ${error.message}`,
        error.stack,
      );
    });

    it('should handle repository errors during update', async () => {
      const error = new Error('Database connection failed');
      repository.findById.mockResolvedValue(mockAccount as any);
      repository.update.mockRejectedValue(error);

      await expect(service.updateAccountStatus(accountId, newStatus)).rejects.toThrow(error);
      expect(service['logger'].error).toHaveBeenCalledWith(
        `Error updating account status: ${error.message}`,
        error.stack,
      );
    });

    it('should handle all status transitions', async () => {
      const statuses = Object.values(BlockchainAccountStatus);
      repository.findById.mockResolvedValue(mockAccount as any);
      repository.update.mockImplementation((id, data) => Promise.resolve({ ...mockAccount, ...data } as any));

      for (const status of statuses) {
        const result = await service.updateAccountStatus(accountId, status);
        expect(result.status).toBe(status);
      }
    });

    it('should handle empty accountId', async () => {
      repository.findById.mockResolvedValue(null as any);

      await expect(service.updateAccountStatus('', newStatus)).rejects.toThrow(
        new NotFoundException('Blockchain account with ID  not found'),
      );
    });

    it('should handle undefined accountId', async () => {
      repository.findById.mockResolvedValue(null as any);

      await expect(service.updateAccountStatus(undefined as any, newStatus)).rejects.toThrow(
        new NotFoundException('Blockchain account with ID undefined not found'),
      );
    });
  });

  describe('deactivateAccount', () => {
    const accountId = 'account-123';

    it('should deactivate account successfully', async () => {
      repository.findById.mockResolvedValue(mockAccount as any);
      repository.update.mockResolvedValue({ ...mockAccount, status: BlockchainAccountStatus.INACTIVE } as any);

      const result = await service.deactivateAccount(accountId);

      expect(repository.update).toHaveBeenCalledWith(accountId, { status: BlockchainAccountStatus.INACTIVE });
      expect(result.status).toBe(BlockchainAccountStatus.INACTIVE);
    });

    it('should handle errors from updateAccountStatus', async () => {
      const error = new Error('Database connection failed');
      repository.findById.mockRejectedValue(error);

      await expect(service.deactivateAccount(accountId)).rejects.toThrow(error);
    });
  });

  describe('activateAccount', () => {
    const accountId = 'account-123';

    it('should activate account successfully', async () => {
      repository.findById.mockResolvedValue(mockInactiveAccount as any);
      repository.update.mockResolvedValue({ ...mockInactiveAccount, status: BlockchainAccountStatus.ACTIVE } as any);

      const result = await service.activateAccount(accountId);

      expect(repository.update).toHaveBeenCalledWith(accountId, { status: BlockchainAccountStatus.ACTIVE });
      expect(result.status).toBe(BlockchainAccountStatus.ACTIVE);
    });

    it('should handle errors from updateAccountStatus', async () => {
      const error = new Error('Database connection failed');
      repository.findById.mockRejectedValue(error);

      await expect(service.activateAccount(accountId)).rejects.toThrow(error);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle null values in account data', async () => {
      const accountWithNulls = {
        ...mockAccount,
        provider_ref: null,
        user_id: null,
      } as any;
      repository.findByUserId.mockResolvedValue([]);
      repository.create.mockResolvedValue(accountWithNulls);

      const result = await service.createAccount('user-123', 'provider-ref');
      expect(result).toEqual(accountWithNulls);
    });

    it('should handle very long strings', async () => {
      const longString = 'a'.repeat(1000);
      repository.findByUserId.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockAccount);

      await service.createAccount(longString, longString);

      expect(repository.create).toHaveBeenCalledWith({
        user_id: longString,
        provider: BlockchainAccountProvider.FIREBLOCKS,
        provider_ref: longString,
        status: BlockchainAccountStatus.ACTIVE,
        rails: 'crypto',
        is_visible: true,
      });
    });

    it('should handle special characters in strings', async () => {
      const specialString = 'user@#$%^&*()_+-=[]{}|;:,.<>?';
      repository.findByUserId.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockAccount);

      await service.createAccount(specialString, specialString);

      expect(repository.create).toHaveBeenCalledWith({
        user_id: specialString,
        provider: BlockchainAccountProvider.FIREBLOCKS,
        provider_ref: specialString,
        status: BlockchainAccountStatus.ACTIVE,
        rails: 'crypto',
        is_visible: true,
      });
    });

    it('should handle concurrent account creation requests', async () => {
      // Simulate race condition where both calls find no existing accounts
      repository.findByUserId.mockResolvedValue([]); // Both calls: no accounts
      repository.create.mockResolvedValue(mockAccount);

      const promises = [
        service.createAccount('user-123', 'provider-ref-1'),
        service.createAccount('user-123', 'provider-ref-2'),
      ];

      const results = await Promise.all(promises);
      expect(results[0]).toEqual(mockAccount);
      expect(results[1]).toEqual(mockAccount);
      expect(repository.create).toHaveBeenCalledTimes(2); // Both calls create accounts
    });

    it('should handle repository returning undefined', async () => {
      repository.findByUserId.mockResolvedValue(undefined as any);

      await expect(service.getUserAccounts('user-123')).rejects.toThrow();
    });

    it('should handle repository returning null array', async () => {
      repository.findByUserId.mockResolvedValue(null as any);

      await expect(service.getUserAccounts('user-123')).rejects.toThrow();
    });
  });

  describe('logging behavior', () => {
    it('should log all successful operations', async () => {
      repository.findByUserId.mockResolvedValue([]);
      repository.create.mockResolvedValue(mockAccount);

      await service.createAccount('user-123', 'provider-ref');

      expect(service['logger'].log).toHaveBeenCalledTimes(3); // Creating, already exists, created
    });

    it('should log errors with stack traces', async () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      repository.findByUserId.mockRejectedValue(error);

      await expect(service.createAccount('user-123', 'provider-ref')).rejects.toThrow(error);

      expect(service['logger'].error).toHaveBeenCalledWith(
        'Error creating blockchain account: Test error',
        'Error stack trace',
      );
    });

    it('should not log when operations succeed without errors', async () => {
      repository.findByUserId.mockResolvedValue([mockAccount]);

      const result = await service.createAccount('user-123', 'provider-ref');

      expect(result).toEqual(mockAccount);
      expect(service['logger'].error).not.toHaveBeenCalled();
    });
  });
});
