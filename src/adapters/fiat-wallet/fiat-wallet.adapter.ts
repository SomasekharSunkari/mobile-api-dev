import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import {
  FiatWalletAccountDetailsRequest,
  FiatWalletAccountDetailsResponse,
  FiatWalletTransferDetailsResponse,
  FiatWalletTransferRequest,
  FiatWalletTransferResponse,
  FiatWalletWithdrawalExecuteRequest,
  FiatWalletWithdrawalQuoteRequest,
  FiatWalletWithdrawalQuoteResponse,
  FiatWalletWithdrawalRequestPayload,
  FiatWalletWithdrawalRequestWrappedResponse,
  FiatWalletWithdrawalResponse,
  IFiatWalletAdapter,
} from './fiat-wallet.adapter.interface';
import { ZerohashFiatWalletAdapter } from './zerohash/zerohash.adapter';

@Injectable()
export class FiatWalletAdapter implements IFiatWalletAdapter {
  @Inject(ZerohashFiatWalletAdapter)
  private readonly zerohashAdapter: ZerohashFiatWalletAdapter;

  async transfer(request: FiatWalletTransferRequest): Promise<FiatWalletTransferResponse> {
    return this.zerohashAdapter.transfer(request);
  }

  async getTransferDetails(transferRequestId: string, provider: string): Promise<FiatWalletTransferDetailsResponse> {
    switch (provider.toLowerCase()) {
      case 'zerohash':
        return this.zerohashAdapter.getTransferDetails(transferRequestId);
      default:
        throw new NotImplementedException(`No transfer details support for provider ${provider}`);
    }
  }

  async getWithdrawalQuote(
    request: FiatWalletWithdrawalQuoteRequest,
    provider: string,
  ): Promise<FiatWalletWithdrawalQuoteResponse> {
    switch (provider.toLowerCase()) {
      case 'zerohash':
        return this.zerohashAdapter.getWithdrawalQuote(request);
      default:
        throw new NotImplementedException(`No withdrawal quote support for provider ${provider}`);
    }
  }

  async executeWithdrawal(
    request: FiatWalletWithdrawalExecuteRequest,
    provider: string,
  ): Promise<FiatWalletWithdrawalResponse> {
    switch (provider.toLowerCase()) {
      case 'zerohash':
        return this.zerohashAdapter.executeWithdrawal(request);
      default:
        throw new NotImplementedException(`No withdrawal execution support for provider ${provider}`);
    }
  }

  async getWithdrawalDetails(withdrawalId: string, provider: string): Promise<FiatWalletWithdrawalResponse> {
    switch (provider.toLowerCase()) {
      case 'zerohash':
        return this.zerohashAdapter.getWithdrawalDetails(withdrawalId);
      default:
        throw new NotImplementedException(`No withdrawal details support for provider ${provider}`);
    }
  }

  async createWithdrawalRequest(
    request: FiatWalletWithdrawalRequestPayload,
    provider: string,
  ): Promise<FiatWalletWithdrawalRequestWrappedResponse> {
    switch (provider.toLowerCase()) {
      case 'zerohash':
        return this.zerohashAdapter.createWithdrawalRequest(request);
      default:
        throw new NotImplementedException(`No withdrawal request support for provider ${provider}`);
    }
  }

  async getAccountDetails(request: FiatWalletAccountDetailsRequest): Promise<FiatWalletAccountDetailsResponse> {
    return this.zerohashAdapter.getAccountDetails(request);
  }
}
