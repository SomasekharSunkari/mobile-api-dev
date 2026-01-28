import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.ip_country_bans);

    if (!tableExists) {
      Logger.log('Creating ip_country_bans table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.ip_country_bans, (tableBuilder) => {
          // primary key
          tableBuilder.string('id').primary();

          // columns
          tableBuilder.string('type').notNullable();
          tableBuilder.string('value').notNullable();
          tableBuilder.string('reason').nullable();

          // date columns
          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('deleted_at').nullable();
        });

      Logger.log('ip_country_bans table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.ip_country_bans);
}
