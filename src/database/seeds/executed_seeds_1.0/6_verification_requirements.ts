import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { VERIFICATION_REQUIREMENTS } from '../data/verification_requirements';

export async function seed(knex: Knex): Promise<void> {
  await knex.withSchema(DatabaseSchema.apiService).table(DatabaseTables.verification_requirements).del();

  await knex
    .withSchema(DatabaseSchema.apiService)
    .table(DatabaseTables.verification_requirements)
    .insert(VERIFICATION_REQUIREMENTS);
}
