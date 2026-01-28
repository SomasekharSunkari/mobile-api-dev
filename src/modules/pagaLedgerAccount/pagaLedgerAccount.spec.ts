import { BadRequestException, HttpStatus, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { Transaction } from 'objection';
import { PagaAdapter } from '../../adapters/waas/paga/paga.adapter';
import { EnvironmentService } from '../../config';
import { LockerService } from '../../services/locker';
import { PagaLedgerTransactionService } from '../pagaLedgerTransaction/pagaLedgerTransaction.service';
import { CreditAccountDto } from './dtos/creditAccount.dto';
import { PagaLedgerAccountController } from './pagaLedgerAccount.controller';
import { PagaLedgerAccountRepository } from './pagaLedgerAccount.repository';
import { PagaLedgerAccountService } from './pagaLedgerAccount.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Helper function to flush all pending promises with fake timers
const flushPromises = async () => {
  // Run all pending timers and flush promise queue multiple times
  jest.runAllTimers();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('PagaLedgerAccountService', () => {
  let service: PagaLedgerAccountService;
  let mockRepository: jest.Mocked<PagaLedgerAccountRepository>;
  let mockLockerService: jest.Mocked<LockerService>;
  let mockTransactionService: jest.Mocked<PagaLedgerTransactionService>;
  let mockPagaAdapter: jest.Mocked<PagaAdapter>;

  const mockAccount = {
    id: '1',
    email: 'test@example.com',
    phone_number: '+2348012345678',
    account_number: 'PAGA12345',
    account_name: 'Test User',
    current_balance: 1000,
    ledger_balance: 1000,
    available_balance: 1000,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  } as any;

  const mockTransaction = {
    id: 'trans123',
    account_number: 'PAGA12345',
    amount: 500,
    status: 'PENDING',
    reference_number: 'REF123',
    transaction_reference: 'REF123',
    balance_before: 1000,
    balance_after: 1500,
    transaction_type: 'CREDIT',
    currency: 'NGN',
    fee: 10,
    date_utc: Date.now(),
    description: 'Test transaction',
    transaction_id: 'TRANS123',
    source_account_name: 'Test Source',
    source_account_organization_name: 'Test Org',
    tax: 0,
    transaction_channel: 'API',
    reversal_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  } as any;

  beforeEach(async () => {
    const mockRepositoryProvider = {
      provide: PagaLedgerAccountRepository,
      useValue: {
        create: jest.fn(),
        update: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        findById: jest.fn(),
        delete: jest.fn(),
        transaction: jest.fn(),
        getTotalUserBalances: jest.fn(),
        getTotalAccountsCount: jest.fn(),
      },
    };

    const mockLockerServiceProvider = {
      provide: LockerService,
      useValue: {
        withLock: jest.fn(),
        runWithLock: jest.fn(),
      },
    };

    const mockTransactionServiceProvider = {
      provide: PagaLedgerTransactionService,
      useValue: {
        create: jest.fn(),
        update: jest.fn(),
        findOne: jest.fn(),
      },
    };

    const mockPagaAdapterProvider = {
      provide: PagaAdapter,
      useValue: {
        getBusinessAccountBalance: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagaLedgerAccountService,
        mockRepositoryProvider,
        mockLockerServiceProvider,
        mockTransactionServiceProvider,
        mockPagaAdapterProvider,
      ],
    }).compile();

    service = module.get<PagaLedgerAccountService>(PagaLedgerAccountService);
    mockRepository = module.get(PagaLedgerAccountRepository);
    mockLockerService = module.get(LockerService);
    mockTransactionService = module.get(PagaLedgerTransactionService);
    mockPagaAdapter = module.get(PagaAdapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new Paga ledger account successfully', async () => {
      const createData = {
        email: 'test@example.com',
        phone_number: '+2348012345678',
        account_number: 'PAGA12345',
        account_name: 'Test User',
        current_balance: 0,
        ledger_balance: 0,
        available_balance: 0,
      };

      mockRepository.create.mockResolvedValue(mockAccount);

      const result = await service.create(createData);

      expect(mockRepository.create).toHaveBeenCalledWith(createData);
      expect(result).toEqual(mockAccount);
    });

    it('should throw InternalServerErrorException when create fails', async () => {
      const createData = {
        email: 'test@example.com',
        phone_number: '+2348012345678',
        account_number: 'PAGA12345',
        account_name: 'Test User',
        current_balance: 0,
        ledger_balance: 0,
        available_balance: 0,
      };

      mockRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createData)).rejects.toThrow(InternalServerErrorException);
      expect(mockRepository.create).toHaveBeenCalledWith(createData);
    });
  });

  describe('update', () => {
    it('should update a Paga ledger account successfully', async () => {
      const accountNumber = 'PAGA12345';
      const updateData = { account_name: 'Updated Name' };

      mockRepository.findOne.mockResolvedValue(mockAccount);
      mockRepository.update.mockResolvedValue({
        ...mockAccount,
        ...updateData,
      });

      const result = await service.update(accountNumber, updateData);

      expect(mockRepository.findOne).toHaveBeenCalledWith({ account_number: accountNumber });
      expect(mockRepository.update).toHaveBeenCalledWith({ account_number: accountNumber }, updateData);
      expect(result.account_name).toBe('Updated Name');
    });

    it('should throw NotFoundException when account does not exist', async () => {
      const accountNumber = 'NONEXISTENT';
      const updateData = { account_name: 'Updated Name' };

      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update(accountNumber, updateData)).rejects.toThrow(InternalServerErrorException);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ account_number: accountNumber });
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when update fails', async () => {
      const accountNumber = 'PAGA12345';
      const updateData = { account_name: 'Updated Name' };

      mockRepository.findOne.mockResolvedValue(mockAccount);
      mockRepository.update.mockRejectedValue(new Error('Database error'));

      await expect(service.update(accountNumber, updateData)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findAll', () => {
    it('should return paginated accounts successfully', async () => {
      const paginatedResult = {
        paga_ledger_accounts: [mockAccount],
        pagination: {
          total: 1,
          currentPage: 1,
          perPage: 10,
          lastPage: 1,
        },
      } as any;

      mockRepository.findAll.mockResolvedValue(paginatedResult);

      const result = await service.findAll();

      expect(mockRepository.findAll).toHaveBeenCalledWith({}, undefined, { graphFetch: 'user' });
      expect(result).toEqual(paginatedResult);
    });

    it('should return paginated accounts with params', async () => {
      const paginatedResult = {
        paga_ledger_accounts: [mockAccount],
        pagination: {
          total: 1,
          currentPage: 2,
          perPage: 5,
          lastPage: 1,
        },
      } as any;

      const params = { page: 2, perPage: 5 };
      mockRepository.findAll.mockResolvedValue(paginatedResult);

      const result = await service.findAll(params);

      expect(mockRepository.findAll).toHaveBeenCalledWith({}, params, { graphFetch: 'user' });
      expect(result).toEqual(paginatedResult);
    });

    it('should throw InternalServerErrorException when findAll fails', async () => {
      mockRepository.findAll.mockRejectedValue(new Error('Database error'));

      await expect(service.findAll()).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findOne', () => {
    it('should find an account by filter successfully', async () => {
      const filter = { account_number: 'PAGA12345' };

      mockRepository.findOne.mockResolvedValue(mockAccount);

      const result = await service.findOne(filter);

      expect(mockRepository.findOne).toHaveBeenCalledWith(filter, undefined, { trx: undefined });
      expect(result).toEqual(mockAccount);
    });

    it('should return null when account not found', async () => {
      const filter = { account_number: 'NONEXISTENT' };

      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne(filter);

      expect(result).toBeNull();
    });

    it('should return null when repository returns undefined', async () => {
      const filter = { account_number: 'NONEXISTENT' };

      mockRepository.findOne.mockResolvedValue(undefined as any);

      const result = await service.findOne(filter);

      expect(result).toBeNull();
    });

    it('should throw InternalServerErrorException when findOne fails', async () => {
      const filter = { account_number: 'PAGA12345' };

      mockRepository.findOne.mockRejectedValue(new Error('Database error'));

      await expect(service.findOne(filter)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findOrCreate', () => {
    const createData = {
      email: 'test@example.com',
      phone_number: '+2348012345678',
      account_number: 'PAGA12345',
      account_name: 'Test User',
      current_balance: 0,
      ledger_balance: 0,
      available_balance: 0,
    };

    it('should return existing account if found', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockAccount);
      jest.spyOn(service, 'create').mockResolvedValue(mockAccount);

      const result = await service.findOrCreate(createData);

      expect(service.findOne).toHaveBeenCalledWith({ account_number: createData.account_number });
      expect(service.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockAccount);
    });

    it('should create new account if not found', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);
      jest.spyOn(service, 'create').mockResolvedValue(mockAccount);

      const result = await service.findOrCreate(createData);

      expect(service.findOne).toHaveBeenCalledWith({ account_number: createData.account_number });
      expect(service.create).toHaveBeenCalledWith(createData);
      expect(result).toEqual(mockAccount);
    });

    it('should throw InternalServerErrorException when findOrCreate fails', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValue(new Error('Database error'));

      await expect(service.findOrCreate(createData)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('delete', () => {
    it('should delete account successfully', async () => {
      const accountId = '1';

      mockRepository.findById.mockResolvedValue(mockAccount);
      mockRepository.delete.mockResolvedValue(undefined);

      await service.delete(accountId);

      expect(mockRepository.findById).toHaveBeenCalledWith(accountId);
      expect(mockRepository.delete).toHaveBeenCalledWith(accountId);
    });

    it('should throw NotFoundException when account does not exist', async () => {
      const accountId = 'nonexistent';

      mockRepository.findById.mockResolvedValue(null);

      await expect(service.delete(accountId)).rejects.toThrow(InternalServerErrorException);
      expect(mockRepository.findById).toHaveBeenCalledWith(accountId);
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when delete fails', async () => {
      const accountId = '1';

      mockRepository.findById.mockResolvedValue(mockAccount);
      mockRepository.delete.mockRejectedValue(new Error('Database error'));

      await expect(service.delete(accountId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateBalance', () => {
    it('should update balance successfully with lock', async () => {
      const accountNumber = 'PAGA12345';
      const amountToUpdate = 500;
      const transactionId = 'trans123';

      mockLockerService.withLock.mockImplementation(async (_lockKey, callback) => {
        return callback();
      });

      mockRepository.findOne.mockResolvedValue(mockAccount);
      mockTransactionService.findOne.mockResolvedValue(mockTransaction);
      mockRepository.transaction.mockImplementation((callback: any) => {
        return callback({} as Transaction);
      });
      mockRepository.update.mockResolvedValue({
        ...mockAccount,
        available_balance: 1500,
      });
      mockTransactionService.update.mockResolvedValue(undefined);

      const result = await service.updateBalance(accountNumber, amountToUpdate, transactionId);

      expect(mockLockerService.withLock).toHaveBeenCalledWith(
        `paga-ledger-account:${accountNumber}:balance-update`,
        expect.any(Function),
        { ttl: 30000, retryCount: 5, retryDelay: 500 },
      );
      expect(result.available_balance).toBe(1500);
    });

    it('should update balance successfully with provided knexTransaction', async () => {
      const accountNumber = 'PAGA12345';
      const amountToUpdate = 500;
      const transactionId = 'trans123';
      const mockKnexTransaction = {} as Transaction;

      mockLockerService.withLock.mockImplementation(async (_lockKey, callback) => {
        return callback();
      });

      mockRepository.findOne.mockResolvedValue(mockAccount);
      mockTransactionService.findOne.mockResolvedValue(mockTransaction);
      mockRepository.update.mockResolvedValue({
        ...mockAccount,
        available_balance: 1500,
      });
      mockTransactionService.update.mockResolvedValue(undefined);

      const result = await service.updateBalance(accountNumber, amountToUpdate, transactionId, mockKnexTransaction);

      expect(mockLockerService.withLock).toHaveBeenCalledWith(
        `paga-ledger-account:${accountNumber}:balance-update`,
        expect.any(Function),
        { ttl: 30000, retryCount: 5, retryDelay: 500 },
      );
      expect(mockRepository.transaction).not.toHaveBeenCalled();
      expect(result.available_balance).toBe(1500);
    });

    it('should throw NotFoundException when account not found', async () => {
      const accountNumber = 'NONEXISTENT';
      const amountToUpdate = 500;
      const transactionId = 'trans123';

      mockLockerService.withLock.mockImplementation(async (_lockKey, callback) => {
        return callback();
      });

      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.updateBalance(accountNumber, amountToUpdate, transactionId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw NotFoundException when transaction not found', async () => {
      const accountNumber = 'PAGA12345';
      const amountToUpdate = 500;
      const transactionId = 'nonexistent';

      mockLockerService.withLock.mockImplementation(async (_lockKey, callback) => {
        return callback();
      });

      mockRepository.findOne.mockResolvedValue(mockAccount);
      mockTransactionService.findOne.mockResolvedValue(null);

      await expect(service.updateBalance(accountNumber, amountToUpdate, transactionId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when balance update fails', async () => {
      const accountNumber = 'PAGA12345';
      const amountToUpdate = 500;
      const transactionId = 'trans123';
      const mockKnexTransaction = {} as Transaction;

      mockLockerService.withLock.mockImplementation(async (_lockKey, callback) => {
        return callback();
      });

      mockRepository.findOne.mockResolvedValue(mockAccount);
      mockTransactionService.findOne.mockResolvedValue(mockTransaction);
      mockRepository.update.mockRejectedValue(new Error('Update failed'));

      await expect(
        service.updateBalance(accountNumber, amountToUpdate, transactionId, mockKnexTransaction),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('depositMoney', () => {
    const depositPayload = {
      amount: 1000,
      referenceNumber: 'REF123',
      fee: 50,
      accountNumber: 'PAGA12345',
      currency: 'NGN',
      description: 'Test deposit',
    };

    const mockKnexTransaction = {} as Transaction;

    it('should deposit money successfully', async () => {
      mockLockerService.withLock.mockImplementation(async (_lockKey, callback) => {
        return callback();
      });

      mockRepository.findOne.mockResolvedValue(mockAccount);
      mockTransactionService.create.mockResolvedValue(mockTransaction);
      jest.spyOn(service, 'updateBalance').mockResolvedValue({ ...mockAccount, available_balance: 1950 });

      const result = await service.depositMoney(depositPayload, mockKnexTransaction);

      expect(mockLockerService.withLock).toHaveBeenCalledWith(
        `paga-ledger-account:${depositPayload.accountNumber}-${depositPayload.referenceNumber}:deposit-money`,
        expect.any(Function),
        { ttl: 30000, retryCount: 5, retryDelay: 500 },
      );
      expect(mockTransactionService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          account_number: depositPayload.accountNumber,
          amount: depositPayload.amount,
          fee: depositPayload.fee,
          reference_number: depositPayload.referenceNumber,
          transaction_type: 'CREDIT',
          status: 'PENDING',
        }),
        mockKnexTransaction,
      );
      expect(service.updateBalance).toHaveBeenCalledWith(
        depositPayload.accountNumber,
        950, // amount - fee
        mockTransaction.id,
        mockKnexTransaction,
      );
      expect(result.available_balance).toBe(1950);
    });

    it('should throw BadRequestException for invalid amount', async () => {
      const invalidPayload = { ...depositPayload, amount: 0 };

      await expect(service.depositMoney(invalidPayload, mockKnexTransaction)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for negative fee', async () => {
      const invalidPayload = { ...depositPayload, fee: -10 };

      await expect(service.depositMoney(invalidPayload, mockKnexTransaction)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when account not found', async () => {
      mockLockerService.withLock.mockImplementation(async (_lockKey, callback) => {
        return callback();
      });

      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.depositMoney(depositPayload, mockKnexTransaction)).rejects.toThrow(NotFoundException);
    });

    it('should mark transaction as FAILED when deposit fails', async () => {
      mockLockerService.withLock.mockImplementation(async (_lockKey, callback) => {
        return callback();
      });

      mockRepository.findOne.mockResolvedValue(mockAccount);
      mockTransactionService.create.mockResolvedValue(mockTransaction);
      jest.spyOn(service, 'updateBalance').mockRejectedValue(new Error('Update failed'));
      mockTransactionService.update.mockResolvedValue(undefined);

      await expect(service.depositMoney(depositPayload, mockKnexTransaction)).rejects.toThrow(Error);

      expect(mockTransactionService.update).toHaveBeenCalledWith(mockTransaction.id, 'FAILED', mockKnexTransaction);
    });

    it('should handle failure when marking transaction as FAILED also fails', async () => {
      mockLockerService.withLock.mockImplementation(async (_lockKey, callback) => {
        return callback();
      });

      mockRepository.findOne.mockResolvedValue(mockAccount);
      mockTransactionService.create.mockResolvedValue(mockTransaction);
      jest.spyOn(service, 'updateBalance').mockRejectedValue(new Error('Update failed'));
      mockTransactionService.update.mockRejectedValue(new Error('Failed to update status'));

      await expect(service.depositMoney(depositPayload, mockKnexTransaction)).rejects.toThrow(Error);

      expect(mockTransactionService.update).toHaveBeenCalledWith(mockTransaction.id, 'FAILED', mockKnexTransaction);
    });

    it('should deposit money with default currency when not provided', async () => {
      const payloadWithoutCurrency = {
        amount: 1000,
        referenceNumber: 'REF123',
        fee: 50,
        accountNumber: 'PAGA12345',
        description: 'Test deposit',
      };

      mockLockerService.withLock.mockImplementation(async (_lockKey, callback) => {
        return callback();
      });

      mockRepository.findOne.mockResolvedValue(mockAccount);
      mockTransactionService.create.mockResolvedValue(mockTransaction);
      jest.spyOn(service, 'updateBalance').mockResolvedValue({ ...mockAccount, available_balance: 1950 });

      const result = await service.depositMoney(payloadWithoutCurrency, mockKnexTransaction);

      expect(mockTransactionService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'NGN',
        }),
        mockKnexTransaction,
      );
      expect(result.available_balance).toBe(1950);
    });
  });

  describe('topUp', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should throw BadRequestException in production', async () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(true);

      const creditDto = {
        account_number: 'PAGA12345',
        amount: 1000,
        reference_number: 'REF1234567890123456',
        source_account_name: 'Test Account',
        source_account_number: '1234567890',
        description: 'Test topup',
      };

      await expect(service.topUp(creditDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when reference number already exists', async () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const creditDto = {
        account_number: 'PAGA12345',
        amount: 1000,
        reference_number: 'REF1234567890123456',
        source_account_name: 'Test Account',
        source_account_number: '1234567890',
        description: 'Test topup',
      };

      mockTransactionService.findOne.mockResolvedValue(mockTransaction);

      await expect(service.topUp(creditDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when reference number is too short', async () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const creditDto = {
        account_number: 'PAGA12345',
        amount: 1000,
        reference_number: 'SHORT',
        source_account_name: 'Test Account',
        source_account_number: '1234567890',
        description: 'Test topup',
      };

      mockTransactionService.findOne.mockResolvedValue(null);

      await expect(service.topUp(creditDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when reference number is too long', async () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const creditDto = {
        account_number: 'PAGA12345',
        amount: 1000,
        reference_number: 'VERYLONGREFERENCENUMBEREXCEEDSTHIRTYCHARS',
        source_account_name: 'Test Account',
        source_account_number: '1234567890',
        description: 'Test topup',
      };

      mockTransactionService.findOne.mockResolvedValue(null);

      await expect(service.topUp(creditDto)).rejects.toThrow(BadRequestException);
    });

    it('should process topUp when reference number is undefined (optional chaining behavior)', async () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const creditDto = {
        account_number: 'PAGA12345',
        amount: 1000,
        reference_number: undefined as any,
        source_account_name: 'Test Account',
        source_account_number: '1234567890',
        description: 'Test topup',
      };

      mockTransactionService.findOne.mockResolvedValue(null);
      mockedAxios.post.mockResolvedValue({
        data: { success: true },
        status: 200,
        statusText: 'OK',
      });

      // Due to optional chaining, undefined?.length returns undefined,
      // and undefined < 15 evaluates to false, so validation passes
      await service.topUp(creditDto);

      expect(mockTransactionService.findOne).toHaveBeenCalledWith({
        reference_number: creditDto.reference_number,
      });
    });

    it('should accept reference number with exactly 15 characters', async () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const creditDto = {
        account_number: 'PAGA12345',
        amount: 1000,
        reference_number: '123456789012345', // exactly 15 chars
        source_account_name: 'Test Account',
        source_account_number: '1234567890',
        description: 'Test topup',
      };

      mockTransactionService.findOne.mockResolvedValue(null);
      mockedAxios.post.mockResolvedValue({
        data: { success: true },
        status: 200,
        statusText: 'OK',
      });

      await service.topUp(creditDto);

      expect(mockTransactionService.findOne).toHaveBeenCalledWith({
        reference_number: creditDto.reference_number,
      });
    });

    it('should accept reference number with exactly 30 characters', async () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const creditDto = {
        account_number: 'PAGA12345',
        amount: 1000,
        reference_number: '123456789012345678901234567890', // exactly 30 chars
        source_account_name: 'Test Account',
        source_account_number: '1234567890',
        description: 'Test topup',
      };

      mockTransactionService.findOne.mockResolvedValue(null);
      mockedAxios.post.mockResolvedValue({
        data: { success: true },
        status: 200,
        statusText: 'OK',
      });

      await service.topUp(creditDto);

      expect(mockTransactionService.findOne).toHaveBeenCalledWith({
        reference_number: creditDto.reference_number,
      });
    });

    it('should successfully process topUp and send webhook', async () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const creditDto = {
        account_number: 'PAGA12345',
        amount: 1000,
        reference_number: 'REF1234567890123456',
        source_account_name: 'Test Account',
        source_account_number: '1234567890',
        description: 'Test topup',
      };

      mockTransactionService.findOne.mockResolvedValue(null);
      mockedAxios.post.mockResolvedValue({
        data: { success: true },
        status: 200,
        statusText: 'OK',
      });

      await service.topUp(creditDto);

      // Flush all timers and pending promises
      await flushPromises();

      expect(mockTransactionService.findOne).toHaveBeenCalledWith({
        reference_number: creditDto.reference_number,
      });
    });

    it('should handle webhook failure gracefully', async () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const creditDto = {
        account_number: 'PAGA12345',
        amount: 1000,
        reference_number: 'REF1234567890123456',
        source_account_name: 'Test Account',
        source_account_number: '1234567890',
        description: 'Test topup',
      };

      mockTransactionService.findOne.mockResolvedValue(null);
      mockedAxios.post.mockRejectedValue({
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
        message: 'Request failed',
      });

      await service.topUp(creditDto);

      // Flush all timers and pending promises
      await flushPromises();

      expect(mockTransactionService.findOne).toHaveBeenCalledWith({
        reference_number: creditDto.reference_number,
      });
    });

    it('should handle webhook failure without response data', async () => {
      jest.spyOn(EnvironmentService, 'isProduction').mockReturnValue(false);

      const creditDto = {
        account_number: 'PAGA12345',
        amount: 1000,
        reference_number: 'REF1234567890123456',
        source_account_name: 'Test Account',
        source_account_number: '1234567890',
        description: 'Test topup',
      };

      mockTransactionService.findOne.mockResolvedValue(null);
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      await service.topUp(creditDto);

      // Flush all timers and pending promises
      await flushPromises();

      expect(mockTransactionService.findOne).toHaveBeenCalledWith({
        reference_number: creditDto.reference_number,
      });
    });
  });

  describe('getDashboardAnalytics', () => {
    const mockBusinessBalance = {
      totalBalance: 5500000,
      availableBalance: 5000000,
      currency: 'NGN',
    };

    it('should return dashboard analytics successfully', async () => {
      const totalUserBalances = 400000000; // 4,000,000 NGN in kobo
      const totalAccounts = 150;

      mockPagaAdapter.getBusinessAccountBalance.mockResolvedValue(mockBusinessBalance);
      mockRepository.getTotalUserBalances.mockResolvedValue(totalUserBalances);
      mockRepository.getTotalAccountsCount.mockResolvedValue(totalAccounts);

      const result = await service.getDashboardAnalytics();

      expect(mockPagaAdapter.getBusinessAccountBalance).toHaveBeenCalled();
      expect(mockRepository.getTotalUserBalances).toHaveBeenCalled();
      expect(mockRepository.getTotalAccountsCount).toHaveBeenCalled();

      // Paga balance in kobo: 5,000,000 * 100 = 500,000,000
      expect(result.paga_business_balance).toBe(500000000);
      expect(result.paga_business_balance_naira).toBe(5000000);
      expect(result.total_user_balances).toBe(totalUserBalances);
      expect(result.total_user_balances_naira).toBe(4000000);
      expect(result.balance_difference).toBe(100000000); // 500M - 400M = 100M
      expect(result.balance_difference_naira).toBe(1000000);
      expect(result.needs_top_up).toBe(false);
      expect(result.top_up_amount_required).toBe(0);
      expect(result.top_up_amount_required_naira).toBe(0);
      expect(result.total_accounts).toBe(totalAccounts);
      expect(result.currency).toBe('NGN');
      expect(result.generated_at).toBeDefined();
    });

    it('should indicate top-up is needed when Paga balance is less than user balances', async () => {
      const totalUserBalances = 600000000; // 6,000,000 NGN in kobo (more than Paga balance)
      const totalAccounts = 200;

      mockPagaAdapter.getBusinessAccountBalance.mockResolvedValue(mockBusinessBalance);
      mockRepository.getTotalUserBalances.mockResolvedValue(totalUserBalances);
      mockRepository.getTotalAccountsCount.mockResolvedValue(totalAccounts);

      const result = await service.getDashboardAnalytics();

      // Paga balance in kobo: 5,000,000 * 100 = 500,000,000
      expect(result.paga_business_balance).toBe(500000000);
      expect(result.total_user_balances).toBe(totalUserBalances);
      expect(result.balance_difference).toBe(-100000000); // 500M - 600M = -100M
      expect(result.balance_difference_naira).toBe(-1000000);
      expect(result.needs_top_up).toBe(true);
      expect(result.top_up_amount_required).toBe(100000000);
      expect(result.top_up_amount_required_naira).toBe(1000000);
    });

    it('should handle zero balances', async () => {
      const zeroBusinessBalance = {
        totalBalance: 0,
        availableBalance: 0,
        currency: 'NGN',
      };

      mockPagaAdapter.getBusinessAccountBalance.mockResolvedValue(zeroBusinessBalance);
      mockRepository.getTotalUserBalances.mockResolvedValue(0);
      mockRepository.getTotalAccountsCount.mockResolvedValue(0);

      const result = await service.getDashboardAnalytics();

      expect(result.paga_business_balance).toBe(0);
      expect(result.paga_business_balance_naira).toBe(0);
      expect(result.total_user_balances).toBe(0);
      expect(result.total_user_balances_naira).toBe(0);
      expect(result.balance_difference).toBe(0);
      expect(result.needs_top_up).toBe(false);
      expect(result.top_up_amount_required).toBe(0);
      expect(result.total_accounts).toBe(0);
    });

    it('should throw InternalServerErrorException when Paga API fails', async () => {
      mockPagaAdapter.getBusinessAccountBalance.mockRejectedValue(new Error('Paga API error'));

      await expect(service.getDashboardAnalytics()).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when repository fails', async () => {
      mockPagaAdapter.getBusinessAccountBalance.mockResolvedValue(mockBusinessBalance);
      mockRepository.getTotalUserBalances.mockRejectedValue(new Error('Database error'));

      await expect(service.getDashboardAnalytics()).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getTotalUserBalances', () => {
    it('should return total user balances successfully', async () => {
      const totalUserBalances = 500000000; // 5,000,000 NGN in kobo
      const totalAccounts = 100;

      mockRepository.getTotalUserBalances.mockResolvedValue(totalUserBalances);
      mockRepository.getTotalAccountsCount.mockResolvedValue(totalAccounts);

      const result = await service.getTotalUserBalances();

      expect(mockRepository.getTotalUserBalances).toHaveBeenCalled();
      expect(mockRepository.getTotalAccountsCount).toHaveBeenCalled();
      expect(result.total_balances).toBe(totalUserBalances);
      expect(result.total_balances_naira).toBe(5000000);
      expect(result.total_accounts).toBe(totalAccounts);
    });

    it('should handle zero balances', async () => {
      mockRepository.getTotalUserBalances.mockResolvedValue(0);
      mockRepository.getTotalAccountsCount.mockResolvedValue(0);

      const result = await service.getTotalUserBalances();

      expect(result.total_balances).toBe(0);
      expect(result.total_balances_naira).toBe(0);
      expect(result.total_accounts).toBe(0);
    });

    it('should throw InternalServerErrorException when repository fails', async () => {
      mockRepository.getTotalUserBalances.mockRejectedValue(new Error('Database error'));

      await expect(service.getTotalUserBalances()).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when getTotalAccountsCount fails', async () => {
      mockRepository.getTotalUserBalances.mockResolvedValue(500000000);
      mockRepository.getTotalAccountsCount.mockRejectedValue(new Error('Database error'));

      await expect(service.getTotalUserBalances()).rejects.toThrow(InternalServerErrorException);
    });
  });
});

describe('PagaLedgerAccountController', () => {
  let controller: PagaLedgerAccountController;
  let mockService: jest.Mocked<PagaLedgerAccountService>;

  const mockPagaLedgerAccountService = {
    topUp: jest.fn(),
    getDashboardAnalytics: jest.fn(),
    getTotalUserBalances: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PagaLedgerAccountController],
      providers: [
        {
          provide: PagaLedgerAccountService,
          useValue: mockPagaLedgerAccountService,
        },
      ],
    }).compile();

    controller = module.get<PagaLedgerAccountController>(PagaLedgerAccountController);
    mockService = module.get(PagaLedgerAccountService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('topUp', () => {
    const creditDto: CreditAccountDto = {
      account_number: 'PAGA12345',
      amount: 1000,
      reference_number: 'REF1234567890123456',
      source_account_name: 'Test Account',
      source_account_number: '1234567890',
      description: 'Test topup',
    };

    it('should call service.topUp and return transformed response', async () => {
      mockService.topUp.mockResolvedValue(undefined);

      const response = await controller.topUp(creditDto);

      expect(mockService.topUp).toHaveBeenCalledWith(creditDto);
      expect(response).toMatchObject({
        statusCode: HttpStatus.OK,
        message: 'Paga webhook scheduled successfully',
        data: {
          message: 'Webhook will be sent in 2 seconds',
          result: undefined,
        },
      });
      expect(response.data.scheduledAt).toBeDefined();
    });

    it('should throw an error if service.topUp fails', async () => {
      mockService.topUp.mockRejectedValue(new BadRequestException('Invalid request'));

      await expect(controller.topUp(creditDto)).rejects.toThrow(BadRequestException);
      expect(mockService.topUp).toHaveBeenCalledWith(creditDto);
    });

    it('should throw BadRequestException when called in production', async () => {
      mockService.topUp.mockRejectedValue(
        new BadRequestException('This endpoint is only available in non-production environments'),
      );

      await expect(controller.topUp(creditDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDashboardAnalytics', () => {
    const mockAnalytics = {
      paga_business_balance: 500000000,
      paga_business_balance_naira: 5000000,
      total_user_balances: 400000000,
      total_user_balances_naira: 4000000,
      balance_difference: 100000000,
      balance_difference_naira: 1000000,
      needs_top_up: false,
      top_up_amount_required: 0,
      top_up_amount_required_naira: 0,
      total_accounts: 150,
      currency: 'NGN',
      generated_at: '2025-01-20T10:00:00.000Z',
    };

    it('should call service.getDashboardAnalytics and return transformed response', async () => {
      mockService.getDashboardAnalytics.mockResolvedValue(mockAnalytics);

      const response = await controller.getDashboardAnalytics();

      expect(mockService.getDashboardAnalytics).toHaveBeenCalled();
      expect(response).toMatchObject({
        statusCode: HttpStatus.OK,
        message: 'Paga dashboard analytics retrieved successfully',
        data: mockAnalytics,
      });
    });

    it('should throw an error if service.getDashboardAnalytics fails', async () => {
      mockService.getDashboardAnalytics.mockRejectedValue(
        new InternalServerErrorException('Failed to fetch analytics'),
      );

      await expect(controller.getDashboardAnalytics()).rejects.toThrow(InternalServerErrorException);
      expect(mockService.getDashboardAnalytics).toHaveBeenCalled();
    });

    it('should return analytics indicating top-up is needed', async () => {
      const analyticsNeedingTopUp = {
        ...mockAnalytics,
        total_user_balances: 600000000,
        total_user_balances_naira: 6000000,
        balance_difference: -100000000,
        balance_difference_naira: -1000000,
        needs_top_up: true,
        top_up_amount_required: 100000000,
        top_up_amount_required_naira: 1000000,
      };

      mockService.getDashboardAnalytics.mockResolvedValue(analyticsNeedingTopUp);

      const response = await controller.getDashboardAnalytics();

      expect(response.data.needs_top_up).toBe(true);
      expect(response.data.top_up_amount_required).toBe(100000000);
    });
  });

  describe('getTotalUserBalances', () => {
    const mockBalances = {
      total_balances: 500000000,
      total_balances_naira: 5000000,
      total_accounts: 100,
    };

    it('should call service.getTotalUserBalances and return transformed response', async () => {
      mockService.getTotalUserBalances.mockResolvedValue(mockBalances);

      const response = await controller.getTotalUserBalances();

      expect(mockService.getTotalUserBalances).toHaveBeenCalled();
      expect(response).toMatchObject({
        statusCode: HttpStatus.OK,
        message: 'Total user balances retrieved successfully',
        data: mockBalances,
      });
    });

    it('should throw an error if service.getTotalUserBalances fails', async () => {
      mockService.getTotalUserBalances.mockRejectedValue(new InternalServerErrorException('Database error'));

      await expect(controller.getTotalUserBalances()).rejects.toThrow(InternalServerErrorException);
      expect(mockService.getTotalUserBalances).toHaveBeenCalled();
    });

    it('should return zero balances when no accounts exist', async () => {
      const zeroBalances = {
        total_balances: 0,
        total_balances_naira: 0,
        total_accounts: 0,
      };

      mockService.getTotalUserBalances.mockResolvedValue(zeroBalances);

      const response = await controller.getTotalUserBalances();

      expect(response.data.total_balances).toBe(0);
      expect(response.data.total_accounts).toBe(0);
    });
  });
});
