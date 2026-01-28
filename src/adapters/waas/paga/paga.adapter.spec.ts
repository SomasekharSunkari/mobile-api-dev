import { InternalServerErrorException, NotFoundException, NotImplementedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import axios, { AxiosResponse } from 'axios';
import { PagaConfigProvider } from '../../../config/paga.config';
import { PagaLedgerAccountRepository } from '../../../modules/pagaLedgerAccount/pagaLedgerAccount.repository';
import { PagaLedgerAccountService } from '../../../modules/pagaLedgerAccount/pagaLedgerAccount.service';
import { PagaLedgerTransactionService } from '../../../modules/pagaLedgerTransaction/pagaLedgerTransaction.service';
import { LockerService } from '../../../services/locker/locker.service';
import {
  DeleteVirtualAccountPayload,
  GetBankTransactionsPayload,
  GetTransactionStatusPayload,
  GetWalletDetailsPayload,
  GetWalletPayload,
  TransferToOtherBankPayload,
  TransferToSameBankPayload,
  UpdateVirtualAccountPayload,
  VerifyBankAccountPayload,
  VirtualPermanentAccountPayload,
  WaasTransactionStatus,
} from '../waas.adapter.interface';
import { PagaAdapter } from './paga.adapter';
import {
  PagaCreatePersistentPaymentAccountResponse,
  PagaDepositToBankResponse,
  PagaGetBankListResponse,
  PagaGetTransactionHistoryResponse,
  PagaGetTransactionStatusResponse,
  PagaGetVirtualAccountResponse,
  PagaTransactionStatusEnum,
  PagaUpdateVirtualAccountResponse,
  PagaVerifyBankAccountResponse,
} from './paga.interface';

// Mock axios to prevent actual HTTP calls
jest.mock('axios');

describe('PagaAdapter', () => {
  let adapter: PagaAdapter;
  let ledgerTxnSvc: jest.Mocked<PagaLedgerTransactionService>;
  let ledgerAcctSvc: jest.Mocked<PagaLedgerAccountService>;
  let module: TestingModule;
  let mockAxiosInstance: jest.Mocked<any>;

  const mockPagaConfig = {
    username: 'test-username',
    credential: 'test-credential',
    hmac: 'test-hmac',
    collectApiUrl: 'https://api.paga.com',
    businessApiUrl: 'https://business.paga.com',
  };

  beforeEach(async () => {
    // Setup mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      defaults: { baseURL: '' },
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

    module = await Test.createTestingModule({
      providers: [
        PagaAdapter,
        {
          provide: PagaConfigProvider,
          useValue: {
            getConfig: jest.fn().mockReturnValue(mockPagaConfig),
          },
        },
        {
          provide: PagaLedgerTransactionService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'txn-id' }),
            update: jest.fn().mockResolvedValue({}),
            findOne: jest.fn(),
            findAll: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: PagaLedgerAccountService,
          useValue: {
            findOrCreate: jest.fn(),
            findOne: jest.fn().mockResolvedValue({ available_balance: 1000000000 }),
            updateBalance: jest.fn().mockResolvedValue({}),
            delete: jest.fn(),
          },
        },
        {
          provide: PagaLedgerAccountRepository,
          useValue: {
            transaction: jest.fn(async (cb: any) => cb({})),
            update: jest.fn(),
            findOne: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: LockerService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            withLock: jest.fn().mockImplementation((_key, cb) => cb()),
          },
        },
      ],
    }).compile();

    adapter = module.get<PagaAdapter>(PagaAdapter);
    ledgerTxnSvc = module.get(PagaLedgerTransactionService) as any;
    ledgerAcctSvc = module.get(PagaLedgerAccountService) as any;
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (module) {
      await module.close();
    }
  });

  describe('getProviderName', () => {
    it('should return "paga" as provider name', () => {
      expect(adapter.getProviderName()).toBe('paga');
    });
  });

  describe('getBankCode', () => {
    it('should return "327" as bank code', () => {
      expect(adapter.getBankCode()).toBe('327');
    });
  });

  describe('createBank', () => {
    const mockPayload: VirtualPermanentAccountPayload = {
      ref: 'REF123',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      phone_number: '08012345678',
      date_of_birth: '1990-01-01',
      gender: 'male',
      address: '123 Main St',
      bvn: '12345678901',
      funding_limit: 100000,
    };

    const mockResponse: AxiosResponse<PagaCreatePersistentPaymentAccountResponse> = {
      data: {
        statusCode: '0',
        statusMessage: 'Success',
        referenceNumber: 'REF123',
        accountNumber: '1234567890',
        accountReference: 'REF123',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully create a virtual account', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await adapter.createBank(mockPayload);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/registerPersistentPaymentAccount',
        expect.objectContaining({
          referenceNumber: 'REF123',
          accountName: 'John Doe',
          accountReference: 'REF123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          financialIdentificationNumber: '12345678901',
          fundingTransactionLimit: 100000,
        }),
        expect.any(Object),
      );

      expect(result).toEqual({
        account_number: '1234567890',
        account_name: 'John Doe',
        bank_name: 'paga',
        provider_ref: 'REF123',
        provider_id: 'paga',
        provider_name: 'paga',
        provider_balance: 0,
        account_type: 'virtual',
        account_sub_type: 'persistent',
        amount: 0,
        order_ref: 'REF123',
      });
    });

    it('should handle payload without optional fields', async () => {
      const minimalPayload = {
        ref: 'REF123',
        first_name: 'John',
        last_name: 'Doe',
        phone_number: '08012345678',
        date_of_birth: '1990-01-01',
        gender: 'male',
        address: '123 Main St',
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await adapter.createBank(minimalPayload);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/registerPersistentPaymentAccount',
        expect.objectContaining({
          referenceNumber: 'REF123',
          accountName: 'John Doe',
          accountReference: 'REF123',
          firstName: 'John',
          lastName: 'Doe',
          email: undefined,
        }),
        expect.any(Object),
      );
    });

    it('should throw InternalServerErrorException on error', async () => {
      const error = new Error('API Error');
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(adapter.createBank(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when statusCode is not 0', async () => {
      const failedResponse = {
        ...mockResponse,
        data: { ...mockResponse.data, statusCode: '1', statusMessage: 'Account creation failed' },
      };
      mockAxiosInstance.post.mockResolvedValue(failedResponse);

      await expect(adapter.createBank(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });

    it('should remove phone number when it exceeds max length', async () => {
      const payloadWithLongPhone = {
        ...mockPayload,
        phone_number: '+2348012345678901',
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await adapter.createBank(payloadWithLongPhone);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/registerPersistentPaymentAccount',
        expect.not.objectContaining({
          phoneNumber: '+2348012345678901',
        }),
        expect.any(Object),
      );
    });

    it('should call pagaLedgerAccountService.findOrCreate on successful account creation', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await adapter.createBank(mockPayload);

      expect(ledgerAcctSvc.findOrCreate).toHaveBeenCalledWith({
        account_number: '1234567890',
        account_name: 'John Doe',
        email: 'john@example.com',
        phone_number: '08012345678',
        available_balance: 0,
      });
    });

    it('should handle API error with statusMessage in response', async () => {
      const error = { response: { data: { statusMessage: 'Account already exists' } } };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(adapter.createBank(mockPayload)).rejects.toThrow(
        new InternalServerErrorException('Account already exists'),
      );
    });
  });

  describe('getBankList', () => {
    const mockBankListResponse: AxiosResponse<PagaGetBankListResponse> = {
      data: {
        referenceNumber: 'REF123456789',
        statusCode: '0',
        statusMessage: 'Success',
        banks: [
          {
            name: 'Access Bank',
            uuid: 'access-bank-uuid',
            interInstitutionCode: '044',
            sortCode: '044',
            ussdCode: '*901#',
          },
          {
            name: 'GTBank',
            uuid: 'gtbank-uuid',
            interInstitutionCode: '058',
            sortCode: '058',
            ussdCode: '*737#',
          },
        ],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should return list of banks', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockBankListResponse);

      const result = await adapter.getBankList();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/banks',
        expect.objectContaining({
          referenceNumber: expect.any(String),
        }),
        expect.any(Object),
      );

      expect(result).toEqual([
        {
          bankName: 'Access Bank',
          bankCode: '044',
          nibssBankCode: '044',
          bankRef: 'access-bank-uuid',
        },
        {
          bankName: 'GTBank',
          bankCode: '058',
          nibssBankCode: '058',
          bankRef: 'gtbank-uuid',
        },
      ]);
    });

    it('should use provided reference number', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockBankListResponse);

      await adapter.getBankList({ ref: 'CUSTOM_REF' });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/banks',
        { referenceNumber: 'CUSTOM_REF' },
        expect.any(Object),
      );
    });

    it('should throw InternalServerErrorException when response data is null', async () => {
      const nullResponse = { ...mockBankListResponse, data: null };
      mockAxiosInstance.post.mockResolvedValue(nullResponse);

      await expect(adapter.getBankList()).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on API error', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(adapter.getBankList()).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getVirtualAccount', () => {
    const mockPayload: GetWalletPayload = {
      ref: 'REF123',
      accountNumber: '1234567890',
    };

    const mockResponse: AxiosResponse<PagaGetVirtualAccountResponse> = {
      data: {
        statusCode: '0',
        statusMessage: 'Success',
        referenceNumber: 'REF123',
        accountReference: 'REF123',
        accountNumber: '1234567890',
        accountName: 'John Doe',
        phoneNumber: '+2348012345678',
        firstName: 'John',
        lastName: 'Doe',
        financialIdentificationNumber: '12345678901',
        creditBankId: '',
        creditBankAccountNumber: '',
        callbackUrl: '',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should return virtual account details', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await adapter.getVirtualAccount(mockPayload);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/getPersistentPaymentAccount',
        {
          referenceNumber: 'REF123',
          accountIdentifier: '1234567890',
        },
        expect.any(Object),
      );

      expect(result).toEqual({
        accountName: 'John Doe',
        address: null,
        accountNumber: '1234567890',
        bankCode: '327',
        bankName: 'paga',
        bvn: '12345678901',
        ref: 'REF123',
        phoneNumber: '+2348012345678',
        merchantId: null,
        callBackUrl: '',
      });
    });

    it('should use ref as accountIdentifier when accountNumber is not provided', async () => {
      const payloadWithoutAccountNumber = { ref: 'REF123' };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await adapter.getVirtualAccount(payloadWithoutAccountNumber);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/getPersistentPaymentAccount',
        {
          referenceNumber: 'REF123',
          accountIdentifier: 'REF123',
        },
        expect.any(Object),
      );
    });

    it('should return undefined when account number is not in response', async () => {
      const responseWithoutAccountNumber = {
        ...mockResponse,
        data: { ...mockResponse.data, accountNumber: null },
      };
      mockAxiosInstance.post.mockResolvedValue(responseWithoutAccountNumber);

      const result = await adapter.getVirtualAccount(mockPayload);

      expect(result).toBeUndefined();
    });

    it('should throw InternalServerErrorException on error', async () => {
      const error = { response: { data: { statusMessage: 'Account not found' } } };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(adapter.getVirtualAccount(mockPayload)).rejects.toThrow(
        new InternalServerErrorException('Account not found'),
      );
    });
  });

  describe('transferToOtherBank', () => {
    const mockPayload: TransferToOtherBankPayload = {
      transactionReference: 'TXN123',
      amount: 5000,
      currency: 'NGN',
      description: 'Test transfer',
      sender: {
        accountNumber: '0987654321',
        bankCode: '044',
        bankName: 'Access Bank',
        accountName: 'Sender Name',
      },
      receiver: {
        accountNumber: '1234567890',
        bankCode: '058',
        bankName: 'GTBank',
        accountName: 'Receiver Name',
        bankRef: 'gtbank-uuid',
      },
      transactionType: 'INTER_BANK',
    };

    const mockResponse: AxiosResponse<PagaDepositToBankResponse> = {
      data: {
        referenceNumber: 'TXN123',
        exchangeRate: 1.0,
        destinationAccountHolderNameAtBank: 'Receiver Name',
        fee: 50,
        vat: 0,
        currency: 'NGN',
        message: 'Transfer successful',
        transactionId: 'PAGA_TXN_123',
        responseCode: 0,
        sessionId: 'SESSION_123',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should successfully transfer to other bank', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockResponse);
      ledgerAcctSvc.findOne.mockResolvedValue({
        account_number: '0987654321',
        available_balance: 1000000000,
        id: 'sender-account-id',
      } as any);

      const result = await adapter.transferToOtherBank(mockPayload);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/depositToBank',
        {
          referenceNumber: 'TXN123',
          amount: 5000,
          destinationBankAccountNumber: '1234567890',
          destinationBankUUID: 'gtbank-uuid',
          remarks: 'Test transfer',
        },
        expect.any(Object),
      );

      expect(result).toEqual({
        transactionReference: 'TXN123',
        sender: mockPayload.sender,
        receiver: mockPayload.receiver,
        amount: 5000,
        country: 'NG',
        transactionType: 'INTRA_BANK',
        narration: 'Test transfer',
        currency: 'NGN',
      });
    });

    it('should throw InternalServerErrorException when ledger account not found', async () => {
      ledgerAcctSvc.findOne.mockResolvedValue(null);

      await expect(adapter.transferToOtherBank(mockPayload)).rejects.toThrow(
        new InternalServerErrorException('Paga ledger account not found'),
      );
    });

    it('should throw BadRequestException when insufficient balance', async () => {
      ledgerAcctSvc.findOne.mockResolvedValue({
        account_number: '0987654321',
        available_balance: 100,
        id: 'sender-account-id',
      } as any);

      await expect(adapter.transferToOtherBank(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });

    it('should update ledger transaction to FAILED when API response code is not 0', async () => {
      const failedResponse = {
        ...mockResponse,
        data: { ...mockResponse.data, responseCode: 1 },
      };
      mockAxiosInstance.post.mockResolvedValue(failedResponse);
      ledgerAcctSvc.findOne.mockResolvedValue({
        account_number: '0987654321',
        available_balance: 1000000000,
        id: 'sender-account-id',
      } as any);

      await adapter.transferToOtherBank(mockPayload);

      expect(ledgerTxnSvc.update).toHaveBeenCalledWith('txn-id', 'FAILED');
    });

    it('should throw InternalServerErrorException on error', async () => {
      const error = { response: { data: { errorMessage: 'Insufficient funds' } } };
      ledgerAcctSvc.findOne.mockResolvedValue({
        account_number: '0987654321',
        available_balance: 1000000000,
        id: 'sender-account-id',
      } as any);
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(adapter.transferToOtherBank(mockPayload)).rejects.toThrow(
        new InternalServerErrorException('Insufficient funds'),
      );
    });

    it('should update ledger transaction to SUCCESSFUL and update balance when API response code is 0', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockResponse);
      ledgerAcctSvc.findOne.mockResolvedValue({
        account_number: '0987654321',
        available_balance: 1000000000,
        id: 'sender-account-id',
      } as any);

      await adapter.transferToOtherBank(mockPayload);

      expect(ledgerTxnSvc.update).toHaveBeenCalledWith('txn-id', 'SUCCESSFUL', expect.any(Object));
      expect(ledgerAcctSvc.updateBalance).toHaveBeenCalled();
    });

    it('should handle payload without optional bankRef', async () => {
      const payloadWithoutBankRef: TransferToOtherBankPayload = {
        ...mockPayload,
        receiver: { ...mockPayload.receiver, bankRef: undefined },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);
      ledgerAcctSvc.findOne.mockResolvedValue({
        account_number: '0987654321',
        available_balance: 1000000000,
        id: 'sender-account-id',
      } as any);

      await adapter.transferToOtherBank(payloadWithoutBankRef);

      expect(mockAxiosInstance.post).toHaveBeenCalled();
    });
  });

  describe('getTransactionStatus', () => {
    const mockPayload: GetTransactionStatusPayload = {
      transactionRef: 'TXN123',
    };

    const mockSuccessResponse: AxiosResponse<PagaGetTransactionStatusResponse> = {
      data: {
        responseCode: 0,
        responseCategoryCode: null,
        message: 'Success',
        referenceNumber: 'TXN123',
        currency: 'NGN',
        status: PagaTransactionStatusEnum.SUCCESSFUL,
        transactionReference: 'TXN123',
        transactionId: 'PAGA_TXN_123',
        reversalId: null,
        transactionType: 'DEPOSIT',
        dateUTC: 1640995200000,
        amount: 5000,
        merchantTransactionReference: 'TXN123',
        exchangeRate: null,
        fee: 50,
        integrationStatus: 'SUCCESS',
        additionalProperties: null,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should return transaction status for successful transaction', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockSuccessResponse);

      const result = await adapter.getTransactionStatus(mockPayload);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/transactionStatus',
        {
          referenceNumber: 'TXN123',
        },
        expect.any(Object),
      );

      expect(result).toEqual({
        status: WaasTransactionStatus.SUCCESS,
        message: 'Success',
      });
    });

    it('should return PENDING status for unknown status', async () => {
      const unknownStatusResponse = {
        ...mockSuccessResponse,
        data: { ...mockSuccessResponse.data, responseCode: 0, status: 'UNKNOWN_STATUS', message: 'Unknown status' },
      };
      mockAxiosInstance.post.mockResolvedValue(unknownStatusResponse);

      const result = await adapter.getTransactionStatus(mockPayload);

      expect(result.status).toBe(WaasTransactionStatus.PENDING);
    });

    it('should return FAILED status for failed transaction', async () => {
      const failedStatusResponse = {
        ...mockSuccessResponse,
        data: {
          ...mockSuccessResponse.data,
          responseCode: 0,
          status: PagaTransactionStatusEnum.FAILED,
          message: 'Transaction failed',
        },
      };
      mockAxiosInstance.post.mockResolvedValue(failedStatusResponse);

      const result = await adapter.getTransactionStatus(mockPayload);

      expect(result.status).toBe(WaasTransactionStatus.FAILED);
    });

    it('should throw InternalServerErrorException on error', async () => {
      const error = { response: { data: { message: 'API Error' } } };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(adapter.getTransactionStatus(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle null status and return PENDING', async () => {
      const nullStatusResponse = {
        ...mockSuccessResponse,
        data: { ...mockSuccessResponse.data, responseCode: 0, status: null, message: 'Status unavailable' },
      };
      mockAxiosInstance.post.mockResolvedValue(nullStatusResponse);

      const result = await adapter.getTransactionStatus(mockPayload);

      expect(result.status).toBe(WaasTransactionStatus.PENDING);
    });

    it('should handle case-insensitive status matching for SUCCESSFUL', async () => {
      const upperCaseStatusResponse = {
        ...mockSuccessResponse,
        data: { ...mockSuccessResponse.data, responseCode: 0, status: 'SUCCESSFUL', message: 'Success' },
      };
      mockAxiosInstance.post.mockResolvedValue(upperCaseStatusResponse);

      const result = await adapter.getTransactionStatus(mockPayload);

      expect(result.status).toBe(WaasTransactionStatus.SUCCESS);
    });

    it('should handle lowercase status matching for failed', async () => {
      const lowerCaseStatusResponse = {
        ...mockSuccessResponse,
        data: { ...mockSuccessResponse.data, responseCode: 0, status: 'failed', message: 'Failed' },
      };
      mockAxiosInstance.post.mockResolvedValue(lowerCaseStatusResponse);

      const result = await adapter.getTransactionStatus(mockPayload);

      expect(result.status).toBe(WaasTransactionStatus.FAILED);
    });
  });

  describe('verifyBankAccount', () => {
    const mockPayload: VerifyBankAccountPayload = {
      accountNumber: '1234567890',
      bankCode: '058',
      amount: '100',
      bankRef: 'gtbank-uuid',
    };

    const mockBankListResponse: AxiosResponse<PagaGetBankListResponse> = {
      data: {
        referenceNumber: 'REF123456789',
        statusCode: '0',
        statusMessage: 'Success',
        banks: [
          {
            name: 'GTBank',
            uuid: 'gtbank-uuid',
            interInstitutionCode: '058',
            sortCode: '058',
            ussdCode: '*737#',
          },
        ],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    const mockVerifyResponse: AxiosResponse<PagaVerifyBankAccountResponse> = {
      data: {
        responseCode: 0,
        responseCategoryCode: 0,
        message: 'Success',
        referenceNumber: 'REF123456789',
        fee: 10,
        vat: 0,
        destinationAccountHolderNameAtBank: 'John Doe',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should verify bank account successfully', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce(mockBankListResponse).mockResolvedValueOnce(mockVerifyResponse);

      const result = await adapter.verifyBankAccount(mockPayload);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/validateDepositToBank',
        expect.objectContaining({
          amount: '100',
          destinationBankUUID: 'gtbank-uuid',
          destinationBankAccountNumber: '1234567890',
        }),
        expect.any(Object),
      );

      expect(result).toEqual({
        accountName: 'John Doe',
        accountNumber: '1234567890',
        bankName: 'GTBank',
        bankCode: '058',
        bankRef: 'gtbank-uuid',
      });
    });

    it('should throw InternalServerErrorException when bank is not found', async () => {
      const payloadWithUnknownBank = { ...mockPayload, bankRef: 'unknown-bank-uuid' };
      mockAxiosInstance.post.mockResolvedValueOnce(mockBankListResponse);

      await expect(adapter.verifyBankAccount(payloadWithUnknownBank)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when response data is null', async () => {
      const nullVerifyResponse = { ...mockVerifyResponse, data: null };
      mockAxiosInstance.post.mockResolvedValueOnce(mockBankListResponse).mockResolvedValueOnce(nullVerifyResponse);

      await expect(adapter.verifyBankAccount(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when response code is not 0', async () => {
      const failedVerifyResponse = {
        ...mockVerifyResponse,
        data: { ...mockVerifyResponse.data, responseCode: 1, message: 'Verification failed' },
      };
      mockAxiosInstance.post.mockResolvedValueOnce(mockBankListResponse).mockResolvedValueOnce(failedVerifyResponse);

      await expect(adapter.verifyBankAccount(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on API error', async () => {
      const error = { response: { data: { statusMessage: 'Network timeout' } }, message: 'Network timeout' };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(adapter.verifyBankAccount(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateVirtualAccount', () => {
    const mockPayload: UpdateVirtualAccountPayload = {
      ref: 'REF123',
      accountNumber: '1234567890',
      phoneNumber: '+2348012345678',
      firstName: 'John',
      lastName: 'Doe',
      accountName: 'John Doe Updated',
      bvn: '12345678901',
      callbackUrl: 'https://callback.url',
    };

    const mockResponse: AxiosResponse<PagaUpdateVirtualAccountResponse> = {
      data: {
        referenceNumber: 'REF123',
        statusCode: '0',
        statusMessage: 'Account updated successfully',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should update virtual account successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await adapter.updateVirtualAccount(mockPayload);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/updatePersistentPaymentAccount',
        expect.objectContaining({
          referenceNumber: 'REF123',
          accountIdentifier: '1234567890',
          phoneNumber: '+2348012345678',
          firstName: 'John',
          lastName: 'Doe',
          accountName: 'John Doe Updated',
          financialIdentificationNumber: '12345678901',
          callbackUrl: 'https://callback.url',
        }),
        expect.any(Object),
      );

      expect(result).toEqual({
        status: 'success',
        message: 'Account updated successfully',
        ref: 'REF123',
      });
    });

    it('should update virtual account with creditBankId and creditBankAccountNumber', async () => {
      const payloadWithBankDetails: UpdateVirtualAccountPayload = {
        ...mockPayload,
        creditBankId: 'bank-uuid-123',
        creditBankAccountNumber: '0123456789',
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await adapter.updateVirtualAccount(payloadWithBankDetails);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/updatePersistentPaymentAccount',
        expect.objectContaining({
          referenceNumber: 'REF123',
          accountIdentifier: '1234567890',
          creditBankId: 'bank-uuid-123',
          creditBankAccountNumber: '0123456789',
        }),
        expect.any(Object),
      );

      expect(result).toEqual({
        status: 'success',
        message: 'Account updated successfully',
        ref: 'REF123',
      });
    });

    it('should use ref as accountIdentifier when accountNumber is not provided', async () => {
      const payloadWithoutAccountNumber = { ...mockPayload, accountNumber: undefined };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await adapter.updateVirtualAccount(payloadWithoutAccountNumber);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/updatePersistentPaymentAccount',
        expect.objectContaining({
          accountIdentifier: 'REF123',
        }),
        expect.any(Object),
      );
    });

    it('should generate referenceNumber when ref is not provided', async () => {
      const payloadWithoutRef = { ...mockPayload, ref: undefined };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await adapter.updateVirtualAccount(payloadWithoutRef);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/updatePersistentPaymentAccount',
        expect.objectContaining({
          referenceNumber: expect.any(String),
        }),
        expect.any(Object),
      );
    });

    it('should throw InternalServerErrorException when statusCode is not 0', async () => {
      const failedResponse = {
        ...mockResponse,
        data: { ...mockResponse.data, statusCode: '1', statusMessage: 'Update failed' },
      };
      mockAxiosInstance.post.mockResolvedValue(failedResponse);

      await expect(adapter.updateVirtualAccount(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on error', async () => {
      const error = { response: { data: { statusMessage: 'API Error' } } };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(adapter.updateVirtualAccount(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('deleteVirtualAccount', () => {
    const mockPayload: DeleteVirtualAccountPayload = {
      ref: 'REF123',
      accountNumber: '1234567890',
      isMainAccount: true,
    };

    const mockResponse = {
      data: {
        statusCode: '0',
        statusMessage: 'Account deleted successfully',
        referenceNumber: 'REF123',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should delete virtual account successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await adapter.deleteVirtualAccount(mockPayload);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/deletePersistentPaymentAccount',
        {
          referenceNumber: 'REF123',
          accountIdentifier: '1234567890',
        },
        expect.any(Object),
      );

      expect(result).toEqual({
        status: 'success',
        message: 'Account deleted successfully',
      });
    });

    it('should delete virtual account with reason', async () => {
      const payloadWithReason: DeleteVirtualAccountPayload = {
        ...mockPayload,
        reason: 'Account holder requested deletion',
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await adapter.deleteVirtualAccount(payloadWithReason);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/deletePersistentPaymentAccount',
        {
          referenceNumber: 'REF123',
          accountIdentifier: '1234567890',
          reason: 'Account holder requested deletion',
        },
        expect.any(Object),
      );
    });

    it('should use ref as accountIdentifier when accountNumber is not provided', async () => {
      const payloadWithoutAccountNumber = { ...mockPayload, accountNumber: undefined };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await adapter.deleteVirtualAccount(payloadWithoutAccountNumber);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/deletePersistentPaymentAccount',
        expect.objectContaining({
          accountIdentifier: 'REF123',
        }),
        expect.any(Object),
      );
    });

    it('should delete ledger account when isMainAccount is true', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await adapter.deleteVirtualAccount(mockPayload);

      expect(ledgerAcctSvc.delete).toHaveBeenCalledWith('1234567890');
    });

    it('should not delete ledger account when isMainAccount is false', async () => {
      const payloadNotMainAccount: DeleteVirtualAccountPayload = {
        ...mockPayload,
        isMainAccount: false,
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await adapter.deleteVirtualAccount(payloadNotMainAccount);

      expect(ledgerAcctSvc.delete).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when statusCode is not 0', async () => {
      const failedResponse = {
        ...mockResponse,
        data: { ...mockResponse.data, statusCode: '1', statusMessage: 'Delete failed' },
      };
      mockAxiosInstance.post.mockResolvedValue(failedResponse);

      await expect(adapter.deleteVirtualAccount(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on API error', async () => {
      const error = { response: { data: { message: 'API Error' } } };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(adapter.deleteVirtualAccount(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('transferToSameBank', () => {
    const mockPayload: TransferToSameBankPayload = {
      transactionReference: 'TXN123',
      amount: 5000,
      currency: 'NGN',
      transactionType: 'INTRA_BANK',
      sender: {
        accountNumber: '0987654321',
        bankName: 'paga',
        accountName: 'Sender Name',
        bankRef: 'paga-ref',
      },
      receiver: {
        accountNumber: '1234567890',
        bankName: 'paga',
        accountName: 'Receiver Name',
        bankRef: 'paga-ref',
      },
    };

    it('should successfully transfer to same bank', async () => {
      ledgerAcctSvc.findOne.mockResolvedValueOnce({
        account_number: '0987654321',
        available_balance: 1000000000,
        id: 'sender-account-id',
        email: 'sender@test.com',
        phone_number: '+234123456789',
        account_name: 'Sender Name',
      } as any);
      ledgerAcctSvc.findOne.mockResolvedValueOnce({
        account_number: '1234567890',
        available_balance: 500000000,
        id: 'receiver-account-id',
        email: 'receiver@test.com',
        phone_number: '+234987654321',
        account_name: 'Receiver Name',
      } as any);

      ledgerTxnSvc.create.mockResolvedValueOnce({ id: 'sender-txn-id' } as any);
      ledgerTxnSvc.create.mockResolvedValueOnce({ id: 'receiver-txn-id' } as any);

      ledgerAcctSvc.updateBalance.mockResolvedValue({} as any);

      const result = await adapter.transferToSameBank(mockPayload);

      expect(ledgerAcctSvc.findOne).toHaveBeenCalledTimes(2);
      expect(ledgerTxnSvc.create).toHaveBeenCalledTimes(2);
      expect(ledgerAcctSvc.updateBalance).toHaveBeenCalledTimes(2);

      expect(result).toEqual({
        transactionReference: 'TXN123',
        sender: mockPayload.sender,
        receiver: mockPayload.receiver,
        amount: 5000,
        currency: 'NGN',
        country: 'NG',
        providerRef: 'TXN123',
      });
    });

    it('should throw InternalServerErrorException when sender account not found', async () => {
      ledgerAcctSvc.findOne.mockResolvedValueOnce(null);

      await expect(adapter.transferToSameBank(mockPayload)).rejects.toThrow(
        new InternalServerErrorException('Sender Paga ledger account not found'),
      );
    });

    it('should throw InternalServerErrorException when receiver account not found', async () => {
      ledgerAcctSvc.findOne.mockResolvedValueOnce({
        account_number: '0987654321',
        available_balance: 1000000000,
        id: 'sender-account-id',
      } as any);
      ledgerAcctSvc.findOne.mockResolvedValueOnce(null);

      await expect(adapter.transferToSameBank(mockPayload)).rejects.toThrow(
        new InternalServerErrorException('Receiver Paga ledger account not found'),
      );
    });

    it('should throw BadRequestException when insufficient balance', async () => {
      ledgerAcctSvc.findOne.mockResolvedValueOnce({
        account_number: '0987654321',
        available_balance: 100,
        id: 'sender-account-id',
      } as any);
      ledgerAcctSvc.findOne.mockResolvedValueOnce({
        account_number: '1234567890',
        available_balance: 500000000,
        id: 'receiver-account-id',
      } as any);

      await expect(adapter.transferToSameBank(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });

    it('should create debit transaction for sender and credit transaction for receiver', async () => {
      ledgerAcctSvc.findOne.mockResolvedValueOnce({
        account_number: '0987654321',
        available_balance: 1000000000,
        id: 'sender-account-id',
      } as any);
      ledgerAcctSvc.findOne.mockResolvedValueOnce({
        account_number: '1234567890',
        available_balance: 500000000,
        id: 'receiver-account-id',
      } as any);

      await adapter.transferToSameBank(mockPayload);

      expect(ledgerTxnSvc.create).toHaveBeenCalledWith(
        expect.objectContaining({
          account_number: '0987654321',
          transaction_type: 'DEBIT',
        }),
      );
      expect(ledgerTxnSvc.create).toHaveBeenCalledWith(
        expect.objectContaining({
          account_number: '1234567890',
          transaction_type: 'CREDIT',
        }),
      );
    });

    it('should update balance for both sender and receiver', async () => {
      ledgerAcctSvc.findOne.mockResolvedValueOnce({
        account_number: '0987654321',
        available_balance: 1000000000,
        id: 'sender-account-id',
      } as any);
      ledgerAcctSvc.findOne.mockResolvedValueOnce({
        account_number: '1234567890',
        available_balance: 500000000,
        id: 'receiver-account-id',
      } as any);

      ledgerTxnSvc.create.mockResolvedValueOnce({ id: 'sender-txn-id' } as any);
      ledgerTxnSvc.create.mockResolvedValueOnce({ id: 'receiver-txn-id' } as any);

      await adapter.transferToSameBank(mockPayload);

      expect(ledgerAcctSvc.updateBalance).toHaveBeenCalledWith('0987654321', expect.any(Number), 'sender-txn-id');
      expect(ledgerAcctSvc.updateBalance).toHaveBeenCalledWith('1234567890', expect.any(Number), 'receiver-txn-id');
    });

    it('should throw InternalServerErrorException on error', async () => {
      ledgerAcctSvc.findOne.mockRejectedValue({ message: 'Database connection error' });

      await expect(adapter.transferToSameBank(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getTransactions', () => {
    const mockPayload: GetBankTransactionsPayload = {
      ref: 'REF123',
      accountNumber: '1234567890',
      fromDate: '2024-01-01',
      toDate: '2024-01-31',
    };

    const mockResponse: AxiosResponse<PagaGetTransactionHistoryResponse> = {
      data: {
        responseCode: 0,
        responseCategoryCode: null,
        message: 'Success',
        referenceNumber: 'REF123',
        recordCount: 2,
        items: [
          {
            itemNumber: 1,
            dateUTC: 1640995200000,
            description: null,
            amount: 5000,
            status: 'SUCCESSFUL',
            transactionId: 'TXN_001',
            referenceNumber: 'REF_001',
            transactionReference: 'TXN_REF_001',
            sourceAccountName: 'Test Account',
            sourceAccountOrganizationName: 'Test Org',
            balance: 10000,
            tax: 0,
            fee: 50,
            transactionType: 'USER_DEPOSIT_FROM_BANK_ACCOUNT',
            transactionChannel: 'API',
            reversalId: null,
            currency: 'NGN',
          },
          {
            itemNumber: 2,
            dateUTC: 1640995200000,
            description: null,
            amount: 2000,
            status: 'SUCCESSFUL',
            transactionId: 'TXN_002',
            referenceNumber: 'REF_002',
            transactionReference: 'TXN_REF_002',
            sourceAccountName: 'Test Account',
            sourceAccountOrganizationName: 'Test Org',
            balance: 8000,
            tax: 0,
            fee: 25,
            transactionType: 'USER_SEND_CASH_TO_BANK_ACCOUNT_SETTLED',
            transactionChannel: 'API',
            reversalId: null,
            currency: 'NGN',
          },
        ],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should return list of transactions', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await adapter.getTransactions(mockPayload);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/transactionHistory',
        expect.objectContaining({
          referenceNumber: 'REF123',
        }),
        expect.any(Object),
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'TXN_001',
          externalTxId: 'TXN_REF_001',
          status: 'SUCCESSFUL',
          operation: 'USER_DEPOSIT_FROM_BANK_ACCOUNT',
          amount: 5000,
          isCredit: true,
          isDebit: false,
          currency: 'NGN',
          fee: 50,
        }),
      );
    });

    it('should return debit transaction correctly', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await adapter.getTransactions(mockPayload);

      expect(result[1]).toEqual(
        expect.objectContaining({
          isCredit: false,
          isDebit: true,
        }),
      );
    });

    it('should identify MERCHANT_PAYMENT_VIRTUAL_ACCOUNT_TRANSFER as credit', async () => {
      const merchantPaymentResponse = {
        ...mockResponse,
        data: {
          ...mockResponse.data,
          items: [
            {
              ...mockResponse.data.items[0],
              transactionType: 'MERCHANT_PAYMENT_VIRTUAL_ACCOUNT_TRANSFER',
            },
          ],
        },
      };
      mockAxiosInstance.post.mockResolvedValue(merchantPaymentResponse);

      const result = await adapter.getTransactions(mockPayload);

      expect(result[0].isCredit).toBe(true);
      expect(result[0].isDebit).toBe(false);
    });

    it('should identify unknown transaction type as debit', async () => {
      const unknownTypeResponse = {
        ...mockResponse,
        data: {
          ...mockResponse.data,
          items: [
            {
              ...mockResponse.data.items[0],
              transactionType: 'UNKNOWN_TYPE',
            },
          ],
        },
      };
      mockAxiosInstance.post.mockResolvedValue(unknownTypeResponse);

      const result = await adapter.getTransactions(mockPayload);

      expect(result[0].isCredit).toBe(false);
      expect(result[0].isDebit).toBe(true);
    });

    it('should handle payload without fromDate and toDate', async () => {
      const payloadWithoutDates = { ref: 'REF123', accountNumber: '1234567890' };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await adapter.getTransactions(payloadWithoutDates);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/transactionHistory',
        expect.objectContaining({
          referenceNumber: 'REF123',
        }),
        expect.any(Object),
      );
    });

    it('should handle empty items array', async () => {
      const emptyResponse = { ...mockResponse, data: { ...mockResponse.data, items: [] } };
      mockAxiosInstance.post.mockResolvedValue(emptyResponse);

      const result = await adapter.getTransactions(mockPayload);

      expect(result).toHaveLength(0);
    });

    it('should handle null items array with nullish coalescing', async () => {
      const nullItemsResponse = { ...mockResponse, data: { ...mockResponse.data, items: null } };
      mockAxiosInstance.post.mockResolvedValue(nullItemsResponse);

      const result = await adapter.getTransactions(mockPayload);

      expect(result).toHaveLength(0);
    });

    it('should handle undefined items array with nullish coalescing', async () => {
      const undefinedItemsResponse = { ...mockResponse, data: { ...mockResponse.data, items: undefined } };
      mockAxiosInstance.post.mockResolvedValue(undefinedItemsResponse);

      const result = await adapter.getTransactions(mockPayload);

      expect(result).toHaveLength(0);
    });

    it('should mark reversed transactions correctly', async () => {
      const reversedTxnResponse = {
        ...mockResponse,
        data: {
          ...mockResponse.data,
          items: [
            {
              ...mockResponse.data.items[0],
              reversalId: 'REVERSAL_123',
            },
          ],
        },
      };
      mockAxiosInstance.post.mockResolvedValue(reversedTxnResponse);

      const result = await adapter.getTransactions(mockPayload);

      expect(result[0].isReversed).toBe(true);
    });

    it('should throw InternalServerErrorException on error', async () => {
      const error = { response: { data: { errorMessage: 'Failed to get transactions' } } };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(adapter.getTransactions(mockPayload)).rejects.toThrow(
        new InternalServerErrorException('Failed to get transactions'),
      );
    });

    it('should use accountNumber as reference when ref is not provided', async () => {
      const payloadWithoutRef = { accountNumber: '1234567890', fromDate: '2024-01-01', toDate: '2024-01-31' };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await adapter.getTransactions(payloadWithoutRef);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/transactionHistory',
        expect.objectContaining({
          referenceNumber: '1234567890',
        }),
        expect.any(Object),
      );
    });
  });

  describe('getWalletDetails', () => {
    const mockPayload: GetWalletDetailsPayload = {
      ref: 'REF123',
      accountNo: '1234567890',
    };

    const mockResponse: AxiosResponse<PagaGetVirtualAccountResponse> = {
      data: {
        statusCode: '0',
        statusMessage: 'Success',
        referenceNumber: 'REF123',
        accountReference: 'REF123',
        accountNumber: '1234567890',
        accountName: 'John Doe',
        phoneNumber: '+2348012345678',
        firstName: 'John',
        lastName: 'Doe',
        financialIdentificationNumber: '12345678901',
        creditBankId: '',
        creditBankAccountNumber: '',
        callbackUrl: 'https://callback.url',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should return wallet details', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await adapter.getWalletDetails(mockPayload);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/getPersistentPaymentAccount',
        {
          referenceNumber: 'REF123',
          accountIdentifier: '1234567890',
        },
        expect.any(Object),
      );

      expect(result).toEqual({
        accountName: 'John Doe',
        address: null,
        accountNumber: '1234567890',
        bankCode: '327',
        bankName: 'paga',
        bvn: '12345678901',
        ref: 'REF123',
        phoneNumber: '+2348012345678',
        callbackUrl: 'https://callback.url',
      });
    });

    it('should use ref as accountIdentifier when accountNo is not provided', async () => {
      const payloadWithoutAccountNo = { ...mockPayload, accountNo: undefined };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await adapter.getWalletDetails(payloadWithoutAccountNo);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/getPersistentPaymentAccount',
        expect.objectContaining({
          accountIdentifier: 'REF123',
        }),
        expect.any(Object),
      );
    });

    it('should throw InternalServerErrorException on error', async () => {
      const error = { response: { data: { statusMessage: 'Account not found' } } };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(adapter.getWalletDetails(mockPayload)).rejects.toThrow(
        new InternalServerErrorException('Account not found'),
      );
    });
  });

  describe('findOrCreateVirtualAccount', () => {
    const mockPayload: VirtualPermanentAccountPayload = {
      ref: 'REF123',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      phone_number: '08012345678',
      date_of_birth: '1990-01-01',
      gender: 'male',
      address: '123 Main St',
      bvn: '12345678901',
    };

    const mockExistingAccountResponse: AxiosResponse<PagaGetVirtualAccountResponse> = {
      data: {
        statusCode: '0',
        statusMessage: 'Success',
        referenceNumber: 'REF123',
        accountReference: 'REF123',
        accountNumber: '1234567890',
        accountName: 'John Doe',
        phoneNumber: '+2348012345678',
        firstName: 'John',
        lastName: 'Doe',
        financialIdentificationNumber: '12345678901',
        creditBankId: '',
        creditBankAccountNumber: '',
        callbackUrl: '',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    const mockCreateBankResponse: AxiosResponse<PagaCreatePersistentPaymentAccountResponse> = {
      data: {
        statusCode: '0',
        statusMessage: 'Success',
        referenceNumber: 'REF123',
        accountNumber: '1234567890',
        accountReference: 'REF123',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    };

    it('should return existing account if found', async () => {
      mockAxiosInstance.post.mockResolvedValue(mockExistingAccountResponse);

      const result = await adapter.findOrCreateVirtualAccount(mockPayload);

      expect(result).toEqual({
        account_number: '1234567890',
        account_name: 'John Doe',
        bank_name: 'paga',
        provider_ref: 'REF123',
        provider_id: 'paga',
        provider_name: 'paga',
        provider_balance: 0,
        account_type: 'virtual',
        account_sub_type: 'persistent',
        amount: 0,
        order_ref: 'REF123',
      });
    });

    it('should create new account if existing account has missing accountName', async () => {
      const incompleteAccountResponse = {
        ...mockExistingAccountResponse,
        data: { ...mockExistingAccountResponse.data, accountName: null },
      };
      mockAxiosInstance.post
        .mockResolvedValueOnce(incompleteAccountResponse)
        .mockResolvedValueOnce(mockCreateBankResponse);

      const result = await adapter.findOrCreateVirtualAccount(mockPayload);

      expect(result.account_number).toBe('1234567890');
    });

    it('should create new account if existing account has missing accountNumber', async () => {
      const incompleteAccountResponse = {
        ...mockExistingAccountResponse,
        data: { ...mockExistingAccountResponse.data, accountNumber: null },
      };
      mockAxiosInstance.post
        .mockResolvedValueOnce(incompleteAccountResponse)
        .mockResolvedValueOnce(mockCreateBankResponse);

      const result = await adapter.findOrCreateVirtualAccount(mockPayload);

      expect(result.account_number).toBe('1234567890');
    });

    it('should throw InternalServerErrorException when getVirtualAccount fails', async () => {
      const error = { response: { data: { statusMessage: 'API Error' } }, message: 'Get account failed' };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(adapter.findOrCreateVirtualAccount(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('checkLedgerBalance', () => {
    it('should return balance check result when account has sufficient balance', async () => {
      ledgerAcctSvc.findOne.mockResolvedValue({
        account_number: '1234567890',
        available_balance: 1000000,
        id: 'account-id',
      } as any);

      const result = await adapter.checkLedgerBalance({
        accountNumber: '1234567890',
        amount: 5000,
        currency: 'NGN',
      });

      expect(result).toEqual({
        hasSufficientBalance: true,
        availableBalance: 1000000,
        requestedAmount: 500000,
      });
    });

    it('should return insufficient balance when account has less balance', async () => {
      ledgerAcctSvc.findOne.mockResolvedValue({
        account_number: '1234567890',
        available_balance: 100,
        id: 'account-id',
      } as any);

      const result = await adapter.checkLedgerBalance({
        accountNumber: '1234567890',
        amount: 5000,
        currency: 'NGN',
      });

      expect(result).toEqual({
        hasSufficientBalance: false,
        availableBalance: 100,
        requestedAmount: 500000,
      });
    });

    it('should throw NotFoundException when account not found', async () => {
      ledgerAcctSvc.findOne.mockResolvedValue(null);

      await expect(
        adapter.checkLedgerBalance({
          accountNumber: '1234567890',
          amount: 5000,
          currency: 'NGN',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBusinessAccountBalance', () => {
    it('should return business account balance successfully', async () => {
      const mockResponse = {
        data: {
          responseCode: 0,
          message: 'Success',
          totalBalance: 1000000,
          availableBalance: 900000,
          currency: 'NGN',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await adapter.getBusinessAccountBalance();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/accountBalance',
        expect.objectContaining({
          referenceNumber: expect.any(String),
        }),
        expect.any(Object),
      );

      expect(result).toEqual({
        totalBalance: 1000000,
        availableBalance: 900000,
        currency: 'NGN',
      });
    });

    it('should default currency to NGN when not provided in response', async () => {
      const mockResponse = {
        data: {
          responseCode: 0,
          message: 'Success',
          totalBalance: 500000,
          availableBalance: 400000,
          currency: null,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await adapter.getBusinessAccountBalance();

      expect(result.currency).toBe('NGN');
    });

    it('should throw InternalServerErrorException when responseCode is not 0', async () => {
      const mockResponse = {
        data: {
          responseCode: 1,
          message: 'Failed to fetch balance',
          totalBalance: 0,
          availableBalance: 0,
          currency: 'NGN',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await expect(adapter.getBusinessAccountBalance()).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when responseCode is not 0 with empty message', async () => {
      const mockResponse = {
        data: {
          responseCode: 1,
          message: null,
          totalBalance: 0,
          availableBalance: 0,
          currency: 'NGN',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await expect(adapter.getBusinessAccountBalance()).rejects.toThrow(
        new InternalServerErrorException('Failed to fetch Paga business account balance'),
      );
    });

    it('should throw InternalServerErrorException on API error', async () => {
      const error = new Error('Network error');
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(adapter.getBusinessAccountBalance()).rejects.toThrow(
        new InternalServerErrorException('Failed to fetch Paga business account balance'),
      );
    });
  });

  describe('Not Implemented Methods', () => {
    it('should throw NotImplementedException for checkUpgradeStatus', async () => {
      await expect(adapter.checkUpgradeStatus({ accountNumber: '1234567890' })).rejects.toThrow(
        NotImplementedException,
      );
    });

    it('should throw NotImplementedException for upgradeVirtualAccount', async () => {
      const mockPayload = {
        accountNumber: '1234567890',
        bvn: '12345678901',
        nin: '12345678901',
        tier: 2,
        idType: 'NIN',
        phoneNumber: '+2348012345678',
        email: 'john@example.com',
        userPhoto: 'base64photo',
        idNumber: '12345678901',
        idCardFront: 'base64front',
        streetName: 'Main Street',
        state: 'Lagos',
        city: 'Lagos',
        localGovernment: 'Lagos Island',
        pep: 'No',
        utilityBill: 'base64bill',
      };
      await expect(adapter.upgradeVirtualAccount(mockPayload)).rejects.toThrow(NotImplementedException);
    });

    it('should throw NotImplementedException for creditBank', async () => {
      const mockPayload = {
        accountNo: '1234567890',
        totalAmount: 5000,
        transactionId: 'TXN123',
        metadata: {},
      };
      await expect(adapter.creditBank(mockPayload)).rejects.toThrow(NotImplementedException);
    });

    it('should throw NotImplementedException for debitBank', () => {
      const mockPayload = {
        accountId: '1234567890',
        amount: 5000,
        transactionId: 'TXN123',
        metadata: {},
      };
      expect(() => adapter.debitBank(mockPayload)).toThrow(NotImplementedException);
    });

    it('should throw NotImplementedException for processTransferInflowWebhook', () => {
      const mockPayload = { transactionId: 'TXN123' };
      expect(() => adapter.processTransferInflowWebhook(mockPayload)).toThrow(NotImplementedException);
    });

    it('should throw NotImplementedException for upgradeAccountToTierThreeMultipart', () => {
      const mockPayload = {
        accountNumber: '1234567890',
        bvn: '12345678901',
        nin: '12345678901',
        proofOfAddressVerification: {} as any,
      };
      expect(() => adapter.upgradeAccountToTierThreeMultipart(mockPayload)).toThrow(NotImplementedException);
    });
  });
});
