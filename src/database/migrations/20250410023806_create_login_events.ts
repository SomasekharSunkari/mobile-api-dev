import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';
import { Logger } from '@nestjs/common';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.login_events).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating login_events table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.login_events, (tableBuilder) => {
                tableBuilder.string('id').primary();
                tableBuilder.string('user_id').notNullable();
                tableBuilder.string('device_id');

                tableBuilder.string('ip_address', 45);
                tableBuilder.timestamp('login_time').defaultTo(trx.fn.now());

                tableBuilder.string('city');
                tableBuilder.string('region');
                tableBuilder.string('country');
                tableBuilder.boolean('is_vpn').defaultTo(false);
                tableBuilder.decimal('risk_score', 5, 2).nullable();

                tableBuilder.timestamps(true, true);
                tableBuilder.timestamp('deleted_at').nullable();

                // Foreign key constraints
                tableBuilder
                  .foreign('user_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
                  .onDelete('CASCADE');

                tableBuilder
                  .foreign('device_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.login_devices}`)
                  .onDelete('SET NULL');
              });
          }
        }),
      )
      .catch((err) => {
        Logger.error('MIGRATION_ERROR (login_events)', err);
        throw err;
      }),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.login_events);
}
