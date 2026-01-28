import { Test, TestingModule } from '@nestjs/testing';
import { NotImplementedException } from '@nestjs/common';
import { LinkBankAccountAdapter } from './link-bank-account.adapter';
import { PlaidAdapter } from './plaid/plaid.adapter';
import { ZerohashAdapter } from './zerohash/zerohash.adapter';
import {
  CreateTokenRequest,
  CreateTokenResponse,
  TokenExchangeRequest,
  TokenExchangeResponse,
  LinkAccountRequest,
  LinkAccountResponse,
  AccountsRequest,
  AccountsResponse,
  ProcessorTokenRequest,
  ProcessorTokenResponse,
} from './link-bank-account.adapter.interface';

describe('LinkBankAccountAdapter', () => {
  let service: LinkBankAccountAdapter;
  let mockPlaid: Partial<PlaidAdapter>;
  let mockZerohash: Partial<ZerohashAdapter>;

  beforeEach(async () => {
    mockPlaid = {
      createLinkToken: jest.fn(),
      exchangeToken: jest.fn(),
      getAccounts: jest.fn(),
      createProcessorToken: jest.fn(),
    };
    mockZerohash = {
      linkBankAccount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkBankAccountAdapter,
        { provide: PlaidAdapter, useValue: mockPlaid },
        { provide: ZerohashAdapter, useValue: mockZerohash },
      ],
    }).compile();

    service = module.get(LinkBankAccountAdapter);
    (service as any).plaidAdapter = mockPlaid;
    (service as any).zerohashAdapter = mockZerohash;
  });

  afterEach(() => jest.clearAllMocks());

  describe('createLinkToken', () => {
    it('should call PlaidAdapter.createLinkToken for US', async () => {
      const req = {} as CreateTokenRequest;
      const expected: CreateTokenResponse = {
        token: 'tok',
        expiration: 'exp',
        requestRef: 'req',
      };
      (mockPlaid.createLinkToken as jest.Mock).mockResolvedValueOnce(expected);

      const result = await service.createLinkToken(req, 'US');
      expect(mockPlaid.createLinkToken).toHaveBeenCalledWith(req);
      expect(result).toBe(expected);
    });

    it('should throw NotImplementedException for non-US', async () => {
      await expect(service.createLinkToken({} as any, 'NG')).rejects.toBeInstanceOf(NotImplementedException);
    });
  });

  describe('exchangeToken', () => {
    it('should call PlaidAdapter.exchangeToken for US', async () => {
      const req = { publicToken: 'pt' } as TokenExchangeRequest;
      const expected: TokenExchangeResponse = {
        accessToken: 'at',
        itemId: 'ii',
        requestRef: 'rr',
      };
      (mockPlaid.exchangeToken as jest.Mock).mockResolvedValueOnce(expected);

      const result = await service.exchangeToken(req, 'US');
      expect(mockPlaid.exchangeToken).toHaveBeenCalledWith(req);
      expect(result).toBe(expected);
    });

    it('should throw NotImplementedException for non-US', async () => {
      await expect(service.exchangeToken({} as any, 'NG')).rejects.toBeInstanceOf(NotImplementedException);
    });
  });

  describe('linkBankAccount', () => {
    it('should call ZerohashAdapter.linkBankAccount for US', async () => {
      const req = {
        externalRef: 'p',
        alias: 'a',
        processorToken: 'pt',
      } as LinkAccountRequest;
      const expected: LinkAccountResponse = {
        requestRef: 'r',
        accountRef: 'ar',
        customerCode: 'cc',
        systemCode: 'sc',
        alias: 'a',
        createdAt: 'now',
        status: 'ok',
      };
      (mockZerohash.linkBankAccount as jest.Mock).mockResolvedValueOnce(expected);

      const result = await service.linkBankAccount(req, 'US');
      expect(mockZerohash.linkBankAccount).toHaveBeenCalledWith(req);
      expect(result).toBe(expected);
    });

    it('should throw NotImplementedException for non-US', async () => {
      await expect(service.linkBankAccount({} as any, 'NG')).rejects.toBeInstanceOf(NotImplementedException);
    });
  });

  describe('getAccounts', () => {
    it('should call PlaidAdapter.getAccounts for US', async () => {
      const req = { accessToken: 't' } as AccountsRequest;
      const expected: AccountsResponse = {
        accounts: [],
        item: {
          authMethod: null,
          availableProducts: [],
          billedProducts: [],
          consentExpirationTime: null,
          error: null,
          institutionRef: null,
          institutionName: null,
          itemId: 'item-123',
          products: [],
          updateType: 'background',
          webhook: null,
        },
        requestRef: 'r',
      };
      (mockPlaid.getAccounts as jest.Mock).mockResolvedValueOnce(expected);

      const result = await service.getAccounts(req, 'US');
      expect(mockPlaid.getAccounts).toHaveBeenCalledWith(req);
      expect(result).toBe(expected);
    });

    it('should throw NotImplementedException for non-US', async () => {
      await expect(service.getAccounts({} as any, 'NG')).rejects.toBeInstanceOf(NotImplementedException);
    });
  });

  describe('createProcessorToken', () => {
    it('should call PlaidAdapter.createProcessorToken for US', async () => {
      const req = { accessToken: 't', accountRef: 'a' } as ProcessorTokenRequest;
      const expected: ProcessorTokenResponse = {
        processorToken: 'ptok',
        requestRef: 'rr',
      };
      (mockPlaid.createProcessorToken as jest.Mock).mockResolvedValueOnce(expected);

      const result = await service.createProcessorToken(req, 'US');
      expect(mockPlaid.createProcessorToken).toHaveBeenCalledWith(req);
      expect(result).toBe(expected);
    });

    it('should throw NotImplementedException for non-US', async () => {
      await expect(service.createProcessorToken({} as any, 'NG')).rejects.toBeInstanceOf(NotImplementedException);
    });
  });

  describe('unlinkAccount', () => {
    it('should call PlaidAdapter.unlinkAccount for US', async () => {
      const req = { accessToken: 'access-token-123' };
      const expected = {
        requestRef: 'req-123',
        removed: true,
      };
      mockPlaid.unlinkAccount = jest.fn().mockResolvedValueOnce(expected);

      const result = await service.unlinkAccount(req, 'US');
      expect(mockPlaid.unlinkAccount).toHaveBeenCalledWith(req);
      expect(result).toBe(expected);
    });

    it('should throw NotImplementedException for non-US', async () => {
      await expect(service.unlinkAccount({} as any, 'NG')).rejects.toBeInstanceOf(NotImplementedException);
    });
  });

  describe('closeAccount', () => {
    it('should call ZerohashAdapter.closeAccount for US', async () => {
      const req = {
        externalAccountRef: 'ext-ref-123',
        participantCode: 'PART123',
      };
      const expected = {
        requestRef: 'req-123',
        accountRef: 'ext-ref-123',
        status: 'closed',
      };
      mockZerohash.closeAccount = jest.fn().mockResolvedValueOnce(expected);

      const result = await service.closeAccount(req, 'US');
      expect(mockZerohash.closeAccount).toHaveBeenCalledWith(req);
      expect(result).toBe(expected);
    });

    it('should throw NotImplementedException for non-US', async () => {
      await expect(service.closeAccount({} as any, 'NG')).rejects.toBeInstanceOf(NotImplementedException);
    });
  });
});
