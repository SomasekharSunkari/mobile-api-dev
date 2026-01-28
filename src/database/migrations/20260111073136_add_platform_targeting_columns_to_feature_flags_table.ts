import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.feature_flags);
    if (tableExists) {
      Logger.log('Adding platform targeting columns to feature_flags table');

      const iosColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.feature_flags, 'enabled_ios');

      if (!iosColumnExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.feature_flags, (tableBuilder) => {
            tableBuilder
              .boolean('enabled_ios')
              .defaultTo(true)
              .notNullable()
              .comment('Flag indicating if feature is enabled for iOS platform');
          });
        Logger.log('enabled_ios column added to feature_flags table');
      }

      const androidColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.feature_flags, 'enabled_android');

      if (!androidColumnExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.feature_flags, (tableBuilder) => {
            tableBuilder
              .boolean('enabled_android')
              .defaultTo(true)
              .notNullable()
              .comment('Flag indicating if feature is enabled for Android platform');
          });
        Logger.log('enabled_android column added to feature_flags table');
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.feature_flags);
    if (tableExists) {
      const iosColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.feature_flags, 'enabled_ios');

      if (iosColumnExists) {
        Logger.log('Removing enabled_ios column from feature_flags table');
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.feature_flags, (tableBuilder) => {
            tableBuilder.dropColumn('enabled_ios');
          });
        Logger.log('enabled_ios column removed from feature_flags table');
      }

      const androidColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.feature_flags, 'enabled_android');

      if (androidColumnExists) {
        Logger.log('Removing enabled_android column from feature_flags table');
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.feature_flags, (tableBuilder) => {
            tableBuilder.dropColumn('enabled_android');
          });
        Logger.log('enabled_android column removed from feature_flags table');
      }
    }
  });
}
