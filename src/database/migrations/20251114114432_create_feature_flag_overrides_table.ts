import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.feature_flag_overrides);

    if (!tableExists) {
      Logger.log('Creating feature_flag_overrides table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.feature_flag_overrides, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder.string('feature_flag_id').notNullable();
          tableBuilder.string('user_id').notNullable();
          tableBuilder.boolean('enabled').notNullable();
          tableBuilder.text('reason').nullable();

          tableBuilder.timestamps(true, true);

          tableBuilder
            .foreign('feature_flag_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.feature_flags}`)
            .onDelete('CASCADE');

          tableBuilder
            .foreign('user_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
            .onDelete('CASCADE');

          tableBuilder.unique(['feature_flag_id', 'user_id']);
        });

      Logger.log('Feature_flag_overrides table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.feature_flag_overrides);
}
