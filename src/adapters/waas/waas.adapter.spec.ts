import { InternalServerErrorException, NotImplementedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentService } from '../../config';
import { PagaAdapter } from './paga/paga.adapter';
import { WaasAdapter } from './waas.adapter';
import {
  CheckLedgerBalancePayload,
  CreditTransactionPayload,
  DebitTransactionPayload,
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
  WaasCheckUpgradeStatusPayload,
  WaasGetBankListPayload,
  WaasProcessWebhookPayload,
  WaasTransactionStatus,
  WaasUpgradeAccountToTierThreePayload,
  WaasUpgradeVirtualAccountPayload,
} from './waas.adapter.interface';

describe('WaasAdapter', () => {
  let adapter: WaasAdapter;
  let pagaAdapter: jest.Mocked<PagaAdapter>;

  const mockPagaAdapter = {
    createBank: jest.fn(),
    findOrCreateVirtualAccount: jest.fn(),
    processTransferInflowWebhook: jest.fn(),
    creditBank: jest.fn(),
    getVirtualAccount: jest.fn(),
    getWalletDetails: jest.fn(),
    debitBank: jest.fn(),
    getProviderName: jest.fn().mockReturnValue('paga'),
    getTransactionStatus: jest.fn(),
    verifyBankAccount: jest.fn(),
    getBankCode: jest.fn().mockReturnValue('327'),
    getBankList: jest.fn(),
    transferToOtherBank: jest.fn(),
    transferToSameBank: jest.fn(),
    getTransactions: jest.fn(),
    updateVirtualAccount: jest.fn(),
    deleteVirtualAccount: jest.fn(),
    checkUpgradeStatus: jest.fn(),
    upgradeVirtualAccount: jest.fn(),
    upgradeAccountToTierThreeMultipart: jest.fn(),
    checkLedgerBalance: jest.fn(),
    getBusinessAccountBalance: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaasAdapter,
        {
          provide: PagaAdapter,
          useValue: mockPagaAdapter,
        },
      ],
    }).compile();

    adapter = module.get<WaasAdapter>(WaasAdapter);
    pagaAdapter = module.get(PagaAdapter) as jest.Mocked<PagaAdapter>;
  });

  describe('getProvider', () => {
    it('should return pagaAdapter when DEFAULT_NG_WAAS_ADAPTER is paga', () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      const provider = adapter.getProvider();
      expect(provider).toBe(pagaAdapter);
    });

    it('should return undefined when DEFAULT_NG_WAAS_ADAPTER is unknown', () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('unknown');
      const provider = adapter.getProvider();
      expect(provider).toBeUndefined();
    });
  });

  describe('getProviderName', () => {
    it('should return provider name from the selected provider', () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      const name = adapter.getProviderName();
      expect(name).toBe('paga');
      expect(mockPagaAdapter.getProviderName).toHaveBeenCalled();
    });
  });

  describe('getBankCode', () => {
    it('should return bank code from the selected provider', () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      const code = adapter.getBankCode();
      expect(code).toBe('327');
      expect(mockPagaAdapter.getBankCode).toHaveBeenCalled();
    });
  });

  describe('createBank', () => {
    const mockPayload: VirtualPermanentAccountPayload = {
      ref: 'REF123',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      phone_number: '+2348012345678',
      date_of_birth: '1990-01-01',
      gender: 'male',
      address: '123 Main St',
    };

    const mockResponse = {
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
    };

    it('should create bank account successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.createBank.mockResolvedValue(mockResponse);

      const result = await adapter.createBank(mockPayload);

      expect(mockPagaAdapter.createBank).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.createBank.mockRejectedValue(new Error('API Error'));

      await expect(adapter.createBank(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findOrCreateVirtualAccount', () => {
    const mockPayload: VirtualPermanentAccountPayload = {
      ref: 'REF123',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      phone_number: '+2348012345678',
      date_of_birth: '1990-01-01',
      gender: 'male',
      address: '123 Main St',
    };

    const mockResponse = {
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
    };

    it('should find or create virtual account successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.findOrCreateVirtualAccount.mockResolvedValue(mockResponse);

      const result = await adapter.findOrCreateVirtualAccount(mockPayload);

      expect(mockPagaAdapter.findOrCreateVirtualAccount).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.findOrCreateVirtualAccount.mockRejectedValue(new Error('API Error'));

      await expect(adapter.findOrCreateVirtualAccount(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('processTransferInflowWebhook', () => {
    const mockPayload: WaasProcessWebhookPayload = {
      transactionId: 'TXN123',
    };

    const mockResponse = {
      transactionId: 'TXN123',
      status: 'success',
    };

    it('should process transfer inflow webhook successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.processTransferInflowWebhook.mockResolvedValue(mockResponse);

      const result = await adapter.processTransferInflowWebhook(mockPayload);

      expect(mockPagaAdapter.processTransferInflowWebhook).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.processTransferInflowWebhook.mockRejectedValue(new Error('Webhook processing failed'));

      await expect(adapter.processTransferInflowWebhook(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('creditBank', () => {
    const mockPayload: CreditTransactionPayload<any> = {
      accountNo: '1234567890',
      totalAmount: 5000,
      transactionId: 'TXN123',
      metadata: {},
    };

    const mockResponse = {
      transactionId: 'TXN123',
      status: 'success',
    };

    it('should credit bank successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.creditBank.mockResolvedValue(mockResponse);

      const result = await adapter.creditBank(mockPayload);

      expect(mockPagaAdapter.creditBank).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.creditBank.mockRejectedValue(new Error('Credit failed'));

      await expect(adapter.creditBank(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getVirtualAccount', () => {
    const mockPayload: GetWalletPayload = {
      ref: 'REF123',
      accountNumber: '1234567890',
    };

    const mockResponse = {
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
    };

    it('should get virtual account successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.getVirtualAccount.mockResolvedValue(mockResponse);

      const result = await adapter.getVirtualAccount(mockPayload);

      expect(mockPagaAdapter.getVirtualAccount).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should return undefined when provider does not support getVirtualAccount', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.getVirtualAccount = undefined;

      const result = await adapter.getVirtualAccount(mockPayload);

      expect(result).toBeUndefined();
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.getVirtualAccount = jest.fn().mockRejectedValue(new Error('Account not found'));

      await expect(adapter.getVirtualAccount(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getWalletDetails', () => {
    const mockPayload: GetWalletDetailsPayload = {
      accountNo: '1234567890',
      ref: 'REF123',
    };

    const mockResponse = {
      accountName: 'John Doe',
      accountNumber: '1234567890',
      bankCode: '327',
      bankName: 'paga',
      bvn: '12345678901',
      ref: 'REF123',
      phoneNumber: '+2348012345678',
      callbackUrl: 'https://callback.url',
      address: null,
    };

    it('should get wallet details successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.getWalletDetails.mockResolvedValue(mockResponse);

      const result = await adapter.getWalletDetails(mockPayload);

      expect(mockPagaAdapter.getWalletDetails).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.getWalletDetails.mockRejectedValue(new Error('Wallet not found'));

      await expect(adapter.getWalletDetails(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('debitBankDetails', () => {
    const mockPayload: DebitTransactionPayload<any> = {
      accountId: '1234567890',
      amount: 5000,
      transactionId: 'TXN123',
      metadata: {},
    };

    it('should throw NotImplementedException', async () => {
      await expect(adapter.debitBankDetails(mockPayload)).rejects.toThrow(NotImplementedException);
    });
  });

  describe('getTransactions', () => {
    const mockPayload: GetBankTransactionsPayload = {
      ref: 'REF123',
      accountNumber: '1234567890',
      fromDate: '2024-01-01',
      toDate: '2024-01-31',
    };

    const mockResponse = [
      {
        id: 'TXN_001',
        externalTxId: 'TXN_REF_001',
        status: 'SUCCESSFUL',
        operation: 'DEPOSIT',
        amount: 5000,
        isReversed: false,
        isCredit: true,
        isDebit: false,
        balanceAfter: null,
        balanceBefore: null,
        currency: 'NGN',
        fee: 50,
        tax: 0,
        transactionType: 'USER_DEPOSIT_FROM_BANK_ACCOUNT',
        transactionChannel: 'API',
        reversalId: null,
        createdAt: '2024-01-15',
        lastUpdated: '2024-01-15',
        narration: 'Deposit',
        referenceNo: 'REF_001',
        transactionDate: '2024-01-15',
        transactionDateString: '2024-01-15T00:00:00.000Z',
        accountNumber: null,
      },
    ];

    it('should get transactions successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.getTransactions.mockResolvedValue(mockResponse);

      const result = await adapter.getTransactions(mockPayload);

      expect(mockPagaAdapter.getTransactions).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.getTransactions.mockRejectedValue(new Error('Failed to get transactions'));

      await expect(adapter.getTransactions(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('upgradeVirtualAccount', () => {
    const mockPayload: WaasUpgradeVirtualAccountPayload = {
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

    const mockResponse = {
      status: 'success',
      message: 'Account upgraded successfully',
    };

    it('should upgrade virtual account successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.upgradeVirtualAccount.mockResolvedValue(mockResponse);

      const result = await adapter.upgradeVirtualAccount(mockPayload);

      expect(mockPagaAdapter.upgradeVirtualAccount).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.upgradeVirtualAccount.mockRejectedValue(new Error('Upgrade failed'));

      await expect(adapter.upgradeVirtualAccount(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('upgradeAccountToTierThreeMultipart', () => {
    const mockPayload: WaasUpgradeAccountToTierThreePayload = {
      accountNumber: '1234567890',
      bvn: '12345678901',
      nin: '12345678901',
      proofOfAddressVerification: {} as any,
    };

    const mockResponse = {
      status: 'success',
      message: 'Account upgraded to tier 3',
    };

    it('should upgrade account to tier three successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.upgradeAccountToTierThreeMultipart.mockResolvedValue(mockResponse);

      const result = await adapter.upgradeAccountToTierThreeMultipart(mockPayload);

      expect(mockPagaAdapter.upgradeAccountToTierThreeMultipart).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.upgradeAccountToTierThreeMultipart.mockRejectedValue(new Error('Upgrade failed'));

      await expect(adapter.upgradeAccountToTierThreeMultipart(mockPayload)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('checkUpgradeStatus', () => {
    const mockPayload: WaasCheckUpgradeStatusPayload = {
      accountNumber: '1234567890',
    };

    const mockResponse = {
      status: 'pending',
      message: 'Upgrade is pending approval',
    };

    it('should check upgrade status successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.checkUpgradeStatus.mockResolvedValue(mockResponse);

      const result = await adapter.checkUpgradeStatus(mockPayload);

      expect(mockPagaAdapter.checkUpgradeStatus).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.checkUpgradeStatus.mockRejectedValue(new Error('Check failed'));

      await expect(adapter.checkUpgradeStatus(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('debitBank', () => {
    const mockPayload: DebitTransactionPayload<any> = {
      accountId: '1234567890',
      amount: 5000,
      transactionId: 'TXN123',
      metadata: {},
    };

    const mockResponse = {
      transactionId: 'TXN123',
      status: 'success',
    };

    it('should debit bank successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.debitBank.mockResolvedValue(mockResponse);

      const result = await adapter.debitBank(mockPayload);

      expect(mockPagaAdapter.debitBank).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.debitBank.mockRejectedValue(new Error('Debit failed'));

      await expect(adapter.debitBank(mockPayload)).rejects.toThrow(InternalServerErrorException);
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

    const mockResponse = {
      transactionReference: 'TXN123',
      sender: mockPayload.sender,
      receiver: mockPayload.receiver,
      amount: 5000,
      country: 'NG',
      transactionType: 'INTRA_BANK',
      narration: 'Test transfer',
      currency: 'NGN',
    };

    it('should transfer to other bank successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.transferToOtherBank.mockResolvedValue(mockResponse);

      const result = await adapter.transferToOtherBank(mockPayload);

      expect(mockPagaAdapter.transferToOtherBank).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.transferToOtherBank.mockRejectedValue(new Error('Transfer failed'));

      await expect(adapter.transferToOtherBank(mockPayload)).rejects.toThrow(InternalServerErrorException);
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

    const mockResponse = {
      transactionReference: 'TXN123',
      sender: mockPayload.sender,
      receiver: mockPayload.receiver,
      amount: 5000,
      currency: 'NGN',
      country: 'NG',
      providerRef: 'TXN123',
    };

    it('should transfer to same bank successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.transferToSameBank.mockResolvedValue(mockResponse);

      const result = await adapter.transferToSameBank(mockPayload);

      expect(mockPagaAdapter.transferToSameBank).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.transferToSameBank.mockRejectedValue(new Error('Transfer failed'));

      await expect(adapter.transferToSameBank(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getBankList', () => {
    const mockPayload: WaasGetBankListPayload = {
      ref: 'REF123',
    };

    const mockResponse = [
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
    ];

    it('should get bank list successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.getBankList.mockResolvedValue(mockResponse);

      const result = await adapter.getBankList(mockPayload);

      expect(mockPagaAdapter.getBankList).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should get bank list without payload', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.getBankList.mockResolvedValue(mockResponse);

      const result = await adapter.getBankList();

      expect(mockPagaAdapter.getBankList).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.getBankList.mockRejectedValue(new Error('Failed to get bank list'));

      await expect(adapter.getBankList(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getTransactionStatus', () => {
    const mockPayload: GetTransactionStatusPayload = {
      transactionRef: 'TXN123',
    };

    const mockResponse = {
      status: WaasTransactionStatus.SUCCESS,
      message: 'Transaction successful',
    };

    it('should get transaction status successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.getTransactionStatus.mockResolvedValue(mockResponse);

      const result = await adapter.getTransactionStatus(mockPayload);

      expect(mockPagaAdapter.getTransactionStatus).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should throw InternalServerErrorException on error', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.getTransactionStatus.mockRejectedValue(new Error('Failed to get status'));

      await expect(adapter.getTransactionStatus(mockPayload)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('verifyBankAccount', () => {
    const mockPayload: VerifyBankAccountPayload = {
      accountNumber: '1234567890',
      bankCode: '058',
      amount: '100',
      bankRef: 'gtbank-uuid',
    };

    const mockResponse = {
      accountName: 'John Doe',
      accountNumber: '1234567890',
      bankName: 'GTBank',
      bankCode: '058',
    };

    it('should verify bank account successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.verifyBankAccount.mockResolvedValue(mockResponse);

      const result = await adapter.verifyBankAccount(mockPayload);

      expect(mockPagaAdapter.verifyBankAccount).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });

    it('should throw InternalServerErrorException when response is null', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.verifyBankAccount.mockResolvedValue(null);

      await expect(adapter.verifyBankAccount(mockPayload)).rejects.toThrow(
        new InternalServerErrorException('Error while verifying bank account'),
      );
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

    const mockResponse = {
      status: 'success',
      message: 'Account updated successfully',
      ref: 'REF123',
    };

    it('should update virtual account successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.updateVirtualAccount.mockResolvedValue(mockResponse);

      const result = await adapter.updateVirtualAccount(mockPayload);

      expect(mockPagaAdapter.updateVirtualAccount).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteVirtualAccount', () => {
    const mockPayload: DeleteVirtualAccountPayload = {
      ref: 'REF123',
      accountNumber: '1234567890',
      isMainAccount: false,
    };

    it('should throw NotImplementedException (deletion disabled)', async () => {
      await expect(adapter.deleteVirtualAccount(mockPayload)).rejects.toThrow(NotImplementedException);
    });
  });

  describe('checkLedgerBalance', () => {
    const mockPayload: CheckLedgerBalancePayload = {
      accountNumber: '1234567890',
      amount: 5000,
      currency: 'NGN',
    };

    const mockResponse = {
      hasSufficientBalance: true,
      availableBalance: 10000000,
      requestedAmount: 500000,
    };

    it('should check ledger balance successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.checkLedgerBalance.mockResolvedValue(mockResponse);

      const result = await adapter.checkLedgerBalance(mockPayload);

      expect(mockPagaAdapter.checkLedgerBalance).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getBusinessAccountBalance', () => {
    const mockResponse = {
      totalBalance: 50000000,
      availableBalance: 45000000,
      currency: 'NGN',
    };

    it('should get business account balance successfully', async () => {
      jest.spyOn(EnvironmentService, 'getValue').mockReturnValue('paga');
      mockPagaAdapter.getBusinessAccountBalance.mockResolvedValue(mockResponse);

      const result = await adapter.getBusinessAccountBalance();

      expect(mockPagaAdapter.getBusinessAccountBalance).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });
});
