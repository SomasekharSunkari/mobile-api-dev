import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.dosh_points_accounts);

    if (tableExists) {
      Logger.log('Adding usd_fiat_rewards_enabled column to dosh_points_accounts table');

      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.dosh_points_accounts, 'usd_fiat_rewards_enabled');

      if (columnExists) {
        Logger.log('usd_fiat_rewards_enabled column already exists in dosh_points_accounts table');
      } else {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.dosh_points_accounts, (tableBuilder) => {
            tableBuilder.boolean('usd_fiat_rewards_enabled').nullable().defaultTo(null);
          });

        Logger.log('usd_fiat_rewards_enabled column added to dosh_points_accounts table');
      }
    } else {
      Logger.warn('dosh_points_accounts table does not exist, skipping migration');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.dosh_points_accounts);

    if (tableExists) {
      Logger.log('Removing usd_fiat_rewards_enabled column from dosh_points_accounts table');

      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.dosh_points_accounts, 'usd_fiat_rewards_enabled');

      if (columnExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.dosh_points_accounts, (tableBuilder) => {
            tableBuilder.dropColumn('usd_fiat_rewards_enabled');
          });

        Logger.log('usd_fiat_rewards_enabled column removed from dosh_points_accounts table');
      }
    }
  });
}
