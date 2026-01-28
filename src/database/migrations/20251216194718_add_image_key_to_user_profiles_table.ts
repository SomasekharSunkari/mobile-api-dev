import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

/**
 * Migration: Add image_key column to users_profiles
 *
 * Purpose:
 * - Store the S3 object key for user profile images.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.users_profiles);

    if (!tableExists) {
      Logger.warn('users_profiles table does not exist, skipping migration');
      return;
    }

    const columnExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasColumn(DatabaseTables.users_profiles, 'image_key');

    if (columnExists) {
      Logger.log('image_key column already exists on users_profiles table');
    } else {
      Logger.log('Adding image_key column to users_profiles table');
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users_profiles, (table) => {
        table.string('image_key').nullable().comment('S3 object key for user profile image');
      });
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.users_profiles);

    if (!tableExists) return;

    const columnExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasColumn(DatabaseTables.users_profiles, 'image_key');

    if (columnExists) {
      Logger.log('Dropping image_key column from users_profiles table');
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users_profiles, (table) => {
        table.dropColumn('image_key');
      });
    }
  });
}
