import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.waitlist);

    if (!tableExists) {
      Logger.log('Creating waitlist table');

      await trx.schema.withSchema(DatabaseSchema.apiService).createTable(DatabaseTables.waitlist, (tableBuilder) => {
        tableBuilder.string('id').primary();
        tableBuilder.string('user_id').notNullable();
        tableBuilder.string('user_email').notNullable();
        tableBuilder.string('reason').notNullable();
        tableBuilder.string('feature').notNullable();

        tableBuilder.timestamps(true, true);
        tableBuilder.timestamp('deleted_at').nullable();

        tableBuilder
          .foreign('user_id')
          .references('id')
          .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
          .onDelete('CASCADE');

        tableBuilder.unique(['user_id', 'feature']);
      });

      Logger.log('Waitlist table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.waitlist);
}
