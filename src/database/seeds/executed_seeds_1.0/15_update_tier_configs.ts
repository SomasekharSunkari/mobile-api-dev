import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { NigeriaTierConfigData } from '../data/tierConfig/ngnTierConfig';
import { USATierConfigData } from '../data/tierConfig/usaTierConfig';

/**
 * Seed to update tier_configs and remove obsolete ones
 * - Deletes tier_config_verification_requirements for tier_configs not in updated data
 * - Deletes tier_configs not in updated data
 * - Upserts tier_configs from NigeriaTierConfigData and USATierConfigData
 */
export async function seed(knex: Knex): Promise<void> {
  const allTierConfigs = [...NigeriaTierConfigData, ...USATierConfigData];
  const validTierConfigIds = allTierConfigs.map((config) => config.id);

  await knex.transaction(async (trx) => {
    // Defer constraint checks until end of transaction
    await trx.raw('SET CONSTRAINTS ALL DEFERRED');

    // Delete tier_config_verification_requirements for tier_configs not in updated data
    await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.tier_config_verification_requirements)
      .whereNotIn('tier_config_id', validTierConfigIds)
      .del();

    // Delete tier_configs not in updated data
    await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.tier_configs)
      .whereNotIn('id', validTierConfigIds)
      .del();

    // Upsert tier_configs
    for (const tierConfig of allTierConfigs) {
      await trx
        .withSchema(DatabaseSchema.apiService)
        .table(DatabaseTables.tier_configs)
        .insert(tierConfig)
        .onConflict('id')
        .merge();
    }
  });
}
