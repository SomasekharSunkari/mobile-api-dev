import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

/**
 * Seed to remove tier level 1 and all its related records
 * - user_tiers linked to tier level 1
 * - tier_config_verification_requirements linked to tier configs of tier level 1
 * - tier_configs linked to tier level 1
 * - tier level 1 itself
 */
export async function seed(knex: Knex): Promise<void> {
  const tierLevel1Id = 'cmakyv2rt000d2v6mqxjnqarp';

  await knex.transaction(async (trx) => {
    // Defer constraint checks until end of transaction
    await trx.raw('SET CONSTRAINTS ALL DEFERRED');

    // Get all tier_config ids linked to tier level 1
    const tierConfigs = await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.tier_configs)
      .where('tier_id', tierLevel1Id)
      .select('id');

    const tierConfigIds = tierConfigs.map((config) => config.id);

    // Delete tier_config_verification_requirements linked to these tier_configs
    if (tierConfigIds.length > 0) {
      await trx
        .withSchema(DatabaseSchema.apiService)
        .table(DatabaseTables.tier_config_verification_requirements)
        .whereIn('tier_config_id', tierConfigIds)
        .del();
    }

    // Delete tier_configs linked to tier level 1
    await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.tier_configs)
      .where('tier_id', tierLevel1Id)
      .del();

    // Delete user_tiers linked to tier level 1
    await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.user_tiers)
      .where('tier_id', tierLevel1Id)
      .del();

    // Delete tier level 1
    await trx.withSchema(DatabaseSchema.apiService).table(DatabaseTables.tiers).where('id', tierLevel1Id).del();
  });
}
