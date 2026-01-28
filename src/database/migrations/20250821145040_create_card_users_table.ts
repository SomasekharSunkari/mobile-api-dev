import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';
import { ICardUserStatus } from '../models/cardUser/cardUser.interface';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.card_users);

    if (!tableExists) {
      Logger.log('Creating card_users table');

      await trx.schema.withSchema(DatabaseSchema.apiService).createTable(DatabaseTables.card_users, (tableBuilder) => {
        tableBuilder.string('id').primary();
        tableBuilder.string('user_id').notNullable();
        tableBuilder.string('provider_ref').nullable();
        tableBuilder.string('provider_status').nullable();
        tableBuilder.string('status').defaultTo(ICardUserStatus.PENDING);
        tableBuilder.text('provider_application_status_reason').nullable();
        tableBuilder.string('country_id').notNullable();
        tableBuilder.decimal('salary', 15, 2).nullable().comment('Annual salary in USD');
        tableBuilder.string('ip_address').nullable().comment('IP address when card user was created');
        tableBuilder.string('occupation').nullable().comment('User occupation');
        tableBuilder.text('usage_reason').nullable().comment('Reason for card usage');
        tableBuilder.decimal('monthly_spend', 15, 2).nullable().comment('Expected monthly spend in USD');
        tableBuilder.string('wallet_address').nullable().comment('Blockchain wallet address');
        tableBuilder
          .string('address_network_name')
          .nullable()
          .comment('Blockchain network name for the wallet address');
        tableBuilder.decimal('balance', 15, 2).defaultTo(0).nullable().comment('Current card balance in USD');

        tableBuilder.timestamps(true, true);
        tableBuilder.timestamp('deleted_at').nullable();

        tableBuilder
          .foreign('user_id')
          .references('id')
          .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
          .onDelete('CASCADE');

        tableBuilder
          .foreign('country_id')
          .references('id')
          .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.countries}`)
          .onDelete('RESTRICT');
      });

      Logger.log('Card users table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.card_users);
}
