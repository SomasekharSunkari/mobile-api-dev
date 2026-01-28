import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  Logger.log('Adding scheduled_deletion_at column to virtual_accounts table');

  const hasColumn = await knex.schema
    .withSchema(DatabaseSchema.apiService)
    .hasColumn(DatabaseTables.virtual_accounts, 'scheduled_deletion_at');

  if (!hasColumn) {
    await knex.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.virtual_accounts, (table) => {
      table.timestamp('scheduled_deletion_at').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  Logger.log('Removing scheduled_deletion_at column from virtual_accounts table');

  const hasColumn = await knex.schema
    .withSchema(DatabaseSchema.apiService)
    .hasColumn(DatabaseTables.virtual_accounts, 'scheduled_deletion_at');

  if (hasColumn) {
    await knex.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.virtual_accounts, (table) => {
      table.dropColumn('scheduled_deletion_at');
    });
  }
}
