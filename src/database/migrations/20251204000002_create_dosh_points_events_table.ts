import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.dosh_points_events);

    if (!tableExists) {
      Logger.log('Creating dosh_points_events table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.dosh_points_events, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder.string('code').notNullable().unique();
          tableBuilder.string('name').notNullable();
          tableBuilder.text('description').nullable();
          tableBuilder.string('transaction_type').notNullable();
          tableBuilder.bigInteger('default_points').notNullable().defaultTo(0);
          tableBuilder.boolean('is_active').notNullable().defaultTo(true);
          tableBuilder.boolean('is_one_time_per_user').notNullable().defaultTo(false);
          tableBuilder.jsonb('metadata').nullable();
          tableBuilder.timestamp('start_date').nullable();
          tableBuilder.timestamp('end_date').nullable();

          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('deleted_at').nullable();
        });

      Logger.log('dosh_points_events table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.dosh_points_events);
}
