import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema
    .withSchema(DatabaseSchema.apiService)
    .hasColumn(DatabaseTables.virtual_accounts, 'type');

  if (!hasColumn) {
    await knex.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.virtual_accounts, (table) => {
      table.string('type').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.virtual_accounts, (table) => {
    table.dropColumn('type');
  });
}
