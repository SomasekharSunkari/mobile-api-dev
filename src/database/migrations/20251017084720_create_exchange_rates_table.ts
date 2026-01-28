import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.exchange_rates).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating exchange_rates table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.exchange_rates, (tableBuilder: Knex.TableBuilder) => {
                // primary key
                tableBuilder.string('id').primary();

                // required columns from IExchangeRate interface
                tableBuilder.string('provider').notNullable();
                tableBuilder.string('buying_currency_code').notNullable();
                tableBuilder.string('selling_currency_code').notNullable();
                tableBuilder.bigInteger('rate').notNullable();
                tableBuilder.string('provider_rate_ref').notNullable();
                tableBuilder.timestamp('expires_at').nullable();

                // base model columns
                tableBuilder.timestamps(true, true);
                tableBuilder.timestamp('deleted_at').nullable();
              });
          }
        }),
      )
      .catch((e: any) => console.error('MIGRATION_ERROR', e)),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.exchange_rates);
}
