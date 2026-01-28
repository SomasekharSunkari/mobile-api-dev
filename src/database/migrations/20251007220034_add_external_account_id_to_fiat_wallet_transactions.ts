import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.fiat_wallet_transactions);

    if (tableExists) {
      Logger.log('Adding external_account_id column to fiat_wallet_transactions table');

      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.fiat_wallet_transactions, 'external_account_id');

      if (!columnExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.fiat_wallet_transactions, (tableBuilder) => {
            tableBuilder
              .string('external_account_id')
              .nullable()
              .comment('Reference to external account used for the transaction');

            // Add foreign key constraint
            tableBuilder
              .foreign('external_account_id')
              .references('id')
              .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.external_accounts}`)
              .onDelete('SET NULL');
          });

        Logger.log('external_account_id column added to fiat_wallet_transactions table');
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.fiat_wallet_transactions);

    if (tableExists) {
      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.fiat_wallet_transactions, 'external_account_id');

      if (columnExists) {
        Logger.log('Removing external_account_id column from fiat_wallet_transactions table');

        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.fiat_wallet_transactions, (tableBuilder) => {
            tableBuilder.dropForeign(['external_account_id']);
            tableBuilder.dropColumn('external_account_id');
          });

        Logger.log('external_account_id column removed from fiat_wallet_transactions table');
      }
    }
  });
}
