import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    try {
      Logger.log('Adding parent_exchange_transaction_id column to card_transactions table');

      const hasColumn = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.card_transactions, 'parent_exchange_transaction_id');

      if (hasColumn) {
        Logger.log('parent_exchange_transaction_id column already exists, skipping');
        return;
      }

      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.card_transactions, (table) => {
        table.string('parent_exchange_transaction_id').nullable();
        table
          .foreign('parent_exchange_transaction_id')
          .references('id')
          .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.transactions}`)
          .onDelete('SET NULL');
      });

      Logger.log('Successfully added parent_exchange_transaction_id column to card_transactions table');
    } catch (error) {
      Logger.error('Error adding parent_exchange_transaction_id column to card_transactions table', error);
      throw error;
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    try {
      Logger.log('Removing parent_exchange_transaction_id column from card_transactions table');

      const hasColumn = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.card_transactions, 'parent_exchange_transaction_id');

      if (!hasColumn) {
        Logger.log('parent_exchange_transaction_id column does not exist, skipping');
        return;
      }

      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.card_transactions, (table) => {
        table.dropForeign('parent_exchange_transaction_id');
        table.dropColumn('parent_exchange_transaction_id');
      });

      Logger.log('Successfully removed parent_exchange_transaction_id column from card_transactions table');
    } catch (error) {
      Logger.error('Error removing parent_exchange_transaction_id column from card_transactions table', error);
      throw error;
    }
  });
}
