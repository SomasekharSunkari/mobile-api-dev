import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { EnvironmentService } from '../../../config';
import {
  BankStatus,
  ExchangeAcceptPayInRequestPayload,
  ExchangeAcceptPayOutRequestPayload,
  ExchangeCancelPayInRequestPayload,
  ExchangeCreatePayInRequestPayload,
  ExchangeCreatePayOutRequestPayload,
  ExchangeCreateWebhookPayload,
  ExchangeCreateWebhookResponse,
  ExchangeCryptoChannel,
  ExchangeCryptoChannelNetwork,
  ExchangeDeleteWebhookPayload,
  ExchangeDeleteWebhookResponse,
  ExchangeGetAllPayInRequestsQueryParams,
  ExchangeGetAllPayOutRequestsQueryParams,
  ExchangeGetPayInRequestPayload,
  ExchangeGetPayOutRequestPayload,
  ExchangeManagementInterface,
  ExchangePayInRequest,
  ExchangePayOutRequest,
  ExchangeRefundPayInRequestPayload,
  ExchangeRejectPayInRequestPayload,
  ExchangeRejectPayOutRequestPayload,
  ExchangeWebhookResponse,
  GetBanksPayload,
  GetBanksResponse,
  GetExchangeChannelsPayload,
  GetExchangeChannelsResponse,
  GetExchangeRatesPayload,
  GetExchangeRatesResponse,
  ValidateBankAccountPayload,
  ValidateBankAccountResponse,
} from '../exchange.interface';
import { YellowCardServiceAxiosHelper } from './yellowcard.axios';
import {
  YellowCardAcceptCollectionRequestPayload,
  YellowCardAcceptPayOutRequestPayload,
  YellowCardCancelCollectionRequestPayload,
  YellowCardCreateWebhookPayload,
  YellowCardCreateWebhookResponse,
  YellowCardDeleteWebhookPayload,
  YellowCardDeleteWebhookResponse,
  YellowCardGetAllCollectionRequestsResponse,
  YellowCardGetAllPayOutRequestsQueryParams,
  YellowCardGetChannelResponse,
  YellowCardGetCryptoChannelsResponse,
  YellowCardGetExchangeRatesPayload,
  YellowCardGetExchangeRatesResponse,
  YellowCardGetNetworksResponse,
  YellowCardNetworks,
  YellowCardPayOutRequest,
  YellowCardPayOutRequestResponse,
  YellowCardRefundCollectionRequestPayload,
  YellowCardRejectCollectionRequestPayload,
  YellowCardRejectPayOutRequestPayload,
  YellowCardSubmitCollectionRequest,
  YellowCardSubmitCollectionRequestPayload,
  YellowCardSubmitCollectionRequestPayloadRecipient,
  YellowCardSubmitPayOutRequestPayload,
  YellowCardValidateBankAccountPayload,
  YellowCardValidateBankAccountResponse,
  YellowCardWebhookResponse,
} from './yellowcard.interface';

@Injectable()
export class YellowCardAdapter extends YellowCardServiceAxiosHelper implements ExchangeManagementInterface {
  protected readonly logger = new Logger(YellowCardAdapter.name);
  getProviderName(): string {
    return 'yellowcard';
  }

  async getExchangeRates(payload: GetExchangeRatesPayload): Promise<GetExchangeRatesResponse[]> {
    this.logger.log(payload, 'YellowCardAdapter.getExchangeRates');
    try {
      const response = await this.get<
        YellowCardGetExchangeRatesResponse,
        AxiosResponse<YellowCardGetExchangeRatesResponse>,
        YellowCardGetExchangeRatesPayload
      >(`/business/rates`, {
        params: {
          currency: payload?.currencyCode,
        },
        validateStatus: () => true,
      });

      this.logger.log(response.data, 'YellowCardAdapter.rate response');
      const data = response.data?.rates ?? [];

      const rates = data.map((rate) => ({
        buy: rate.buy,
        sell: rate.sell,
        locale: rate.locale,
        rateRef: rate.rateId,
        code: rate.code,
        updatedAt: rate.updatedAt,
      }));

      this.logger.log(rates, 'YellowCardAdapter.rate rates');

      return rates;
    } catch (error) {
      this.logger.error(error?.message, 'YellowCardAdapter.getExchangeRates');
      throw new BadRequestException(error?.message);
    }
  }

