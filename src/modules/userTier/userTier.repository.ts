import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../database';
import { UserTierModel } from '../../database/models/userTier/userTier.model';

@Injectable()
export class UserTierRepository extends BaseRepository<UserTierModel> {
  constructor() {
    super(UserTierModel);
  }

  /**
   * Find all user tiers with full relationship graph including tier configs and verification requirements
   */
  async findByUserWithTierDetails(userId: string): Promise<UserTierModel[]> {
    const userTiers = await this.query()
      .where({ user_id: userId })
      .withGraphJoined(
        'tier.tierConfigs as tc.[country, tierConfigVerificationRequirements as tcvr.verificationRequirement as vr]',
      )
      .orderBy('tier.level', 'asc');

    return this.transformAliasedResults(userTiers);
  }

  /**
   * Transform aliased query results back to proper model structure
   */
  private transformAliasedResults(userTiers: any[]): UserTierModel[] {
    return userTiers.map((userTier) => {
      if (userTier.tier?.tc) {
        userTier.tier.tierConfigs = userTier.tier.tc.map((tc: any) => {
          if (tc.tcvr) {
            tc.tierConfigVerificationRequirements = tc.tcvr.map((tcvr: any) => {
              if (tcvr.vr) {
                tcvr.verificationRequirement = tcvr.vr;
                delete tcvr.vr;
              }
              return tcvr;
            });
            delete tc.tcvr;
          }
          return tc;
        });
        delete userTier.tier.tc;
      }
      return userTier as UserTierModel;
    });
  }

  /**
   * Find a specific user tier by user and tier ID
   */
  async findByUserAndTier(userId: string, tierId: string): Promise<UserTierModel | undefined> {
    const userTier = await this.query()
      .where({ user_id: userId, tier_id: tierId })
      .withGraphFetched(
        'tier.tierConfigs as tc.[country, tierConfigVerificationRequirements as tcvr.verificationRequirement as vr]',
      )
      .first();

    if (!userTier) {
      return undefined;
    }

    const transformed = this.transformAliasedResults([userTier]);
    return transformed[0];
  }

  /**
   * Create user tier record if it doesn't exist
   */
  async createIfNotExists(userId: string, tierId: string): Promise<UserTierModel> {
    const existing = await this.query().findOne({ user_id: userId, tier_id: tierId });

    if (existing) {
      return existing as UserTierModel;
    }

    return this.create({ user_id: userId, tier_id: tierId });
  }
}
