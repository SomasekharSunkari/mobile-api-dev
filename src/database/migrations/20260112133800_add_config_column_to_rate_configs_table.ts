import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.rate_configs);

    if (tableExists) {
      Logger.log('Adding config column to rate_configs table');

      const hasConfigColumn = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.rate_configs, 'config');

      if (!hasConfigColumn) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.rate_configs, (tableBuilder) => {
            tableBuilder.jsonb('config').nullable();
          });

        Logger.log('config column added to rate_configs table');
      } else {
        Logger.log('config column already exists in rate_configs table');
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
      Logger.log('Removing config column from rate_configs table');

      const hasConfigColumn = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.rate_configs, 'config');

      if (hasConfigColumn) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.rate_configs, (tableBuilder) => {
            tableBuilder.dropColumn('config');
          });

        Logger.log('config column removed from rate_configs table');
      }
    }
  });
}
