import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const hasColumn = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasColumn(DatabaseTables.users_virtual_cards, 'insufficient_funds_decline_count');

    if (!hasColumn) {
      Logger.log('Adding insufficient_funds_decline_count column to users_virtual_cards table');

      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users_virtual_cards, (table) => {
        table
          .integer('insufficient_funds_decline_count')
          .defaultTo(0)
          .notNullable()
          .comment('Count of consecutive declined transactions due to insufficient funds');
      });

      Logger.log('Added insufficient_funds_decline_count column to users_virtual_cards table');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const hasColumn = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasColumn(DatabaseTables.users_virtual_cards, 'insufficient_funds_decline_count');

    if (hasColumn) {
      Logger.log('Removing insufficient_funds_decline_count column from users_virtual_cards table');

      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users_virtual_cards, (table) => {
        table.dropColumn('insufficient_funds_decline_count');
      });

      Logger.log('Removed insufficient_funds_decline_count column from users_virtual_cards table');
    }
  });
}
