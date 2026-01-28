import { createId } from '@paralleldrive/cuid2';
import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { KycVerificationEnum } from '../../models/kycVerification/kycVerification.interface';

// Tier 1 tier_config ids by country
const TIER_1_CONFIG_IDS = {
  nigeria: 'cmakvoh1k000008lae5kl7uyk',
  usa: 'cmakvvocg00012v6mzvfixlk8',
};

// Tier 1 verification requirements by tier_config_id
const TIER_1_VERIFICATION_REQUIREMENTS = {
  // Nigeria Tier 1
  [TIER_1_CONFIG_IDS.nigeria]: [
    'cmf2h9nz5000runmichplfdbq',
    'cmh9b2kxt00072v6lbvn1ngr1',
    'cmf2h9nz5000uunmiga1r6aji',
    'cmf2h9nz5000yunmi9s0e4ajt',
    'cmh97890400042v6lzeupjp8e',
    'cmh978dkd00052v6lpvi96dhy',
    'cmh978gsv00062v6lfyqx0fds',
  ],
  // USA Tier 1
  [TIER_1_CONFIG_IDS.usa]: [
    'cmf2h9nz60016unmi2ryl778a',
    'cmf2h9nz60017unmi1k5v9j28',
    'cmf2h9nz60018unmi4el418ga',
    'cmh975fet00022v6lbfrp2e2d',
    'cmh975ixg00032v6lz43v9544',
    'cmh975j5e00042v6lrl385w6v',
    'cmh9c3phn00082v6lphone1us',
    'cmh9c3phn00092v6laddrs1us',
  ],
};

// All valid tier 1 verification requirement ids
const ALL_TIER_1_REQUIREMENT_IDS = [
  ...TIER_1_VERIFICATION_REQUIREMENTS[TIER_1_CONFIG_IDS.nigeria],
  ...TIER_1_VERIFICATION_REQUIREMENTS[TIER_1_CONFIG_IDS.usa],
];

/**
 * Seed to sync approved kyc_verifications to new tier 1 requirements
 * - For users with approved kyc_verifications, ensure they have all tier 1 requirements approved
 * - Delete any kyc_verifications not related to tier 1 requirements for those users
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // Defer constraint checks until end of transaction
    await trx.raw('SET CONSTRAINTS ALL DEFERRED');

    // Get all users with at least one approved kyc_verification
    const approvedUsers = await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.kyc_verifications)
      .where('status', 'approved')
      .distinct('user_id')
      .select('user_id');

    for (const { user_id } of approvedUsers) {
      // Get the user's tier_config_id from their existing kyc_verifications
      const existingKyc = await trx
        .withSchema(DatabaseSchema.apiService)
        .table(DatabaseTables.kyc_verifications)
        .where('user_id', user_id)
        .whereNotNull('tier_config_id')
        .first('tier_config_id');

      if (!existingKyc?.tier_config_id) {
        continue;
      }

      // Determine tier 1 config based on existing tier_config's country
      const tierConfig = await trx
        .withSchema(DatabaseSchema.apiService)
        .table(DatabaseTables.tier_configs)
        .where('id', existingKyc.tier_config_id)
        .first('country_id');

      if (!tierConfig?.country_id) {
        continue;
      }

      // Find the tier 1 config for this country
      const tier1Config = await trx
        .withSchema(DatabaseSchema.apiService)
        .table(DatabaseTables.tier_configs)
        .where('country_id', tierConfig.country_id)
        .where('tier_id', 'cmdwb8gtw00012v6ni5k5n13u') // New tier 1 id
        .first('id');

      if (!tier1Config?.id) {
        continue;
      }

      const tier1RequirementIds = TIER_1_VERIFICATION_REQUIREMENTS[tier1Config.id] || [];

      if (tier1RequirementIds.length === 0) {
        continue;
      }

      // Get an approved kyc_verification as template for new records
      const templateKyc = await trx
        .withSchema(DatabaseSchema.apiService)
        .table(DatabaseTables.kyc_verifications)
        .where('user_id', user_id)
        .where('status', 'approved')
        .first();

      // Ensure approved kyc_verifications exist for all tier 1 requirements
      for (const requirementId of tier1RequirementIds) {
        const existingRequirement = await trx
          .withSchema(DatabaseSchema.apiService)
          .table(DatabaseTables.kyc_verifications)
          .where('user_id', user_id)
          .where('tier_config_verification_requirement_id', requirementId)
          .first();

        if (!existingRequirement) {
          // Create approved kyc_verification for this requirement
          await trx
            .withSchema(DatabaseSchema.apiService)
            .table(DatabaseTables.kyc_verifications)
            .insert({
              id: createId(),
              user_id,
              provider: templateKyc?.provider || 'system',
              provider_ref: templateKyc?.provider_ref,
              attempt: 1,
              status: 'approved',
              tier_config_id: tier1Config.id,
              tier_config_verification_requirement_id: requirementId,
              reviewed_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
        } else if (existingRequirement.status.toLowerCase() !== KycVerificationEnum.APPROVED.toLowerCase()) {
          // Update to approved
          await trx
            .withSchema(DatabaseSchema.apiService)
            .table(DatabaseTables.kyc_verifications)
            .where('id', existingRequirement.id)
            .update({
              status: 'approved',
              tier_config_id: tier1Config.id,
              reviewed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
        }
      }

      // Delete kyc_verifications not related to tier 1 requirements for this user
      await trx
        .withSchema(DatabaseSchema.apiService)
        .table(DatabaseTables.kyc_verifications)
        .where('user_id', user_id)
        .whereNotIn('tier_config_verification_requirement_id', ALL_TIER_1_REQUIREMENT_IDS)
        .del();
    }
  });
}
