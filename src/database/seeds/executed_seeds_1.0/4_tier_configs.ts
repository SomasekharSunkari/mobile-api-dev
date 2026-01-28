import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { NigeriaTierConfigData } from '../data/tierConfig/ngnTierConfig';
import { USATierConfigData } from '../data/tierConfig/usaTierConfig';

export async function seed(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // Defer constraint checks until end of transaction
    await trx.raw('SET CONSTRAINTS ALL DEFERRED');

    // Deletes ALL existing entries
    await trx.withSchema(DatabaseSchema.apiService).table(DatabaseTables.tier_configs).del();

    // Inserts seed entries
    await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.tier_configs)
      .insert([...NigeriaTierConfigData, ...USATierConfigData]);
  });
}