  async getChannels(payload?: GetExchangeChannelsPayload): Promise<GetExchangeChannelsResponse[]> {
    this.logger.log('YellowCardAdapter.getChannels', payload);
    try {
      const response = await this.get<YellowCardGetChannelResponse>(`/business/channels`, {
        params: {
          country: payload?.countryCode,
        },
      });

      const data = response.data?.channels ?? [];

      const channels = data.map((channel) => ({
        ref: channel.id,
        max: channel.max,
        currency: channel.currency,
        localCurrency: channel.countryCurrency,
        status: channel.status,
        localFee: channel.feeLocal,
        vendorRef: channel.vendorId,
        countryCode: channel.country,
        min: channel.min,
        type: channel.channelType,
        rampType: channel.rampType,
        settlementType: channel.settlementType,
        settlementTime: channel.estimatedSettlementTime,
        feeUSD: channel.feeUSD,
      }));

      return channels;
    } catch (error) {
      this.logger.error(error?.message, 'YellowCardAdapter.getChannels');
      throw new BadRequestException(error?.message);
    }
  }

  async getBanks(payload?: GetBanksPayload): Promise<GetBanksResponse[]> {
    this.logger.log('YellowCardAdapter.getBanks', payload);
    try {
      const response = await this.get<YellowCardGetNetworksResponse>(`/business/networks`, {
        params: {
          country: payload?.countryCode,
        },
      });

      const data = response.data?.networks ?? [];

      const networks = data.map((network) => ({
        ref: network.id,
        name: network.name,
        code: network.code,
        countryCode: network.country,
        status: network.status as unknown as BankStatus,
        accountNumberType: network.accountNumberType,
        countryAccountNumberType: network.countryAccountNumberType,
        channelRefs: network.channelIds,
        createdAt: network.createdAt,
        updatedAt: network.updatedAt,
      }));

      return networks;
    } catch (error) {
      this.logger.error(error?.message, 'YellowCardAdapter.getBanks');
      throw new BadRequestException(error?.message);
    }
  }

  async validateBankAccount(payload: ValidateBankAccountPayload): Promise<ValidateBankAccountResponse> {
    this.logger.log('YellowCardAdapter.validateBankAccount', payload);
    try {
      const response = await this.post<
        YellowCardValidateBankAccountResponse,
        AxiosResponse<YellowCardValidateBankAccountResponse>,
        YellowCardValidateBankAccountPayload
      >(`/business/details/bank`, {
        networkId: payload?.bankRef,
        accountNumber: payload?.accountNumber,
      });

      const data = response.data;

      return {
        accountNumber: data?.accountNumber,
        accountName: data?.accountName,
        bankName: data?.accountBank,
      };
    } catch (error) {
      this.logger.error(error?.message, 'YellowCardAdapter.validateBankAccount');
      throw new BadRequestException(error?.response?.data?.message);
    }
  }

  async getCryptoChannels(): Promise<ExchangeCryptoChannel[]> {
    this.logger.log('YellowCardAdapter.getCryptoChannels');
    try {
      const response = await this.get<YellowCardGetCryptoChannelsResponse>(`/business/channels/crypto`);

      const data = response.data?.channels ?? [];

      const cryptoChannels = data.map<ExchangeCryptoChannel>((channel) => ({
        code: channel.code,
        ref: channel.id,
        name: channel.name,
        enabled: channel.enabled,
        networks: this.transformCryptoChannelNetwork(channel.networks),
        minLocalBuy: channel.buyMinLocal,
        maxLocalBuy: channel.buyMaxLocal,
        minLocalSell: channel.sellMinLocal,
        maxLocalSell: channel.sellMaxLocal,
        defaultNetwork: channel.defaultNetwork,
      }));

      return cryptoChannels;
    } catch (error) {
      this.logger.error(error?.message, 'YellowCardAdapter.getCryptoChannels');
      throw new BadRequestException(error?.message);
    }
  }

  private transformCryptoChannelNetwork(network: YellowCardNetworks): ExchangeCryptoChannelNetwork[] {
    if (!network) {
      return [];
    }

    return Object.entries(network).map(([, value]) => {
      return {
        chainCurrencyRef: value?.chainCurrencyId,
        addressRegex: value?.addressRegex,
        requiresMemo: value?.requiresMemo,
        explorerUrl: value?.explorerUrl,
        name: value?.name,
        isEnabled: value?.enabled,
        network: value.network,
        nativeAsset: value.nativeAsset,
      };
    });
  }

