import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

/**
 * Migration: Rename unsettled columns to pending count columns in tier_configs table
 *
 * Purpose:
 * - Renames maximum_unsettled_deposits to maximum_pending_deposits_count
 * - Renames maximum_unsettled_withdrawals to maximum_pending_withdrawals_count
 */
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.tier_configs);

    if (tableExists) {
      Logger.log('Renaming unsettled columns to pending count columns in tier_configs table');

      const oldDepositsColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.tier_configs, 'maximum_unsettled_deposits');

      const oldWithdrawalsColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.tier_configs, 'maximum_unsettled_withdrawals');

      if (oldDepositsColumnExists) {
        await trx.schema.withSchema(DatabaseSchema.apiService).raw(`
          ALTER TABLE ${DatabaseSchema.apiService}.${DatabaseTables.tier_configs}
          RENAME COLUMN maximum_unsettled_deposits TO maximum_pending_deposits_count
        `);
        Logger.log('Renamed maximum_unsettled_deposits to maximum_pending_deposits_count');
      }

      if (oldWithdrawalsColumnExists) {
        await trx.schema.withSchema(DatabaseSchema.apiService).raw(`
          ALTER TABLE ${DatabaseSchema.apiService}.${DatabaseTables.tier_configs}
          RENAME COLUMN maximum_unsettled_withdrawals TO maximum_pending_withdrawals_count
        `);
        Logger.log('Renamed maximum_unsettled_withdrawals to maximum_pending_withdrawals_count');
      }

      Logger.log('Column renaming completed in tier_configs table');
    } else {
      Logger.warn('tier_configs table does not exist, skipping migration');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.tier_configs);

    if (tableExists) {
      Logger.log('Reverting pending count columns to unsettled columns in tier_configs table');

      const newDepositsColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.tier_configs, 'maximum_pending_deposits_count');

      const newWithdrawalsColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.tier_configs, 'maximum_pending_withdrawals_count');

      if (newDepositsColumnExists) {
        await trx.schema.withSchema(DatabaseSchema.apiService).raw(`
          ALTER TABLE ${DatabaseSchema.apiService}.${DatabaseTables.tier_configs}
          RENAME COLUMN maximum_pending_deposits_count TO maximum_unsettled_deposits
        `);
        Logger.log('Reverted maximum_pending_deposits_count to maximum_unsettled_deposits');
      }

      if (newWithdrawalsColumnExists) {
        await trx.schema.withSchema(DatabaseSchema.apiService).raw(`
          ALTER TABLE ${DatabaseSchema.apiService}.${DatabaseTables.tier_configs}
          RENAME COLUMN maximum_pending_withdrawals_count TO maximum_unsettled_withdrawals
        `);
        Logger.log('Reverted maximum_pending_withdrawals_count to maximum_unsettled_withdrawals');
      }

      Logger.log('Column revert completed in tier_configs table');
    }
  });
}
