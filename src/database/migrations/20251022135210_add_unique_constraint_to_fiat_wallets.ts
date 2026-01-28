import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Adding unique constraint to fiat_wallets table on (user_id, asset)');

      // First, remove any duplicate records that might exist
      // Keep only the first record for each user_id + asset combination
      await trx.raw(`
        DELETE FROM ${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM ${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}
          GROUP BY user_id, asset
        )
      `);

      // Now add the unique constraint
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.fiat_wallets, (table) => {
        table.unique(['user_id', 'asset'], {
          indexName: 'fiat_wallets_user_id_asset_unique',
        });
      });

      Logger.log('Successfully added unique constraint to fiat_wallets table');
    } catch (error) {
      Logger.error('Error adding unique constraint to fiat_wallets table', error);
      throw error;
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Removing unique constraint from fiat_wallets table');

      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.fiat_wallets, (table) => {
        table.dropUnique(['user_id', 'asset'], 'fiat_wallets_user_id_asset_unique');
      });

      Logger.log('Successfully removed unique constraint from fiat_wallets table');
    } catch (error) {
      Logger.error('Error removing unique constraint from fiat_wallets table', error);
      throw error;
    }
  });
}
