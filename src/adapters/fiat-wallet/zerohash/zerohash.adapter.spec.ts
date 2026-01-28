jest.mock('../../../config/environment', () => ({
  EnvironmentService: {
    getValue: jest.fn(),
    getValues: jest.fn(() => ({
      db_host: 'localhost',
      db_password: 'test',
      db_user: 'test',
      db_name: 'test',
      db_port: 5432,
      db_ssl: false,
    })),
  },
}));

jest.mock('../../../database/database.connection', () => ({
  KnexDB: {
    connection: jest.fn(() => ({
      raw: jest.fn(),
      destroy: jest.fn(),
    })),
  },
}));

jest.mock('../../participant/zerohash/zerohash.axios', () => {
  return {
    ZerohashAxiosHelper: class {
      post = jest.fn();
      get = jest.fn();
      protected configProvider = {
        getConfig: jest.fn().mockReturnValue({
          accountGroup: 'LNPWRG',
          yellowcardMerchantWallet: 'test-wallet-address',
        }),
      };
    },
  };
});

import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE } from '../../../constants/constants';
import { FiatWalletTransferRequest } from '../fiat-wallet.adapter.interface';
import { ZerohashFiatWalletAdapter } from './zerohash.adapter';

describe('ZerohashFiatWalletAdapter', () => {
  let adapter: ZerohashFiatWalletAdapter;

  const mockTransferRequest: FiatWalletTransferRequest = {
    senderCode: 'NE9XPV',
    receiverCode: 'IMBLL6',
    asset: 'USDC.SOL',
    amount: '.10',
    transferId: '123456789',
  };

  const mockTransferResponse = {
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} } as any,
    data: {
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
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZerohashFiatWalletAdapter],
    }).compile();

    adapter = module.get<ZerohashFiatWalletAdapter>(ZerohashFiatWalletAdapter);

    adapter['get'] = jest.fn();
    adapter['post'] = jest.fn();
    adapter['put'] = jest.fn();
    adapter['patch'] = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('transfer', () => {
    it('should successfully initiate a transfer', async () => {
      const postSpy = jest.spyOn(adapter, 'post').mockResolvedValue(mockTransferResponse);

      const result = await adapter.transfer(mockTransferRequest);

      expect(postSpy).toHaveBeenCalledWith('/transfers', {
        from_participant_code: 'NE9XPV',
        from_account_group: 'LNPWRG',
        to_participant_code: 'IMBLL6',
        to_account_group: 'LNPWRG',
        asset: 'USDC.SOL',
        amount: '.10',
        client_transfer_id: '123456789',
      });

      expect(result).toEqual({
        providerRequestRef: '1261302',
        providerReference: '123456789',
        status: 'approved',
        amount: '.10',
        currency: 'USDC.SOL',
        createdAt: '2025-07-11T17:26:51.352Z',
      });
    });

    it('should throw InternalServerErrorException when transfer fails', async () => {
      const postSpy = jest.spyOn(adapter, 'post').mockRejectedValue(new Error('API Error'));

      await expect(adapter.transfer(mockTransferRequest)).rejects.toThrow(InternalServerErrorException);

      expect(postSpy).toHaveBeenCalledWith('/transfers', expect.any(Object));
    });

    it('should include correct payload structure', async () => {
      const postSpy = jest.spyOn(adapter, 'post').mockResolvedValue(mockTransferResponse);

      await adapter.transfer(mockTransferRequest);

      const expectedPayload = {
        from_participant_code: mockTransferRequest.senderCode,
        from_account_group: 'LNPWRG',
        to_participant_code: mockTransferRequest.receiverCode,
        to_account_group: 'LNPWRG',
        asset: mockTransferRequest.asset,
        amount: mockTransferRequest.amount,
        client_transfer_id: mockTransferRequest.transferId,
      };

      expect(postSpy).toHaveBeenCalledWith('/transfers', expectedPayload);
    });

    it('should use account group from config provider', async () => {
      const postSpy = jest.spyOn(adapter, 'post').mockResolvedValue(mockTransferResponse);

      await adapter.transfer(mockTransferRequest);

      const calledPayload = postSpy.mock.calls[0][1] as any;
      expect(calledPayload.from_account_group).toBe('LNPWRG');
      expect(calledPayload.to_account_group).toBe('LNPWRG');
    });

    it('should map response correctly to generic interface', async () => {
      jest.spyOn(adapter, 'post').mockResolvedValue(mockTransferResponse);

      const result = await adapter.transfer(mockTransferRequest);

      expect(result.providerRequestRef).toBe('1261302');
      expect(result.providerReference).toBe('123456789');
      expect(result.status).toBe('approved');
      expect(result.amount).toBe('.10');
      expect(result.currency).toBe('USDC.SOL');
      expect(result.createdAt).toBe('2025-07-11T17:26:51.352Z');
    });

    it('should handle network errors', async () => {
      jest.spyOn(adapter, 'post').mockRejectedValue(new Error('Network timeout'));

      await expect(adapter.transfer(mockTransferRequest)).rejects.toThrow(InternalServerErrorException);
      await expect(adapter.transfer(mockTransferRequest)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });
  });

  describe('getTransferDetails', () => {
    const mockTransferDetailsResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} } as any,
      data: {
        message: {
          id: 1261302,
          client_transfer_id: '123456789',
          status: 'approved',
          amount: '.10',
          asset: 'USDC.SOL',
          from_participant_code: 'NE9XPV',
          to_participant_code: 'IMBLL6',
          created_at: '2025-07-11T17:26:51.352Z',
          updated_at: '2025-07-11T17:26:51.352Z',
        },
      },
    };

    it('should successfully get transfer details', async () => {
      const getSpy = jest.spyOn(adapter, 'get').mockResolvedValue(mockTransferDetailsResponse);

      const result = await adapter.getTransferDetails('transfer-123');

      expect(getSpy).toHaveBeenCalledWith('/transfers/transfer-123');

      expect(result).toEqual({
        providerRequestRef: '1261302',
        providerReference: '123456789',
        status: 'approved',
        amount: '.10',
        currency: 'USDC.SOL',
        fromUserRef: 'NE9XPV',
        toUserRef: 'IMBLL6',
        createdAt: '2025-07-11T17:26:51.352Z',
        updatedAt: '2025-07-11T17:26:51.352Z',
      });
    });

    it('should throw InternalServerErrorException when transfer details fails', async () => {
      const getSpy = jest.spyOn(adapter, 'get').mockRejectedValue(new Error('API Error'));

      await expect(adapter.getTransferDetails('transfer-123')).rejects.toThrow(InternalServerErrorException);
      expect(getSpy).toHaveBeenCalledWith('/transfers/transfer-123');
    });

    it('should include all transfer details fields', async () => {
      jest.spyOn(adapter, 'get').mockResolvedValue(mockTransferDetailsResponse);

      const result = await adapter.getTransferDetails('transfer-123');

      expect(result).toHaveProperty('providerRequestRef');
      expect(result).toHaveProperty('providerReference');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('amount');
      expect(result).toHaveProperty('currency');
      expect(result).toHaveProperty('fromUserRef');
      expect(result).toHaveProperty('toUserRef');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });

    it('should handle 404 errors gracefully', async () => {
      jest.spyOn(adapter, 'get').mockRejectedValue(new Error('Not Found'));

      await expect(adapter.getTransferDetails('non-existent-transfer')).rejects.toThrow(InternalServerErrorException);
      await expect(adapter.getTransferDetails('non-existent-transfer')).rejects.toThrow(
        ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE,
      );
    });
  });

  describe('getWithdrawalQuote', () => {
    const mockQuoteRequest = {
      userRef: 'TEST123',
      asset: 'USDC.SOL',
      amount: '100.00',
      withdrawalAddress: 'test-wallet-address',
    };

    const mockZerohashResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} } as any,
      data: {
        message: {
          withdrawal_quote_id: 'quote-123',
          network_fee_notional: '1.50',
          net_withdrawal_quantity: '98.50',
          amount: '100.00',
          asset: 'USDC.SOL',
        },
      },
    };

    it('should successfully get withdrawal quote', async () => {
      const getSpy = jest.spyOn(adapter, 'get').mockResolvedValue(mockZerohashResponse);

      const result = await adapter.getWithdrawalQuote(mockQuoteRequest);

      expect(getSpy).toHaveBeenCalledWith(
        '/withdrawals/locked_network_fee?participant_code=TEST123&asset=USDC.SOL&withdrawal_address=test-wallet-address&amount=100.00',
      );

      expect(result).toEqual({
        providerQuoteRef: 'quote-123',
        providerFee: '1.50',
        netWithdrawalQuantity: '98.50',
        amount: '100.00',
        currency: 'USDC.SOL',
      });
    });

    it('should throw error when quote fails', async () => {
      const getSpy = jest.spyOn(adapter, 'get').mockRejectedValue(new Error('API Error'));

      await expect(adapter.getWithdrawalQuote(mockQuoteRequest)).rejects.toThrow(InternalServerErrorException);
      expect(getSpy).toHaveBeenCalledWith(
        '/withdrawals/locked_network_fee?participant_code=TEST123&asset=USDC.SOL&withdrawal_address=test-wallet-address&amount=100.00',
      );
    });

    it('should construct query params correctly', async () => {
      const getSpy = jest.spyOn(adapter, 'get').mockResolvedValue(mockZerohashResponse);

      await adapter.getWithdrawalQuote(mockQuoteRequest);

      const calledUrl = getSpy.mock.calls[0][0];
      expect(calledUrl).toContain('participant_code=TEST123');
      expect(calledUrl).toContain('asset=USDC.SOL');
      expect(calledUrl).toContain('withdrawal_address=test-wallet-address');
      expect(calledUrl).toContain('amount=100.00');
    });

    it('should map quote response correctly', async () => {
      jest.spyOn(adapter, 'get').mockResolvedValue(mockZerohashResponse);

      const result = await adapter.getWithdrawalQuote(mockQuoteRequest);

      expect(result.providerQuoteRef).toBe('quote-123');
      expect(result.providerFee).toBe('1.50');
      expect(result.netWithdrawalQuantity).toBe('98.50');
      expect(result.amount).toBe('100.00');
      expect(result.currency).toBe('USDC.SOL');
    });

    it('should handle invalid withdrawal address', async () => {
      jest.spyOn(adapter, 'get').mockRejectedValue(new Error('Invalid address'));

      const invalidRequest = { ...mockQuoteRequest, withdrawalAddress: 'invalid' };
      await expect(adapter.getWithdrawalQuote(invalidRequest)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('executeWithdrawal', () => {
    const mockExecuteRequest = {
      providerQuoteRef: 'quote-123',
      providerReference: 'withdraw-456',
    };

    const mockExecuteResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} } as any,
      data: {
        message: {
          withdrawal_request_id: 'req-123',
          client_withdrawal_request_id: 'withdraw-456',
          on_chain_status: 'processing',
          amount: '98.50',
          asset: 'USDC.SOL',
        },
      },
    };

    it('should successfully execute withdrawal', async () => {
      const postSpy = jest.spyOn(adapter, 'post').mockResolvedValue(mockExecuteResponse);

      const result = await adapter.executeWithdrawal(mockExecuteRequest);

      expect(postSpy).toHaveBeenCalledWith('/withdrawals/execute', {
        withdrawal_quote_id: 'quote-123',
        client_withdrawal_request_id: 'withdraw-456',
      });

      expect(result).toEqual({
        providerRequestRef: 'req-123',
        providerReference: 'withdraw-456',
        status: 'processing',
        amount: '98.50',
        currency: 'USDC.SOL',
        externalReference: null,
      });
    });

    it('should throw InternalServerErrorException when execution fails', async () => {
      const postSpy = jest.spyOn(adapter, 'post').mockRejectedValue(new Error('API Error'));

      await expect(adapter.executeWithdrawal(mockExecuteRequest)).rejects.toThrow(InternalServerErrorException);
      expect(postSpy).toHaveBeenCalledWith('/withdrawals/execute', {
        withdrawal_quote_id: 'quote-123',
        client_withdrawal_request_id: 'withdraw-456',
      });
    });

    it('should set externalReference to null in execute response', async () => {
      jest.spyOn(adapter, 'post').mockResolvedValue(mockExecuteResponse);

      const result = await adapter.executeWithdrawal(mockExecuteRequest);

      expect(result.externalReference).toBeNull();
    });

    it('should include correct payload structure', async () => {
      const postSpy = jest.spyOn(adapter, 'post').mockResolvedValue(mockExecuteResponse);

      await adapter.executeWithdrawal(mockExecuteRequest);

      const expectedPayload = {
        withdrawal_quote_id: mockExecuteRequest.providerQuoteRef,
        client_withdrawal_request_id: mockExecuteRequest.providerReference,
      };

      expect(postSpy).toHaveBeenCalledWith('/withdrawals/execute', expectedPayload);
    });

    it('should handle expired quote error', async () => {
      jest.spyOn(adapter, 'post').mockRejectedValue(new Error('Quote expired'));

      await expect(adapter.executeWithdrawal(mockExecuteRequest)).rejects.toThrow(InternalServerErrorException);
      await expect(adapter.executeWithdrawal(mockExecuteRequest)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });
  });

  describe('getWithdrawalDetails', () => {
    const mockWithdrawalDetailsResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} } as any,
      data: {
        message: [
          {
            id: 'req-123',
            client_withdrawal_request_id: 'withdraw-456',
            status: 'completed',
            requested_amount: '98.50',
            asset: 'USDC.SOL',
            transaction_id: 'tx-789',
          },
        ],
      },
    };

    it('should successfully get withdrawal details', async () => {
      const getSpy = jest.spyOn(adapter, 'get').mockResolvedValue(mockWithdrawalDetailsResponse);

      const result = await adapter.getWithdrawalDetails('withdrawal-123');

      expect(getSpy).toHaveBeenCalledWith('/withdrawals/requests/withdrawal-123');

      expect(result).toEqual({
        providerRequestRef: 'req-123',
        providerReference: 'withdraw-456',
        status: 'completed',
        amount: '98.50',
        currency: 'USDC.SOL',
        externalReference: 'tx-789',
      });
    });

    it('should throw InternalServerErrorException when details fetch fails', async () => {
      const getSpy = jest.spyOn(adapter, 'get').mockRejectedValue(new Error('API Error'));

      await expect(adapter.getWithdrawalDetails('withdrawal-123')).rejects.toThrow(InternalServerErrorException);
      expect(getSpy).toHaveBeenCalledWith('/withdrawals/requests/withdrawal-123');
    });

    it('should extract first element from response array', async () => {
      jest.spyOn(adapter, 'get').mockResolvedValue(mockWithdrawalDetailsResponse);

      const result = await adapter.getWithdrawalDetails('withdrawal-123');

      expect(result.providerRequestRef).toBe('req-123');
      expect(result.externalReference).toBe('tx-789');
    });

    it('should include transaction_id as externalReference', async () => {
      jest.spyOn(adapter, 'get').mockResolvedValue(mockWithdrawalDetailsResponse);

      const result = await adapter.getWithdrawalDetails('withdrawal-123');

      expect(result.externalReference).toBe('tx-789');
    });

    it('should handle non-existent withdrawal', async () => {
      jest.spyOn(adapter, 'get').mockRejectedValue(new Error('Withdrawal not found'));

      await expect(adapter.getWithdrawalDetails('non-existent')).rejects.toThrow(InternalServerErrorException);
      await expect(adapter.getWithdrawalDetails('non-existent')).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });
  });

  describe('createWithdrawalRequest', () => {
    const mockWithdrawalRequest = {
      providerUserRef: 'TEST123',
      transactionRef: 'tx-ref-456',
      withdrawalAddress: 'test-wallet-address',
      amount: '100.5',
      asset: 'USDC.SOL',
    };

    const mockCreateWithdrawalResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} } as any,
      data: {
        message: {
          id: 'withdrawal-req-789',
          withdrawal_account_id: 12345,
          participant_code: 'TEST123',
          requestor_participant_code: 'TEST123',
          requested_amount: '100.50',
          settled_amount: '100.50',
          status: 'pending',
          asset: 'USDC.SOL',
          transaction_id: 'blockchain-tx-123',
          on_chain_status: 'pending',
          gas_price: '0.001',
          fee_amount: '0.50',
          withdrawal_fee: '0.50',
          quoted_fee_amount: '0.50',
          quoted_fee_notional: '0.50',
          client_withdrawal_request_id: 'tx-ref-456',
        },
      },
    };

    it('should successfully create withdrawal request', async () => {
      const postSpy = jest.spyOn(adapter, 'post').mockResolvedValue(mockCreateWithdrawalResponse);

      const result = await adapter.createWithdrawalRequest(mockWithdrawalRequest);

      expect(postSpy).toHaveBeenCalledWith('/withdrawals/requests', {
        client_withdrawal_request_id: 'tx-ref-456',
        address: 'test-wallet-address',
        participant_code: 'TEST123',
        account_group: 'LNPWRG',
        amount: '100.5',
        asset: 'USDC.SOL',
      });

      expect(result).toEqual({
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
      });
    });

    it('should throw InternalServerErrorException when creation fails', async () => {
      jest.spyOn(adapter, 'post').mockRejectedValue(new Error('API Error'));

      await expect(adapter.createWithdrawalRequest(mockWithdrawalRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(adapter.createWithdrawalRequest(mockWithdrawalRequest)).rejects.toThrow(
        ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE,
      );
    });

    it('should use account group from config provider', async () => {
      const postSpy = jest.spyOn(adapter, 'post').mockResolvedValue(mockCreateWithdrawalResponse);

      await adapter.createWithdrawalRequest(mockWithdrawalRequest);

      const calledPayload = postSpy.mock.calls[0][1] as any;
      expect(calledPayload.account_group).toBe('LNPWRG');
    });

    it('should convert amount to string', async () => {
      const postSpy = jest.spyOn(adapter, 'post').mockResolvedValue(mockCreateWithdrawalResponse);

      await adapter.createWithdrawalRequest(mockWithdrawalRequest);

      const calledPayload = postSpy.mock.calls[0][1] as any;
      expect(calledPayload.amount).toBe('100.5');
      expect(typeof calledPayload.amount).toBe('string');
    });

    it('should map all response fields correctly', async () => {
      jest.spyOn(adapter, 'post').mockResolvedValue(mockCreateWithdrawalResponse);

      const result = await adapter.createWithdrawalRequest(mockWithdrawalRequest);

      expect(result.providerRef).toBe('withdrawal-req-789');
      expect(result.withdrawalAccountRef).toBe('12345');
      expect(result.providerUserRef).toBe('TEST123');
      expect(result.requestorUserRef).toBe('TEST123');
      expect(result.requestedAmount).toBe('100.50');
      expect(result.settledAmount).toBe('100.50');
      expect(result.status).toBe('pending');
      expect(result.asset).toBe('USDC.SOL');
      expect(result.blockchainTransactionRef).toBe('blockchain-tx-123');
      expect(result.blockchainStatus).toBe('pending');
      expect(result.gasPrice).toBe('0.001');
      expect(result.feeAmount).toBe('0.50');
      expect(result.withdrawalFee).toBe('0.50');
      expect(result.quotedFeeAmount).toBe('0.50');
      expect(result.quotedFeeNotional).toBe('0.50');
      expect(result.clientWithdrawalRequestRef).toBe('tx-ref-456');
    });

    it('should include all required fields in request payload', async () => {
      const postSpy = jest.spyOn(adapter, 'post').mockResolvedValue(mockCreateWithdrawalResponse);

      await adapter.createWithdrawalRequest(mockWithdrawalRequest);

      const calledPayload = postSpy.mock.calls[0][1];
      expect(calledPayload).toHaveProperty('client_withdrawal_request_id');
      expect(calledPayload).toHaveProperty('address');
      expect(calledPayload).toHaveProperty('participant_code');
      expect(calledPayload).toHaveProperty('account_group');
      expect(calledPayload).toHaveProperty('amount');
      expect(calledPayload).toHaveProperty('asset');
    });

    it('should handle insufficient balance error', async () => {
      jest.spyOn(adapter, 'post').mockRejectedValue(new Error('Insufficient balance'));

      await expect(adapter.createWithdrawalRequest(mockWithdrawalRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle invalid address error', async () => {
      jest.spyOn(adapter, 'post').mockRejectedValue(new Error('Invalid withdrawal address'));

      await expect(adapter.createWithdrawalRequest(mockWithdrawalRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getAccountDetails', () => {
    const mockAccountDetailsRequest = {
      accountOwner: 'TEST123',
      asset: 'USDC.SOL',
    };

    const mockAccountDetailsResponse = {
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} } as any,
      data: {
        message: [
          {
            asset: 'USDC.SOL',
            account_owner: 'TEST123',
            account_type: 'available',
            account_group: 'LNPWRG',
            account_label: null,
            balance: '1000.00',
            account_id: 'acc-123',
            last_update: '2025-01-15T10:00:00.000Z',
          },
        ],
        page: 1,
        total_pages: 1,
      },
    };

    it('should successfully get account details', async () => {
      const getSpy = jest.spyOn(adapter, 'get').mockResolvedValue(mockAccountDetailsResponse);

      const result = await adapter.getAccountDetails(mockAccountDetailsRequest);

      expect(getSpy).toHaveBeenCalledWith('/accounts?account_owner=TEST123&asset=USDC.SOL');

      expect(result).toEqual({
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
      });
    });

    it('should construct query params correctly', async () => {
      const getSpy = jest.spyOn(adapter, 'get').mockResolvedValue(mockAccountDetailsResponse);

      await adapter.getAccountDetails(mockAccountDetailsRequest);

      const calledUrl = getSpy.mock.calls[0][0];
      expect(calledUrl).toContain('account_owner=TEST123');
      expect(calledUrl).toContain('asset=USDC.SOL');
    });

    it('should map response correctly to generic interface', async () => {
      jest.spyOn(adapter, 'get').mockResolvedValue(mockAccountDetailsResponse);

      const result = await adapter.getAccountDetails(mockAccountDetailsRequest);

      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0].accountOwner).toBe('TEST123');
      expect(result.accounts[0].asset).toBe('USDC.SOL');
      expect(result.accounts[0].accountType).toBe('available');
      expect(result.accounts[0].accountGroup).toBe('LNPWRG');
      expect(result.accounts[0].balance).toBe('1000.00');
      expect(result.accounts[0].accountRef).toBe('acc-123');
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should handle multiple accounts in response', async () => {
      const multipleAccountsResponse = {
        ...mockAccountDetailsResponse,
        data: {
          message: [
            {
              asset: 'USDC.SOL',
              account_owner: 'TEST123',
              account_type: 'available',
              account_group: 'LNPWRG',
              account_label: 'main',
              balance: '1000.00',
              account_id: 'acc-123',
              last_update: '2025-01-15T10:00:00.000Z',
            },
            {
              asset: 'USDC.SOL',
              account_owner: 'TEST123',
              account_type: 'collateral',
              account_group: 'LNPWRG',
              account_label: 'collateral',
              balance: '500.00',
              account_id: 'acc-456',
              last_update: '2025-01-15T11:00:00.000Z',
            },
          ],
          page: 1,
          total_pages: 1,
        },
      };

      jest.spyOn(adapter, 'get').mockResolvedValue(multipleAccountsResponse);

      const result = await adapter.getAccountDetails(mockAccountDetailsRequest);

      expect(result.accounts).toHaveLength(2);
      expect(result.accounts[0].accountRef).toBe('acc-123');
      expect(result.accounts[1].accountRef).toBe('acc-456');
    });

    it('should handle empty accounts response', async () => {
      const emptyResponse = {
        ...mockAccountDetailsResponse,
        data: {
          message: [],
          page: 1,
          total_pages: 0,
        },
      };

      jest.spyOn(adapter, 'get').mockResolvedValue(emptyResponse);

      const result = await adapter.getAccountDetails(mockAccountDetailsRequest);

      expect(result.accounts).toEqual([]);
      expect(result.totalPages).toBe(0);
    });

    it('should throw InternalServerErrorException when fetch fails', async () => {
      jest.spyOn(adapter, 'get').mockRejectedValue(new Error('API Error'));

      await expect(adapter.getAccountDetails(mockAccountDetailsRequest)).rejects.toThrow(InternalServerErrorException);
      await expect(adapter.getAccountDetails(mockAccountDetailsRequest)).rejects.toThrow(
        ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE,
      );
    });

    it('should handle network timeout error', async () => {
      jest.spyOn(adapter, 'get').mockRejectedValue(new Error('Network timeout'));

      await expect(adapter.getAccountDetails(mockAccountDetailsRequest)).rejects.toThrow(InternalServerErrorException);
    });

    it('should include all account detail fields in response', async () => {
      jest.spyOn(adapter, 'get').mockResolvedValue(mockAccountDetailsResponse);

      const result = await adapter.getAccountDetails(mockAccountDetailsRequest);

      expect(result).toHaveProperty('accounts');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('totalPages');
      expect(result.accounts[0]).toHaveProperty('asset');
      expect(result.accounts[0]).toHaveProperty('accountOwner');
      expect(result.accounts[0]).toHaveProperty('accountType');
      expect(result.accounts[0]).toHaveProperty('accountGroup');
      expect(result.accounts[0]).toHaveProperty('accountLabel');
      expect(result.accounts[0]).toHaveProperty('balance');
      expect(result.accounts[0]).toHaveProperty('accountRef');
      expect(result.accounts[0]).toHaveProperty('lastUpdate');
    });
  });
});
