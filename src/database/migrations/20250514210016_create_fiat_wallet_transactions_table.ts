import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';
import { TransactionStatus } from '../models';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.fiat_wallet_transactions);

    if (!tableExists) {
      Logger.log('Creating fiat_wallet_transactions table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.fiat_wallet_transactions, (tableBuilder) => {
          tableBuilder.string('id').primary();

          // Core fields
          tableBuilder.string('transaction_id').notNullable();
          tableBuilder.string('fiat_wallet_id').notNullable();
          tableBuilder.string('user_id').notNullable();
          tableBuilder.string('transaction_type').notNullable().comment('Specific type of fiat wallet transaction');
          tableBuilder.bigInteger('amount').notNullable().comment('Transaction amount in lowest denomination');
          tableBuilder.bigInteger('balance_before').notNullable();
          tableBuilder.bigInteger('balance_after').notNullable();
          tableBuilder.string('currency').notNullable();
          tableBuilder.string('status').notNullable().defaultTo(TransactionStatus.PENDING);

          // Provider details
          tableBuilder.string('provider').nullable().comment('Payment provider used for the transaction');
          tableBuilder.string('provider_reference').nullable().comment('Reference/ID from the provider');
          tableBuilder.string('provider_quote_ref').nullable().comment('Provider quote reference/ID');
          tableBuilder.string('provider_request_ref').nullable().comment('Provider request reference/ID');
          tableBuilder.bigInteger('provider_fee').nullable().comment('Fee charged by the provider');
          tableBuilder.text('provider_metadata').nullable().comment('Additional provider data in JSON format');

          // Source/destination (specifically for fiat wallet transactions)
          tableBuilder.string('source').nullable().comment('Source of funds (bank, card, etc.)');
          tableBuilder.string('destination').nullable().comment('Destination of funds');

          // Additional info
          tableBuilder.text('description').nullable();
          tableBuilder.text('failure_reason').nullable();

          // Timestamps
          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('processed_at').nullable();
          tableBuilder.timestamp('completed_at').nullable();
          tableBuilder.timestamp('failed_at').nullable();
          tableBuilder.timestamp('deleted_at').nullable();

          // Foreign keys
          tableBuilder
            .foreign('transaction_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.transactions}`)
            .onDelete('CASCADE');

          tableBuilder
            .foreign('fiat_wallet_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}`)
            .onDelete('CASCADE');

          tableBuilder
            .foreign('user_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
            .onDelete('CASCADE');
        });

      Logger.log('Fiat wallet transactions table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.fiat_wallet_transactions);
}
