import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.account_deactivation_codes).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating account_deactivation_codes table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.account_deactivation_codes, (tableBuilder: Knex.TableBuilder) => {
                // primary key
                tableBuilder.string('id').primary();

                // foreign key
                tableBuilder.string('user_id').notNullable();

                // columns
                tableBuilder.string('code').notNullable();
                tableBuilder.string('email').notNullable();
                tableBuilder.timestamp('expires_at').notNullable();
                tableBuilder.boolean('is_used').notNullable().defaultTo(false);
                tableBuilder.timestamp('used_at').nullable();

                // date columns
                tableBuilder.timestamp('deleted_at').nullable();
                tableBuilder.timestamps(true, true);

                // relationships (foreign keys) - placed after created_at and updated_at
                tableBuilder
                  .foreign('user_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.users`)
                  .onDelete('CASCADE');
              });
          }
        }),
      )
      .catch((e: any) => console.error('MIGRATION_ERROR', e)),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.account_deactivation_codes);
}
