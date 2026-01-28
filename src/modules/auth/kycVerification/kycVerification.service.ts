import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { Knex } from 'knex';
import { add } from 'mathjs';
import Objection from 'objection';
import { KYCAdapter } from '../../../adapters/kyc/kyc-adapter';
import { SumsubAdapter } from '../../../adapters/kyc/sumsub/sumsub.adapter';
import { SumsubAddressKeyValue, SumsubInfoAddress } from '../../../adapters/kyc/sumsub/sumsub.interface';
import { EnvironmentService } from '../../../config';
import { IPaginatedResponse } from '../../../database';
import {
  IKycVerification,
  KycVerificationEnum,
} from '../../../database/models/kycVerification/kycVerification.interface';
import { KycVerificationModel } from '../../../database/models/kycVerification/kycVerification.model';
import { TierModel } from '../../../database/models/tier';
import { TierConfigModel } from '../../../database/models/tierConfig/tierConfig.model';
import { TierRepository } from '../../tier';
import { TierConfigService } from '../../tierConfig/tierConfig.service';
import { UserTierRepository } from '../../userTier/userTier.repository';
import { KycStatusLogService } from '../kycStatusLog/kycStatusLog.service';
import { UserRepository } from '../user/user.repository';
import { InitiateWidgetKycDto } from './dto/generateSumsubAccessToken.dto';
import { RestartKycVerificationDto } from './dto/restartKycVerification.dto';
import { KycVerificationRepository } from './kycVerification.repository';

@Injectable()
export class KycVerificationService {
  private readonly logger = new Logger(KycVerificationService.name);

  private readonly TIER_ONE_VERIFICATION_LEVEL = 1;
  private readonly TIER_TWO_VERIFICATION_LEVEL = 2;

  @Inject(KycVerificationRepository)
  private readonly kycVerificationRepository: KycVerificationRepository;

  @Inject(KYCAdapter)
  private readonly kycAdapter: KYCAdapter;

  @Inject(KycStatusLogService)
  private readonly kycStatusLogService: KycStatusLogService;

  @Inject(UserRepository)
  private readonly userRepository: UserRepository;

  @Inject(TierConfigService)
  private readonly tierConfigService: TierConfigService;

  @Inject(TierRepository)
  private readonly tierRepository: TierRepository;

  @Inject(UserTierRepository)
  private readonly userTierRepository: UserTierRepository;

  @Inject(SumsubAdapter)
  private readonly sumsubAdapter: SumsubAdapter;

  constructor() {}

  /**
   * Finds an existing KYC record by user ID.
   */
  async findByUserId(userId: string): Promise<KycVerificationModel | undefined> {
    return await this.kycVerificationRepository.findByUserId(userId);
  }

  async findUserKycVerifications(userId: string): Promise<IPaginatedResponse<KycVerificationModel>> {
    const kycVerifications = await this.kycVerificationRepository.findAll({ user_id: userId });
    return kycVerifications;
  }

  /**
   * Updates a KYC record by ID.
   */
  async updateKycStatus(kycId: string, updates: Partial<IKycVerification>, trx?: Knex.Transaction): Promise<void> {
    await this.kycVerificationRepository.update(kycId, updates, { trx: trx });
  }

