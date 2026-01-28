import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.rate_configs);

    if (tableExists) {
      Logger.log('Adding ngn_withdrawal_fee columns to rate_configs table');

      const ngnWithdrawalFeeExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.rate_configs, 'ngn_withdrawal_fee');

      const isNgnWithdrawalFeePercentageExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.rate_configs, 'is_ngn_withdrawal_fee_percentage');

      const ngnWithdrawalFeeCapExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.rate_configs, 'ngn_withdrawal_fee_cap');

      if (ngnWithdrawalFeeExists && isNgnWithdrawalFeePercentageExists && ngnWithdrawalFeeCapExists) {
        Logger.log('ngn_withdrawal_fee columns already exist in rate_configs table');
      } else {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.rate_configs, (tableBuilder) => {
            if (!ngnWithdrawalFeeExists) {
              tableBuilder.decimal('ngn_withdrawal_fee', 20, 8).nullable().defaultTo(0);
            }
            if (!isNgnWithdrawalFeePercentageExists) {
              tableBuilder.boolean('is_ngn_withdrawal_fee_percentage').nullable().defaultTo(false);
            }
            if (!ngnWithdrawalFeeCapExists) {
              tableBuilder.decimal('ngn_withdrawal_fee_cap', 20, 8).nullable().defaultTo(0);
            }
          });

        Logger.log('ngn_withdrawal_fee columns added to rate_configs table');
      }
    } else {
      Logger.warn('rate_configs table does not exist, skipping migration');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.rate_configs);

    if (tableExists) {
      Logger.log('Removing ngn_withdrawal_fee columns from rate_configs table');

      const ngnWithdrawalFeeExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.rate_configs, 'ngn_withdrawal_fee');

      const isNgnWithdrawalFeePercentageExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.rate_configs, 'is_ngn_withdrawal_fee_percentage');

      const ngnWithdrawalFeeCapExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.rate_configs, 'ngn_withdrawal_fee_cap');

      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.rate_configs, (tableBuilder) => {
        if (ngnWithdrawalFeeExists) {
          tableBuilder.dropColumn('ngn_withdrawal_fee');
        }
        if (isNgnWithdrawalFeePercentageExists) {
          tableBuilder.dropColumn('is_ngn_withdrawal_fee_percentage');
        }
        if (ngnWithdrawalFeeCapExists) {
          tableBuilder.dropColumn('ngn_withdrawal_fee_cap');
        }
      });

      Logger.log('ngn_withdrawal_fee columns removed from rate_configs table');
    }
  });
}
