import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PROVIDERS, ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE } from '../../../constants/constants';
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
} from '../participant.adapter.interface';
import { ZerohashAxiosHelper } from './zerohash.axios';
import {
  GetParticipantResponse,
  NIGERIAN_CITY_TO_STATE_MAPPING,
  NigerianStateCode,
  ZerohashDepositAddressCreateRequest,
  ZerohashDepositAddressCreateWrappedResponse,
  ZerohashDepositAddressFetchWrappedResponse,
  ZerohashDocumentUploadRequest,
  ZerohashDocumentUploadResponse,
  ZerohashKycStatusResponse,
  ZerohashParticipantCreateRequest,
  ZerohashParticipantCreateWrappedResponse,
  ZerohashParticipantUpdateRequest,
  ZerohashParticipantUpdateResponse,
} from './zerohash.interface';
import { ZerohashHelper } from './zerohash.helper';

@Injectable()
export class ZerohashParticipantAdapter extends ZerohashAxiosHelper implements ParticipantAdapterInterface {
  private readonly logger = new Logger(ZerohashParticipantAdapter.name);
  private static readonly STATE_CODE_LENGTH = 2;
  private static readonly SECONDS_TO_MILLISECONDS_MULTIPLIER = 1000;

  /**
   * Maps Nigerian cities/regions to their ISO 3166-2 state subdivision codes
   * @param cityOrState - Nigerian city, region, or state name
   * @returns ISO 3166-2 state subdivision code (e.g., "LA" for Lagos)
   */
  private mapNigerianCityToStateCode(cityOrState: string): string {
    if (!cityOrState) {
      throw new BadGatewayException('Nigerian state/city is required but not provided');
    }

    const normalizedInput = cityOrState.toLowerCase().trim().replace(/\s+/g, '');

    // Check if it's already a valid state code
    if (normalizedInput.length === ZerohashParticipantAdapter.STATE_CODE_LENGTH) {
      const upperCode = normalizedInput.toUpperCase();
      if (Object.values(NigerianStateCode).includes(upperCode as NigerianStateCode)) {
        return upperCode;
      }
    }

    // Map city/region to state code using the centralized mapping
    const stateCode = NIGERIAN_CITY_TO_STATE_MAPPING[normalizedInput];
    if (stateCode) {
      return stateCode;
    }

    // If no mapping found, throw an exception
    this.logger.error(`No state mapping found for: ${cityOrState}`);
    throw new BadGatewayException(
      `Invalid Nigerian state/city: ${cityOrState}. Please provide a valid Nigerian state or city.`,
    );
  }

