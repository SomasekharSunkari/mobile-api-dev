import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { AdapterConfigProvider } from '../../config/adapter.config';

import {
  DepositAddressCreateRequest,
  DepositAddressCreateResponse,
  DepositAddressFetchRequest,
  DepositAddressFetchResponse,
  DocumentUploadRequest,
  GetKycStatusRequest,
  GetKycStatusResponse,
  GetParticipantRefRequest,
  GetParticipantRefResponse,
  ParticipantAdapterInterface,
  ParticipantCreateRequest,
  ParticipantCreateResponse,
  ParticipantUpdateRequest,
} from './participant.adapter.interface';
import { ZerohashParticipantAdapter } from './zerohash/zerohash.adapter';

@Injectable()
export class ParticipantAdapter implements ParticipantAdapterInterface {
  private readonly logger = new Logger(ParticipantAdapter.name);
  private readonly MATCH_WHITE_SPACE_REGEX = /\s+/g;
  @Inject(ZerohashParticipantAdapter)
  private readonly zerohashParticipantAdapter: ZerohashParticipantAdapter;

  private readonly adapterConfig: AdapterConfigProvider;

  constructor() {
    this.adapterConfig = new AdapterConfigProvider();
  }

  private getProvider(countryCode: string): ParticipantAdapterInterface {
    const participantCountries = this.adapterConfig
      .getConfig()
      .default_participant_countries.toUpperCase()
      .replaceAll(this.MATCH_WHITE_SPACE_REGEX, '')
      .split(',');

    this.logger.debug(`Supported Zerohash participant countries: ${participantCountries.join(', ')}`);
    this.logger.debug(`Requested country: ${countryCode}`);

    if (participantCountries.includes(countryCode.toUpperCase())) {
      this.logger.debug(`Using ZerohashParticipantAdapter for country: ${countryCode}`);
      return this.zerohashParticipantAdapter;
    }

    this.logger.error(`Unsupported participant country for customer creation: ${countryCode}`);
    throw new BadRequestException(`Unsupported participant country for customer creation: ${countryCode}`);
  }

  async createParticipant(payload: ParticipantCreateRequest): Promise<ParticipantCreateResponse> {
    const provider = this.getProvider(payload.country);
    return await provider.createParticipant(payload);
  }

  async getParticipantRef(payload: GetParticipantRefRequest, countryCode?: string): Promise<GetParticipantRefResponse> {
    const provider = this.getProvider(countryCode);
    return await provider.getParticipantRef(payload);
  }

  async uploadKycDocument(payload: DocumentUploadRequest): Promise<void> {
    const provider = this.getProvider(payload.country);

    if (provider.uploadKycDocument) {
      return await provider.uploadKycDocument(payload);
    } else {
      this.logger.warn(`Document upload not supported for country: ${payload.country}`);
    }
  }

  async updateParticipant(payload: ParticipantUpdateRequest): Promise<void> {
    const provider = this.getProvider(payload.citizenshipCode);

    if (provider.updateParticipant) {
      return await provider.updateParticipant(payload);
    } else {
      throw new BadRequestException(`Participant update not supported for country: ${payload.citizenshipCode}`);
    }
  }

  async createDepositAddress(
    payload: DepositAddressCreateRequest,
    countryCode?: string,
  ): Promise<DepositAddressCreateResponse> {
    const provider = this.getProvider(countryCode);
    return await provider.createDepositAddress(payload);
  }

  async getDepositAddress(
    payload: DepositAddressFetchRequest,
    countryCode?: string,
  ): Promise<DepositAddressFetchResponse> {
    const provider = this.getProvider(countryCode);
    return await provider.getDepositAddress(payload);
  }

  async getKycStatus(payload: GetKycStatusRequest, countryCode?: string): Promise<GetKycStatusResponse> {
    const provider = this.getProvider(countryCode);
    return await provider.getKycStatus(payload);
  }
}
