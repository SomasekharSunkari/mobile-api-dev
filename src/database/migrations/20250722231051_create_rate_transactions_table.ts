import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.rate_transactions).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log(`Creating ${DatabaseTables.rate_transactions} table`);

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.rate_transactions, (tableBuilder: Knex.CreateTableBuilder) => {
                // primary key
                tableBuilder.string('id').unique().notNullable().primary();

                // foreign keys
                tableBuilder.string('user_id').notNullable();
                tableBuilder.string('transaction_id').notNullable();

                // columns
                tableBuilder.bigInteger('rate').notNullable();
                tableBuilder.string('converted_currency').notNullable();
                tableBuilder.string('base_currency').notNullable();
                tableBuilder.bigInteger('amount').notNullable();
                tableBuilder.bigInteger('converted_amount').notNullable();
                tableBuilder.string('provider').notNullable();

                tableBuilder.text('failure_reason').nullable();
                tableBuilder.string('status').notNullable();
                tableBuilder.string('type').notNullable();

                // date columns
                tableBuilder.timestamp('expires_at').nullable();
                tableBuilder.timestamp('processed_at').nullable();
                tableBuilder.timestamp('failed_at').nullable();
                tableBuilder.timestamp('completed_at').nullable();

                tableBuilder.timestamps(true, true);
                tableBuilder.timestamp('deleted_at').nullable();

                // foreign key constraints
                tableBuilder
                  .foreign('user_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
                  .onDelete('CASCADE');

                tableBuilder
                  .foreign('transaction_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.transactions}`)
                  .onDelete('CASCADE');
              });
          }
        }),
      )
      .catch((e: any) => console.error('MIGRATION_ERROR', e)),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.rate_transactions);
}