  async createPayOutRequest(payload: ExchangeCreatePayOutRequestPayload): Promise<ExchangePayOutRequest> {
    this.logger.log('YellowCardAdapter.createPayOutRequest', payload);

    try {
      const formattedPayload: YellowCardSubmitPayOutRequestPayload = {
        channelId: payload.channelRef,
        customerUID: payload.userId,
        reason: payload.narration,
        sequenceId: payload.transactionRef,
        sender: {
          name: payload.sender.fullName,
          address: payload.sender.address,
          country: payload.sender.countryCode,
          email: payload.sender.email,
          dob: payload.sender.dob,
          idNumber: payload.sender.idNumber,
          idType: payload.sender.idType,
          additionalIdNumber: payload.sender.additionalIdNumber,
          additionalIdType: payload.sender.additionalIdType,
          phone: payload.sender.phoneNumber,
        },
        destination: {
          accountName: payload.destination.accountName,
          accountNumber: payload.destination.accountNumber,
          accountType: payload.destination.transferType,
          networkId: payload.destination.bankRef,
        },
        forceAccept: true,
        directSettlement: true,
        settlementInfo: {
          cryptoAmount: payload.cryptoInfo.cryptoAmount,
          cryptoCurrency: payload.cryptoInfo.cryptoCurrency,
          cryptoNetwork: payload.cryptoInfo.cryptoNetwork,
        },
      };

      const response = await this.post<
        YellowCardPayOutRequest,
        AxiosResponse<YellowCardPayOutRequest>,
        YellowCardSubmitPayOutRequestPayload
      >(`/business/payments`, formattedPayload);

      const data = response.data;

      return this.transformPayOutRequest(data);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;

      this.logger.error(message, 'YellowCardAdapter.createPayOutRequest');
      throw new BadRequestException(message);
    }
  }

  private transformPayOutRequest(data: YellowCardPayOutRequest): ExchangePayOutRequest {
    return {
      amount: data.amount,
      channelRef: data.channelId,
      sequenceRef: data.sequenceId,
      currency: data.currency,
      country: data.country,
      reason: data.reason,
      convertedAmount: data.convertedAmount,
      status: data.status,
      rate: data.rate,
      sender: data.sender,
      destination: data.destination,
      userId: data.customerUID,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      expiresAt: data.expiresAt,
      ref: data.id,
      providerRef: data.id,
      cryptoInfo: {
        walletAddress: data.settlementInfo?.walletAddress,
        cryptoAmount: data.settlementInfo?.cryptoAmount,
        cryptoCurrency: data.settlementInfo?.cryptoCurrency,
        cryptoNetwork: data.settlementInfo?.cryptoNetwork,
        rate: data.settlementInfo?.cryptoUSDRate,
        expiresAt: data.settlementInfo?.expiresAt,
      },
    };
  }

  async acceptPayOutRequest(payload: ExchangeAcceptPayOutRequestPayload): Promise<ExchangePayOutRequest> {
    this.logger.log('YellowCardAdapter.acceptPayOutRequest', payload);

    try {
      const response = await this.post<
        YellowCardPayOutRequest,
        AxiosResponse<YellowCardPayOutRequest>,
        YellowCardAcceptPayOutRequestPayload
      >(`/business/payments/${payload.paymentRef}/accept`);

      return this.transformPayOutRequest(response.data);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;

      this.logger.error(message, 'YellowCardAdapter.acceptPayOutRequest');
      throw new BadRequestException(message);
    }
  }

  async rejectPayOutRequest(payload: ExchangeRejectPayOutRequestPayload): Promise<ExchangePayOutRequest> {
    this.logger.log('YellowCardAdapter.rejectPayOutRequest', payload);

    try {
      const response = await this.post<
        YellowCardPayOutRequest,
        AxiosResponse<YellowCardPayOutRequest>,
        YellowCardRejectPayOutRequestPayload
      >(`/business/payments/${payload.paymentRef}/reject`);

      return this.transformPayOutRequest(response.data);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;

      this.logger.error(message, 'YellowCardAdapter.rejectPayOutRequest');
      throw new BadRequestException(message);
    }
  }

