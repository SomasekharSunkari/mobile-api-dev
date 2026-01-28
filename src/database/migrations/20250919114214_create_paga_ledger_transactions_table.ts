import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.paga_ledger_transactions).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating paga_ledger_transactions table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.paga_ledger_transactions, (tableBuilder: Knex.TableBuilder) => {
                // primary key
                tableBuilder.string('id').primary();

                // required columns from IPagaLedgerTransaction interface
                tableBuilder.string('account_number').notNullable();
                tableBuilder.bigInteger('amount').notNullable();
                tableBuilder.enum('status', ['PENDING', 'SUCCESSFUL', 'FAILED']).notNullable();
                tableBuilder.string('reference_number').notNullable();
                tableBuilder.string('transaction_reference').notNullable();
                tableBuilder.bigInteger('balance_before').notNullable();
                tableBuilder.bigInteger('balance_after').notNullable();
                tableBuilder.enum('transaction_type', ['CREDIT', 'DEBIT']).notNullable();
                tableBuilder.string('currency').notNullable().defaultTo('NGN');

                // optional columns from interface
                tableBuilder.bigInteger('date_utc').nullable();
                tableBuilder.text('description').nullable();
                tableBuilder.string('transaction_id').nullable();
                tableBuilder.string('source_account_name').nullable();
                tableBuilder.string('source_account_organization_name').nullable();
                tableBuilder.bigInteger('tax').nullable().defaultTo(0);
                tableBuilder.bigInteger('fee').nullable().defaultTo(0);
                tableBuilder.string('transaction_channel').nullable();
                tableBuilder.string('reversal_id').nullable();

                // base model columns
                tableBuilder.timestamps(true, true);
                tableBuilder.timestamp('deleted_at').nullable();

                tableBuilder
                  .foreign('account_number')
                  .references('account_number')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.paga_ledger_accounts}`)
                  .onDelete('CASCADE')
                  .onUpdate('CASCADE');
              });
          }
        }),
      )
      .catch((e: any) => console.error('MIGRATION_ERROR', e)),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.paga_ledger_transactions);
}
