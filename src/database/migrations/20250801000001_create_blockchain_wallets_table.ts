import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).createTable(DatabaseTables.blockchain_wallets, (table) => {
    table.string('id').primary();
    table.string('user_id').nullable();
    table.string('blockchain_account_id').nullable();
    table.string('provider_account_ref').nullable();
    table.string('provider').nullable();
    table.string('asset').nullable();
    table.string('base_asset').nullable();
    table.string('address').nullable();
    table.decimal('balance', 38, 18).notNullable().defaultTo('0');
    table.string('name').nullable();
    table.string('status').nullable();
    table.string('network').nullable();
    table.enu('rails', ['remittance', 'crypto']).notNullable().defaultTo('crypto');
    table.integer('decimal').nullable();
    table.boolean('is_visible').notNullable().defaultTo(false);
    table.timestamp('created_at').nullable();
    table.timestamp('updated_at').nullable();
    table.timestamp('deleted_at').nullable();

    // Foreign keys
    table.foreign('user_id').references('id').inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`);
    table
      .foreign('blockchain_account_id')
      .references('id')
      .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.blockchain_accounts}`)
      .onDelete('SET NULL');

    // Indexes
    table.index('user_id');
    table.index('blockchain_account_id');
    table.index('provider');
    table.index('asset');
    table.index('status');
    table.index('network');
    table.index('rails');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.blockchain_wallets);
}
