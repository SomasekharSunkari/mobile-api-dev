import { Knex } from 'knex';
import { DatabaseTables } from '../../database.table';
import { COUNTRIES } from '../data/countries';

export async function seed(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // Inserts seed entries
    await trx.withSchema('api_service').table(DatabaseTables.countries).insert(COUNTRIES);
  });
}
