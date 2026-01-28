import type { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema(DatabaseSchema.apiService)
    .createTable(DatabaseTables.system_users_beneficiaries, (table) => {
      table.string('id').primary();
      table.string('sender_user_id').notNullable(); // id of the sender user
      table.string('beneficiary_user_id').notNullable(); // id of the beneficiary user
      table.string('alias_name').nullable(); // alias name of the beneficiary
      table.string('avatar_url').nullable(); // avatar url of the beneficiary

      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('deleted_at').nullable();

      // Foreign keys
      table.foreign('sender_user_id').references('id').inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`);
      table
        .foreign('beneficiary_user_id')
        .references('id')
        .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`);

      // Indexes
      table.index('sender_user_id');
      table.index('beneficiary_user_id');
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.system_users_beneficiaries);
}