  public async createParticipant(payload: ParticipantCreateRequest): Promise<ParticipantCreateResponse> {
    this.logger.log(`Creating ZeroHash customer for ${payload.email}`);

    const isUS = payload.country === 'US';
    const isNG = payload.country === 'NG';

    if (!isUS && !isNG) {
      throw new BadGatewayException(`Unsupported country for ZeroHash createCustomer: ${payload.country}`);
    }

    // Convert timestamps from seconds to milliseconds
    const kycTimestampMs = payload.kycTimestamp * ZerohashParticipantAdapter.SECONDS_TO_MILLISECONDS_MULTIPLIER;
    const complianceTimestampMs =
      payload.complianceTimestamp * ZerohashParticipantAdapter.SECONDS_TO_MILLISECONDS_MULTIPLIER;
    const signedTimestampMs = payload.signedTimestamp * ZerohashParticipantAdapter.SECONDS_TO_MILLISECONDS_MULTIPLIER;

    // Map state/city to proper subdivision code for Nigeria, keep US states as-is
    const stateCode = isNG ? this.mapNigerianCityToStateCode(payload.state) : payload.state;

    const zerohashParticipantRequest: ZerohashParticipantCreateRequest = {
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email,
      address_one: payload.address,
      city: payload.city,
      jurisdiction_code: `${payload.country}-${stateCode}`,
      citizenship_code: payload.country,
      date_of_birth: payload.dob,
      kyc: payload.kyc,
      kyc_timestamp: kycTimestampMs,
      sanction_screening: payload.compliance,
      sanction_screening_timestamp: complianceTimestampMs,
      signed_timestamp: signedTimestampMs,
    };

    if (isUS) {
      zerohashParticipantRequest.zip = payload.zip;
      zerohashParticipantRequest.tax_id = payload.tin; // SSN for US users
    }

    if (isNG) {
      zerohashParticipantRequest.id_number_type = 'non_us_other';
      zerohashParticipantRequest.id_number = payload.tin; // BVN for NG users
      zerohashParticipantRequest.non_us_other_type = 'BVN'; // Bank Verification Number for Nigerian users
    }

    let participantCode: string;

    try {
      const response = await this.post<ZerohashParticipantCreateWrappedResponse, ZerohashParticipantCreateRequest>(
        '/participants/customers/new',
        zerohashParticipantRequest,
      );

      participantCode = response.data.message.participant_code;
      this.logger.log(`Created ZeroHash customer: ${participantCode}`);
    } catch (error) {
      this.logger.error(`Failed to create ZeroHash customer: ${error.message}`);
      if (error.response) {
        this.logger.error(`Zerohash response status: ${error.response.status}`);
        this.logger.error(`Zerohash response data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      throw new BadGatewayException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }

    return {
      providerRef: participantCode,
      provider: PROVIDERS.ZEROHASH,
    };
  }

  public async getParticipantRef(payload: GetParticipantRefRequest): Promise<GetParticipantRefResponse> {
    this.logger.log(`Getting ZeroHash participant code for ${payload.email}`);

    try {
      const response = await this.get<GetParticipantResponse>(`/participants/${payload.email}`, {
        validateStatus: (status) => {
          return (status >= 200 && status < 300) || status === 404;
        },
      });

      const data = response.data;

      if (response.status === 404) {
        return {
          ref: null,
          email: data.message?.email,
          provider: PROVIDERS.ZEROHASH,
        };
      }

      return {
        ref: data.message?.participant_code,
        email: data.message?.email,
        provider: PROVIDERS.ZEROHASH,
      };
    } catch (error) {
      this.logger.error(`Failed to get ZeroHash participant code: ${error.message}`);
      throw new BadGatewayException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }

  public async uploadKycDocument(payload: DocumentUploadRequest): Promise<void> {
    this.logger.log(`Uploading document for ZeroHash participant ${payload.userRef}`);

    const digest = crypto.createHash('sha256').update(payload.document, 'utf8').digest('base64');

    // Map camelCase payload to snake_case ZeroHash API format
    const zerohashPayload: ZerohashDocumentUploadRequest = {
      document_type: payload.documentType,
      document: payload.document,
      mime: payload.mime,
      file_name: payload.fileName,
      participant_code: payload.userRef,
      id_front: payload.idFront,
    };

    try {
      await this.post<ZerohashDocumentUploadResponse, ZerohashDocumentUploadRequest>(
        '/participants/documents',
        zerohashPayload,
        {
          headers: {
            'X-SCX-FILE-HASH': digest,
          },
        },
      );

      this.logger.log(`Uploaded document for participant ${payload.userRef}`);
    } catch (docErr: any) {
      this.logger.error(`Failed to upload document for participant ${payload.userRef}: ${docErr.message}`);
      if (docErr.response) {
        this.logger.error(`Zerohash doc upload status: ${docErr.response.status}`);
        this.logger.error(`Zerohash doc upload data: ${JSON.stringify(docErr.response.data, null, 2)}`);
      }
      throw new BadGatewayException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }

  public async updateParticipant(payload: ParticipantUpdateRequest): Promise<void> {
    this.logger.log(`Updating ZeroHash participant ${payload.userRef}`);

    // Map camelCase payload to snake_case ZeroHash API format
    const zerohashPayload: ZerohashParticipantUpdateRequest = {
      platform_updated_at: payload.platformUpdatedAt,
      id_number: payload.idNumber,
      id_number_type: payload.idNumberType,
      liveness_check: payload.livenessCheck,
      idv: payload.idv,
      tax_id: payload.taxIdNumber,
      citizenship_code: payload.citizenshipCode,
      employment_status: ZerohashHelper.mapEmploymentStatusToZeroHash(payload.employmentStatus),
      source_of_funds: ZerohashHelper.mapSourceOfFundsToZeroHash(payload.sourceOfFunds),
      industry: ZerohashHelper.mapOccupationToIndustry(payload.industry),
    };

    try {
      await this.patch<ZerohashParticipantUpdateResponse, ZerohashParticipantUpdateRequest>(
        `/participants/customers/${payload.userRef}`,
        zerohashPayload,
      );

      this.logger.log(`Updated participant ${payload.userRef}`);
    } catch (updateErr: any) {
      this.logger.error(`Failed to update participant ${payload.userRef}: ${updateErr.message}`);
      if (updateErr.response) {
        this.logger.error(`Zerohash update status: ${updateErr.response.status}`);
        this.logger.error(`Zerohash update data: ${JSON.stringify(updateErr.response.data, null, 2)}`);
      }
      throw new BadGatewayException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }

  public async createDepositAddress(payload: DepositAddressCreateRequest): Promise<DepositAddressCreateResponse> {
    // Use the asset provided in the payload
    const asset = payload.asset;

    this.logger.log(`Creating ZeroHash deposit address for participant: ${payload.userRef}, asset: ${asset}`);

    // Map camelCase payload to snake_case ZeroHash API format
    const zerohashRequest: ZerohashDepositAddressCreateRequest = {
      participant_code: payload.userRef,
      asset: asset,
    };

    try {
      const response = await this.post<
        ZerohashDepositAddressCreateWrappedResponse,
        ZerohashDepositAddressCreateRequest
      >('/deposits/digital_asset_addresses', zerohashRequest);

      this.logger.log(`Created ZeroHash deposit address: ${response.data.message.address}`);

      return {
        address: response.data.message.address,
        asset: response.data.message.asset,
        userRef: response.data.message.participant_code,
        createdAt: response.data.message.created_at,
      };
    } catch (error) {
      this.logger.error(`Failed to create ZeroHash deposit address: ${error.message}`);
      if (error.response) {
        this.logger.error(`Zerohash response status: ${error.response.status}`);
        this.logger.error(`Zerohash response data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      throw new BadGatewayException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }

  public async getDepositAddress(payload: DepositAddressFetchRequest): Promise<DepositAddressFetchResponse> {
    this.logger.log(
      `Fetching ZeroHash deposit address for participant: ${payload.participantCode}, asset: ${payload.asset}`,
    );

    try {
      const response = await this.get<ZerohashDepositAddressFetchWrappedResponse>(
        `/deposits/digital_asset_addresses?participant_code=${payload.participantCode}&asset=${payload.asset}`,
      );

      const addresses = response.data.message;

      // If no addresses found, return empty response
      if (!addresses || addresses.length === 0) {
        this.logger.log(
          `No deposit address found for participant: ${payload.participantCode}, asset: ${payload.asset}`,
        );
        return {};
      }

      // Return the first address found (there should only be one per participant/asset combination)
      const depositAddress = addresses[0];
      this.logger.log(`Found ZeroHash deposit address: ${depositAddress.address}`);

      return {
        address: depositAddress.address,
        asset: depositAddress.asset,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch ZeroHash deposit address: ${error.message}`);
      if (error.response) {
        this.logger.error(`Zerohash response status: ${error.response.status}`);
        this.logger.error(`Zerohash response data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      throw new BadGatewayException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }

  public async getKycStatus(payload: GetKycStatusRequest): Promise<GetKycStatusResponse> {
    this.logger.log(`Getting KYC status for ZeroHash participant ${payload.userRef}`);

    try {
      const response = await this.get<ZerohashKycStatusResponse>(`/participant/${payload.userRef}/kyc_status`);

      const data = response.data.message;

      return {
        userRef: data.participant_code,
        identityVerification: data.idv,
        livenessVerification: data.liveness_check,
        taxIdNumberProvided: data.tax_id,
        isEnhancedDueDiligence: data.edd,
        tags: data.tags,
        status: data.participant_status,
        verificationAttempts: data.kyc_attempts,
        isEnhancedDueDiligenceRequired: data.edd_required,
      };
    } catch (error) {
      this.logger.error(`Failed to get ZeroHash KYC status: ${error.message}`);
      if (error.response) {
        this.logger.error(`Zerohash response status: ${error.response.status}`);
        this.logger.error(`Zerohash response data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      throw new BadGatewayException(ZEROHASH_SERVICE_UNAVAILABLE_MESSAGE);
    }
  }
}
