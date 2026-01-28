import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.verification_requirements);

    if (!tableExists) {
      Logger.log('Creating verification_requirements table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.verification_requirements, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder
            .string('name')
            .notNullable()
            .comment(
              'name of the verification requirement, e.g. "bvn", "ssn", "nin", "passport", "driver_license", "national_id", "voter_id", "passport", "driver_license", "national_id", "voter_id"',
            );

          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('deleted_at').nullable();
        });

      Logger.log('verification_requirements table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.verification_requirements);
}
