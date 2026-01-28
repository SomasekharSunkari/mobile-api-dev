import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

/**
 * Migration: Add weekly transaction count limit columns to tier_configs table
 *
 * Purpose:
 * - Limits the number of deposit/withdrawal transactions allowed per week (rolling 7 days)
 * - Used for US users to enforce regulatory compliance
 * - Separate from weekly amount limits (which limit total dollar amounts)
 */
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.tier_configs);

    if (tableExists) {
      Logger.log('Adding weekly count limit columns to tier_configs table');

      const depositsCountColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.tier_configs, 'maximum_weekly_deposit_count');

      const withdrawalsCountColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.tier_configs, 'maximum_weekly_withdrawal_count');

      if (!depositsCountColumnExists || !withdrawalsCountColumnExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.tier_configs, (tableBuilder) => {
            if (!depositsCountColumnExists) {
              tableBuilder
                .integer('maximum_weekly_deposit_count')
                .nullable()
                .comment('Maximum number of deposit transactions allowed per week');
            }
            if (!withdrawalsCountColumnExists) {
              tableBuilder
                .integer('maximum_weekly_withdrawal_count')
                .nullable()
                .comment('Maximum number of withdrawal transactions allowed per week');
            }
          });

        Logger.log('Weekly count limit columns added to tier_configs table');
      } else {
        Logger.log('Weekly count limit columns already exist in tier_configs table');
      }
    } else {
      Logger.warn('tier_configs table does not exist, skipping migration');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.tier_configs);

    if (tableExists) {
      Logger.log('Removing weekly count limit columns from tier_configs table');

      const depositsCountColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.tier_configs, 'maximum_weekly_deposit_count');

      const withdrawalsCountColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.tier_configs, 'maximum_weekly_withdrawal_count');

      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.tier_configs, (tableBuilder) => {
        if (depositsCountColumnExists) {
          tableBuilder.dropColumn('maximum_weekly_deposit_count');
        }
        if (withdrawalsCountColumnExists) {
          tableBuilder.dropColumn('maximum_weekly_withdrawal_count');
        }
      });

      Logger.log('Weekly count limit columns removed from tier_configs table');
    }
  });
}
