import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.tiers).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating tiers table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.tiers, (tableBuilder: Knex.TableBuilder) => {
                // primary key
                tableBuilder.string('id').primary();

                // columns
                tableBuilder.string('name').notNullable();
                tableBuilder.string('status').notNullable();
                tableBuilder.integer('level').notNullable();
                tableBuilder.string('description').nullable();
                tableBuilder.bigInteger('minimum_deposit').defaultTo(0).notNullable();
                tableBuilder.bigInteger('maximum_deposit').defaultTo(0).notNullable();
                tableBuilder.bigInteger('minimum_balance').defaultTo(0).notNullable();
                tableBuilder.bigInteger('maximum_balance').defaultTo(0).notNullable();

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
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.tiers);
}
