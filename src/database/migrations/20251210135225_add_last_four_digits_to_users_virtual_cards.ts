import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

/**
 * Migration: Add last_four_digits column to users_virtual_cards
 *
 * Purpose:
 * - Persist the masked PAN suffix returned by the card provider for user display and notifications.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.users_virtual_cards);

    if (!tableExists) {
      Logger.warn('users_virtual_cards table does not exist, skipping migration');
      return;
    }

    const columnExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasColumn(DatabaseTables.users_virtual_cards, 'last_four_digits');

    if (columnExists) {
      Logger.log('last_four_digits column already exists on users_virtual_cards table');
    } else {
      Logger.log('Adding last_four_digits column to users_virtual_cards table');
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users_virtual_cards, (table) => {
        table.string('last_four_digits', 4).nullable().comment('Last 4 digits of the card PAN (masked storage)');
      });
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.users_virtual_cards);

    if (!tableExists) return;

    const columnExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasColumn(DatabaseTables.users_virtual_cards, 'last_four_digits');

    if (columnExists) {
      Logger.log('Dropping last_four_digits column from users_virtual_cards table');
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users_virtual_cards, (table) => {
        table.dropColumn('last_four_digits');
      });
    }
  });
}
