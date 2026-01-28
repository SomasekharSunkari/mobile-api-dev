import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.card_transactions);

    if (tableExists) {
      Logger.log('card_transactions table already exists, skipping');
      return;
    }

    Logger.log('Creating card_transactions table');

    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .createTable(DatabaseTables.card_transactions, (tableBuilder) => {
        tableBuilder.string('id').primary();

        tableBuilder.string('user_id').notNullable();
        tableBuilder.string('card_user_id').notNullable();
        tableBuilder.string('user_virtual_card_id').nullable();

        tableBuilder.decimal('amount', 15, 2).notNullable();
        tableBuilder.string('provider_reference').nullable();
        tableBuilder.string('currency').notNullable();
        tableBuilder.string('transactionhash').nullable();
        tableBuilder.decimal('authorized_amount', 15, 2).nullable();
        tableBuilder.string('authorization_method').nullable();
        tableBuilder.string('merchant_name').notNullable();
        tableBuilder.string('merchant_id').nullable();
        tableBuilder.string('merchant_city').nullable();
        tableBuilder.string('merchant_country').nullable();
        tableBuilder.string('merchant_category').nullable();
        tableBuilder.string('merchant_category_code').nullable();
        tableBuilder.string('card_id').nullable();
        tableBuilder.string('status').notNullable().defaultTo('pending');
        tableBuilder.string('declined_reason').nullable();
        tableBuilder.timestamp('authorized_at').nullable();

        tableBuilder.decimal('balance_before', 15, 2).nullable();
        tableBuilder.decimal('balance_after', 15, 2).nullable();

        tableBuilder.string('transaction_type').notNullable();
        tableBuilder.string('type').notNullable();

        tableBuilder.timestamps(true, true);
        tableBuilder.timestamp('deleted_at').nullable();

        // Relationships at the end
        tableBuilder
          .foreign('card_user_id')
          .references('id')
          .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.card_users}`);
        tableBuilder
          .foreign('user_id')
          .references('id')
          .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`);
        tableBuilder
          .foreign('user_virtual_card_id')
          .references('id')
          .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users_virtual_cards}`);
      });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const hasTable = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.card_transactions);

    if (!hasTable) return;

    await trx.schema.withSchema(DatabaseSchema.apiService).dropTable(DatabaseTables.card_transactions);
  });
}
