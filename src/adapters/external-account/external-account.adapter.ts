import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import { PlaidExternalAccountAdapter } from './plaid/plaid.adapter';
import { ZerohashExternalAccountAdapter } from './zerohash/zerohash.adapter';
import {
  IExternalAccountAdapter,
  RiskSignalRequest,
  RiskSignalResponse,
  DecisionReportRequest,
  DecisionReportResponse,
  ReturnReportRequest,
  ReturnReportResponse,
  FundingQuoteRequest,
  FundingQuoteResponse,
  ExecutePaymentRequest,
  ExecutePaymentResponse,
  RefreshAuthDataRequest,
  RefreshAuthDataResponse,
} from './external-account.adapter.interface';

@Injectable()
export class ExternalAccountAdapter implements IExternalAccountAdapter {
  @Inject(PlaidExternalAccountAdapter)
  private readonly plaidAdapter: PlaidExternalAccountAdapter;
  @Inject(ZerohashExternalAccountAdapter)
  private readonly zerohashAdapter: ZerohashExternalAccountAdapter;

  async evaluateRiskSignal(request: RiskSignalRequest, countryCode: string): Promise<RiskSignalResponse> {
    switch (countryCode.toUpperCase()) {
      case 'US':
        return this.plaidAdapter.evaluateRiskSignal(request);
      default:
        throw new NotImplementedException(`No risk signal evaluation support for country ${countryCode}`);
    }
  }

  async reportDecision(request: DecisionReportRequest, countryCode: string): Promise<DecisionReportResponse> {
    switch (countryCode.toUpperCase()) {
      case 'US':
        return this.plaidAdapter.reportDecision(request);
      default:
        throw new NotImplementedException(`No decision reporting support for country ${countryCode}`);
    }
  }

  async reportReturn(request: ReturnReportRequest, countryCode: string): Promise<ReturnReportResponse> {
    switch (countryCode.toUpperCase()) {
      case 'US':
        return this.plaidAdapter.reportReturn(request);
      default:
        throw new NotImplementedException(`No return reporting support for country ${countryCode}`);
    }
  }

  async requestQuote(request: FundingQuoteRequest, countryCode: string): Promise<FundingQuoteResponse> {
    switch (countryCode.toUpperCase()) {
      case 'US':
        return this.zerohashAdapter.requestQuote(request);
      default:
        throw new NotImplementedException(`No Request Funding Quote support for country ${countryCode}`);
    }
  }

  async executePayment(request: ExecutePaymentRequest, countryCode: string): Promise<ExecutePaymentResponse> {
    switch (countryCode.toUpperCase()) {
      case 'US':
        return this.zerohashAdapter.executePayment(request);
      default:
        throw new NotImplementedException(`No payment execution support for country ${countryCode}`);
    }
  }

  async refreshUserAuthData(request: RefreshAuthDataRequest, countryCode: string): Promise<RefreshAuthDataResponse> {
    switch (countryCode.toUpperCase()) {
      case 'US':
        return this.plaidAdapter.refreshUserAuthData(request);
      default:
        throw new NotImplementedException(`No auth data refresh support for country ${countryCode}`);
    }
  }
}
