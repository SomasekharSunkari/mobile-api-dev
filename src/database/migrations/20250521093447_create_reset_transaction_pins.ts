import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.reset_transaction_pins).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating reset_transaction_pins table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.reset_transaction_pins, (tableBuilder: any) => {
                tableBuilder.string('id').unique().notNullable().primary();
                tableBuilder.string('user_id').notNullable();
                tableBuilder.string('code').notNullable();
                tableBuilder.boolean('is_used').notNullable().defaultTo(false);
                tableBuilder.timestamp('expiration_time').notNullable();
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
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.reset_transaction_pins);
}
