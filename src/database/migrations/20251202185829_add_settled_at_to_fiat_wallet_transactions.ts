import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

/**
 * Migration: Add settled_at column to fiat_wallet_transactions table
 *
 * Purpose:
 * - Tracks when a fiat wallet transaction is settled (funds actually moved)
 * - Distinguishes between trade completion (completed_at) and actual settlement (settled_at)
 * - Populated via ZeroHash payment_status_changed webhook when payment_status is 'settled'
 */
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.fiat_wallet_transactions);

    if (tableExists) {
      Logger.log('Adding settled_at column to fiat_wallet_transactions table');

      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.fiat_wallet_transactions, 'settled_at');

      if (columnExists) {
        Logger.log('settled_at column already exists in fiat_wallet_transactions table');
      } else {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.fiat_wallet_transactions, (tableBuilder) => {
            tableBuilder
              .timestamp('settled_at')
              .nullable()
              .comment('Timestamp when the transaction was settled (funds actually moved)');
          });

        Logger.log('settled_at column added to fiat_wallet_transactions table');
      }
    } else {
      Logger.warn('fiat_wallet_transactions table does not exist, skipping migration');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.fiat_wallet_transactions);

    if (tableExists) {
      Logger.log('Removing settled_at column from fiat_wallet_transactions table');

      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.fiat_wallet_transactions, 'settled_at');

      if (columnExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.fiat_wallet_transactions, (tableBuilder) => {
            tableBuilder.dropColumn('settled_at');
          });

        Logger.log('settled_at column removed from fiat_wallet_transactions table');
      }
    }
  });
}