  async initiateWidgetKyc(userId: string, dto: InitiateWidgetKycDto) {
    this.logger.log('KycVerificationService.initiateWidgetKyc', userId);
    try {
      const { verification_type } = dto;
      const user = await this.userRepository.findById(userId, '[country]');
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const level = this.tierConfigService.mapSumsubVerificationTypeToTierLevel(verification_type);
      const tier = (await this.tierRepository
        .query()
        .findOne({ level })
        .withGraphFetched('tierConfigs.tierConfigVerificationRequirements')) as TierModel;

      if (!tier?.tierConfigs) {
        throw new NotFoundException('Tier configuration not found');
      }

      const tiersToProcess: TierModel[] = [tier];

      // implement initiateWidget kyc to return the access token
      const initiatedWidgetKyc = await this.kycAdapter.initiateWidgetKyc({
        userId,
        email: user.email,
        phoneNumber: user.phone_number,
        kycVerificationType: verification_type,
      });

      if (!initiatedWidgetKyc?.token) {
        throw new BadRequestException('Failed to initiate KYC Process: Invalid token');
      }

      // Intentionally skip creating KYC verification records for tier-two verification
      // as per product team request to test address verification on users without prior verifications.
      if (verification_type?.toLowerCase() === 'tier-two-verification') {
        return {
          token: initiatedWidgetKyc.token,
          userId: initiatedWidgetKyc.userId,
          kycVerificationType: initiatedWidgetKyc.kycVerificationType,
          verificationUrl: EnvironmentService.isDevelopment()
            ? this.sumsubVerificationUrl(initiatedWidgetKyc.token)
            : undefined,
        };
      }

      const providerName = this.kycAdapter.getProviderName(user.country.code);

      // Create kyc_verification records for each tier and verification requirement in user's country
      // Wrap in a single transaction to ensure atomicity
      await this.kycVerificationRepository.transaction(async (trx) => {
        for (const tier of tiersToProcess) {
          await this.processTierVerificationRequirements(
            tier,
            userId,
            user.country_id,
            providerName,
            initiatedWidgetKyc.kycVerificationType,
            trx,
          );
        }
      });

      return {
        token: initiatedWidgetKyc.token,
        userId: initiatedWidgetKyc.userId,
        kycVerificationType: initiatedWidgetKyc.kycVerificationType,
        verificationUrl: EnvironmentService.isDevelopment()
          ? this.sumsubVerificationUrl(initiatedWidgetKyc.token)
          : undefined,
      };
    } catch (error) {
      this.logger.error(error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error?.message);
    }
  }

  async restartWidgetKyc(userId: string, dto: RestartKycVerificationDto) {
    this.logger.log('KycVerificationService.restartWidgetKyc', userId);
    try {
      const { verification_type } = dto;
      const user = await this.userRepository.findById(userId, '[country]');
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user has KYC verification records
      const kycVerifications = await this.kycVerificationRepository.query().where({ user_id: userId });

      if (!kycVerifications || kycVerifications.length === 0) {
        throw new NotFoundException('No KYC verification records found for user');
      }

      // Check if any KYC verification is approved
      const hasApprovedKyc = kycVerifications.some(
        (kyc) => (kyc as KycVerificationModel).status === KycVerificationEnum.APPROVED,
      );

      if (hasApprovedKyc) {
        throw new BadRequestException('Cannot restart KYC process: User has approved KYC verification');
      }

      // Get the provider_ref from the first KYC verification record
      const kycRecord = kycVerifications[0] as KycVerificationModel;
      if (!kycRecord.provider_ref) {
        throw new BadRequestException('No provider reference found for KYC verification');
      }

      const applicantId = kycRecord.provider_ref;

      // Reset the applicant in Sumsub
      await this.kycAdapter.resetApplicant({ applicantId });
      this.logger.log(`Reset applicant: ${applicantId}`);

      // Clear tax identifier
      await this.kycAdapter.updateApplicantTaxInfo({ applicantId, tin: '' });
      this.logger.log(`Cleared tax info for applicant: ${applicantId}`);

      // Initiate widget KYC to get new access token
      const initiatedWidgetKyc = await this.kycAdapter.initiateWidgetKyc({
        userId,
        email: user.email,
        phoneNumber: user.phone_number,
        kycVerificationType: verification_type,
      });

      if (!initiatedWidgetKyc?.token) {
        throw new BadRequestException('Failed to restart KYC Process: Invalid token');
      }

      return {
        token: initiatedWidgetKyc.token,
        userId: initiatedWidgetKyc.userId,
        kycVerificationType: initiatedWidgetKyc.kycVerificationType,
        verificationUrl: EnvironmentService.isDevelopment()
          ? this.sumsubVerificationUrl(initiatedWidgetKyc.token)
          : undefined,
      };
    } catch (error) {
      this.logger.error(error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error?.message);
    }
  }

