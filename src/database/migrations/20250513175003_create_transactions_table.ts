import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';
import { TransactionStatus } from '../models';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.transactions);

    if (!tableExists) {
      Logger.log('Creating transactions table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.transactions, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder.string('user_id').nullable();
          tableBuilder.string('reference').notNullable().unique();
          tableBuilder.string('external_reference').nullable();
          tableBuilder.string('asset').notNullable(); // Currency or stablecoin type (e.g., USD, USDT, USDC)
          tableBuilder.bigInteger('amount').notNullable(); // Amount in lowest denomination (e.g., cents for USD)
          tableBuilder.bigInteger('balance_before').notNullable();
          tableBuilder.bigInteger('balance_after').notNullable();
          tableBuilder
            .string('transaction_type')
            .notNullable()
            .comment('Type of transaction (deposit, withdrawal, transfer, etc.)');
          tableBuilder.string('status').notNullable().defaultTo(TransactionStatus.PENDING);
          tableBuilder.string('category').notNullable().comment('Transaction category (fiat, blockchain)');
          tableBuilder.string('transaction_scope').notNullable().comment('Transaction scope (internal, external)');
          tableBuilder.string('parent_transaction_id').nullable().comment('Parent transaction id');
          tableBuilder.text('metadata').nullable().comment('Additional transaction data in JSON format');
          tableBuilder.text('description').nullable();
          tableBuilder.string('ip_address').nullable();
          tableBuilder.string('user_agent').nullable();
          tableBuilder.string('failure_reason').nullable();

          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('completed_at').nullable();
          tableBuilder.timestamp('failed_at').nullable();
          tableBuilder.timestamp('deleted_at').nullable();
          tableBuilder.timestamp('processed_at').nullable();

          tableBuilder
            .foreign('user_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
            .onDelete('SET NULL');
        });

      Logger.log('Transactions table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.transactions);
}
