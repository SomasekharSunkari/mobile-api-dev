import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.countries).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating countries table');
            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.countries, (tableBuilder) => {
                tableBuilder.string('id').primary();
                tableBuilder.string('name').notNullable();
                tableBuilder.string('code').notNullable();
                tableBuilder.string('phone_code').notNullable();
                tableBuilder.boolean('is_supported').defaultTo(false);
                tableBuilder.string('flag_url').nullable();

                // currency code
                tableBuilder.string('currency_code').notNullable();
                tableBuilder.string('currency_denominator_code').notNullable();

                tableBuilder.timestamps(true, true);
                tableBuilder.timestamp('deleted_at').nullable();
              });
          }
        }),
      )
      .catch((e) => {
        Logger.error('MIGRATION_ERROR', e);
        throw e;
      }),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.countries);
}
