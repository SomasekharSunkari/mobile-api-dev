import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema(DatabaseSchema.apiService)
    .createTable(DatabaseTables.blockchain_wallet_transactions, (table) => {
      table.string('id').primary();
      table.string('blockchain_wallet_id').nullable();
      table.string('provider_reference').nullable();
      table.string('asset').nullable();
      table.decimal('amount', 38, 18).notNullable().defaultTo('0');
      table.decimal('balance_before', 38, 18).notNullable().defaultTo('0');
      table.decimal('balance_after', 38, 18).notNullable().defaultTo('0');
      table.string('transaction_type').nullable();
      table.string('status').notNullable().defaultTo('pending');
      table.text('metadata').nullable();
      table.text('description').nullable();
      table.string('tx_hash').nullable();
      table.text('failure_reason').nullable();
      table.string('main_transaction_id').nullable();
      table.string('peer_wallet_id').nullable();
      table.string('peer_wallet_address').nullable();
      table.string('intiated_by').nullable();
      table.string('signed_by').nullable();
      table.string('network_fee').nullable();
      table.string('parent_id').nullable();
      table.string('idempotency_key', 40).nullable();
      table.enu('type', ['debit', 'credit']).nullable();
      table.enu('transaction_scope', ['internal', 'external']).nullable().defaultTo('internal');
      table.timestamp('created_at').nullable();
      table.timestamp('updated_at').nullable();
      table.timestamp('deleted_at').nullable();

      // Foreign keys
      table
        .foreign('blockchain_wallet_id')
        .references('id')
        .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallets}`);
      table
        .foreign('main_transaction_id')
        .references('id')
        .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.transactions}`);
      table
        .foreign('peer_wallet_id')
        .references('id')
        .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallets}`);

      // Indexes
      table.index('blockchain_wallet_id');
      table.index('main_transaction_id');
      table.index('peer_wallet_id');
      table.index('transaction_type');
      table.index('status');
      table.index('type');
      table.index('transaction_scope');
      table.index('idempotency_key');
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema(DatabaseSchema.apiService)
    .dropTableIfExists(DatabaseTables.blockchain_wallet_transactions);
}
