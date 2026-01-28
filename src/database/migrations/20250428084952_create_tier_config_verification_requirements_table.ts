import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.tier_config_verification_requirements);

    if (!tableExists) {
      Logger.log('Creating tier_config_verification_requirements table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.tier_config_verification_requirements, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder.string('tier_config_id').notNullable();
          tableBuilder.string('verification_requirement_id').notNullable();

          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('deleted_at').nullable();
        });

      Logger.log('tier_config_verification_requirements table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema(DatabaseSchema.apiService)
    .dropTableIfExists(DatabaseTables.tier_config_verification_requirements);
}
