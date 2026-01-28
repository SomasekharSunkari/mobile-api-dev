import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

/**
 * Seed to rename tiers after removing tier level 1
 * - tier2 => tier1 (level 1, active)
 * - tier3 => tier2 (level 2, active)
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // Update tier2 to tier1
    await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.tiers)
      .where('id', 'cmdwb8gtw00012v6ni5k5n13u') // ID for tier1 renamed to tier2
      .update({
        name: 'tier1',
        level: 1,
        status: 'active',
      });

    // Update tier3 to tier2
    await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.tiers)
      .where('id', 'cma6yixxx0003w5miabcde123') // ID for tier3 renamed to tier2
      .update({
        name: 'tier2',
        level: 2,
        status: 'active',
      });
  });
}
