import { NotImplementedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FiatWalletAdapter } from './fiat-wallet.adapter';
import {
  FiatWalletAccountDetailsRequest,
  FiatWalletTransferRequest,
  FiatWalletWithdrawalRequestPayload,
} from './fiat-wallet.adapter.interface';
import { ZerohashFiatWalletAdapter } from './zerohash/zerohash.adapter';

describe('FiatWalletAdapter', () => {
  let adapter: FiatWalletAdapter;
  let zerohashAdapter: ZerohashFiatWalletAdapter;

  const mockTransferRequest: FiatWalletTransferRequest = {
    senderCode: 'NE9XPV',
    receiverCode: 'IMBLL6',
    asset: 'USDC.SOL',
    amount: '.10',
    transferId: '123456789',
  };

  const mockTransferResponse = {
    message: {
      id: 1261302,
      client_transfer_id: '123456789',
      created_at: '2025-07-11T17:26:51.352Z',
      updated_at: '2025-07-11T17:26:51.352Z',
      status: 'approved',
      from_participant_code: 'NE9XPV',
      from_account_group: 'LNPWRG',
      from_account_label: null,
      to_participant_code: 'IMBLL6',
      to_account_group: 'LNPWRG',
      to_account_label: null,
      amount: '.10',
      movement_id: null,
      admin_transfer: false,
      parent_link_id: null,
      parent_link_id_source: null,
      asset: 'USDC.SOL',
      prefunded: false,
    },
  };

  beforeEach(async () => {
    const mockZerohashAdapter = {
      transfer: jest.fn(),
      getTransferDetails: jest.fn(),
      getWithdrawalQuote: jest.fn(),
      executeWithdrawal: jest.fn(),
      getWithdrawalDetails: jest.fn(),
      createWithdrawalRequest: jest.fn(),
      getAccountDetails: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FiatWalletAdapter, { provide: ZerohashFiatWalletAdapter, useValue: mockZerohashAdapter }],
    }).compile();

    adapter = module.get<FiatWalletAdapter>(FiatWalletAdapter);
    zerohashAdapter = module.get<ZerohashFiatWalletAdapter>(ZerohashFiatWalletAdapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('transfer', () => {
    it('should route US transfers to ZeroHash adapter', async () => {
      (zerohashAdapter.transfer as jest.Mock).mockResolvedValue(mockTransferResponse);

      const result = await adapter.transfer(mockTransferRequest);

      expect(zerohashAdapter.transfer).toHaveBeenCalledWith(mockTransferRequest);
      expect(result).toEqual(mockTransferResponse);
    });

    it('should handle case-insensitive country codes', async () => {
      (zerohashAdapter.transfer as jest.Mock).mockResolvedValue(mockTransferResponse);

      const result = await adapter.transfer(mockTransferRequest);

      expect(zerohashAdapter.transfer).toHaveBeenCalledWith(mockTransferRequest);
      expect(result).toEqual(mockTransferResponse);
    });
  });

  describe('getTransferDetails', () => {
    const mockTransferDetailsResponse = {
      providerRequestRef: '1261302',
      providerReference: '123456789',
      status: 'approved',
      amount: '.10',
      currency: 'USDC.SOL',
      fromUserRef: 'NE9XPV',
      toUserRef: 'IMBLL6',
      createdAt: '2025-07-11T17:26:51.352Z',
      updatedAt: '2025-07-11T17:26:51.352Z',
    };

    it('should route ZeroHash transfer details requests', async () => {
      (zerohashAdapter.getTransferDetails as jest.Mock).mockResolvedValue(mockTransferDetailsResponse);

      const result = await adapter.getTransferDetails('transfer-123', 'zerohash');

      expect(zerohashAdapter.getTransferDetails).toHaveBeenCalledWith('transfer-123');
      expect(result).toEqual(mockTransferDetailsResponse);
    });

    it('should throw NotImplementedException for unsupported providers', async () => {
      await expect(adapter.getTransferDetails('transfer-123', 'unknown')).rejects.toThrow(NotImplementedException);
    });
  });

  describe('getWithdrawalQuote', () => {
    const mockQuoteRequest = {
      userRef: 'TEST123',
      asset: 'USD',
      amount: '100.00',
      withdrawalAddress: 'test-wallet-address',
    };

    const mockQuoteResponse = {
      providerQuoteRef: 'quote-123',
      providerFee: '1.50',
      netWithdrawalQuantity: '98.50',
      amount: '100.00',
      currency: 'USD',
    };

    it('should route ZeroHash withdrawal quote requests', async () => {
      (zerohashAdapter.getWithdrawalQuote as jest.Mock).mockResolvedValue(mockQuoteResponse);

      const result = await adapter.getWithdrawalQuote(mockQuoteRequest, 'zerohash');

      expect(zerohashAdapter.getWithdrawalQuote).toHaveBeenCalledWith(mockQuoteRequest);
      expect(result).toEqual(mockQuoteResponse);
    });

    it('should throw NotImplementedException for unsupported providers', async () => {
      await expect(adapter.getWithdrawalQuote(mockQuoteRequest, 'unsupported')).rejects.toThrow(
        NotImplementedException,
      );
    });
  });

  describe('executeWithdrawal', () => {
    const mockExecuteRequest = {
      providerQuoteRef: 'quote-123',
      providerReference: 'withdraw-456',
    };

    const mockExecuteResponse = {
      providerRequestRef: 'request-123',
      providerReference: 'withdraw-456',
      status: 'processing',
      amount: '100.00',
      currency: 'USD',
    };

    it('should route ZeroHash withdrawal execution requests', async () => {
      (zerohashAdapter.executeWithdrawal as jest.Mock).mockResolvedValue(mockExecuteResponse);

      const result = await adapter.executeWithdrawal(mockExecuteRequest, 'zerohash');

      expect(zerohashAdapter.executeWithdrawal).toHaveBeenCalledWith(mockExecuteRequest);
      expect(result).toEqual(mockExecuteResponse);
    });

    it('should throw NotImplementedException for unsupported providers', async () => {
      await expect(adapter.executeWithdrawal(mockExecuteRequest, 'unknown')).rejects.toThrow(NotImplementedException);
    });
  });

  describe('getWithdrawalDetails', () => {
    const mockWithdrawalDetailsResponse = {
      providerRequestRef: 'request-123',
      providerReference: 'withdraw-456',
      status: 'completed',
      amount: '98.50',
      currency: 'USD',
    };

    it('should route ZeroHash withdrawal details requests', async () => {
      (zerohashAdapter.getWithdrawalDetails as jest.Mock).mockResolvedValue(mockWithdrawalDetailsResponse);

      const result = await adapter.getWithdrawalDetails('withdrawal-123', 'zerohash');

      expect(zerohashAdapter.getWithdrawalDetails).toHaveBeenCalledWith('withdrawal-123');
      expect(result).toEqual(mockWithdrawalDetailsResponse);
    });

    it('should throw NotImplementedException for unsupported providers', async () => {
      await expect(adapter.getWithdrawalDetails('withdrawal-123', 'unknown')).rejects.toThrow(NotImplementedException);
    });
  });

  describe('createWithdrawalRequest', () => {
    const mockWithdrawalRequestPayload: FiatWalletWithdrawalRequestPayload = {
      providerUserRef: 'TEST123',
      transactionRef: 'tx-ref-456',
      withdrawalAddress: 'test-wallet-address',
      amount: '100.5',
      asset: 'USDC.SOL',
    };

    const mockWithdrawalRequestResponse = {
      providerRef: 'withdrawal-req-789',
      withdrawalAccountRef: '12345',
      providerUserRef: 'TEST123',
      requestorUserRef: 'TEST123',
      requestedAmount: '100.50',
      settledAmount: '100.50',
      status: 'pending',
      asset: 'USDC.SOL',
      blockchainTransactionRef: 'blockchain-tx-123',
      blockchainStatus: 'pending',
      gasPrice: '0.001',
      feeAmount: '0.50',
      withdrawalFee: '0.50',
      quotedFeeAmount: '0.50',
      quotedFeeNotional: '0.50',
      clientWithdrawalRequestRef: 'tx-ref-456',
    };

    it('should route ZeroHash withdrawal request creation', async () => {
      (zerohashAdapter.createWithdrawalRequest as jest.Mock).mockResolvedValue(mockWithdrawalRequestResponse);

      const result = await adapter.createWithdrawalRequest(mockWithdrawalRequestPayload, 'zerohash');

      expect(zerohashAdapter.createWithdrawalRequest).toHaveBeenCalledWith(mockWithdrawalRequestPayload);
      expect(result).toEqual(mockWithdrawalRequestResponse);
    });

    it('should handle case-insensitive provider names', async () => {
      (zerohashAdapter.createWithdrawalRequest as jest.Mock).mockResolvedValue(mockWithdrawalRequestResponse);

      const result = await adapter.createWithdrawalRequest(mockWithdrawalRequestPayload, 'ZEROHASH');

      expect(zerohashAdapter.createWithdrawalRequest).toHaveBeenCalledWith(mockWithdrawalRequestPayload);
      expect(result).toEqual(mockWithdrawalRequestResponse);
    });

    it('should throw NotImplementedException for unsupported providers', async () => {
      await expect(adapter.createWithdrawalRequest(mockWithdrawalRequestPayload, 'unknown')).rejects.toThrow(
        NotImplementedException,
      );
    });

    it('should throw NotImplementedException with correct message for unsupported providers', async () => {
      await expect(adapter.createWithdrawalRequest(mockWithdrawalRequestPayload, 'invalid')).rejects.toThrow(
        'No withdrawal request support for provider invalid',
      );
    });
  });

  describe('getAccountDetails', () => {
    const mockAccountDetailsRequest: FiatWalletAccountDetailsRequest = {
      accountOwner: 'TEST123',
      asset: 'USDC.SOL',
    };

    const mockAccountDetailsResponse = {
      accounts: [
        {
          asset: 'USDC.SOL',
          accountOwner: 'TEST123',
          accountType: 'available',
          accountGroup: 'LNPWRG',
          accountLabel: null,
          balance: '1000.00',
          accountRef: 'acc-123',
          lastUpdate: '2025-01-15T10:00:00.000Z',
        },
      ],
      page: 1,
      totalPages: 1,
    };

    it('should route account details requests to ZeroHash adapter', async () => {
      (zerohashAdapter.getAccountDetails as jest.Mock).mockResolvedValue(mockAccountDetailsResponse);

      const result = await adapter.getAccountDetails(mockAccountDetailsRequest);

      expect(zerohashAdapter.getAccountDetails).toHaveBeenCalledWith(mockAccountDetailsRequest);
      expect(result).toEqual(mockAccountDetailsResponse);
    });

    it('should return account details with correct structure', async () => {
      (zerohashAdapter.getAccountDetails as jest.Mock).mockResolvedValue(mockAccountDetailsResponse);

      const result = await adapter.getAccountDetails(mockAccountDetailsRequest);

      expect(result.accounts).toBeDefined();
      expect(result.accounts.length).toBe(1);
      expect(result.accounts[0].accountOwner).toBe('TEST123');
      expect(result.accounts[0].asset).toBe('USDC.SOL');
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should handle empty accounts response', async () => {
      const emptyResponse = {
        accounts: [],
        page: 1,
        totalPages: 0,
      };
      (zerohashAdapter.getAccountDetails as jest.Mock).mockResolvedValue(emptyResponse);

      const result = await adapter.getAccountDetails(mockAccountDetailsRequest);

      expect(result.accounts).toEqual([]);
      expect(result.totalPages).toBe(0);
    });
  });
});
