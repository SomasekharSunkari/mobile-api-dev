import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WaasTransactionStatus } from '../../adapters/waas/waas.adapter.interface';
import { FetchQuery, UserModel } from '../../database';
import { VirtualAccountModel, VirtualAccountType } from '../../database/models/virtualAccount';
import { AppLoggerService } from '../../services/logger/logger.service';
import { VirtualAccountController } from './virtualAccount.controller';
import { VirtualAccountService } from './virtualAccount.service';

describe('VirtualAccountController', () => {
  let controller: VirtualAccountController;

  const mockVirtualAccountService = {
    findAll: jest.fn(),
  };

  const mockAppLoggerService = {
    logInfo: jest.fn(),
    logError: jest.fn(),
    logUserAction: jest.fn(),
    setContext: jest.fn(),
    createChild: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VirtualAccountController],
      providers: [
        {
          provide: VirtualAccountService,
          useValue: mockVirtualAccountService,
        },
        {
          provide: AppLoggerService,
          useValue: mockAppLoggerService,
        },
      ],
    }).compile();

    controller = module.get<VirtualAccountController>(VirtualAccountController);
  });

  describe('findAll', () => {
    it('should return all virtual accounts for a user', async () => {
      const user: UserModel = { id: 'user123' } as UserModel;
      const query: FetchQuery & { walletId?: string } = { walletId: 'wallet123' };
      const virtualAccounts: VirtualAccountModel[] = [
        {
          user_id: 'user123',
          account_name: 'John Doe',
          account_number: '1234567890',
          bank_name: 'Test Bank',
          fiat_wallet_id: 'wallet123',
        } as VirtualAccountModel,
      ];

      mockVirtualAccountService.findAll.mockResolvedValue(virtualAccounts);

      const result = await controller.findAll(user, query);

      expect(mockVirtualAccountService.findAll).toHaveBeenCalledWith(user.id, query);
      expect(result.data).toEqual(virtualAccounts);
      expect(result.message).toBe('VirtualAccount fetched successfully');
    });

    it('should throw an InternalServerErrorException if the service throws an error', async () => {
      const user: UserModel = { id: 'user123' } as UserModel;
      const query: FetchQuery & { walletId?: string } = { walletId: 'wallet123' };

      mockVirtualAccountService.findAll.mockRejectedValue(new InternalServerErrorException('Service error'));

      await expect(controller.findAll(user, query)).rejects.toThrow(InternalServerErrorException);
    });
  });
});

