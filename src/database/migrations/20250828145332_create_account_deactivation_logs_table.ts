import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.account_deactivation_logs).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating account_deactivation_logs table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.account_deactivation_logs, (tableBuilder: Knex.TableBuilder) => {
                // primary key
                tableBuilder.string('id').primary();

                // foreign keys
                tableBuilder.string('user_id').notNullable();
                tableBuilder.string('deactivated_by_user_id').nullable();
                tableBuilder.string('reactivated_by_user_id').nullable();

                // columns
                tableBuilder.jsonb('reasons').notNullable();
                tableBuilder.string('status').notNullable();
                tableBuilder.timestamp('deactivated_on').nullable();
                tableBuilder.timestamp('reactivated_on').nullable();
                tableBuilder.boolean('is_active_log').notNullable().defaultTo(true);

                // date columns
                tableBuilder.timestamp('deleted_at').nullable();
                tableBuilder.timestamps(true, true);

                // relations
                tableBuilder
                  .foreign('user_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`);
                tableBuilder
                  .foreign('deactivated_by_user_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`);
                tableBuilder
                  .foreign('reactivated_by_user_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`);
              });
          }
        }),
      )
      .catch((e: any) => console.error('MIGRATION_ERROR', e)),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.account_deactivation_logs);
}