  async getPayOutRequest(payload: ExchangeGetPayOutRequestPayload): Promise<ExchangePayOutRequest> {
    this.logger.log('YellowCardAdapter.getPayOutRequest', payload);

    try {
      const response = await this.get<YellowCardPayOutRequest>(`/business/payments/${payload.paymentRef}`);

      return this.transformPayOutRequest(response.data);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;
      this.logger.error(message, 'YellowCardAdapter.getPayOutRequest');
      throw new BadRequestException(message);
    }
  }

  async getPayOutRequestByTransactionRef(transactionId: string): Promise<ExchangePayOutRequest> {
    this.logger.log('YellowCardAdapter.getPayOutRequestByTransactionId', transactionId);

    try {
      const response = await this.get<YellowCardPayOutRequest>(`/business/payments/sequence-id/${transactionId}`);

      return this.transformPayOutRequest(response.data);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;
      this.logger.error(message, 'YellowCardAdapter.getPayOutRequestByTransactionId');
      throw new BadRequestException(message);
    }
  }

  async getAllPayOutRequests(params: ExchangeGetAllPayOutRequestsQueryParams): Promise<ExchangePayOutRequest[]> {
    this.logger.log('YellowCardAdapter.getAllPayOutRequests', params);

    try {
      const response = await this.get<
        YellowCardPayOutRequestResponse,
        AxiosResponse<YellowCardPayOutRequestResponse>,
        YellowCardGetAllPayOutRequestsQueryParams
      >(`/business/payments`, {
        params: {
          startDate: params?.startDate,
          endDate: params?.endDate,
          startAt: params?.page,
          perPage: params?.limit,
          rangeBy: params?.filterBy,
        },
      });

      const data = response.data?.payments ?? [];

      const payments = data.map((payment) => this.transformPayOutRequest(payment));

      return payments;
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;
      this.logger.error(message, 'YellowCardAdapter.getAllPayOutRequests');
      throw new BadRequestException(message);
    }
  }

  async createWebhook(payload: ExchangeCreateWebhookPayload): Promise<ExchangeCreateWebhookResponse> {
    this.logger.log('YellowCardAdapter.createWebhook', payload);

    try {
      const response = await this.post<
        YellowCardCreateWebhookResponse,
        AxiosResponse<YellowCardCreateWebhookResponse>,
        YellowCardCreateWebhookPayload
      >(`/business/webhooks`, {
        url: payload.url,
        active: true,
      });

      return {
        id: response.data.id,
        url: response.data.url,
        isActive: response.data.active,
        createdAt: response.data.createdAt,
        updatedAt: response.data.updatedAt,
      };
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;
      this.logger.error(message, 'YellowCardAdapter.createWebhook');
      throw new BadRequestException(message);
    }
  }

  private transformPayInRequest(data: YellowCardSubmitCollectionRequest): ExchangePayInRequest {
    return {
      amount: data.amount,
      channelRef: data.channelId,
      transactionRef: data.sequenceId,
      currency: data.currency,
      country: data.country,
      sender: data.recipient,
      bankInfo: data.bankInfo,
      status: data.status,
      userId: data.customerUID,
      convertedAmount: data.convertedAmount,
      rate: data.rate,
      expiresAt: data.expiresAt,
      createdAt: data.createdAt,
      ref: data.id,
      updatedAt: data.updatedAt,
      source: {
        accountType: data.source.accountType,
        accountNumber: data.source.accountNumber,
        networkRef: data.source.networkId,
      },
      feeLocal: data.serviceFeeAmountLocal,
      feeUSD: data.serviceFeeAmountUSD,
      networkFeeLocal: data.networkFeeAmountLocal,
      networkFeeUSD: data.networkFeeAmountUSD,
      partnerFeeLocal: data.partnerFeeAmountLocal,
      partnerFeeUSD: data.partnerFeeAmountUSD,
      receiverCryptoInfo: {
        walletAddress: data.settlementInfo?.walletAddress,
        cryptoCurrency: data.settlementInfo?.cryptoCurrency,
        cryptoNetwork: data.settlementInfo?.cryptoNetwork,
        cryptoAmount: data.settlementInfo?.cryptoAmount,
        cryptoUSDRate: data.settlementInfo?.cryptoUSDRate,
        cryptoLocalRate: data.settlementInfo?.cryptoLocalRate,
      },
    };
  }

