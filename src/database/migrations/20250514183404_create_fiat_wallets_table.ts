import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.fiat_wallets).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating fiat_wallets table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.fiat_wallets, (tableBuilder: Knex.TableBuilder) => {
                // primary key
                tableBuilder.string('id').primary();

                // foreign keys
                tableBuilder.string('user_id').notNullable();

                // columns
                tableBuilder.bigInteger('balance').notNullable().defaultTo(0);
                tableBuilder.bigInteger('credit_balance').notNullable().defaultTo(0);
                tableBuilder.string('asset').notNullable();
                tableBuilder.string('status').notNullable();

                // date columns
                tableBuilder.timestamp('deleted_at').nullable();
                tableBuilder.timestamps(true, true);
              });
          }
        }),
      )
      .catch((e: any) => console.error('MIGRATION_ERROR', e)),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.fiat_wallets);
}
