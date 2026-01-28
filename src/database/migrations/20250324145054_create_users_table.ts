import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';
import { UserStatus } from '../models';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.users);

    if (!tableExists) {
      Logger.log('Creating users table');

      await trx.schema.withSchema(DatabaseSchema.apiService).createTable(DatabaseTables.users, (tableBuilder) => {
        tableBuilder.string('id').primary();
        tableBuilder.string('first_name').nullable();
        tableBuilder.string('middle_name').nullable();
        tableBuilder.string('last_name').nullable();
        tableBuilder.string('username').notNullable().unique();
        tableBuilder.string('email').nullable().unique();
        tableBuilder.boolean('is_email_verified').defaultTo(false);
        tableBuilder.string('password').notNullable();
        tableBuilder.boolean('is_active').defaultTo(false);
        tableBuilder.string('country_id');
        tableBuilder.boolean('is_deactivated').defaultTo(false);

        tableBuilder.string('status').defaultTo(UserStatus.INACTIVE);

        tableBuilder.string('phone_number').nullable().unique();
        tableBuilder.string('phone_number_country_code').nullable();
        tableBuilder.boolean('is_phone_verified').defaultTo(false);
        tableBuilder.boolean('require_password_reset').defaultTo(false);

        tableBuilder.timestamps(true, true);
        tableBuilder.timestamp('deleted_at').nullable();

        tableBuilder
          .foreign('country_id')
          .references('id')
          .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.countries}`)
          .onDelete('SET NULL');
      });

      Logger.log('Users table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.users);
}
