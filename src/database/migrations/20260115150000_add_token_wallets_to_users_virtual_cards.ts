import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

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
      .hasColumn(DatabaseTables.users_virtual_cards, 'token_wallets');

    if (columnExists) {
      Logger.log('token_wallets column already exists on users_virtual_cards table');
    } else {
      Logger.log('Adding token_wallets column to users_virtual_cards table');
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users_virtual_cards, (table) => {
        table
          .string('token_wallets')
          .nullable()
          .comment('Comma-separated list of digital wallet providers (e.g., apple,google)');
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
      .hasColumn(DatabaseTables.users_virtual_cards, 'token_wallets');

    if (columnExists) {
      Logger.log('Dropping token_wallets column from users_virtual_cards table');
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users_virtual_cards, (table) => {
        table.dropColumn('token_wallets');
      });
    }
  });
}