  async createPayInRequest(payload: ExchangeCreatePayInRequestPayload): Promise<ExchangePayInRequest> {
    this.logger.log('YellowCardAdapter.createPayInRequest', payload);

    const recipientUser: YellowCardSubmitCollectionRequestPayloadRecipient = {
      name: payload.sender.name,
      country: payload.sender.country,
      address: payload.sender.address,
      dob: payload.sender.dob,
      email: payload.sender.email,
      idNumber: payload.sender.idNumber,
      idType: payload.sender.idType,
      phone: payload.sender.phone,
    };

    const recipientForBusiness: YellowCardSubmitCollectionRequestPayloadRecipient = {
      businessName: payload.sender.businessName,
      businessId: payload.sender.businessIdNumber,
      phone: payload.sender.phone,
      email: payload.sender.email,
    };

    const formattedPayload: YellowCardSubmitCollectionRequestPayload = {
      channelId: payload.channelRef,
      sequenceId: payload.transactionRef,
      localAmount: payload.localAmount,
      amount: payload.amount,
      recipient: payload.customerType === 'institution' ? recipientForBusiness : recipientUser,
      source: {
        accountType: payload.transferType,
        networkId: payload.networkRef,
      },
      forceAccept: payload.forceAccept,
      customerType: payload.customerType,
      redirectUrl: payload.redirectUrl,
      customerUID: payload.userId,
      currency: payload.currencyCode,
      country: payload.sender.country,
      reason: 'other',
      directSettlement: true,
      settlementInfo: {
        walletAddress: payload.receiver.walletAddress,
        cryptoCurrency: payload.receiver?.cryptoCurrency,
        cryptoNetwork: payload.receiver?.cryptoNetwork,
      },
    };

    if (payload.sender.additionalIdType && payload.sender.additionalIdNumber) {
      formattedPayload.recipient.additionalIdType = payload.sender.additionalIdType;
      formattedPayload.recipient.additionalIdNumber = payload.sender.additionalIdNumber;
    }

    if (payload.localAmount) {
      delete formattedPayload.amount;
      formattedPayload.localAmount = payload.localAmount;
    }

    if (!EnvironmentService.isProduction()) {
      formattedPayload.source.accountNumber = '1111111111';
      // formattedPayload.source.accountNumber = '0000000000';
    }

    try {
      const response = await this.post<
        YellowCardSubmitCollectionRequest,
        AxiosResponse<YellowCardSubmitCollectionRequest>,
        YellowCardSubmitCollectionRequestPayload
      >('/business/collections', formattedPayload);

      return this.transformPayInRequest(response.data);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;
      this.logger.error(message, 'YellowCardAdapter.createPayInRequest');
      throw new BadRequestException(message);
    }
  }

  async acceptPayInRequest(payload: ExchangeAcceptPayInRequestPayload): Promise<ExchangePayInRequest> {
    this.logger.log('YellowCardAdapter.acceptPayInRequest', payload);

    try {
      const response = await this.post<
        YellowCardSubmitCollectionRequest,
        AxiosResponse<YellowCardSubmitCollectionRequest>,
        YellowCardAcceptCollectionRequestPayload
      >(`/business/collections/${payload.ref}/accept`);

      return this.transformPayInRequest(response.data);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;
      this.logger.error(message, 'YellowCardAdapter.acceptPayInRequest');
      throw new BadRequestException(message);
    }
  }

  async rejectPayInRequest(payload: ExchangeRejectPayInRequestPayload): Promise<ExchangePayInRequest> {
    this.logger.log('YellowCardAdapter.rejectPayInRequest', payload);

    try {
      const response = await this.post<
        YellowCardSubmitCollectionRequest,
        AxiosResponse<YellowCardSubmitCollectionRequest>,
        YellowCardRejectCollectionRequestPayload
      >(`/business/collections/${payload.ref}/reject`);

      return this.transformPayInRequest(response.data);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;
      this.logger.error(message, 'YellowCardAdapter.rejectPayInRequest');
      throw new BadRequestException(message);
    }
  }

