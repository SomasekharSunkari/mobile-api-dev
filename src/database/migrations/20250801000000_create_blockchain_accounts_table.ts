import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  // Create blockchain_accounts table
  await knex.schema.withSchema(DatabaseSchema.apiService).createTable(DatabaseTables.blockchain_accounts, (table) => {
    table.string('id').primary();
    table.string('user_id').notNullable();
    table.string('provider').notNullable().defaultTo('fireblocks');
    table.string('provider_ref').notNullable();
    table.string('status').notNullable().defaultTo('active');
    table.string('rails').notNullable().defaultTo('crypto');
    table.boolean('is_visible').notNullable().defaultTo(false);
    table.timestamp('created_at').nullable();
    table.timestamp('updated_at').nullable();
    table.timestamp('deleted_at').nullable();

    // Indexes
    table.index('user_id');
    table.index('provider');
    table.index('provider_ref');
    table.index('status');
    table.unique(['user_id', 'provider', 'rails']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.blockchain_accounts);
}
