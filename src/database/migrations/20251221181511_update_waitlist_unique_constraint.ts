import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Updating unique constraint on waitlist table to include reason');

      // Drop the existing unique constraint
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.waitlist, (table) => {
        table.dropUnique(['user_id', 'feature'], 'waitlist_user_id_feature_unique');
      });

      // Add the new unique constraint with reason
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.waitlist, (table) => {
        table.unique(['user_id', 'feature', 'reason'], {
          indexName: 'waitlist_user_id_feature_reason_unique',
        });
      });

      Logger.log('Successfully updated unique constraint on waitlist table');
    } catch (error) {
      Logger.error('Error updating unique constraint on waitlist table', error);
      throw error;
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Reverting unique constraint on waitlist table');

      // Drop the new unique constraint
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.waitlist, (table) => {
        table.dropUnique(['user_id', 'feature', 'reason'], 'waitlist_user_id_feature_reason_unique');
      });

      // Restore the original unique constraint
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.waitlist, (table) => {
        table.unique(['user_id', 'feature'], {
          indexName: 'waitlist_user_id_feature_unique',
        });
      });

      Logger.log('Successfully reverted unique constraint on waitlist table');
    } catch (error) {
      Logger.error('Error reverting unique constraint on waitlist table', error);
      throw error;
    }
  });
}
