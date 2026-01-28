import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.feature_flag_overrides);

    if (tableExists) {
      Logger.log('Adding deleted_at column to feature_flag_overrides table');

      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.feature_flag_overrides, 'deleted_at');

      if (!columnExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.feature_flag_overrides, (tableBuilder) => {
            tableBuilder
              .timestamp('deleted_at')
              .nullable()
              .comment('Timestamp indicating when the feature flag override was deleted');
          });

        Logger.log('deleted_at column added to feature_flag_overrides table');
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.feature_flag_overrides);

    if (tableExists) {
      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.feature_flag_overrides, 'deleted_at');

      if (columnExists) {
        Logger.log('Removing deleted_at column from feature_flag_overrides table');

        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.feature_flag_overrides, (tableBuilder) => {
            tableBuilder.dropColumn('deleted_at');
          });

        Logger.log('deleted_at column removed from feature_flag_overrides table');
      }
    }
  });
}
