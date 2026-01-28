import { BadGatewayException, NotImplementedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE } from '../../../constants/constants';
import {
  AccountsRequest,
  CreateTokenRequest,
  LinkAccountRequest,
  LinkAccountResponse,
  ProcessorTokenRequest,
  TokenExchangeRequest,
} from '../link-bank-account.adapter.interface';
import { ZerohashAdapter } from './zerohash.adapter';
import { ZeroHashLinkBankAccountResponse } from './zerohash.adapter.interface';

describe('ZerohashAdapter', () => {
  let service: ZerohashAdapter;

  const mockRequest: LinkAccountRequest = {
    externalRef: 'participant-789',
    alias: 'My Bank Account',
    processorToken: 'mock-processor-token',
  };

  const mockResponse: ZeroHashLinkBankAccountResponse = {
    external_account_id: 'external-abc',
    request_id: 'request-123',
    participant_code: 'participant-789',
    platform_code: 'platform-xyz',
    account_nickname: 'My Bank Account',
    created_at: '2024-06-01T12:00:00Z',
    status: 'linked',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZerohashAdapter],
    }).compile();

    service = module.get<ZerohashAdapter>(ZerohashAdapter);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('linkBankAccount', () => {
    it('returns mapped response on success', async () => {
      jest.spyOn(service, 'post').mockResolvedValueOnce({ data: mockResponse } as any);

      const result: LinkAccountResponse = await service.linkBankAccount(mockRequest);

      expect(service.post).toHaveBeenCalledWith('/payments/external_accounts', {
        participant_code: mockRequest.externalRef,
        account_nickname: mockRequest.alias,
        plaid_processor_token: mockRequest.processorToken,
      });

      expect(result).toEqual({
        requestRef: mockResponse.request_id,
        accountRef: mockResponse.external_account_id,
        customerCode: mockResponse.participant_code,
        systemCode: mockResponse.platform_code,
        alias: mockResponse.account_nickname,
        createdAt: mockResponse.created_at,
        status: mockResponse.status,
      });
    });

    it('throws BadGatewayException when post rejects with response data', async () => {
      const err = { response: { data: { error: 'Bad request' } } };
      jest.spyOn(service, 'post').mockRejectedValue(err);

      await expect(service.linkBankAccount(mockRequest)).rejects.toThrow(BadGatewayException);
    });

    it('throws BadGatewayException when post rejects without response data', async () => {
      const err = { message: 'timeout' };
      jest.spyOn(service, 'post').mockRejectedValue(err);

      await expect(service.linkBankAccount(mockRequest)).rejects.toThrow(BadGatewayException);
    });
  });

  describe('createLinkToken', () => {
    it('throws NotImplementedException', async () => {
      await expect(service.createLinkToken({} as CreateTokenRequest)).rejects.toBeInstanceOf(NotImplementedException);
    });
  });

  describe('exchangeToken', () => {
    it('throws NotImplementedException', async () => {
      await expect(service.exchangeToken({} as TokenExchangeRequest)).rejects.toBeInstanceOf(NotImplementedException);
    });
  });

  describe('getAccounts', () => {
    it('throws NotImplementedException', async () => {
      await expect(service.getAccounts({} as AccountsRequest)).rejects.toBeInstanceOf(NotImplementedException);
    });
  });

  describe('createProcessorToken', () => {
    it('throws NotImplementedException', async () => {
      await expect(service.createProcessorToken({} as ProcessorTokenRequest)).rejects.toBeInstanceOf(
        NotImplementedException,
      );
    });
  });

  describe('unlinkAccount', () => {
    it('throws NotImplementedException', async () => {
      const req = { accessToken: 'access-token-123' };
      await expect(service.unlinkAccount(req)).rejects.toThrow(
        'ZerohashAdapter does not support unlinkAccount; use PlaidAdapter instead.',
      );
    });
  });

  describe('closeAccount', () => {
    it('returns mapped response on success', async () => {
      const mockCloseResponse = {
        request_id: 'req-close-123',
        external_account_id: 'ext-ref-123',
        status: 'closed',
      };

      jest.spyOn(service, 'post').mockResolvedValueOnce({ data: mockCloseResponse } as any);

      const req = {
        externalAccountRef: 'ext-ref-123',
        participantCode: 'PART123',
      };

      const result = await service.closeAccount(req);

      expect(service.post).toHaveBeenCalledWith('/payments/external_accounts/ext-ref-123/close', {
        participant_code: 'PART123',
      });

      expect(result).toEqual({
        requestRef: mockCloseResponse.request_id,
        accountRef: mockCloseResponse.external_account_id,
        status: mockCloseResponse.status,
      });
    });

    it('throws BadGatewayException when post rejects with response data', async () => {
      const err = { response: { data: { error: 'Account not found' } } };
      jest.spyOn(service, 'post').mockRejectedValueOnce(err);

      const req = {
        externalAccountRef: 'ext-ref-123',
        participantCode: 'PART123',
      };

      await expect(service.closeAccount(req)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });

    it('throws BadGatewayException when post rejects without response data', async () => {
      const err = { message: 'Network timeout' };
      jest.spyOn(service, 'post').mockRejectedValueOnce(err);

      const req = {
        externalAccountRef: 'ext-ref-123',
        participantCode: 'PART123',
      };

      await expect(service.closeAccount(req)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });

    it('throws BadGatewayException when response data is malformed', async () => {
      jest.spyOn(service, 'post').mockResolvedValueOnce({ data: null } as any);

      const req = {
        externalAccountRef: 'ext-ref-123',
        participantCode: 'PART123',
      };

      await expect(service.closeAccount(req)).rejects.toThrow(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    });
  });
});
