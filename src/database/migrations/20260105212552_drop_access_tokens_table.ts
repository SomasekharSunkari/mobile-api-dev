import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.access_tokens)
      .then((tableExists: boolean) => {
        console.log('tableExists', tableExists);
        console.log('DatabaseTables.access_tokens', DatabaseTables.access_tokens);
        console.log('DatabaseSchema.apiService', DatabaseSchema.apiService);
        if (tableExists) {
          Logger.log('Dropping access_tokens table - tokens now stored in Redis');

          return trx.schema.withSchema(DatabaseSchema.apiService).dropTable(DatabaseTables.access_tokens);
        }
      })
      .catch((e: any) => console.error('MIGRATION_ERROR', e)),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.access_tokens).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Recreating access_tokens table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.access_tokens, (tableBuilder: Knex.TableBuilder) => {
                // primary key
                tableBuilder.string('id').primary();

                // foreign keys
                tableBuilder.string('user_id').notNullable();

                // columns
                tableBuilder.string('token').notNullable();
                tableBuilder.dateTime('expiration_time').notNullable();
                tableBuilder.string('identity').notNullable();

                // date columns
                tableBuilder.timestamp('deleted_at').nullable();
                tableBuilder.timestamps(true, true);

                // foreign key constraints
                tableBuilder
                  .foreign('user_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
                  .onDelete('CASCADE');
              });
          }
        }),
      )
      .catch((e: any) => console.error('MIGRATION_ERROR', e)),
  );
}
