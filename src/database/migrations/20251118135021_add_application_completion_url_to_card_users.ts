import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const hasColumn = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasColumn(DatabaseTables.card_users, 'provider_application_completion_url');

    if (!hasColumn) {
      Logger.log('Adding provider_application_completion_url column to card_users table');

      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.card_users, (table) => {
        table
          .text('provider_application_completion_url')
          .nullable()
          .comment('Application completion URL from provider');
      });

      Logger.log('Added provider_application_completion_url column to card_users table');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const hasColumn = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasColumn(DatabaseTables.card_users, 'provider_application_completion_url');

    if (hasColumn) {
      Logger.log('Removing provider_application_completion_url column from card_users table');

      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.card_users, (table) => {
        table.dropColumn('provider_application_completion_url');
      });

      Logger.log('Removed provider_application_completion_url column from card_users table');
    }
  });
}
