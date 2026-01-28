import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.rate_configs);

    if (!tableExists) {
      Logger.log('Creating rate_configs table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.rate_configs, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder.string('provider').notNullable();

          tableBuilder.decimal('service_fee', 18, 8).defaultTo(0);
          tableBuilder.string('service_fee_currency').nullable();
          tableBuilder.boolean('is_service_fee_percentage').defaultTo(false);

          tableBuilder.decimal('partner_fee', 18, 8).defaultTo(0);
          tableBuilder.string('partner_fee_currency').nullable();
          tableBuilder.boolean('is_partner_fee_percentage').defaultTo(false);

          tableBuilder.decimal('disbursement_fee', 18, 8).defaultTo(0);
          tableBuilder.string('disbursement_fee_currency').nullable();
          tableBuilder.boolean('is_disbursement_fee_percentage').defaultTo(false);

          tableBuilder.boolean('is_active').defaultTo(true);
          tableBuilder.text('description').nullable();

          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('deleted_at').nullable();

          tableBuilder.unique(['provider']);
        });

      Logger.log('rate_configs table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.rate_configs);
}
