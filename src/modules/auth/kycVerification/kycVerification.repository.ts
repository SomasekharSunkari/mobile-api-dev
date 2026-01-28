import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../database/base';
import { KycVerificationEnum } from '../../../database/models/kycVerification/kycVerification.interface';
import { KycVerificationModel } from '../../../database/models/kycVerification/kycVerification.model';

@Injectable()
export class KycVerificationRepository extends BaseRepository<KycVerificationModel> {
  constructor() {
    super(KycVerificationModel);
  }

  async findByUserId(userId: string): Promise<KycVerificationModel | undefined> {
    const result = await this.query().findOne({ user_id: userId });
    return result as KycVerificationModel;
  }

  async findByProviderRef(providerRef: string): Promise<KycVerificationModel | undefined> {
    const result = await this.query().findOne({ provider_ref: providerRef });
    return result as KycVerificationModel;
  }

  async findOrCreate(
    whereFilter: Partial<KycVerificationModel>,
    createPayload: Partial<KycVerificationModel>,
  ): Promise<KycVerificationModel> {
    const existingRecord = await this.query().findOne(whereFilter);

    if (existingRecord) {
      return existingRecord as KycVerificationModel;
    }

    return this.create(createPayload);
  }

  /**
   * Find all verifications for a user within a specific tier config
   */
  async findUserVerificationsForTierConfig(userId: string, tierConfigId: string): Promise<KycVerificationModel[]> {
    const verifications = await this.query().where({
      user_id: userId,
      tier_config_id: tierConfigId,
    });

    return verifications as KycVerificationModel[];
  }

  /**
   * Find approved verifications for a user matching specific verification requirement IDs
   */
  async findUserApprovedVerifications(
    userId: string,
    tierConfigVerificationRequirementIds: string[],
  ): Promise<KycVerificationModel[]> {
    if (tierConfigVerificationRequirementIds.length === 0) {
      return [];
    }

    const verifications = await this.query()
      .where({ user_id: userId, status: KycVerificationEnum.APPROVED })
      .whereIn('tier_config_verification_requirement_id', tierConfigVerificationRequirementIds);

    return verifications as KycVerificationModel[];
  }
}