describe('VirtualAccountService', () => {
  let service: VirtualAccountService;

  const mockVirtualAccountRepository = {
    create: jest.fn(),
    findSync: jest.fn(),
    findOne: jest.fn(),
    query: jest.fn(),
  };

  const mockWaasAdapter = {
    findOrCreateVirtualAccount: jest.fn(),
    getProviderName: jest.fn(),
    transferToOtherBank: jest.fn(),
    getTransactionStatus: jest.fn(),
    getTransactions: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockTransactionRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
  };

  const mockFiatWalletService = {
    getUserWallet: jest.fn(),
    updateBalance: jest.fn(),
  };

  const mockTransactionService = {
    updateStatus: jest.fn(),
  };

  const mockLockerService = {
    withLock: jest.fn((_key, callback) => callback()),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: VirtualAccountService,
          useFactory: () => {
            const service = new VirtualAccountService();
            (service as any).virtualAccountRepository = mockVirtualAccountRepository;
            (service as any).waasAdapter = mockWaasAdapter;
            (service as any).userRepository = mockUserRepository;
            (service as any).transactionRepository = mockTransactionRepository;
            (service as any).fiatWalletService = mockFiatWalletService;
            (service as any).transactionService = mockTransactionService;
            (service as any).lockerService = mockLockerService;
            return service;
          },
        },
      ],
    }).compile();

    service = module.get<VirtualAccountService>(VirtualAccountService);
  });

  describe('create', () => {
    it('should create a virtual account', async () => {
      const userId = 'user123';
      const data = { bvn: '12345678901', fiat_wallet_id: 'wallet123' };
      const type = VirtualAccountType.MAIN_ACCOUNT;
      const user = {
        id: userId,
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone_number: '1234567890',
        userProfile: {
          address_line1: '123 Main St',
          dob: new Date('1990-01-01'),
          gender: 'male',
          city: 'Test City',
          postal_code: '12345',
          state_or_province: 'Test State',
        },
      };

      const waasResponse = {
        account_name: 'John Doe',
        account_number: '1234567890',
        bank_name: 'Test Bank',
        provider_ref: 'provider123',
        provider_name: 'test-provider',
      };

      const virtualAccount = {
        user_id: userId,
        fiat_wallet_id: data.fiat_wallet_id,
        account_name: waasResponse.account_name,
        account_number: waasResponse.account_number,
        bank_name: waasResponse.bank_name,
        bank_ref: waasResponse.provider_ref,
        type: type,
      };

      // Mock the query builder chain - returns self for chaining
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      };
      mockVirtualAccountRepository.query.mockReturnValue(mockQueryBuilder);
      mockUserRepository.findOne.mockResolvedValue(user);
      mockWaasAdapter.findOrCreateVirtualAccount.mockResolvedValue(waasResponse);
      mockVirtualAccountRepository.create.mockResolvedValue(virtualAccount);

      const result = await service.create(userId, data, type);

      expect(mockVirtualAccountRepository.query).toHaveBeenCalled();
      expect(mockUserRepository.findOne).toHaveBeenCalled();
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ id: userId }, {}, { graphFetch: 'userProfile' });
      expect(mockWaasAdapter.findOrCreateVirtualAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          address: user.userProfile.address_line1,
          bvn: data.bvn,
        }),
      );
      expect(mockVirtualAccountRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          fiat_wallet_id: data.fiat_wallet_id,
          type: type,
        }),
        undefined,
      );
      expect(result).toEqual(virtualAccount);
    });

    it('should create a virtual account with null fiat_wallet_id', async () => {
      const userId = 'user123';
      const data = { bvn: '12345678901' };
      const type = VirtualAccountType.EXCHANGE_ACCOUNT;
      const user = {
        id: userId,
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone_number: '1234567890',
        userProfile: {
          address_line1: '123 Main St',
          dob: new Date('1990-01-01'),
          gender: 'male',
          city: 'Test City',
          postal_code: '12345',
          state_or_province: 'Test State',
        },
      };

      const waasResponse = {
        account_name: 'John Doe',
        account_number: '1234567890',
        bank_name: 'Test Bank',
        provider_ref: 'provider123',
        provider_name: 'test-provider',
      };

      const virtualAccount = {
        user_id: userId,
        fiat_wallet_id: null,
        account_name: waasResponse.account_name,
        account_number: waasResponse.account_number,
        bank_name: waasResponse.bank_name,
        bank_ref: waasResponse.provider_ref,
        type: type,
      };

      // Mock the query builder chain - returns self for chaining
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      };
      mockVirtualAccountRepository.query.mockReturnValue(mockQueryBuilder);
      mockUserRepository.findOne.mockResolvedValue(user);
      mockWaasAdapter.findOrCreateVirtualAccount.mockResolvedValue(waasResponse);
      mockVirtualAccountRepository.create.mockResolvedValue(virtualAccount);

      const result = await service.create(userId, data, type);

      expect(mockVirtualAccountRepository.query).toHaveBeenCalled();
      expect(mockVirtualAccountRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          fiat_wallet_id: null,
          type: type,
        }),
        undefined,
      );
      expect(result).toEqual(virtualAccount);
    });

    it('should return existing virtual account if found', async () => {
      const userId = 'user123';
      const data = { bvn: '12345678901', fiat_wallet_id: 'wallet123' };
      const type = VirtualAccountType.MAIN_ACCOUNT;
      const existingVirtualAccount = {
        user_id: userId,
        fiat_wallet_id: data.fiat_wallet_id,
        account_name: 'John Doe',
        account_number: '1234567890',
        bank_name: 'Test Bank',
        type: type,
      };

      // Mock the query builder chain - returns self for chaining
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingVirtualAccount),
      };
      mockVirtualAccountRepository.query.mockReturnValue(mockQueryBuilder);

      const result = await service.create(userId, data, type);

      expect(mockVirtualAccountRepository.query).toHaveBeenCalled();
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
      expect(mockWaasAdapter.findOrCreateVirtualAccount).not.toHaveBeenCalled();
      expect(result).toEqual(existingVirtualAccount);
    });

    it('should throw an InternalServerErrorException if an error occurs', async () => {
      const userId = 'user123';
      const data = { bvn: '12345678901', fiat_wallet_id: 'wallet123' };
      const type = VirtualAccountType.MAIN_ACCOUNT;

      // Mock the query builder chain - returns self for chaining
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      };
      mockVirtualAccountRepository.query.mockReturnValue(mockQueryBuilder);
      mockUserRepository.findOne.mockRejectedValue(new Error('User not found'));

      await expect(service.create(userId, data, type)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findAll', () => {
    it('should return all virtual accounts for a user', async () => {
      const userId = 'user123';
      const params = { walletId: 'wallet123' };
      const virtualAccounts = [
        {
          user_id: userId,
          account_name: 'John Doe',
          account_number: '1234567890',
          bank_name: 'Test Bank',
          fiat_wallet_id: 'wallet123',
          type: VirtualAccountType.MAIN_ACCOUNT,
        },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        then: (cb: any) => Promise.resolve(cb(virtualAccounts)),
        catch: () => Promise.resolve(),
      };

      mockVirtualAccountRepository.findSync.mockReturnValue({
        where: () => mockQueryBuilder,
        then: (cb: any) => Promise.resolve(cb(virtualAccounts)),
      });

      const result = await service.findAll(userId, params);

      expect(mockVirtualAccountRepository.findSync).toHaveBeenCalledWith({
        user_id: userId,
        type: VirtualAccountType.MAIN_ACCOUNT,
      });
      expect(result).toEqual(virtualAccounts);
    });

    it('should throw an InternalServerErrorException if an error occurs', async () => {
      const userId = 'user123';
      const params = { walletId: 'wallet123' };

      mockVirtualAccountRepository.findSync.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(service.findAll(userId, params)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findOrCreateVirtualAccount', () => {
    it('should return existing virtual account if found', async () => {
      const userId = 'user123';
      const data = { bvn: '12345678901', fiat_wallet_id: 'wallet123' };
      const type = VirtualAccountType.MAIN_ACCOUNT;
      const existingVirtualAccount = {
        user_id: userId,
        account_name: 'John Doe',
        account_number: '1234567890',
        bank_name: 'Test Bank',
        type: type,
      } as VirtualAccountModel;

      mockWaasAdapter.getProviderName.mockReturnValue('test-provider');
      // Mock the query builder chain to return existing virtual account
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(existingVirtualAccount),
      };
      mockVirtualAccountRepository.query.mockReturnValue(mockQueryBuilder);

      const result = await service.findOrCreateVirtualAccount(userId, data, type);

      expect(mockVirtualAccountRepository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('user_id', userId);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('type', type);
      expect(result).toEqual(existingVirtualAccount);
    });

    it('should create new virtual account if not found', async () => {
      const userId = 'user123';
      const data = { bvn: '12345678901', fiat_wallet_id: 'wallet123' };
      const type = VirtualAccountType.MAIN_ACCOUNT;
      const newVirtualAccount = {
        user_id: userId,
        account_name: 'John Doe',
        account_number: '1234567890',
        bank_name: 'Test Bank',
        type: type,
      } as VirtualAccountModel;

      const user = {
        id: userId,
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        phone_number: '1234567890',
        userProfile: {
          address_line1: '123 Main St',
          dob: new Date('1990-01-01'),
          gender: 'male',
          city: 'Test City',
          postal_code: '12345',
          state_or_province: 'Test State',
        },
      };

      const waasResponse = {
        account_name: 'John Doe',
        account_number: '1234567890',
        bank_name: 'Test Bank',
        provider_ref: 'provider123',
        provider_name: 'test-provider',
      };

      mockWaasAdapter.getProviderName.mockReturnValue('test-provider');
      // Mock the query builder chain - returns self for chaining
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      };
      mockVirtualAccountRepository.query.mockReturnValue(mockQueryBuilder);
      mockUserRepository.findOne.mockResolvedValue(user);
      mockWaasAdapter.findOrCreateVirtualAccount.mockResolvedValue(waasResponse);
      mockVirtualAccountRepository.create.mockResolvedValue(newVirtualAccount);

      const result = await service.findOrCreateVirtualAccount(userId, data, type);

      expect(mockVirtualAccountRepository.query).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('user_id', userId);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('type', type);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ id: userId }, {}, { graphFetch: 'userProfile' });
      expect(mockWaasAdapter.findOrCreateVirtualAccount).toHaveBeenCalled();
      expect(mockVirtualAccountRepository.create).toHaveBeenCalled();
      expect(result).toEqual(newVirtualAccount);
    });

    it('should throw InternalServerErrorException if error occurs', async () => {
      const userId = 'user123';
      const data = { bvn: '12345678901', fiat_wallet_id: 'wallet123' };
      const type = VirtualAccountType.MAIN_ACCOUNT;

      mockWaasAdapter.getProviderName.mockReturnValue('test-provider');
      // Mock the query builder chain to throw an error
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockRejectedValue(new Error('Database error')),
      };
      mockVirtualAccountRepository.query.mockReturnValue(mockQueryBuilder);

      await expect(service.findOrCreateVirtualAccount(userId, data, type)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findOneByUserIdOrThrow', () => {
    it('should return virtual account when found', async () => {
      const userId = 'user123';
      const virtualAccount = {
        user_id: userId,
        account_name: 'John Doe',
        account_number: '1234567890',
        bank_name: 'Test Bank',
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as VirtualAccountModel;

      mockWaasAdapter.getProviderName.mockReturnValue('test-provider');
      mockVirtualAccountRepository.findOne.mockResolvedValue(virtualAccount);

      const result = await service.findOneByUserIdOrThrow(userId);

      expect(mockVirtualAccountRepository.findOne).toHaveBeenCalledWith(
        {
          user_id: userId,
          provider: 'test-provider',
          type: VirtualAccountType.MAIN_ACCOUNT,
        },
        undefined,
        { trx: undefined },
      );
      expect(result).toEqual(virtualAccount);
    });

    it('should throw InternalServerErrorException when virtual account not found', async () => {
      const userId = 'user123';

      mockWaasAdapter.getProviderName.mockReturnValue('test-provider');
      mockVirtualAccountRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneByUserIdOrThrow(userId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('transferToOtherBank', () => {
    it('should transfer to other bank successfully', async () => {
      const userId = 'user123';
      const data = {
        account_number: '9876543210',
        amount: 1000,
        bank_name: 'Test Bank',
        bank_ref: 'bank-ref-123',
        account_name: 'Receiver Name',
      };
      const metadata = {
        description: 'Test transfer',
        fees: 10,
      };

      const virtualAccount = {
        account_number: '1234567890',
        account_name: 'John Doe',
        bank_name: 'Source Bank',
        type: VirtualAccountType.MAIN_ACCOUNT,
      } as VirtualAccountModel;

      const fiatWallet = {
        id: 'wallet123',
        balance: 5000,
      };

      const transaction = {
        id: 'tx123',
      };

      const transferResponse = {
        data: { success: true },
      };

      const transactionStatus = {
        status: WaasTransactionStatus.SUCCESS,
      };

      mockVirtualAccountRepository.findOne.mockResolvedValue(virtualAccount);
      mockFiatWalletService.getUserWallet.mockResolvedValue(fiatWallet);
      mockTransactionRepository.create.mockResolvedValue(transaction);
      mockWaasAdapter.transferToOtherBank.mockResolvedValue(transferResponse);
      mockWaasAdapter.getTransactionStatus.mockResolvedValue(transactionStatus);
      mockFiatWalletService.updateBalance.mockResolvedValue(undefined);
      mockTransactionService.updateStatus.mockResolvedValue(undefined);

      const result = await service.transferToOtherBank(userId, data, metadata);

      expect(mockVirtualAccountRepository.findOne).toHaveBeenCalledWith({
        user_id: userId,
        type: VirtualAccountType.MAIN_ACCOUNT,
      });
      expect(mockFiatWalletService.getUserWallet).toHaveBeenCalledWith(userId, 'NGN');
      expect(mockTransactionRepository.create).toHaveBeenCalled();
      expect(mockWaasAdapter.transferToOtherBank).toHaveBeenCalled();
      expect(mockWaasAdapter.getTransactionStatus).toHaveBeenCalled();
      expect(mockFiatWalletService.updateBalance).toHaveBeenCalled();
      expect(mockTransactionService.updateStatus).toHaveBeenCalledWith(transaction.id, 'completed');
      expect(result).toEqual(transferResponse);
    });

    it('should throw error if transaction fails', async () => {
      const userId = 'user123';
      const data = {
        account_number: '9876543210',
        amount: 1000,
        bank_ref: 'bank-ref-123',
        account_name: 'Receiver Name',
      };
      const metadata = { description: 'Test transfer' };

      const virtualAccount = {
        account_number: '1234567890',
        type: VirtualAccountType.MAIN_ACCOUNT,
        account_name: 'John Doe',
        bank_name: 'Source Bank',
      } as VirtualAccountModel;
      const fiatWallet = { id: 'wallet123', balance: 5000 };
      const transaction = { id: 'tx123' };
      const transferResponse = { data: { success: true } };
      const transactionStatus = { status: WaasTransactionStatus.FAILED };

      mockVirtualAccountRepository.findOne.mockResolvedValue(virtualAccount);
      mockFiatWalletService.getUserWallet.mockResolvedValue(fiatWallet);
      mockTransactionRepository.create.mockResolvedValue(transaction);
      mockWaasAdapter.transferToOtherBank.mockResolvedValue(transferResponse);
      mockWaasAdapter.getTransactionStatus.mockResolvedValue(transactionStatus);

      await expect(service.transferToOtherBank(userId, data, metadata)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
