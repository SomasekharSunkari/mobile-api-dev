import { Test, TestingModule } from '@nestjs/testing';
import { PlaidAdapter } from './plaid.adapter';
import { CountryCode, ProcessorTokenCreateRequestProcessorEnum } from 'plaid';
import {
  CreateTokenRequest,
  TokenExchangeRequest,
  AccountsRequest,
  ProcessorTokenRequest,
} from '../link-bank-account.adapter.interface';

jest.mock('./plaid.connector'); // mock inherited methods

describe('PlaidAdapter', () => {
  let service: PlaidAdapter;

  const mockConfig = {
    clientId: 'mock-client-id',
    secret: 'mock-secret',
    webhook: 'https://example.com/webhook',
    redirect_uri: 'https://example.com/redirect',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlaidAdapter],
    }).compile();

    service = module.get<PlaidAdapter>(PlaidAdapter);
    // patch in our fake configProvider
    (service as any).configProvider = {
      getConfig: () => mockConfig,
    };
  });

  afterEach(() => jest.clearAllMocks());

  describe('createLinkToken', () => {
    it('returns token, expiration, and requestRef on success', async () => {
      jest.spyOn(service as any, 'linkTokenCreate').mockResolvedValueOnce({
        data: { link_token: 'lt', expiration: 'exp', request_id: 'rid' },
      });

      const req: CreateTokenRequest = {
        user: {
          userRef: 'user-123',
          phone: '+1234567890',
          email: 'test@example.com',
          fullName: 'John Doe',
          dob: '1990-01-01',
          address: {
            street: '123 Main St',
            city: 'New York',
            region: 'NY',
            postalCode: '10001',
            country: 'US',
          },
        },
        clientName: 'MyApp',
        language: 'en',
        customizationName: undefined,
        androidPackageName: undefined,
      };

      const result = await service.createLinkToken(req);
      expect(result).toEqual({
        token: 'lt',
        expiration: 'exp',
        requestRef: 'rid',
      });
    });

    it('throws formatted error if the connector rejects', async () => {
      const err = { isAxiosError: true, response: { data: { error_message: 'Unauthorized' } } };
      jest.spyOn(service as any, 'linkTokenCreate').mockRejectedValueOnce(err);

      const req: CreateTokenRequest = {
        user: {
          userRef: 'user-123',
          phone: '+1234567890',
          email: 'test@example.com',
          fullName: 'John Doe',
          dob: '1990-01-01',
          address: {
            street: '123 Main St',
            city: 'New York',
            region: 'NY',
            postalCode: '10001',
            country: 'US',
          },
        },
        clientName: 'MyApp',
        language: 'en',
        customizationName: undefined,
        androidPackageName: undefined,
      };

      await expect(service.createLinkToken(req)).rejects.toThrow(JSON.stringify(err.response.data));
    });
  });

  describe('exchangeToken', () => {
    it('returns accessToken, itemId, and requestRef', async () => {
      jest.spyOn(service as any, 'itemPublicTokenExchange').mockResolvedValueOnce({
        data: { access_token: 'at', item_id: 'iid', request_id: 'rid2' },
      });

      const req: TokenExchangeRequest = { publicToken: 'public-token' };
      const res = await service.exchangeToken(req);
      expect(res).toEqual({
        accessToken: 'at',
        itemId: 'iid',
        requestRef: 'rid2',
      });
    });
  });

  describe('getAccounts', () => {
    it('maps accounts and item and returns requestRef', async () => {
      const apiResp = {
        accounts: [
          {
            account_id: 'acc1',
            balances: {
              available: 10,
              current: 10,
              iso_currency_code: 'USD',
              limit: null,
              unofficial_currency_code: null,
            },
            holder_category: 'personal',
            mask: '0000',
            name: 'MyAcc',
            official_name: 'Official Acc',
            persistent_account_id: 'pacc1',
            subtype: 'checking',
            type: 'depository',
          },
        ],
        item: {
          auth_method: null,
          available_products: [],
          billed_products: [],
          consent_expiration_time: null,
          error: null,
          institution_id: 'ins_1',
          institution_name: 'Test Bank',
          item_id: 'item-123',
          products: [],
          update_type: 'background',
          webhook: null,
        },
        request_id: 'rid3',
      };

      jest.spyOn(service as any, 'accountsGet').mockResolvedValueOnce({ data: apiResp });

      const req: AccountsRequest = { accessToken: 'at' };
      const res = await service.getAccounts(req);
      expect(res.requestRef).toBe('rid3');
      expect(res.accounts[0].ref).toBe('acc1');
      expect(res.item.itemId).toBe('item-123');
    });

    it('throws formatted error if accountsGet fails', async () => {
      const err = { isAxiosError: true, response: { data: { error_message: 'not found' } } };
      jest.spyOn(service as any, 'accountsGet').mockRejectedValueOnce(err);

      const req: AccountsRequest = { accessToken: 'at' };
      await expect(service.getAccounts(req)).rejects.toThrow(JSON.stringify(err.response.data));
    });
  });

  describe('createProcessorToken', () => {
    it('returns processorToken and requestRef', async () => {
      const apiResp = { processor_token: 'pt', request_id: 'rid4' };
      jest.spyOn(service as any, 'processorTokenCreate').mockResolvedValueOnce({ data: apiResp });

      const req: ProcessorTokenRequest = {
        accessToken: 'at',
        accountRef: 'aid',
        provider: ProcessorTokenCreateRequestProcessorEnum.ZeroHash,
      };
      const res = await service.createProcessorToken(req);
      expect(res).toEqual({
        processorToken: 'pt',
        requestRef: 'rid4',
      });
    });

    it('throws formatted error if processorTokenCreate fails', async () => {
      const err = { isAxiosError: true, response: { data: { error_message: 'bad request' } } };
      jest.spyOn(service as any, 'processorTokenCreate').mockRejectedValueOnce(err);

      const req: ProcessorTokenRequest = {
        accessToken: 'at',
        accountRef: 'aid',
        provider: ProcessorTokenCreateRequestProcessorEnum.ZeroHash,
      };
      await expect(service.createProcessorToken(req)).rejects.toThrow(JSON.stringify(err.response.data));
    });
  });

  describe('supportedCountries', () => {
    it('returns US only', () => {
      expect(service.supportedCountries()).toEqual([CountryCode.Us]);
    });
  });

  describe('unlinkAccount', () => {
    it('returns requestRef and removed flag on success', async () => {
      const apiResp = { request_id: 'rid5', removed: true };
      jest.spyOn(service as any, 'itemRemove').mockResolvedValueOnce({ data: apiResp });

      const req = { accessToken: 'access-token-123' };
      const res = await service.unlinkAccount(req);
      expect(res).toEqual({
        requestRef: 'rid5',
        removed: true,
      });
    });

    it('throws formatted error if itemRemove fails', async () => {
      const err = { isAxiosError: true, response: { data: { error_message: 'invalid token' } } };
      jest.spyOn(service as any, 'itemRemove').mockRejectedValueOnce(err);

      const req = { accessToken: 'invalid-token' };
      await expect(service.unlinkAccount(req)).rejects.toThrow(JSON.stringify(err.response.data));
    });
  });

  describe('closeAccount', () => {
    it('throws NotImplementedException', async () => {
      const req = {
        externalAccountRef: 'ext-ref-123',
        participantCode: 'PART123',
      };
      await expect(service.closeAccount(req)).rejects.toThrow('PlaidAdapter does not support closeAccount');
    });
  });
});
