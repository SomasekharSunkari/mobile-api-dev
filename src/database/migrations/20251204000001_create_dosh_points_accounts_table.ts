import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.dosh_points_accounts);

    if (!tableExists) {
      Logger.log('Creating dosh_points_accounts table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.dosh_points_accounts, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder.string('user_id').notNullable().unique();
          tableBuilder.bigInteger('balance').notNullable().defaultTo(0);
          tableBuilder.string('status').notNullable().defaultTo('active');

          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('deleted_at').nullable();

          tableBuilder
            .foreign('user_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
            .onDelete('CASCADE');
        });

      Logger.log('dosh_points_accounts table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.dosh_points_accounts);
}
