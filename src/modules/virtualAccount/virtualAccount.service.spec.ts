import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WaasAdapter } from '../../adapters/waas/waas.adapter';
import { WaasTransactionStatus } from '../../adapters/waas/waas.adapter.interface';
import { TransactionStatus, TransactionType } from '../../database';
import { VirtualAccountType } from '../../database/models/virtualAccount';
import { LockerService } from '../../services/locker/locker.service';
import { UserRepository } from '../auth/user/user.repository';
import { FiatWalletService } from '../fiatWallet';
import { TransactionRepository } from '../transaction/transaction.repository';
import { TransactionService } from '../transaction/transaction.service';
import { VirtualAccountRepository } from './virtualAccount.repository';
import { VirtualAccountService } from './virtualAccount.service';

describe('VirtualAccountService', () => {
  let service: VirtualAccountService;
  let virtualAccountRepository: jest.Mocked<VirtualAccountRepository>;
  let waasAdapter: jest.Mocked<WaasAdapter>;
  let transactionRepository: jest.Mocked<TransactionRepository>;
  let fiatWalletService: jest.Mocked<FiatWalletService>;
  let transactionService: jest.Mocked<TransactionService>;

  const mockUser = {
    id: 'user-123',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    phone_number: '+2348012345678',
    userProfile: {
      address_line1: '123 Test Street',
      dob: '1990-01-01',
      gender: 'male',
      city: 'Lagos',
      postal_code: '100001',
      state_or_province: 'Lagos',
    },
  };

  const mockVirtualAccount = {
    id: 'va-123',
    user_id: 'user-123',
    account_number: '1234567890',
    account_name: 'John Doe',
    bank_name: 'Paga',
    bank_ref: 'ref-123',
    type: VirtualAccountType.MAIN_ACCOUNT,
    provider: 'paga',
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
  };

  const mockVirtualAccountRepository = {
    query: jest.fn().mockReturnValue(mockQueryBuilder),
    findOne: jest.fn(),
    findSync: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockWaasAdapter = {
    findOrCreateVirtualAccount: jest.fn(),
    getProviderName: jest.fn().mockReturnValue('paga'),
    transferToOtherBank: jest.fn(),
    getTransactionStatus: jest.fn(),
    getBankList: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockTransactionRepository = {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };

  const mockFiatWalletService = {
    getUserWallet: jest.fn(),
    updateBalance: jest.fn(),
  };

  const mockTransactionService = {
    updateStatus: jest.fn(),
  };

  const mockLockerService = {
    withLock: jest.fn().mockImplementation((_key, fn) => fn()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: VirtualAccountRepository, useValue: mockVirtualAccountRepository },
        { provide: WaasAdapter, useValue: mockWaasAdapter },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: TransactionRepository, useValue: mockTransactionRepository },
        { provide: FiatWalletService, useValue: mockFiatWalletService },
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: LockerService, useValue: mockLockerService },
        {
          provide: VirtualAccountService,
          useFactory: (vaRepo, waas, userRepo, txnRepo, fiatWalletSvc, txnSvc, lockerSvc) => {
            const svc = new VirtualAccountService();
            (svc as any).virtualAccountRepository = vaRepo;
            (svc as any).waasAdapter = waas;
            (svc as any).userRepository = userRepo;
            (svc as any).transactionRepository = txnRepo;
            (svc as any).fiatWalletService = fiatWalletSvc;
            (svc as any).transactionService = txnSvc;
            (svc as any).lockerService = lockerSvc;
            return svc;
          },
          inject: [
            VirtualAccountRepository,
            WaasAdapter,
            UserRepository,
            TransactionRepository,
            FiatWalletService,
            TransactionService,
            LockerService,
          ],
        },
      ],
    }).compile();

    service = module.get<VirtualAccountService>(VirtualAccountService);
    virtualAccountRepository = module.get(VirtualAccountRepository) as jest.Mocked<VirtualAccountRepository>;
    waasAdapter = module.get(WaasAdapter) as jest.Mocked<WaasAdapter>;
    transactionRepository = module.get(TransactionRepository) as jest.Mocked<TransactionRepository>;
    fiatWalletService = module.get(FiatWalletService) as jest.Mocked<FiatWalletService>;
    transactionService = module.get(TransactionService) as jest.Mocked<TransactionService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should return existing virtual account if already exists', async () => {
      mockQueryBuilder.first.mockResolvedValue(mockVirtualAccount);

      const result = await service.create('user-123', {}, VirtualAccountType.MAIN_ACCOUNT);

      expect(result).toEqual(mockVirtualAccount);
      expect(waasAdapter.findOrCreateVirtualAccount).not.toHaveBeenCalled();
    });

    it('should create new virtual account if none exists', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockWaasAdapter.findOrCreateVirtualAccount.mockResolvedValue({
        account_name: 'John Doe',
        account_number: '1234567890',
        bank_name: 'Paga',
        provider_ref: 'ref-123',
        provider_name: 'paga',
        provider_id: 'paga',
        provider_balance: 0,
      });
      mockVirtualAccountRepository.create.mockResolvedValue(mockVirtualAccount as any);

      const result = await service.create('user-123', { bvn: '12345678901' }, VirtualAccountType.MAIN_ACCOUNT);

      expect(result).toEqual(mockVirtualAccount);
      expect(waasAdapter.findOrCreateVirtualAccount).toHaveBeenCalled();
      expect(virtualAccountRepository.create).toHaveBeenCalled();
    });

    it('should filter by fiat_wallet_id when provided', async () => {
      mockQueryBuilder.first.mockResolvedValue(mockVirtualAccount);

      await service.create('user-123', { fiat_wallet_id: 'wallet-123' }, VirtualAccountType.MAIN_ACCOUNT);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('fiat_wallet_id', 'wallet-123');
    });

    it('should filter by transaction_id for exchange accounts', async () => {
      mockQueryBuilder.first.mockResolvedValue(mockVirtualAccount);

      await service.create('user-123', { transaction_id: 'txn-123' }, VirtualAccountType.EXCHANGE_ACCOUNT);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('transaction_id', 'txn-123');
    });

    it('should use whereNull for transaction_id when not provided for exchange accounts', async () => {
      mockQueryBuilder.first.mockResolvedValue(mockVirtualAccount);

      await service.create('user-123', {}, VirtualAccountType.EXCHANGE_ACCOUNT);

      expect(mockQueryBuilder.whereNull).toHaveBeenCalledWith('transaction_id');
    });

    it('should throw error if user profile has no dob', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, userProfile: null } as any);

      await expect(service.create('user-123', {}, VirtualAccountType.MAIN_ACCOUNT)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw error on waas adapter failure', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockWaasAdapter.findOrCreateVirtualAccount.mockRejectedValue(new Error('Provider error'));

      await expect(service.create('user-123', {}, VirtualAccountType.MAIN_ACCOUNT)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should include transaction_id for exchange accounts when creating', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockWaasAdapter.findOrCreateVirtualAccount.mockResolvedValue({
        account_name: 'John Doe',
        account_number: '1234567890',
        bank_name: 'Paga',
        provider_ref: 'ref-123',
        provider_name: 'paga',
        provider_id: 'paga',
        provider_balance: 0,
      });
      mockVirtualAccountRepository.create.mockResolvedValue(mockVirtualAccount as any);

      await service.create('user-123', { transaction_id: 'txn-123' }, VirtualAccountType.EXCHANGE_ACCOUNT);

      expect(virtualAccountRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_id: 'txn-123',
        }),
        undefined,
      );
    });

    it('should set transaction_id to null for non-exchange accounts', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockWaasAdapter.findOrCreateVirtualAccount.mockResolvedValue({
        account_name: 'John Doe',
        account_number: '1234567890',
        bank_name: 'Paga',
        provider_ref: 'ref-123',
        provider_name: 'paga',
        provider_id: 'paga',
        provider_balance: 0,
      });
      mockVirtualAccountRepository.create.mockResolvedValue(mockVirtualAccount as any);

      await service.create('user-123', { transaction_id: 'txn-123' }, VirtualAccountType.MAIN_ACCOUNT);

      expect(virtualAccountRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_id: null,
        }),
        undefined,
      );
    });
  });

  describe('findOrCreateVirtualAccount', () => {
    it('should return existing virtual account if found', async () => {
      mockQueryBuilder.first.mockResolvedValue(mockVirtualAccount);

      const result = await service.findOrCreateVirtualAccount('user-123', {}, VirtualAccountType.MAIN_ACCOUNT);

      expect(result).toEqual(mockVirtualAccount);
    });

    it('should create new virtual account if not found', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockWaasAdapter.findOrCreateVirtualAccount.mockResolvedValue({
        account_name: 'John Doe',
        account_number: '1234567890',
        bank_name: 'Paga',
        provider_ref: 'ref-123',
        provider_name: 'paga',
        provider_id: 'paga',
        provider_balance: 0,
      });
      mockVirtualAccountRepository.create.mockResolvedValue(mockVirtualAccount as any);

      const result = await service.findOrCreateVirtualAccount('user-123', {}, VirtualAccountType.MAIN_ACCOUNT);

      expect(result).toEqual(mockVirtualAccount);
    });

    it('should handle unique constraint violation and fetch existing account', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce(null);

      const constraintError = new Error('Unique constraint violation');
      (constraintError as any).code = '23505';

      // Mock the create to throw unique constraint error
      jest.spyOn(service, 'create').mockRejectedValueOnce(constraintError);

      // Second query returns the account
      mockQueryBuilder.first.mockResolvedValueOnce(mockVirtualAccount);

      const result = await service.findOrCreateVirtualAccount('user-123', {}, VirtualAccountType.MAIN_ACCOUNT);

      expect(result).toEqual(mockVirtualAccount);
    });

    it('should handle unique constraint violation with constraint property', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce(null);

      const constraintError = new Error('Unique constraint violation');
      (constraintError as any).constraint = 'virtual_accounts_unique';

      jest.spyOn(service, 'create').mockRejectedValueOnce(constraintError);

      mockQueryBuilder.first.mockResolvedValueOnce(mockVirtualAccount);

      const result = await service.findOrCreateVirtualAccount('user-123', {}, VirtualAccountType.MAIN_ACCOUNT);

      expect(result).toEqual(mockVirtualAccount);
    });

    it('should throw error if account not found after constraint violation', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      const constraintError = new Error('Unique constraint violation');
      (constraintError as any).code = '23505';

      jest.spyOn(service, 'create').mockRejectedValueOnce(constraintError);

      await expect(service.findOrCreateVirtualAccount('user-123', {}, VirtualAccountType.MAIN_ACCOUNT)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should filter by transaction_id for exchange accounts', async () => {
      mockQueryBuilder.first.mockResolvedValue(mockVirtualAccount);

      await service.findOrCreateVirtualAccount(
        'user-123',
        { transaction_id: 'txn-123' },
        VirtualAccountType.EXCHANGE_ACCOUNT,
      );

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('transaction_id', 'txn-123');
    });

    it('should use whereNull for transaction_id when not provided for exchange accounts', async () => {
      mockQueryBuilder.first.mockResolvedValue(mockVirtualAccount);

      await service.findOrCreateVirtualAccount('user-123', {}, VirtualAccountType.EXCHANGE_ACCOUNT);

      expect(mockQueryBuilder.whereNull).toHaveBeenCalledWith('transaction_id');
    });

    it('should include transaction_id in query after constraint violation for exchange accounts', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce(null);

      const constraintError = new Error('Unique constraint violation');
      (constraintError as any).code = '23505';

      jest.spyOn(service, 'create').mockRejectedValueOnce(constraintError);

      mockQueryBuilder.first.mockResolvedValueOnce(mockVirtualAccount);

      await service.findOrCreateVirtualAccount(
        'user-123',
        { transaction_id: 'txn-123' },
        VirtualAccountType.EXCHANGE_ACCOUNT,
      );

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('transaction_id', 'txn-123');
    });

    it('should throw generic error for non-constraint violations', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce(null);

      const genericError = new Error('Database connection error');

      jest.spyOn(service, 'create').mockRejectedValueOnce(genericError);

      await expect(service.findOrCreateVirtualAccount('user-123', {}, VirtualAccountType.MAIN_ACCOUNT)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findOneByUserIdOrThrow', () => {
    it('should return virtual account when found', async () => {
      mockVirtualAccountRepository.findOne.mockResolvedValue(mockVirtualAccount as any);

      const result = await service.findOneByUserIdOrThrow('user-123');

      expect(result).toEqual(mockVirtualAccount);
      expect(virtualAccountRepository.findOne).toHaveBeenCalledWith(
        {
          user_id: 'user-123',
          provider: 'paga',
          type: VirtualAccountType.MAIN_ACCOUNT,
        },
        undefined,
        { trx: undefined },
      );
    });

    it('should throw error when virtual account not found', async () => {
      mockVirtualAccountRepository.findOne.mockResolvedValue(null);

      await expect(service.findOneByUserIdOrThrow('user-123')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findAll', () => {
    it('should return all virtual accounts for user', async () => {
      const mockAccounts = [mockVirtualAccount];
      const mockFindSyncResult = Promise.resolve(mockAccounts);
      mockVirtualAccountRepository.findSync.mockReturnValue(mockFindSyncResult as any);

      const result = await service.findAll('user-123', {});

      expect(result).toEqual(mockAccounts);
    });

    it('should filter by walletId when provided', async () => {
      const mockWhere = jest.fn().mockResolvedValue([mockVirtualAccount]);
      const mockFindSyncResult = { where: mockWhere };
      mockVirtualAccountRepository.findSync.mockReturnValue(mockFindSyncResult as any);

      await service.findAll('user-123', { walletId: 'wallet-123' });

      expect(mockWhere).toHaveBeenCalledWith({ fiat_wallet_id: 'wallet-123' });
    });

    it('should throw error on repository failure', async () => {
      mockVirtualAccountRepository.findSync.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(service.findAll('user-123', {})).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('transferToOtherBank', () => {
    const mockTransferData = {
      amount: 1000,
      account_number: '0987654321',
      bank_ref: 'bank-ref-123',
      account_name: 'Receiver Name',
    };

    const mockFiatWallet = {
      id: 'wallet-123',
      balance: 100000,
    };

    const mockTransaction = {
      id: 'txn-123',
      amount: 1000,
    };

    beforeEach(() => {
      mockVirtualAccountRepository.findOne.mockResolvedValue(mockVirtualAccount as any);
      mockFiatWalletService.getUserWallet.mockResolvedValue(mockFiatWallet as any);
      mockTransactionRepository.create.mockResolvedValue(mockTransaction as any);
      mockWaasAdapter.transferToOtherBank.mockResolvedValue({
        transactionReference: 'ref-123',
        amount: 1000,
        currency: 'NGN',
        country: 'NG',
        narration: 'Transfer',
        transactionType: 'INTRA_BANK',
        sender: {} as any,
        receiver: {} as any,
      });
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: WaasTransactionStatus.SUCCESS,
        message: 'Success',
      });
      mockFiatWalletService.updateBalance.mockResolvedValue({} as any);
      mockTransactionService.updateStatus.mockResolvedValue({} as any);
    });

    it('should successfully transfer to other bank', async () => {
      const result = await service.transferToOtherBank('user-123', mockTransferData, {
        description: 'Test transfer',
      });

      expect(result).toBeDefined();
      expect(waasAdapter.transferToOtherBank).toHaveBeenCalled();
      expect(fiatWalletService.updateBalance).toHaveBeenCalled();
      expect(transactionService.updateStatus).toHaveBeenCalled();
    });

    it('should use existing transaction when transactionId provided', async () => {
      mockTransactionRepository.findOne.mockResolvedValue(mockTransaction as any);

      await service.transferToOtherBank('user-123', mockTransferData, {
        description: 'Test transfer',
        transactionId: 'existing-txn-123',
      });

      expect(transactionRepository.findOne).toHaveBeenCalledWith({ id: 'existing-txn-123' });
      expect(transactionRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if virtual account not found', async () => {
      mockVirtualAccountRepository.findOne.mockResolvedValue(null);

      await expect(service.transferToOtherBank('user-123', mockTransferData, { description: 'Test' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw error if transaction status is FAILED', async () => {
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: WaasTransactionStatus.FAILED,
        message: 'Failed',
      });

      await expect(service.transferToOtherBank('user-123', mockTransferData, { description: 'Test' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle PENDING transaction status', async () => {
      mockWaasAdapter.getTransactionStatus.mockResolvedValue({
        status: WaasTransactionStatus.PENDING,
        message: 'Pending',
      });

      const result = await service.transferToOtherBank('user-123', mockTransferData, {
        description: 'Test transfer',
      });

      expect(result).toBeDefined();
    });

    it('should throw error on waas adapter failure', async () => {
      mockWaasAdapter.transferToOtherBank.mockRejectedValue(new Error('Transfer failed'));

      await expect(service.transferToOtherBank('user-123', mockTransferData, { description: 'Test' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should use provided transaction reference', async () => {
      await service.transferToOtherBank('user-123', mockTransferData, {
        description: 'Test transfer',
        transactionReference: 'custom-ref-123',
      });

      expect(waasAdapter.transferToOtherBank).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionReference: 'custom-ref-123',
        }),
      );
    });

    it('should use default description when not provided', async () => {
      await service.transferToOtherBank('user-123', mockTransferData, {} as any);

      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Transfer to other bank',
        }),
      );
    });

    it('should use provided transaction status', async () => {
      await service.transferToOtherBank('user-123', mockTransferData, {
        description: 'Test transfer',
        transactionStatus: TransactionStatus.PENDING,
      });

      expect(fiatWalletService.updateBalance).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.any(String),
        expect.any(String),
        TransactionStatus.PENDING,
        expect.any(Object),
      );
    });

    it('should pass fiatWalletTransactionId to updateBalance', async () => {
      await service.transferToOtherBank('user-123', mockTransferData, {
        description: 'Test transfer',
        fiatWalletTransactionId: 'fwt-123',
      });

      expect(fiatWalletService.updateBalance).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          fiat_wallet_transaction_id: 'fwt-123',
        }),
      );
    });

    it('should pass fees to balance calculation', async () => {
      await service.transferToOtherBank('user-123', mockTransferData, {
        description: 'Test transfer',
        fees: 50,
      });

      expect(fiatWalletService.updateBalance).toHaveBeenCalled();
    });
  });

  describe('create with forceCreate', () => {
    it('should skip existing account check when forceCreate is true', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockWaasAdapter.findOrCreateVirtualAccount.mockResolvedValue({
        account_name: 'John Doe',
        account_number: '1234567890',
        bank_name: 'Paga',
        provider_ref: 'ref-123',
        provider_name: 'paga',
        provider_id: 'paga',
        provider_balance: 0,
      });
      mockVirtualAccountRepository.create.mockResolvedValue(mockVirtualAccount as any);

      const result = await service.create(
        'user-123',
        { transaction_id: 'txn-123' },
        VirtualAccountType.EXCHANGE_ACCOUNT,
        undefined,
        true,
      );

      expect(result).toEqual(mockVirtualAccount);
      // query should not be called to check for existing account
      expect(mockQueryBuilder.first).not.toHaveBeenCalled();
      expect(waasAdapter.findOrCreateVirtualAccount).toHaveBeenCalled();
      expect(virtualAccountRepository.create).toHaveBeenCalled();
    });

    it('should still check for existing account when forceCreate is false', async () => {
      mockQueryBuilder.first.mockResolvedValue(mockVirtualAccount);

      const result = await service.create(
        'user-123',
        { transaction_id: 'txn-123' },
        VirtualAccountType.EXCHANGE_ACCOUNT,
        undefined,
        false,
      );

      expect(result).toEqual(mockVirtualAccount);
      expect(mockQueryBuilder.first).toHaveBeenCalled();
      expect(waasAdapter.findOrCreateVirtualAccount).not.toHaveBeenCalled();
    });

    it('should still check for existing account when forceCreate is undefined', async () => {
      mockQueryBuilder.first.mockResolvedValue(mockVirtualAccount);

      const result = await service.create(
        'user-123',
        { transaction_id: 'txn-123' },
        VirtualAccountType.EXCHANGE_ACCOUNT,
      );

      expect(result).toEqual(mockVirtualAccount);
      expect(mockQueryBuilder.first).toHaveBeenCalled();
      expect(waasAdapter.findOrCreateVirtualAccount).not.toHaveBeenCalled();
    });
  });

  describe('createExchangeVirtualAccountForTransaction', () => {
    const mockExchangeTransaction = {
      id: 'txn-123',
      user_id: 'user-123',
      transaction_type: TransactionType.EXCHANGE,
    };

    it('should throw error when transaction not found', async () => {
      mockTransactionRepository.findById.mockResolvedValue(null);

      await expect(service.createExchangeVirtualAccountForTransaction('txn-123')).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.createExchangeVirtualAccountForTransaction('txn-123')).rejects.toThrow(
        'Transaction with ID txn-123 not found',
      );
    });

    it('should throw error when transaction is not an exchange type', async () => {
      mockTransactionRepository.findById.mockResolvedValue({
        ...mockExchangeTransaction,
        transaction_type: TransactionType.TRANSFER_IN,
      } as any);

      await expect(service.createExchangeVirtualAccountForTransaction('txn-123')).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.createExchangeVirtualAccountForTransaction('txn-123')).rejects.toThrow(
        'is not an exchange transaction',
      );
    });

    it('should create virtual account with forceCreate for valid exchange transaction', async () => {
      mockTransactionRepository.findById.mockResolvedValue(mockExchangeTransaction as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockWaasAdapter.findOrCreateVirtualAccount.mockResolvedValue({
        account_name: 'John Doe',
        account_number: '1234567890',
        bank_name: 'Paga',
        provider_ref: 'ref-123',
        provider_name: 'paga',
        provider_id: 'paga',
        provider_balance: 0,
      });
      mockVirtualAccountRepository.create.mockResolvedValue({
        ...mockVirtualAccount,
        type: VirtualAccountType.EXCHANGE_ACCOUNT,
        transaction_id: 'txn-123',
      } as any);

      const result = await service.createExchangeVirtualAccountForTransaction('txn-123');

      expect(result).toBeDefined();
      expect(result.transaction_id).toBe('txn-123');
      expect(waasAdapter.findOrCreateVirtualAccount).toHaveBeenCalled();
      expect(virtualAccountRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          type: VirtualAccountType.EXCHANGE_ACCOUNT,
          transaction_id: 'txn-123',
        }),
        undefined,
      );
    });
  });

  describe('getVirtualAccountsForTransaction', () => {
    it('should return all virtual accounts for a transaction', async () => {
      const mockAccounts = [
        { ...mockVirtualAccount, transaction_id: 'txn-123' },
        { ...mockVirtualAccount, id: 'va-456', account_number: '0987654321', transaction_id: 'txn-123' },
      ];
      mockVirtualAccountRepository.findSync.mockReturnValue(Promise.resolve(mockAccounts) as any);

      const result = await service.getVirtualAccountsForTransaction('txn-123');

      expect(result).toEqual(mockAccounts);
      expect(virtualAccountRepository.findSync).toHaveBeenCalledWith({ transaction_id: 'txn-123' });
    });

    it('should return empty array when no virtual accounts found', async () => {
      mockVirtualAccountRepository.findSync.mockReturnValue(Promise.resolve([]) as any);

      const result = await service.getVirtualAccountsForTransaction('txn-123');

      expect(result).toEqual([]);
    });
  });

  describe('unscheduleVirtualAccountDeletion', () => {
    const mockVirtualAccountWithDeletion = {
      ...mockVirtualAccount,
      scheduled_deletion_at: new Date('2026-01-27'),
    };

    it('should throw error when virtual account not found', async () => {
      mockVirtualAccountRepository.findById.mockResolvedValue(null);

      await expect(service.unscheduleVirtualAccountDeletion('va-123')).rejects.toThrow(InternalServerErrorException);
      await expect(service.unscheduleVirtualAccountDeletion('va-123')).rejects.toThrow(
        'Virtual account with ID va-123 not found',
      );
    });

    it('should throw error when virtual account is not scheduled for deletion', async () => {
      mockVirtualAccountRepository.findById.mockResolvedValue({
        ...mockVirtualAccount,
        scheduled_deletion_at: null,
      } as any);

      await expect(service.unscheduleVirtualAccountDeletion('va-123')).rejects.toThrow(InternalServerErrorException);
      await expect(service.unscheduleVirtualAccountDeletion('va-123')).rejects.toThrow(
        'Virtual account va-123 is not scheduled for deletion',
      );
    });

    it('should clear scheduled_deletion_at successfully', async () => {
      mockVirtualAccountRepository.findById
        .mockResolvedValueOnce(mockVirtualAccountWithDeletion as any)
        .mockResolvedValueOnce({ ...mockVirtualAccount, scheduled_deletion_at: null } as any);
      mockVirtualAccountRepository.update.mockResolvedValue(undefined);

      const result = await service.unscheduleVirtualAccountDeletion('va-123');

      expect(virtualAccountRepository.update).toHaveBeenCalledWith('va-123', {
        scheduled_deletion_at: null,
      });
      expect(result.scheduled_deletion_at).toBeNull();
    });
  });

  describe('scheduleExchangeVirtualAccountDeletion', () => {
    const mockExchangeVirtualAccount = {
      ...mockVirtualAccount,
      id: 'va-exchange-123',
      type: VirtualAccountType.EXCHANGE_ACCOUNT,
      transaction_id: 'txn-123',
    };

    it('should schedule virtual account deletion successfully', async () => {
      mockQueryBuilder.first.mockResolvedValue(mockExchangeVirtualAccount);
      mockVirtualAccountRepository.update.mockResolvedValue(undefined);

      await service.scheduleExchangeVirtualAccountDeletion('user-123', 'txn-123', 'Transaction failed');

      expect(virtualAccountRepository.update).toHaveBeenCalledWith('va-exchange-123', {
        scheduled_deletion_at: expect.any(Date),
      });
    });

    it('should set scheduled_deletion_at to 7 days from now', async () => {
      mockQueryBuilder.first.mockResolvedValue(mockExchangeVirtualAccount);
      mockVirtualAccountRepository.update.mockResolvedValue(undefined);

      const beforeCall = new Date();

      await service.scheduleExchangeVirtualAccountDeletion('user-123', 'txn-123', 'Transaction failed');

      const afterCall = new Date();

      expect(virtualAccountRepository.update).toHaveBeenCalledWith(
        'va-exchange-123',
        expect.objectContaining({
          scheduled_deletion_at: expect.any(Date),
        }),
      );

      const updateCall = mockVirtualAccountRepository.update.mock.calls[0];
      const scheduledDate = updateCall[1].scheduled_deletion_at as Date;

      const expectedMinDate = new Date(beforeCall.getTime() + 7 * 24 * 60 * 60 * 1000 - 60000);
      const expectedMaxDate = new Date(afterCall.getTime() + 7 * 24 * 60 * 60 * 1000 + 60000);

      expect(scheduledDate.getTime()).toBeGreaterThanOrEqual(expectedMinDate.getTime());
      expect(scheduledDate.getTime()).toBeLessThanOrEqual(expectedMaxDate.getTime());
    });

    it('should not update when virtual account not found', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockWaasAdapter.findOrCreateVirtualAccount.mockRejectedValue(new Error('Provider error'));

      await service.scheduleExchangeVirtualAccountDeletion('user-123', 'txn-123', 'Transaction failed');

      expect(virtualAccountRepository.update).not.toHaveBeenCalled();
    });

    it('should not update when virtual account has no id', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        ...mockExchangeVirtualAccount,
        id: null,
      });

      await service.scheduleExchangeVirtualAccountDeletion('user-123', 'txn-123', 'Transaction failed');

      expect(virtualAccountRepository.update).not.toHaveBeenCalled();
    });

    it('should handle error during scheduling without throwing', async () => {
      mockQueryBuilder.first.mockResolvedValue(mockExchangeVirtualAccount);
      mockVirtualAccountRepository.update.mockRejectedValue(new Error('Update error'));

      await expect(
        service.scheduleExchangeVirtualAccountDeletion('user-123', 'txn-123', 'Transaction failed'),
      ).resolves.not.toThrow();
    });
  });
});
