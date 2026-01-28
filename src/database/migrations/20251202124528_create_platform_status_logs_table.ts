import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.platform_status_logs);

    if (!tableExists) {
      Logger.log('Creating platform_status_logs table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.platform_status_logs, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder.string('platform_status_id').notNullable();
          tableBuilder.string('previous_status').nullable();
          tableBuilder.string('new_status').notNullable();
          tableBuilder.text('reason').nullable();
          tableBuilder.string('triggered_by').notNullable().defaultTo('system');
          tableBuilder.string('admin_user_id').nullable();

          tableBuilder.timestamps(true, true);

          tableBuilder
            .foreign('platform_status_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.platform_statuses}`)
            .onDelete('CASCADE');

          tableBuilder
            .foreign('admin_user_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
            .onDelete('SET NULL');
        });

      Logger.log('platform_status_logs table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.platform_status_logs);
}
