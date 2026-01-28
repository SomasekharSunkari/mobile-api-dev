import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

/**
 * Migration: Add unsettled transaction limit columns to tier_configs table
 *
 * Purpose:
 * - Limits how many unsettled (settled_at IS NULL) deposits/withdrawals a user can have
 * - Used for US users to prevent excessive pending transactions
 */
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.tier_configs);

    if (tableExists) {
      Logger.log('Adding unsettled limit columns to tier_configs table');

      const depositsColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.tier_configs, 'maximum_unsettled_deposits');

      const withdrawalsColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.tier_configs, 'maximum_unsettled_withdrawals');

      if (!depositsColumnExists || !withdrawalsColumnExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.tier_configs, (tableBuilder) => {
            if (!depositsColumnExists) {
              tableBuilder
                .integer('maximum_unsettled_deposits')
                .nullable()
                .comment('Maximum number of unsettled deposits allowed');
            }
            if (!withdrawalsColumnExists) {
              tableBuilder
                .integer('maximum_unsettled_withdrawals')
                .nullable()
                .comment('Maximum number of unsettled withdrawals allowed');
            }
          });

        Logger.log('Unsettled limit columns added to tier_configs table');
      } else {
        Logger.log('Unsettled limit columns already exist in tier_configs table');
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
      Logger.log('Removing unsettled limit columns from tier_configs table');

      const depositsColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.tier_configs, 'maximum_unsettled_deposits');

      const withdrawalsColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.tier_configs, 'maximum_unsettled_withdrawals');

      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.tier_configs, (tableBuilder) => {
        if (depositsColumnExists) {
          tableBuilder.dropColumn('maximum_unsettled_deposits');
        }
        if (withdrawalsColumnExists) {
          tableBuilder.dropColumn('maximum_unsettled_withdrawals');
        }
      });

      Logger.log('Unsettled limit columns removed from tier_configs table');
    }
  });
}
