import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.kyc_verifications);

    if (!tableExists) {
      Logger.log('Creating kyc_verifications table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.kyc_verifications, (tableBuilder) => {
          tableBuilder.string('id', 100).primary();
          tableBuilder.string('user_id', 100).notNullable();
          tableBuilder.string('country_id', 100).nullable();
          tableBuilder.string('tier_config_id', 100).nullable();

          tableBuilder.string('provider', 100).nullable();
          tableBuilder.string('provider_ref', 150).nullable();
          tableBuilder.integer('attempt').notNullable().defaultTo(1);
          tableBuilder.string('status', 50).notNullable();
          tableBuilder.text('error_message').nullable();
          tableBuilder.timestamp('submitted_at').nullable();
          tableBuilder.timestamp('reviewed_at').nullable();

          // New fields
          tableBuilder.string('identity_type', 50).nullable();
          tableBuilder.string('identity_value', 100).nullable();
          tableBuilder.jsonb('metadata').nullable();
          tableBuilder.string('provider_status', 50).nullable();
          tableBuilder.string('provider_level').nullable();

          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('deleted_at').nullable();

          tableBuilder
            .foreign('user_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
            .onDelete('CASCADE');

          tableBuilder
            .foreign('country_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.countries}`)
            .onDelete('SET NULL');

          tableBuilder
            .foreign('tier_config_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.tier_configs}`)
            .onDelete('CASCADE');
        });

      Logger.log('kyc_verifications table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.kyc_verifications);
}