  private async processTierVerificationRequirements(
    tier: TierModel,
    userId: string,
    countryId: string,
    providerName: string,
    kycVerificationType: string,
    trx: Objection.Transaction,
  ) {
    for (const tierConfig of tier.tierConfigs) {
      if (tierConfig.country_id !== countryId) {
        continue;
      }

      const verificationRequirements = tierConfig.tierConfigVerificationRequirements || [];

      if (verificationRequirements.length === 0) {
        this.logger.warn(`No verification requirements found for tier config ${tierConfig.id}`);
        continue;
      }

      for (const verificationRequirement of verificationRequirements) {
        const existing = (await this.kycVerificationRepository.query(trx).findOne({
          user_id: userId,
          tier_config_verification_requirement_id: verificationRequirement.id,
        })) as KycVerificationModel | undefined;

        if (existing) {
          await this.updateExistingKycRecord(existing, kycVerificationType, trx);
        } else {
          await this.createNewKycRecord(
            userId,
            providerName,
            kycVerificationType,
            tierConfig.id,
            verificationRequirement.id,
            trx,
          );
        }
      }
    }
  }

  private async updateExistingKycRecord(existing: KycVerificationModel, kycVerificationType: string, trx: any) {
    await this.kycVerificationRepository.update(
      existing.id,
      {
        status: KycVerificationEnum.PENDING,
        provider_verification_type: kycVerificationType,
        attempt: add(existing.attempt, 1),
      },
      { trx },
    );

    await this.kycStatusLogService.logStatusChange(
      existing.id,
      existing.status,
      KycVerificationEnum.PENDING,
      'User restarted KYC process.',
      trx,
    );
  }

  private async createNewKycRecord(
    userId: string,
    providerName: string,
    kycVerificationType: string,
    tierConfigId: string,
    verificationRequirementId: string,
    trx: any,
  ) {
    const kycRecord = await this.kycVerificationRepository.create(
      {
        user_id: userId,
        provider: providerName,
        status: KycVerificationEnum.NOT_STARTED,
        provider_verification_type: kycVerificationType,
        attempt: 1,
        tier_config_id: tierConfigId,
        tier_config_verification_requirement_id: verificationRequirementId,
      },
      trx,
    );

    await this.kycStatusLogService.logStatusChange(
      kycRecord.id,
      KycVerificationEnum.NOT_STARTED,
      KycVerificationEnum.NOT_STARTED,
      'User initiated KYC process.',
      trx,
    );
  }

  private sumsubVerificationUrl(accessToken: string) {
    const PORT = EnvironmentService.getValue('APP_PORT');
    return `http://localhost:${PORT}/views/sumsub/verification?accessToken=${accessToken}`;
  }

  /**
   * Ensures user_tier record exists for a verified KYC
   * Called when a KYC verification is approved to track user tier progress
   */
  async ensureUserTierRecord(kycVerification: KycVerificationModel): Promise<void> {
    try {
      if (!kycVerification.tier_config_id) {
        this.logger.warn(`KYC verification ${kycVerification.id} has no tier_config_id, skipping user_tier creation`);
        return;
      }

      const tierConfig = await this.tierConfigService.findOne(kycVerification.tier_config_id);

      if (!tierConfig) {
        this.logger.warn(`Tier config ${kycVerification.tier_config_id} not found, skipping user_tier creation`);
        return;
      }

      await this.userTierRepository.createIfNotExists(kycVerification.user_id, tierConfig.tier_id);

      this.logger.log(
        `Ensured user_tier record exists for user ${kycVerification.user_id} and tier ${tierConfig.tier_id}`,
      );
    } catch (error) {
      this.logger.error(`Error ensuring user_tier record for KYC ${kycVerification.id}: ${error.message}`, error.stack);
    }
  }

