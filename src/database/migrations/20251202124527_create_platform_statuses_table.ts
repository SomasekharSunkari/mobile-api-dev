import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.platform_statuses);

    if (!tableExists) {
      Logger.log('Creating platform_statuses table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.platform_statuses, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder.string('service_key').notNullable().unique();
          tableBuilder.string('service_name').notNullable();
          tableBuilder.string('status').notNullable().defaultTo('operational');
          tableBuilder.timestamp('last_checked_at').nullable();
          tableBuilder.timestamp('last_failure_at').nullable();
          tableBuilder.text('failure_reason').nullable();
          tableBuilder.boolean('is_manually_set').defaultTo(false);
          tableBuilder.text('custom_message').nullable();

          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('deleted_at').nullable();
        });

      Logger.log('platform_statuses table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.platform_statuses);
}
