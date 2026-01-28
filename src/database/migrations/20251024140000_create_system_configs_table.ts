import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.system_configs);

    if (!tableExists) {
      Logger.log('Creating system_configs table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.system_configs, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder.string('key').notNullable().unique();
          tableBuilder.string('type').notNullable();
          tableBuilder.boolean('is_enabled').notNullable().defaultTo(true);
          tableBuilder.text('description').nullable();

          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('deleted_at').nullable();
        });

      Logger.log('system_configs table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.system_configs);
}