  async getRecentKycStatus(userId: string): Promise<{
    tier_level: number;
    status: KycVerificationEnum;
  }> {
    const kycRecords = (await this.kycVerificationRepository
      .query()
      .select('tier_config_id', 'status')
      .max('created_at as latest_created_at')
      .where({ user_id: userId })
      .groupBy('tier_config_id', 'status')
      .orderBy('latest_created_at', 'desc')
      .withGraphFetched('tierConfig.tier')) as unknown as {
      tier_config_id: string;
      status: KycVerificationEnum;
      latest_created_at: string;
      tierConfig: TierConfigModel & { tier: TierModel };
    }[];

    if (kycRecords.length === 0) {
      return {
        tier_level: 1,
        status: KycVerificationEnum.NOT_STARTED,
      };
    }

    // sort tiers by the highest level
    const sortedTiers = [...kycRecords].sort(
      (a, b) => (b?.tierConfig?.tier?.level ?? 0) - (a?.tierConfig?.tier?.level ?? 0),
    );

    // map the tiers to level and status e.g. { level: 1, status: 'pending' }
    const tiers = sortedTiers.map((kyc) => ({
      tier_level: kyc.tierConfig?.tier?.level,
      status: kyc.status,
    }));

    return tiers[0];
  }

  async moveMetadataAddressToSumsubInfoAddress(): Promise<{ noOfUsersAffected: number; noOfUsersResolved: number }> {
    // get the kyc verifications from 24th december 2025 to 13th january 2026
    const kycVerifications = (await this.kycVerificationRepository
      .query()
      .where('provider', 'sumsub')
      .andWhere('status', 'approved')) as KycVerificationModel[];

    const userIds = new Set(kycVerifications.map((verifications) => verifications.user_id));
    const noOfUsersAffected = [];
    const noOfUsersResolved = [];

    // get these userIds applicant data from sumsub
    for (const userId of userIds) {
      const userApplicantDatas = await this.sumsubAdapter.getKycDetailsByUserIdWithTransform(userId);
      console.log(
        '🚀 ~~ updateUsersKycApplicantInfo ~~ userApplicantDatas:',
        userApplicantDatas.fixedInfo,
        userApplicantDatas.fixedInfo.addresses,
        userApplicantDatas.metadata,
      );

      // check if the applicant has a metadata or does not have a postal code in the fixed info
      const applicantAddressPostalCode = userApplicantDatas.fixedInfo?.addresses?.[0]?.postCode;
      if (userApplicantDatas.metadata && userApplicantDatas.metadata.length > 0 && !applicantAddressPostalCode) {
        // transform the metadata to sumsub info address
        const addressFromMetadata = this.transformMetadataToAddress(
          userApplicantDatas.metadata,
          userApplicantDatas.fixedInfo?.country || 'NGA',
        );

        noOfUsersAffected.push(userId);

        console.log('🚀 ~~ Transformed address from metadata:', addressFromMetadata);

        const response = await this.sumsubAdapter.updateApplicantFixedInfo(userApplicantDatas.id, {
          addresses: [addressFromMetadata as SumsubInfoAddress],
        });

        if (response) {
          noOfUsersResolved.push(userId);
        }
      }
    }

    return {
      noOfUsersAffected: noOfUsersAffected.length,
      noOfUsersResolved: noOfUsersResolved.length,
    };
  }

  private transformMetadataToAddress(metadata: SumsubAddressKeyValue[], country: string): Partial<SumsubInfoAddress> {
    const addressMap: Record<string, string> = {};

    for (const item of metadata) {
      addressMap[item.key] = item.value;
    }

    return {
      street: addressMap['Street'] || '',
      streetEn: addressMap['Street'] || '',
      town: addressMap['City'] || '',
      townEn: addressMap['City'] || '',
      state: addressMap['State'] || '',
      stateEn: addressMap['State'] || '',
      postCode: addressMap['Postcode'] || '',
      country: country,
    };
  }
}
