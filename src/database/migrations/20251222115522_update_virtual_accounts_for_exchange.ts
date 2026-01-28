import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Updating virtual_accounts table: making fiat_wallet_id nullable and adding transaction_id');

      // Make fiat_wallet_id nullable
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.virtual_accounts, (table) => {
        table.string('fiat_wallet_id').nullable().alter();
      });

      // Check if transaction_id column already exists
      const hasColumn = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.virtual_accounts, 'transaction_id');

      if (!hasColumn) {
        await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.virtual_accounts, (table) => {
          table.string('transaction_id').nullable();
        });
      }

      // Drop the existing unique constraint if it exists
      try {
        await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.virtual_accounts, (table) => {
          table.dropUnique(['user_id', 'provider'], 'virtual_accounts_user_id_provider_unique');
        });
        Logger.log('Dropped existing unique constraint on (user_id, provider)');
      } catch {
        Logger.log('Unique constraint on (user_id, provider) does not exist or already dropped');
      }

      // Add new unique constraint that includes type and transaction_id
      // Using a partial unique index to handle NULL transaction_id values
      await trx.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS virtual_accounts_user_provider_type_exchange_ref_unique
        ON ${DatabaseSchema.apiService}.${DatabaseTables.virtual_accounts} (user_id, provider, type, transaction_id)
        WHERE transaction_id IS NOT NULL
      `);

      // Add unique constraint for main accounts (where transaction_id is NULL)
      await trx.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS virtual_accounts_user_provider_type_main_unique
        ON ${DatabaseSchema.apiService}.${DatabaseTables.virtual_accounts} (user_id, provider, type)
        WHERE transaction_id IS NULL
      `);

      Logger.log('Successfully updated virtual_accounts table');
    } catch (error) {
      Logger.error('Error updating virtual_accounts table', error);
      throw error;
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Reverting virtual_accounts table changes');

      // Drop the new partial unique indexes
      await trx.raw(`
        DROP INDEX IF EXISTS ${DatabaseSchema.apiService}.virtual_accounts_user_provider_type_exchange_ref_unique
      `);
      await trx.raw(`
        DROP INDEX IF EXISTS ${DatabaseSchema.apiService}.virtual_accounts_user_provider_type_main_unique
      `);

      // Restore the original unique constraint
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.virtual_accounts, (table) => {
        table.unique(['user_id', 'provider'], {
          indexName: 'virtual_accounts_user_id_provider_unique',
        });
      });

      // Drop the transaction_id column
      const hasColumn = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.virtual_accounts, 'transaction_id');

      if (hasColumn) {
        await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.virtual_accounts, (table) => {
          table.dropColumn('transaction_id');
        });
      }

      // Revert fiat_wallet_id to not nullable
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.virtual_accounts, (table) => {
        table.string('fiat_wallet_id').notNullable().alter();
      });

      Logger.log('Successfully reverted virtual_accounts table changes');
    } catch (error) {
      Logger.error('Error reverting virtual_accounts table changes', error);
      throw error;
    }
  });
}
