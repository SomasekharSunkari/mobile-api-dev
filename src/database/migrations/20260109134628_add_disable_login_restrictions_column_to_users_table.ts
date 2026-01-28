import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.users);
    if (tableExists) {
      Logger.log('Adding disable_login_restrictions column to users table');
      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.users, 'disable_login_restrictions');
      if (!columnExists) {
        await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users, (tableBuilder) => {
          tableBuilder
            .boolean('disable_login_restrictions')
            .defaultTo(false)
            .notNullable()
            .comment('Flag indicating login restrictions are disabled for this user');
        });
        Logger.log('disable_login_restrictions column added to users table');
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.users);
    if (tableExists) {
      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.users, 'disable_login_restrictions');
      if (columnExists) {
        Logger.log('Removing disable_login_restrictions column from users table');
        await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users, (tableBuilder) => {
          tableBuilder.dropColumn('disable_login_restrictions');
        });
        Logger.log('disable_login_restrictions column removed from users table');
      }
    }
  });
}
