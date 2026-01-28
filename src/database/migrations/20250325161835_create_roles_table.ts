import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';
import { Logger } from '@nestjs/common';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.roles).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating roles table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.roles, (tableBuilder: any) => {
                tableBuilder.string('id').primary();

                tableBuilder.string('name').notNullable();
                tableBuilder.string('desc').nullable();
                tableBuilder.string('slug').notNullable();

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
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.roles);
}
