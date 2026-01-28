import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  await knex.withSchema(DatabaseSchema.apiService).table(DatabaseTables.tiers).del();

  // Inserts seed entries
  await knex
    .withSchema(DatabaseSchema.apiService)
    .table(DatabaseTables.tiers)
    .insert([
      {
        id: 'cmakyv2rt000d2v6mqxjnqarp',
        name: 'tier1',
        level: 1,
        status: 'active',
      },
      {
        id: 'cmdwb8gtw00012v6ni5k5n13u',
        name: 'tier2',
        level: 2,
        status: 'inactive',
      },
      {
        id: 'cma6yixxx0003w5miabcde123',
        name: 'tier3',
        level: 3,
        status: 'active',
      },
    ]);
}
