import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { BANKS } from '../data/banks';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex.withSchema(DatabaseSchema.apiService).table(DatabaseTables.banks).del();

  // Inserts seed entries
  await knex.withSchema(DatabaseSchema.apiService).table(DatabaseTables.banks).insert(BANKS);
}
