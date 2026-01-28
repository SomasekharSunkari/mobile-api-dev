import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema(DatabaseSchema.apiService)
    .createTable(DatabaseTables.blockchain_wallet_keys, (table) => {
      table.string('id').primary();
      table.string('blockchain_wallet_id').notNullable();
      table.text('encrypted_private_key').notNullable();
      table.text('encryption_iv').notNullable();
      table.string('network').notNullable();
      table.text('public_key').nullable();
      table.integer('key_index').notNullable().defaultTo(0);
      table.timestamp('created_at').nullable();
      table.timestamp('updated_at').nullable();
      table.timestamp('deleted_at').nullable();

      table
        .foreign('blockchain_wallet_id')
        .references('id')
        .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallets}`)
        .onDelete('CASCADE');

      table.unique(['blockchain_wallet_id'], {
        indexName: 'blockchain_wallet_keys_blockchain_wallet_id_unique',
        deferrable: 'deferred',
      });

      table.index('blockchain_wallet_id');
      table.index('network');
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.blockchain_wallet_keys);
}
