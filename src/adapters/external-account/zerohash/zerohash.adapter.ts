import { BadGatewayException, Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE } from '../../../constants/constants';
import { ZerohashAxiosHelper } from '../../participant/zerohash/zerohash.axios';
import {
  DecisionReportRequest,
  DecisionReportResponse,
  ExecutePaymentRequest,
  ExecutePaymentResponse,
  FundingQuoteRequest,
  FundingQuoteResponse,
  IExternalAccountAdapter,
  RefreshAuthDataRequest,
  RefreshAuthDataResponse,
  ReturnReportRequest,
  ReturnReportResponse,
  RiskSignalRequest,
  RiskSignalResponse,
} from '../external-account.adapter.interface';
import {
  ZeroHashExecutePaymentRequest,
  ZeroHashExecutePaymentWrappedResponse,
  ZeroHashFundingQuoteRequest,
  ZeroHashFundingQuoteWrappedResponse,
} from './zerohash.adapter.interface';

@Injectable()
export class ZerohashExternalAccountAdapter extends ZerohashAxiosHelper implements IExternalAccountAdapter {
  private readonly logger = new Logger(ZerohashExternalAccountAdapter.name);

  async evaluateRiskSignal(request: RiskSignalRequest): Promise<RiskSignalResponse> {
    this.logger.debug(`evaluateRiskSignal not supported by ZeroHash: ${JSON.stringify(request)}`);
    throw new NotImplementedException('Risk signal evaluation not implemented for ZeroHash');
  }

  async reportDecision(request: DecisionReportRequest): Promise<DecisionReportResponse> {
    this.logger.debug(`reportDecision not supported by ZeroHash: ${JSON.stringify(request)}`);
    throw new NotImplementedException('Decision reporting not implemented for ZeroHash');
  }

  async reportReturn(request: ReturnReportRequest): Promise<ReturnReportResponse> {
    this.logger.debug(`reportReturn not supported by ZeroHash: ${JSON.stringify(request)}`);
    throw new NotImplementedException('Return reporting not implemented for ZeroHash');
  }

  async refreshUserAuthData(request: RefreshAuthDataRequest): Promise<RefreshAuthDataResponse> {
    this.logger.debug(`refreshUserAuthData not supported by ZeroHash: ${JSON.stringify(request)}`);
    throw new NotImplementedException('Auth data refresh not implemented for ZeroHash');
  }

  async requestQuote(request: FundingQuoteRequest): Promise<FundingQuoteResponse> {
    this.logger.log(`Requesting quote from ZeroHash for participant: ${request.providerUserRef}`);

    try {
      // Map generic request to ZeroHash-specific format
      const zerohashPayload: ZeroHashFundingQuoteRequest = {
        participant_code: request.providerUserRef,
        quoted_currency: request.targetCurrency,
        underlying_currency: request.sourceCurrency,
        side: request.operation,
        total: request.amount,
        quote_expiry: request.quoteExpiry,
      };

      const response = await this.post<ZeroHashFundingQuoteWrappedResponse, ZeroHashFundingQuoteRequest>(
        '/payments/rfq',
        zerohashPayload,
      );

      this.logger.debug(`ZeroHash Request Funding Quote response:\n${JSON.stringify(response.data, null, 2)}`);

      const responseData = response.data.message;

      // Map ZeroHash response to generic format
      return {
        quoteRef: responseData.quote_id,
        amount: responseData.quantity,
        rate: responseData.price,
        expiresAt: responseData.expire_ts,
      };
    } catch (error: any) {
      this.logger.error(`Failed to request quote for participant ${request.providerUserRef}: ${error.message}`);
      if (error.response) {
        this.logger.error(`ZeroHash response status: ${error.response.status}`);
        this.logger.error(`ZeroHash response data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      throw new BadGatewayException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }

  async executePayment(request: ExecutePaymentRequest): Promise<ExecutePaymentResponse> {
    this.logger.log(
      `Executing payment on ZeroHash for participant: ${request.providerUserRef}, quote: ${request.quoteRef}`,
    );

    try {
      // Map generic request to ZeroHash-specific format
      const zerohashPayload: ZeroHashExecutePaymentRequest = {
        participant_code: request.providerUserRef,
        quote_id: request.quoteRef,
        ach_signed_agreement: request.achSignedAgreement,
        external_account_id: request.externalAccountRef,
        description: request.description,
      };

      const response = await this.post<ZeroHashExecutePaymentWrappedResponse, ZeroHashExecutePaymentRequest>(
        '/payments/execute',
        zerohashPayload,
      );

      this.logger.debug(`ZeroHash execute payment response:\n${JSON.stringify(response.data, null, 2)}`);

      const responseData = response.data.message;

      // Map ZeroHash response to generic format
      return {
        requestRef: responseData.request_id,
        transactionRef: responseData.transaction_id,
        status: responseData.status,
        warning: responseData.warning,
      };
    } catch (error: any) {
      this.logger.error(`Failed to execute payment for participant ${request.providerUserRef}: ${error.message}`);
      if (error.response) {
        this.logger.error(`ZeroHash response status: ${error.response.status}`);
        this.logger.error(`ZeroHash response data: ${JSON.stringify(error.response.data, null, 2)}`);
      }

      throw new BadGatewayException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }
}
