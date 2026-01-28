import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.provider_limits);

    if (!tableExists) {
      Logger.log('Creating provider_limits table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.provider_limits, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder.string('provider').notNullable();
          tableBuilder.string('limit_type').notNullable();
          tableBuilder.bigInteger('limit_value').notNullable();
          tableBuilder.string('currency').defaultTo('USD');
          tableBuilder.boolean('is_active').notNullable().defaultTo(true);
          tableBuilder.text('description').nullable();

          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('deleted_at').nullable();

          tableBuilder.unique(['provider', 'limit_type', 'currency']);
        });

      Logger.log('provider_limits table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.provider_limits);
}
