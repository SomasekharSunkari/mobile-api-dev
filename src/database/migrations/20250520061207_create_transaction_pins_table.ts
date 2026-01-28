import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.transaction_pins).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating transaction_pins table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.transaction_pins, (tableBuilder: any) => {
                tableBuilder.string('id').unique().notNullable().primary();
                tableBuilder.string('user_id').notNullable().unique();
                tableBuilder.string('pin').notNullable();

                tableBuilder.timestamps(true, true);
                tableBuilder.timestamp('deleted_at').nullable();

                // foreign key constraint
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

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.transaction_pins);
}
