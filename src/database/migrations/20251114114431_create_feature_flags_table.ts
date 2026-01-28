import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.feature_flags);

    if (!tableExists) {
      Logger.log('Creating feature_flags table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.feature_flags, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder.string('key').notNullable().unique();
          tableBuilder.text('description').nullable();
          tableBuilder.boolean('enabled').defaultTo(false);
          tableBuilder.timestamp('expires_at').nullable();

          tableBuilder.timestamps(true, true);
        });

      Logger.log('Feature_flags table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.feature_flags);
}
