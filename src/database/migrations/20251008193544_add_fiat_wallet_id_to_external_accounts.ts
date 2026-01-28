import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.external_accounts);

    if (tableExists) {
      Logger.log('Adding fiat_wallet_id column to external_accounts table');

      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.external_accounts, 'fiat_wallet_id');

      if (!columnExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.external_accounts, (tableBuilder) => {
            tableBuilder
              .string('fiat_wallet_id')
              .nullable()
              .comment('Reference to fiat wallet associated with the external account');

            // Add foreign key constraint
            tableBuilder
              .foreign('fiat_wallet_id')
              .references('id')
              .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}`)
              .onDelete('SET NULL');
          });

        Logger.log('fiat_wallet_id column added to external_accounts table');
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.external_accounts);

    if (tableExists) {
      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.external_accounts, 'fiat_wallet_id');

      if (columnExists) {
        Logger.log('Removing fiat_wallet_id column from external_accounts table');

        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.external_accounts, (tableBuilder) => {
            tableBuilder.dropForeign(['fiat_wallet_id']);
            tableBuilder.dropColumn('fiat_wallet_id');
          });

        Logger.log('fiat_wallet_id column removed from external_accounts table');
      }
    }
  });
}
