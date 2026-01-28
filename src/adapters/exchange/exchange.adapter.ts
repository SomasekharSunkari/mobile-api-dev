import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ExchangeConfig, ExchangeConfigProvider } from '../../config/exchange.config';
import {
  ExchangeAcceptPayInRequestPayload,
  ExchangeAcceptPayOutRequestPayload,
  ExchangeCancelPayInRequestPayload,
  ExchangeCreatePayInRequestPayload,
  ExchangeCreatePayOutRequestPayload,
  ExchangeCreateWebhookPayload,
  ExchangeCreateWebhookResponse,
  ExchangeCryptoChannel,
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
} from './exchange.interface';
import { YellowCardAdapter } from './yellowcard/yellowcard.adapter';

@Injectable()
export class ExchangeAdapter implements ExchangeManagementInterface {
  @Inject(YellowCardAdapter)
  private readonly yellowCardAdapter: YellowCardAdapter;

  private readonly exchangeConfig: ExchangeConfig;

  constructor() {
    this.exchangeConfig = new ExchangeConfigProvider().getConfig();
  }

  getProviderName(): string {
    return this.exchangeConfig.default_exchange_provider;
  }

  getProvider(): ExchangeManagementInterface {
    const provider = this.getProviderName();

    if (provider === 'yellowcard') {
      return this.yellowCardAdapter;
    }

    throw new InternalServerErrorException('Provider not found');
  }

  async getChannels(payload: GetExchangeChannelsPayload): Promise<GetExchangeChannelsResponse[]> {
    const provider = this.getProvider();

    return await provider.getChannels(payload);
  }

  async getBanks(payload: GetBanksPayload): Promise<GetBanksResponse[]> {
    const provider = this.getProvider();

    return await provider.getBanks(payload);
  }

  async getExchangeRates(payload?: GetExchangeRatesPayload): Promise<GetExchangeRatesResponse[]> {
    const provider = this.getProvider();

    return await provider.getExchangeRates(payload);
  }

  async validateBankAccount(payload: ValidateBankAccountPayload): Promise<ValidateBankAccountResponse> {
    const provider = this.getProvider();

    return await provider.validateBankAccount(payload);
  }

  async getCryptoChannels(): Promise<ExchangeCryptoChannel[]> {
    const provider = this.getProvider();

    return await provider.getCryptoChannels();
  }

  async createPayOutRequest(payload: ExchangeCreatePayOutRequestPayload): Promise<ExchangePayOutRequest> {
    const provider = this.getProvider();

    return await provider.createPayOutRequest(payload);
  }

  async acceptPayOutRequest(payload: ExchangeAcceptPayOutRequestPayload): Promise<ExchangePayOutRequest> {
    const provider = this.getProvider();

    return await provider.acceptPayOutRequest(payload);
  }

  async rejectPayOutRequest(payload: ExchangeRejectPayOutRequestPayload): Promise<ExchangePayOutRequest> {
    const provider = this.getProvider();

    return await provider.rejectPayOutRequest(payload);
  }

  async getPayOutRequest(payload: ExchangeGetPayOutRequestPayload): Promise<ExchangePayOutRequest> {
    const provider = this.getProvider();

    return await provider.getPayOutRequest(payload);
  }

  async getAllPayOutRequests(params: ExchangeGetAllPayOutRequestsQueryParams): Promise<ExchangePayOutRequest[]> {
    const provider = this.getProvider();

    return await provider.getAllPayOutRequests(params);
  }

  async getPayOutRequestByTransactionRef(transactionId: string): Promise<ExchangePayOutRequest> {
    const provider = this.getProvider();

    return await provider.getPayOutRequestByTransactionRef(transactionId);
  }

  async createWebhook(payload: ExchangeCreateWebhookPayload): Promise<ExchangeCreateWebhookResponse> {
    const provider = this.getProvider();

    return await provider.createWebhook(payload);
  }

  async createPayInRequest(payload: ExchangeCreatePayInRequestPayload): Promise<ExchangePayInRequest> {
    const provider = this.getProvider();

    return await provider.createPayInRequest(payload);
  }

  async acceptPayInRequest(payload: ExchangeAcceptPayInRequestPayload): Promise<ExchangePayInRequest> {
    const provider = this.getProvider();

    return await provider.acceptPayInRequest(payload);
  }

  async rejectPayInRequest(payload: ExchangeRejectPayInRequestPayload): Promise<ExchangePayInRequest> {
    const provider = this.getProvider();

    return await provider.rejectPayInRequest(payload);
  }

  async cancelPayInRequest(payload: ExchangeCancelPayInRequestPayload): Promise<ExchangePayInRequest> {
    const provider = this.getProvider();

    return await provider.cancelPayInRequest(payload);
  }

  async refundPayInRequest(payload: ExchangeRefundPayInRequestPayload): Promise<ExchangePayInRequest> {
    const provider = this.getProvider();

    return await provider.refundPayInRequest(payload);
  }

  async getPayInRequest(payload: ExchangeGetPayInRequestPayload): Promise<ExchangePayInRequest> {
    const provider = this.getProvider();

    return await provider.getPayInRequest(payload);
  }

  async getPayInRequestByTransactionRef(transactionId: string): Promise<ExchangePayInRequest> {
    const provider = this.getProvider();

    return await provider.getPayInRequestByTransactionRef(transactionId);
  }

  async getAllPayInRequests(params: ExchangeGetAllPayInRequestsQueryParams): Promise<ExchangePayInRequest[]> {
    const provider = this.getProvider();

    return await provider.getAllPayInRequests(params);
  }

  async getWebhooks(): Promise<ExchangeWebhookResponse[]> {
    const provider = this.getProvider();

    return await provider.getWebhooks();
  }

  async deleteWebhook(payload: ExchangeDeleteWebhookPayload): Promise<ExchangeDeleteWebhookResponse> {
    const provider = this.getProvider();

    return await provider.deleteWebhook(payload);
  }
}
