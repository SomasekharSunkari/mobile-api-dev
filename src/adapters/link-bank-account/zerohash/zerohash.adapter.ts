import { BadGatewayException, BadRequestException, Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ZerohashAxiosHelper } from '../../../adapters/participant/zerohash/zerohash.axios';
import { ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE } from '../../../constants/constants';
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
} from '../link-bank-account.adapter.interface';
import {
  ZeroHashCloseAccountRequest,
  ZeroHashCloseAccountResponse,
  ZeroHashLinkBankAccountRequest,
  ZeroHashLinkBankAccountResponse,
} from './zerohash.adapter.interface';

@Injectable()
export class ZerohashAdapter extends ZerohashAxiosHelper implements IBankAccountLinkingAdapter {
  private readonly logger = new Logger(ZerohashAdapter.name);

  async linkBankAccount(req: LinkAccountRequest): Promise<LinkAccountResponse> {
    const { externalRef, alias, processorToken } = req;

    this.logger.log(`Linking bank account to ZeroHash for participant: ${externalRef}`);

    try {
      const response = await this.post<ZeroHashLinkBankAccountResponse, ZeroHashLinkBankAccountRequest>(
        '/payments/external_accounts',
        {
          participant_code: externalRef,
          account_nickname: alias,
          plaid_processor_token: processorToken,
        },
      );

      this.logger.debug(`ZeroHash response:\n${JSON.stringify(response.data, null, 2)}`);

      const responseData = response.data;
      if (!responseData) {
        throw new BadRequestException('Malformed API Response');
      }

      // use responseData below
      return {
        requestRef: responseData.request_id,
        accountRef: responseData.external_account_id,
        customerCode: responseData.participant_code,
        systemCode: responseData.platform_code,
        alias: responseData.account_nickname,
        createdAt: responseData.created_at,
        status: responseData.status,
      };
    } catch (err: any) {
      const details = err.response?.data ?? err.message;
      this.logger.error(`Failed to link bank account for participant ${externalRef}: ${JSON.stringify(details)}`);
      throw new BadGatewayException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }

  async createLinkToken(req: CreateTokenRequest): Promise<CreateTokenResponse> {
    this.logger.debug(`createLinkToken not supported by Zerohash: ${JSON.stringify(req)}`);
    throw new NotImplementedException('ZerohashAdapter does not support createLinkToken; use PlaidAdapter instead.');
  }

  async exchangeToken(req: TokenExchangeRequest): Promise<TokenExchangeResponse> {
    this.logger.debug(`exchangeToken not supported by Zerohash: ${JSON.stringify(req)}`);
    throw new NotImplementedException('ZerohashAdapter does not support exchangeToken; use PlaidAdapter instead.');
  }

  async getAccounts(req: AccountsRequest): Promise<AccountsResponse> {
    this.logger.debug(`getAccounts not supported by Zerohash: ${JSON.stringify(req)}`);
    throw new NotImplementedException('ZerohashAdapter does not support getAccounts; use PlaidAdapter instead.');
  }

  async createProcessorToken(req: ProcessorTokenRequest): Promise<ProcessorTokenResponse> {
    this.logger.debug(`createProcessorToken not supported by Zerohash: ${JSON.stringify(req)}`);
    throw new NotImplementedException(
      'ZerohashAdapter does not support createProcessorToken; use PlaidAdapter instead.',
    );
  }

  async unlinkAccount(req: UnlinkAccountRequest): Promise<UnlinkAccountResponse> {
    this.logger.debug(`unlinkAccount not supported by Zerohash: ${JSON.stringify(req)}`);
    throw new NotImplementedException('ZerohashAdapter does not support unlinkAccount; use PlaidAdapter instead.');
  }

  async closeAccount(req: CloseAccountRequest): Promise<CloseAccountResponse> {
    const { externalAccountRef, participantCode } = req;

    this.logger.log(`Closing ZeroHash external account: ${externalAccountRef} for participant: ${participantCode}`);

    try {
      const response = await this.post<ZeroHashCloseAccountResponse, ZeroHashCloseAccountRequest>(
        `/payments/external_accounts/${externalAccountRef}/close`,
        {
          participant_code: participantCode,
        },
      );

      this.logger.debug(`ZeroHash close account response:\n${JSON.stringify(response.data, null, 2)}`);

      const responseData = response.data;
      if (!responseData) {
        throw new BadRequestException('Malformed API Response');
      }

      return {
        requestRef: responseData.request_id,
        accountRef: responseData.external_account_id,
        status: responseData.status,
      };
    } catch (err: any) {
      const details = err.response?.data ?? err.message;
      this.logger.error(
        `Failed to close ZeroHash account ${externalAccountRef} for participant ${participantCode}: ${JSON.stringify(details)}`,
      );
      throw new BadGatewayException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }
}
