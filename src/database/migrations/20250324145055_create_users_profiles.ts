import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.users_profiles).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating users_profiles table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.users_profiles, (tableBuilder) => {
                tableBuilder.string('id').primary();
                tableBuilder.string('user_id').notNullable();

                tableBuilder.date('dob');
                tableBuilder.string('gender');

                tableBuilder.string('address_line1');
                tableBuilder.string('address_line2');
                tableBuilder.string('city');
                tableBuilder.string('state_or_province');
                tableBuilder.string('postal_code');
                tableBuilder.text('notification_token').nullable();

                tableBuilder.timestamps(true, true);
                tableBuilder.timestamp('deleted_at');

                // Foreign Keys
                tableBuilder
                  .foreign('user_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
                  .onDelete('CASCADE');
              });
          }
        }),
      )
      .catch((err) => {
        Logger.error('MIGRATION_ERROR (users_profiles)', err);
        throw err;
      }),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.users_profiles);
}
