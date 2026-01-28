import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.users_profiles);

    if (tableExists) {
      Logger.log('Adding avatar_url column to users_profiles table');

      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.users_profiles, 'avatar_url');

      if (!columnExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.users_profiles, (tableBuilder) => {
            tableBuilder.string('avatar_url').nullable().comment('URL to user profile avatar image stored in S3');
          });

        Logger.log('avatar_url column added to users_profiles table');
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.users_profiles);

    if (tableExists) {
      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.users_profiles, 'avatar_url');

      if (columnExists) {
        Logger.log('Removing avatar_url column from users_profiles table');

        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.users_profiles, (tableBuilder) => {
            tableBuilder.dropColumn('avatar_url');
          });

        Logger.log('avatar_url column removed from users_profiles table');
      }
    }
  });
}
