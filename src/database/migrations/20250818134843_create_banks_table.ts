import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.banks).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating banks table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.banks, (tableBuilder: Knex.TableBuilder) => {
                // primary key
                tableBuilder.string('id').primary();

                // foreign keys
                tableBuilder.string('country_id').notNullable();

                // columns
                tableBuilder.string('name').notNullable();
                tableBuilder.string('code').notNullable();
                tableBuilder.string('logo').nullable();
                tableBuilder.string('status').nullable();
                tableBuilder.string('short_name').nullable();

                tableBuilder.timestamp('deleted_at').nullable();
                tableBuilder.timestamps(true, true);

                // foreign key constraints
                tableBuilder
                  .foreign('country_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.countries}`);
              });
          }
        }),
      )
      .catch((e: any) => console.error('MIGRATION_ERROR', e)),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.banks);
}
