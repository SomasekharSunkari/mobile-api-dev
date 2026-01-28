import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const hasColumn = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasColumn(DatabaseTables.exchange_rates, 'provider_rate');

    if (!hasColumn) {
      Logger.log('Adding provider_rate column to exchange_rates table');

      await trx.schema.withSchema(DatabaseSchema.apiService).table(DatabaseTables.exchange_rates, (tableBuilder) => {
        tableBuilder.bigInteger('provider_rate').nullable();
      });

      Logger.log('provider_rate column added to exchange_rates table');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const hasColumn = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasColumn(DatabaseTables.exchange_rates, 'provider_rate');

    if (hasColumn) {
      Logger.log('Removing provider_rate column from exchange_rates table');

      await trx.schema.withSchema(DatabaseSchema.apiService).table(DatabaseTables.exchange_rates, (tableBuilder) => {
        tableBuilder.dropColumn('provider_rate');
      });

      Logger.log('provider_rate column removed from exchange_rates table');
    }
  });
}
