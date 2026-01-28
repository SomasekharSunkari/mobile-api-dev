import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.system_configs);

    if (!tableExists) {
      Logger.warn('system_configs table does not exist, skipping migration');
      return;
    }

    const columnExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasColumn(DatabaseTables.system_configs, 'value');

    if (columnExists) {
      Logger.log('value column already exists on system_configs table');
    } else {
      Logger.log('Adding value column to system_configs table');
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.system_configs, (table) => {
        table.text('value').nullable();
      });
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.system_configs);

    if (!tableExists) return;

    const columnExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasColumn(DatabaseTables.system_configs, 'value');

    if (columnExists) {
      Logger.log('Dropping value column from system_configs table');
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.system_configs, (table) => {
        table.dropColumn('value');
      });
    }
  });
}
