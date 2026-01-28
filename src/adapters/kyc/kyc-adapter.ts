import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AdapterConfigProvider } from '../../config/adapter.config';
import {
  DirectKYCInitiateResponse,
  GenerateAccessTokenPayload,
  GenerateAccessTokenResponse,
  GenerateShareTokenPayload,
  GenerateShareTokenResponse,
  GetDocumentContentPayload,
  GetDocumentContentResponse,
  GetDocumentInfoPayload,
  GetDocumentInfoResponse,
  GetKycDetailsPayload,
  GetKycDetailsResponse,
  InitiateDirectKycPayload,
  InitiateWidgetKycPayload,
  KycBaseResponse,
  KYCManagementInterface,
  PerformAMLCheckPayload,
  PerformAMLCheckResponse,
  ProcessKycWebhookPayload,
  ProcessKycWebhookResponse,
  ResetApplicantPayload,
  ResetApplicantResponse,
  UpdateApplicantTaxInfoPayload,
  UpdateApplicantTaxInfoResponse,
  ValidateKycResponse,
  WidgetKYCInitiateResponse,
} from './kyc-adapter.interface';
import { SumsubAdapter } from './sumsub/sumsub.adapter';

@Injectable()
export class KYCAdapter implements KYCManagementInterface {
  @Inject(AdapterConfigProvider)
  private readonly adapterConfig: AdapterConfigProvider;

  @Inject(SumsubAdapter)
  private readonly sumsubAdapter: SumsubAdapter;

  private getProvider(countryCode?: string): KYCManagementInterface {
    const providerKey = this.getProviderName(countryCode);

    if (!providerKey) {
      throw new BadRequestException(`No KYC provider configured for country: ${countryCode}`);
    }

    switch (providerKey) {
      case 'sumsub':
        return this.sumsubAdapter;
      default:
        throw new BadRequestException(`Unsupported KYC provider: ${providerKey}`);
    }
  }

  getProviderName(countryCode: string): string {
    if (countryCode) {
      const normalized = countryCode.toLowerCase();
      const config = this.adapterConfig.getConfig();
      return config.kyc[`default_${normalized}_kyc_provider` as keyof typeof config.kyc];
    } else {
      return this.adapterConfig.getConfig().kyc.default_kyc_provider;
    }
  }

  /**
   * @param payload - The payload to process
   * @param provider - The provider to use
   * @returns The processed payload
   * @description This method is used to process the webhook from the given provider,
   * the response and the payloads are not typed, hence we use generic type.
   * When handling webhooks, is important we do it carefully and not assume the type of the payload or response,
   * so we are leaving the type inference to the caller where the webhook is being handled.
   *
   * Added to this, the underlying implementation of the processWebhook method is where all the validation is done,
   * Validations like signature verification, event type validation, etc. are done here.
   * If there are need to make an extra request to the provider, it should be done here.
   * This is to avoid the need to validate the payload and response in the caller.
   * The returned data should be used to make decision in the caller.
   */
  async processWebhook(
    payload: ProcessKycWebhookPayload,
    provider?: string,
  ): Promise<KycBaseResponse<ProcessKycWebhookResponse>> {
    if (!provider) {
      provider = this.getProviderName(payload.country);
    }

    switch (provider) {
      case 'sumsub':
        return this.sumsubAdapter.processWebhook(payload as any);
      default:
        throw new BadRequestException(`Unsupported KYC provider: ${provider}`);
    }
  }

  async validateKyc(): Promise<ValidateKycResponse> {
    throw new Error('Not yet implemented');
  }

  async getKycDetails(payload: GetKycDetailsPayload): Promise<KycBaseResponse<GetKycDetailsResponse>> {
    const provider = this.getProvider();
    const response = await provider.getKycDetails(payload);

    return response;
  }

  async initiateWidgetKyc(payload: InitiateWidgetKycPayload, country?: string): Promise<WidgetKYCInitiateResponse> {
    return this.getProvider(country).initiateWidgetKyc(payload);
  }

  async initiateDirectKyc(payload: InitiateDirectKycPayload & { country: string }): Promise<DirectKYCInitiateResponse> {
    const { country, ...rest } = payload;
    return this.getProvider(country).initiateDirectKyc(rest);
  }

  verifySignature(req: Request, country: string): boolean {
    return this.getProvider(country).verifySignature(req, country);
  }

  async getFullInfo(userRef: string, country: string): Promise<any> {
    return this.getProvider(country).getFullInfo(userRef, country);
  }

  supportedCountries(): string[] {
    return ['US'];
  }

  async generateAccessToken(data: GenerateAccessTokenPayload): Promise<KycBaseResponse<GenerateAccessTokenResponse>> {
    const provider = this.getProvider();

    return await provider.generateAccessToken(data);
  }

  async generateShareToken(data: GenerateShareTokenPayload): Promise<KycBaseResponse<GenerateShareTokenResponse>> {
    const provider = this.getProvider();
    return await provider.generateShareToken(data);
  }

  async getKycDetailsByUserId(userId: string) {
    const provider = this.getProvider();

    return await provider.getKycDetailsByUserId(userId);
  }

  async performAMLCheck(payload: PerformAMLCheckPayload): Promise<KycBaseResponse<PerformAMLCheckResponse>> {
    const provider = this.getProvider();

    if (!provider.performAMLCheck) {
      throw new BadRequestException('Provider does not support AML check');
    }

    return await provider.performAMLCheck(payload);
  }

  async getDocumentInfo(payload: GetDocumentInfoPayload): Promise<KycBaseResponse<GetDocumentInfoResponse>> {
    const provider = this.getProvider();
    return await provider.getDocumentInfo(payload);
  }

  async getDocumentContent(payload: GetDocumentContentPayload): Promise<KycBaseResponse<GetDocumentContentResponse>> {
    const provider = this.getProvider();
    return await provider.getDocumentContent(payload);
  }

  async resetApplicant(payload: ResetApplicantPayload): Promise<KycBaseResponse<ResetApplicantResponse>> {
    const provider = this.getProvider();
    return await provider.resetApplicant(payload);
  }

  async updateApplicantTaxInfo(
    payload: UpdateApplicantTaxInfoPayload,
  ): Promise<KycBaseResponse<UpdateApplicantTaxInfoResponse>> {
    const provider = this.getProvider();
    return await provider.updateApplicantTaxInfo(payload);
  }
}
