import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';
import { Logger } from '@nestjs/common';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.login_devices).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating login_devices table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.login_devices, (tableBuilder) => {
                tableBuilder.string('id').primary();
                tableBuilder.string('user_id').notNullable();

                tableBuilder.string('device_fingerprint').notNullable();
                tableBuilder.string('device_name');
                tableBuilder.string('device_type');
                tableBuilder.string('os');
                tableBuilder.string('browser');
                tableBuilder.boolean('is_trusted').defaultTo(false);
                tableBuilder.timestamp('last_verified_at').nullable();
                tableBuilder.timestamp('last_login');

                tableBuilder.timestamps(true, true);
                tableBuilder.timestamp('deleted_at').nullable();

                // Foreign key constraint to users table
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
        Logger.error('MIGRATION_ERROR (login_devices)', err);
        throw err;
      }),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.login_devices);
}
