import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.paga_ledger_accounts).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating paga_ledger_accounts table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.paga_ledger_accounts, (tableBuilder: Knex.TableBuilder) => {
                // primary key
                tableBuilder.string('id').primary();

                // required columns from IPagaLedgerAccount interface
                tableBuilder.string('email').notNullable();
                tableBuilder.string('phone_number').nullable();
                tableBuilder.string('account_number').notNullable().unique();
                tableBuilder.string('account_name').notNullable();
                tableBuilder.bigInteger('available_balance').nullable().defaultTo(0);

                // base model columns
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
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.paga_ledger_accounts);
}
