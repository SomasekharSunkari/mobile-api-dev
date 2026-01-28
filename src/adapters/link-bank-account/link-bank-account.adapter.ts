import { Inject, Injectable, NotImplementedException } from '@nestjs/common';

import { PlaidAdapter } from './plaid/plaid.adapter';
import { ZerohashAdapter } from './zerohash/zerohash.adapter';
import {
  AccountsRequest,
  AccountsResponse,
  CloseAccountRequest,
  CloseAccountResponse,
  CreateTokenRequest,
  CreateTokenResponse,
  IBankAccountLinkingAdapter,
  LinkAccountRequest,
  LinkAccountResponse,
  ProcessorTokenRequest,
  ProcessorTokenResponse,
  TokenExchangeRequest,
  TokenExchangeResponse,
  UnlinkAccountRequest,
  UnlinkAccountResponse,
} from './link-bank-account.adapter.interface';

@Injectable()
export class LinkBankAccountAdapter implements IBankAccountLinkingAdapter {
  @Inject(PlaidAdapter)
  private readonly plaidAdapter: PlaidAdapter;

  @Inject(ZerohashAdapter)
  private readonly zerohashAdapter: ZerohashAdapter;

  async createLinkToken(req: CreateTokenRequest, countryCode: string): Promise<CreateTokenResponse> {
    if (countryCode.toUpperCase() === 'US') {
      return this.plaidAdapter.createLinkToken(req);
    }
    throw new NotImplementedException(`No linkToken support for country ${countryCode}`);
  }

  async exchangeToken(req: TokenExchangeRequest, countryCode: string): Promise<TokenExchangeResponse> {
    if (countryCode.toUpperCase() === 'US') {
      return this.plaidAdapter.exchangeToken(req);
    }
    throw new NotImplementedException(`No exchangeToken support for country ${countryCode}`);
  }

  async linkBankAccount(req: LinkAccountRequest, countryCode: string): Promise<LinkAccountResponse> {
    if (countryCode.toUpperCase() === 'US') {
      return this.zerohashAdapter.linkBankAccount(req);
    }
    throw new NotImplementedException(`No linkBankAccount support for country ${countryCode}`);
  }

  async getAccounts(req: AccountsRequest, countryCode: string): Promise<AccountsResponse> {
    if (countryCode.toUpperCase() === 'US') {
      return this.plaidAdapter.getAccounts(req);
    }
    throw new NotImplementedException(`No getAccounts support for country ${countryCode}`);
  }

  async createProcessorToken(req: ProcessorTokenRequest, countryCode: string): Promise<ProcessorTokenResponse> {
    if (countryCode.toUpperCase() === 'US') {
      return this.plaidAdapter.createProcessorToken(req);
    }
    throw new NotImplementedException(`No createProcessorToken support for country ${countryCode}`);
  }

  async unlinkAccount(req: UnlinkAccountRequest, countryCode: string): Promise<UnlinkAccountResponse> {
    if (countryCode.toUpperCase() === 'US') {
      return this.plaidAdapter.unlinkAccount(req);
    }
    throw new NotImplementedException(`No account unlinking support for country ${countryCode}`);
  }

  async closeAccount(req: CloseAccountRequest, countryCode: string): Promise<CloseAccountResponse> {
    if (countryCode.toUpperCase() === 'US') {
      return this.zerohashAdapter.closeAccount(req);
    }
    throw new NotImplementedException(`No account closing support for country ${countryCode}`);
  }
}