  async cancelPayInRequest(payload: ExchangeCancelPayInRequestPayload): Promise<ExchangePayInRequest> {
    this.logger.log('YellowCardAdapter.cancelPayInRequest', payload);

    try {
      const response = await this.post<
        YellowCardSubmitCollectionRequest,
        AxiosResponse<YellowCardSubmitCollectionRequest>,
        YellowCardCancelCollectionRequestPayload
      >(`/business/collections/${payload.ref}/cancel`);

      return this.transformPayInRequest(response.data);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;
      this.logger.error(message, 'YellowCardAdapter.cancelPayInRequest');
      throw new BadRequestException(message);
    }
  }

  async refundPayInRequest(payload: ExchangeRefundPayInRequestPayload): Promise<ExchangePayInRequest> {
    this.logger.log('YellowCardAdapter.refundPayInRequest', payload);

    try {
      const response = await this.post<
        YellowCardSubmitCollectionRequest,
        AxiosResponse<YellowCardSubmitCollectionRequest>,
        YellowCardRefundCollectionRequestPayload
      >(`/business/collections/${payload.ref}/refund`);

      return this.transformPayInRequest(response.data);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;
      this.logger.error(message, 'YellowCardAdapter.refundPayInRequest');
      throw new BadRequestException(message);
    }
  }

  async getPayInRequest(payload: ExchangeGetPayInRequestPayload): Promise<ExchangePayInRequest> {
    this.logger.log('YellowCardAdapter.getPayInRequest', payload);

    try {
      const response = await this.get<YellowCardSubmitCollectionRequest>(`/business/collections/${payload.ref}`);

      return this.transformPayInRequest(response.data);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;
      this.logger.error(message, 'YellowCardAdapter.getPayInRequest');
      throw new BadRequestException(message);
    }
  }

  async getPayInRequestByTransactionRef(transactionId: string): Promise<ExchangePayInRequest> {
    this.logger.log('YellowCardAdapter.getPayInRequestByTransactionId', transactionId);

    try {
      const response = await this.get<YellowCardSubmitCollectionRequest>(
        `/business/collections/sequence-id/${transactionId}`,
      );

      return this.transformPayInRequest(response.data);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;
      this.logger.error(message, 'YellowCardAdapter.getPayInRequestByTransactionId');
      throw new BadRequestException(message);
    }
  }

  async getAllPayInRequests(params?: ExchangeGetAllPayInRequestsQueryParams): Promise<ExchangePayInRequest[]> {
    this.logger.log('YellowCardAdapter.getAllPayInRequests', params);

    try {
      const response = await this.get<YellowCardGetAllCollectionRequestsResponse>(`/business/collections`, {
        params: {
          startDate: params?.startDate,
          endDate: params?.endDate,
          startAt: params?.page,
          perPage: params?.limit,
          rangeBy: params?.filterBy,
        },
      });

      const data = response.data?.collections ?? [];

      const collections = data.map((collection) => this.transformPayInRequest(collection));

      return collections;
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;
      this.logger.error(message, 'YellowCardAdapter.getAllPayInRequests');
      throw new BadRequestException(message);
    }
  }

  async getWebhooks(): Promise<ExchangeWebhookResponse[]> {
    this.logger.log('YellowCardAdapter.getWebhooks');

    try {
      const response = await this.get<YellowCardWebhookResponse>(`/business/webhooks`);

      const data = response.data?.webhooks ?? [];

      const webhooks = data.map((webhook) => ({
        ref: webhook.id,
        url: webhook.url,
        isActive: webhook.active,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
        event: webhook.state,
      }));

      return webhooks;
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;
      this.logger.error(message, 'YellowCardAdapter.getWebhooks');
      throw new BadRequestException(error?.message);
    }
  }

  async deleteWebhook(payload: ExchangeDeleteWebhookPayload): Promise<ExchangeDeleteWebhookResponse> {
    this.logger.log('YellowCardAdapter.deleteWebhook', payload);

    try {
      const response = await this.delete<
        YellowCardDeleteWebhookResponse,
        AxiosResponse<YellowCardDeleteWebhookResponse>,
        YellowCardDeleteWebhookPayload
      >(`/business/webhooks/${payload.ref}`);

      return {
        ok: response.data.ok,
      };
    } catch (error) {
      const message = error?.response?.data?.message || error?.message;
      this.logger.error(message, 'YellowCardAdapter.deleteWebhook');
      throw new BadRequestException(error?.message);
    }
  }
}
