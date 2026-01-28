import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Adding unique constraint to virtual_accounts table on (user_id, provider)');

      // First, remove any duplicate records that might exist
      // Keep only the first record for each user_id + provider combination
      await trx.raw(`
        DELETE FROM ${DatabaseSchema.apiService}.${DatabaseTables.virtual_accounts}
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM ${DatabaseSchema.apiService}.${DatabaseTables.virtual_accounts}
          GROUP BY user_id, provider
        )
      `);

      // Now add the unique constraint
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.virtual_accounts, (table) => {
        table.unique(['user_id', 'provider'], {
          indexName: 'virtual_accounts_user_id_provider_unique',
        });
      });

      Logger.log('Successfully added unique constraint to virtual_accounts table');
    } catch (error) {
      Logger.error('Error adding unique constraint to virtual_accounts table', error);
      throw error;
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Removing unique constraint from virtual_accounts table');

      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.virtual_accounts, (table) => {
        table.dropUnique(['user_id', 'provider'], 'virtual_accounts_user_id_provider_unique');
      });

      Logger.log('Successfully removed unique constraint from virtual_accounts table');
    } catch (error) {
      Logger.error('Error removing unique constraint from virtual_accounts table', error);
      throw error;
    }
  });
}
