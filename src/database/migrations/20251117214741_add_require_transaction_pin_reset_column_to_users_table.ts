import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.users);

    if (tableExists) {
      Logger.log('Adding require_transaction_pin_reset column to users table');

      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.users, 'require_transaction_pin_reset');

      if (!columnExists) {
        await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users, (tableBuilder) => {
          tableBuilder
            .boolean('require_transaction_pin_reset')
            .defaultTo(false)
            .notNullable()
            .comment('Flag indicating user must reset their transaction PIN');
        });

        Logger.log('require_transaction_pin_reset column added to users table');
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
        .hasColumn(DatabaseTables.users, 'require_transaction_pin_reset');

      if (columnExists) {
        Logger.log('Removing require_transaction_pin_reset column from users table');

        await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users, (tableBuilder) => {
          tableBuilder.dropColumn('require_transaction_pin_reset');
        });

        Logger.log('require_transaction_pin_reset column removed from users table');
      }
    }
  });
}
