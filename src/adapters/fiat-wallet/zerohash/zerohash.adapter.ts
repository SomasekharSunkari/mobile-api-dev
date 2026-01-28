import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE } from '../../../constants/constants';
import { ZerohashAxiosHelper } from '../../participant/zerohash/zerohash.axios';
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
} from '../fiat-wallet.adapter.interface';
import {
  ZeroHashAccountDetailsWrappedResponse,
  ZeroHashTransferDetailsWrappedResponse,
  ZeroHashTransferRequest,
  ZeroHashTransferWrappedResponse,
  ZeroHashWithdrawalDetailsWrappedResponse,
  ZeroHashWithdrawalExecuteRequest,
  ZeroHashWithdrawalExecuteWrappedResponse,
  ZeroHashWithdrawalQuoteWrappedResponse,
  ZeroHashWithdrawalRequestPayload,
  ZeroHashWithdrawalRequestWrappedResponse,
} from './zerohash.interface';

@Injectable()
export class ZerohashFiatWalletAdapter extends ZerohashAxiosHelper implements IFiatWalletAdapter {
  private readonly logger = new Logger(ZerohashFiatWalletAdapter.name);

  async transfer(request: FiatWalletTransferRequest): Promise<FiatWalletTransferResponse> {
    this.logger.log(
      `Initiating ZeroHash transfer: ${request.amount} ${request.asset} from ${request.senderCode} to ${request.receiverCode}`,
    );

    try {
      const { accountGroup } = this.configProvider.getConfig();

      const payload: ZeroHashTransferRequest = {
        from_participant_code: request.senderCode,
        from_account_group: accountGroup,
        to_participant_code: request.receiverCode,
        to_account_group: accountGroup,
        asset: request.asset,
        amount: request.amount,
        client_transfer_id: request.transferId,
      };

      const response: AxiosResponse<ZeroHashTransferWrappedResponse> = await this.post('/transfers', payload);

      this.logger.log(
        `ZeroHash transfer initiated successfully: client_transfer_id=${request.transferId}, status=${response.data.message.status}`,
      );

      // Map ZeroHash response to generic interface
      const transferResponse: FiatWalletTransferResponse = {
        providerRequestRef: response.data.message.id.toString(),
        providerReference: response.data.message.client_transfer_id,
        status: response.data.message.status,
        amount: response.data.message.amount,
        currency: response.data.message.asset,
        createdAt: response.data.message.created_at,
      };

      return transferResponse;
    } catch (error) {
      this.logger.error(`Transfer failed: ${error.message}`);
      throw new InternalServerErrorException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }

  async getTransferDetails(transferRequestId: string): Promise<FiatWalletTransferDetailsResponse> {
    this.logger.log(`Fetching ZeroHash transfer details for transfer_request_id: ${transferRequestId}`);

    try {
      const response: AxiosResponse<ZeroHashTransferDetailsWrappedResponse> = await this.get(
        `/transfers/${transferRequestId}`,
      );

      this.logger.log(
        `ZeroHash transfer details fetched successfully: client_transfer_id=${response.data.message.client_transfer_id}`,
      );

      // Map ZeroHash response to generic interface
      const transferDetailsResponse: FiatWalletTransferDetailsResponse = {
        providerRequestRef: response.data.message.id.toString(),
        providerReference: response.data.message.client_transfer_id,
        status: response.data.message.status,
        amount: response.data.message.amount,
        currency: response.data.message.asset,
        fromUserRef: response.data.message.from_participant_code,
        toUserRef: response.data.message.to_participant_code,
        createdAt: response.data.message.created_at,
        updatedAt: response.data.message.updated_at,
      };

      return transferDetailsResponse;
    } catch (error) {
      this.logger.error(`Get transfer details failed: ${error.message}`);
      throw new InternalServerErrorException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }

  async getWithdrawalQuote(request: FiatWalletWithdrawalQuoteRequest): Promise<FiatWalletWithdrawalQuoteResponse> {
    this.logger.log(`Fetching ZeroHash withdrawal quote: ${request.amount} ${request.asset}`);

    try {
      this.logger.log(`Using withdrawal address: ${request.withdrawalAddress}`);

      const queryParams = new URLSearchParams({
        participant_code: request.userRef,
        asset: request.asset,
        withdrawal_address: request.withdrawalAddress,
        amount: request.amount,
      });

      const response: AxiosResponse<ZeroHashWithdrawalQuoteWrappedResponse> = await this.get(
        `/withdrawals/locked_network_fee?${queryParams.toString()}`,
      );

      this.logger.log(
        `ZeroHash withdrawal quote fetched successfully: withdrawal_quote_id=${response.data.message.withdrawal_quote_id}`,
      );

      // Map ZeroHash response to generic interface
      const quoteResponse: FiatWalletWithdrawalQuoteResponse = {
        providerQuoteRef: response.data.message.withdrawal_quote_id,
        providerFee: response.data.message.network_fee_notional,
        netWithdrawalQuantity: response.data.message.net_withdrawal_quantity,
        amount: response.data.message.amount,
        currency: response.data.message.asset,
      };

      return quoteResponse;
    } catch (error) {
      this.logger.log(error);
      this.logger.error(`Get withdrawal quote failed: ${error.message}`);
      throw new InternalServerErrorException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }

  async executeWithdrawal(request: FiatWalletWithdrawalExecuteRequest): Promise<FiatWalletWithdrawalResponse> {
    this.logger.log(`Executing ZeroHash withdrawal: withdrawal_quote_id=${request.providerQuoteRef}`);

    try {
      const payload: ZeroHashWithdrawalExecuteRequest = {
        withdrawal_quote_id: request.providerQuoteRef,
        client_withdrawal_request_id: request.providerReference,
      };

      const response: AxiosResponse<ZeroHashWithdrawalExecuteWrappedResponse> = await this.post(
        '/withdrawals/execute',
        payload,
      );

      this.logger.log(
        `ZeroHash withdrawal executed successfully: client_withdrawal_request_id=${request.providerReference}, status=${response.data.message.on_chain_status}`,
      );

      // Map ZeroHash response to generic interface
      const withdrawalResponse: FiatWalletWithdrawalResponse = {
        providerRequestRef: response.data.message.withdrawal_request_id,
        providerReference: response.data.message.client_withdrawal_request_id,
        status: response.data.message.on_chain_status,
        amount: response.data.message.amount,
        currency: response.data.message.asset,
        externalReference: null, // Not available in execute response, will be available in details
      };

      return withdrawalResponse;
    } catch (error) {
      this.logger.error(`Execute withdrawal failed: ${error.message}`);
      throw new InternalServerErrorException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }

  async getWithdrawalDetails(withdrawalId: string): Promise<FiatWalletWithdrawalResponse> {
    this.logger.log(`Fetching ZeroHash withdrawal details for withdrawal_id: ${withdrawalId}`);

    try {
      const response: AxiosResponse<ZeroHashWithdrawalDetailsWrappedResponse> = await this.get(
        `/withdrawals/requests/${withdrawalId}`,
      );

      this.logger.log(
        `ZeroHash withdrawal details fetched successfully: client_withdrawal_request_id=${response.data.message[0].client_withdrawal_request_id}`,
      );

      const withdrawalDetails = response.data.message[0];

      // Map ZeroHash response to generic interface
      const withdrawalResponse: FiatWalletWithdrawalResponse = {
        providerRequestRef: withdrawalDetails.id,
        providerReference: withdrawalDetails.client_withdrawal_request_id,
        status: withdrawalDetails.status,
        amount: withdrawalDetails.requested_amount,
        currency: withdrawalDetails.asset,
        externalReference: withdrawalDetails.transaction_id,
      };

      return withdrawalResponse;
    } catch (error) {
      this.logger.error(`Get withdrawal details failed: ${error.message}`);
      throw new InternalServerErrorException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }

  /**
   * @description Creates a withdrawal request in ZeroHash,this is used when we want
   * to create a withdrawal request for a user and want it to be approved immediately, without confirming the quote.
   * @url https://docs.zerohash.com/reference/post_withdrawals-requests
   * @param request - The withdrawal request payload
   * @returns The withdrawal request wrapped response
   * @throws InternalServerErrorException if the withdrawal request creation fails
   */
  async createWithdrawalRequest(
    request: FiatWalletWithdrawalRequestPayload,
  ): Promise<FiatWalletWithdrawalRequestWrappedResponse> {
    this.logger.log(`Creating ZeroHash withdrawal request: ${request.amount} ${request.asset}`);

    try {
      const { accountGroup } = this.configProvider.getConfig();
      const payload: ZeroHashWithdrawalRequestPayload = {
        client_withdrawal_request_id: request.transactionRef,
        address: request.withdrawalAddress,
        participant_code: request.providerUserRef,
        account_group: accountGroup,
        amount: request.amount.toString(),
        asset: request.asset,
      };

      const response: AxiosResponse<{ message: ZeroHashWithdrawalRequestWrappedResponse }> = await this.post(
        '/withdrawals/requests',
        payload,
      );

      this.logger.log(`ZeroHash withdrawal request created successfully: id=${response.data.message.id}`);

      const withdrawalRequest = response.data.message;

      const withdrawalRequestResponse: FiatWalletWithdrawalRequestWrappedResponse = {
        providerRef: withdrawalRequest.id,
        withdrawalAccountRef: withdrawalRequest.withdrawal_account_id.toString(),
        providerUserRef: withdrawalRequest.participant_code,
        requestorUserRef: withdrawalRequest.requestor_participant_code,
        requestedAmount: withdrawalRequest.requested_amount,
        settledAmount: withdrawalRequest.settled_amount,
        status: withdrawalRequest.status,
        asset: withdrawalRequest.asset,
        blockchainTransactionRef: withdrawalRequest.transaction_id, // this is the transaction ID on the blockchain
        blockchainStatus: withdrawalRequest.on_chain_status, // this is the status of the transaction on the blockchain
        gasPrice: withdrawalRequest.gas_price,
        feeAmount: withdrawalRequest.fee_amount,
        withdrawalFee: withdrawalRequest.withdrawal_fee,
        quotedFeeAmount: withdrawalRequest.quoted_fee_amount,
        quotedFeeNotional: withdrawalRequest.quoted_fee_notional,
        clientWithdrawalRequestRef: withdrawalRequest.client_withdrawal_request_id,
      };

      return withdrawalRequestResponse;
    } catch (error) {
      this.logger.error(`Create withdrawal request failed: ${error.message}`);
      throw new InternalServerErrorException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }

  /**
   * @description Fetches account details from ZeroHash for a given account owner and asset
   * @url https://docs.zerohash.com/reference/get_accounts
   * @param request - The account details request containing accountOwner and asset
   * @returns The account details response with account information
   * @throws InternalServerErrorException if fetching account details fails
   */
  async getAccountDetails(request: FiatWalletAccountDetailsRequest): Promise<FiatWalletAccountDetailsResponse> {
    this.logger.log(
      `Fetching ZeroHash account details for account_owner: ${request.accountOwner}, asset: ${request.asset}`,
    );

    try {
      const queryParams = new URLSearchParams({
        account_owner: request.accountOwner,
        asset: request.asset,
      });

      const response: AxiosResponse<ZeroHashAccountDetailsWrappedResponse> = await this.get(
        `/accounts?${queryParams.toString()}`,
      );

      this.logger.log(
        `ZeroHash account details fetched successfully: found ${response.data.message.length} account(s)`,
      );

      const accountDetailsResponse: FiatWalletAccountDetailsResponse = {
        accounts: response.data.message.map((account) => ({
          asset: account.asset,
          accountOwner: account.account_owner,
          accountType: account.account_type,
          accountGroup: account.account_group,
          accountLabel: account.account_label,
          balance: account.balance,
          accountRef: account.account_id,
          lastUpdate: account.last_update,
        })),
        page: response.data.page,
        totalPages: response.data.total_pages,
      };

      return accountDetailsResponse;
    } catch (error) {
      this.logger.error(`Get account details failed: ${error.message}`);
      throw new InternalServerErrorException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }
}
