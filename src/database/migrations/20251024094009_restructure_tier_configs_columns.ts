import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Removing columns from tier_configs table');

      // Now remove the limits from the tiers table
      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .alterTable(DatabaseTables.tier_configs, (table: Knex.CreateTableBuilder) => {
          table.dropColumn('name');
          table.dropColumn('description');
          table.dropColumn('level');
          table.dropColumn('status');
          table.dropColumn('verifications');

          // weekly limits
          table.bigInteger('maximum_weekly_deposit').defaultTo(0).notNullable();
          table.bigInteger('maximum_weekly_withdrawal').defaultTo(0).notNullable();
          table.bigInteger('maximum_weekly_transaction').defaultTo(0).notNullable();

          // withdrawal limits
          table.bigInteger('minimum_per_withdrawal').defaultTo(0).notNullable();
          table.bigInteger('maximum_per_withdrawal').defaultTo(0).notNullable();
          table.bigInteger('maximum_daily_withdrawal').defaultTo(0).notNullable();
          table.bigInteger('maximum_monthly_withdrawal').defaultTo(0).notNullable();

          // Add weekly remittance limits
          table.bigInteger('remittance_maximum_weekly_deposit').nullable();
          table.bigInteger('remittance_maximum_weekly_transaction').nullable();

          // Add remittance withdrawal limits
          table.bigInteger('remittance_minimum_per_withdrawal').nullable();
          table.bigInteger('remittance_maximum_per_withdrawal').nullable();
          table.bigInteger('remittance_maximum_daily_withdrawal').nullable();
          table.bigInteger('remittance_maximum_weekly_withdrawal').nullable();
          table.bigInteger('remittance_maximum_monthly_withdrawal').nullable();
        });

      Logger.log('Successfully removed columns from tier_configs table');
    } catch (error) {
      Logger.error('Error removing columns from tier_configs table', error);
      throw error;
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Adding columns to tier_configs table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .alterTable(DatabaseTables.tier_configs, (table: Knex.CreateTableBuilder) => {
          table.dropColumn('maximum_weekly_deposit');
          table.dropColumn('maximum_weekly_transaction');
          table.dropColumn('remittance_maximum_weekly_deposit');
          table.dropColumn('remittance_maximum_weekly_transaction');

          table.dropColumn('minimum_per_withdrawal');
          table.dropColumn('maximum_per_withdrawal');
          table.dropColumn('maximum_daily_withdrawal');
          table.dropColumn('maximum_weekly_withdrawal');
          table.dropColumn('maximum_monthly_withdrawal');
          table.dropColumn('remittance_minimum_per_withdrawal');
          table.dropColumn('remittance_maximum_per_withdrawal');
          table.dropColumn('remittance_maximum_daily_withdrawal');
          table.dropColumn('remittance_maximum_weekly_withdrawal');
          table.dropColumn('remittance_maximum_monthly_withdrawal');

          table.string('name').nullable();
          table.string('description').nullable();
          table.integer('level').notNullable();
          table.string('status').notNullable();
          table.json('verifications').notNullable();
        });

      Logger.log('Successfully added columns to tier_configs table');
    } catch (error) {
      Logger.error('Error adding columns to tier_configs table', error);
      throw error;
    }
  });
}
