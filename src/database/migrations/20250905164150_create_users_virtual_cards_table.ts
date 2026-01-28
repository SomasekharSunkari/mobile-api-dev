import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.users_virtual_cards);

    if (!tableExists) {
      Logger.log('Creating users_virtual_cards table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.users_virtual_cards, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder.string('user_id').notNullable();
          tableBuilder.string('card_user_id').notNullable();
          tableBuilder.string('provider_ref').nullable();
          tableBuilder.string('status').notNullable();
          tableBuilder.decimal('limit', 15, 2).nullable().comment('Card spending limit');
          tableBuilder
            .string('limit_frequency')
            .nullable()
            .comment('Frequency for the spending limit (daily, weekly, monthly)');
          tableBuilder.string('display_name').nullable().comment('Custom display name for the card');
          tableBuilder.string('provider_product_id').nullable();
          tableBuilder.string('provider_product_ref').nullable();
          tableBuilder.string('art_id').nullable().comment('Card art/design identifier');
          tableBuilder.string('address_line_1').nullable();
          tableBuilder.string('address_line_2').nullable();
          tableBuilder.string('city').nullable();
          tableBuilder.string('region').nullable();
          tableBuilder.string('postal_code').nullable();
          tableBuilder.string('country_id').nullable();
          tableBuilder.boolean('is_freezed').defaultTo(false).comment('Whether the card is frozen');
          tableBuilder.string('expiration_month').nullable().comment('Card expiration month');
          tableBuilder.string('expiration_year').nullable().comment('Card expiration year');
          tableBuilder.decimal('balance', 15, 2).defaultTo(0).nullable().comment('Current virtual card balance in USD');

          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('deleted_at').nullable();

          tableBuilder
            .foreign('user_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
            .onDelete('CASCADE');

          tableBuilder
            .foreign('card_user_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.card_users}`)
            .onDelete('CASCADE');

          tableBuilder
            .foreign('country_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.countries}`)
            .onDelete('SET NULL');
        });

      Logger.log('Users virtual cards table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.users_virtual_cards);
}
