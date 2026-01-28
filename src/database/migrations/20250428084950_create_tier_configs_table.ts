import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.tier_configs).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating tier_config table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.tier_configs, (tableBuilder: Knex.TableBuilder) => {
                // primary key
                tableBuilder.string('id').primary();

                // foreign keys
                tableBuilder.string('tier_id').notNullable();
                tableBuilder.string('country_id').notNullable();

                // columns
                tableBuilder.string('name').nullable();
                tableBuilder.string('description').nullable();

                tableBuilder.integer('level').notNullable();
                tableBuilder.string('status').notNullable();
                tableBuilder.json('verifications').notNullable();
                tableBuilder.bigInteger('maximum_balance').defaultTo(0).notNullable();
                tableBuilder.bigInteger('minimum_balance').defaultTo(0).notNullable();
                tableBuilder.bigInteger('minimum_per_deposit').defaultTo(0).notNullable();
                tableBuilder.bigInteger('maximum_per_deposit').defaultTo(0).notNullable();
                tableBuilder.bigInteger('maximum_daily_deposit').defaultTo(0).notNullable();
                tableBuilder.bigInteger('maximum_monthly_deposit').defaultTo(0).notNullable();
                tableBuilder.bigInteger('maximum_daily_transaction').defaultTo(0).notNullable();
                tableBuilder.bigInteger('maximum_monthly_transaction').defaultTo(0).notNullable();
                tableBuilder.bigInteger('minimum_transaction_amount').defaultTo(0).notNullable();
                tableBuilder.bigInteger('maximum_transaction_amount').defaultTo(0).notNullable();

                // remittance
                tableBuilder.bigInteger('remittance_minimum_per_deposit').nullable();
                tableBuilder.bigInteger('remittance_maximum_per_deposit').nullable();
                tableBuilder.bigInteger('remittance_maximum_daily_deposit').nullable();
                tableBuilder.bigInteger('remittance_maximum_monthly_deposit').nullable();
                tableBuilder.bigInteger('remittance_minimum_transaction_amount').nullable();
                tableBuilder.bigInteger('remittance_maximum_transaction_amount').nullable();
                tableBuilder.bigInteger('remittance_maximum_daily_transaction').nullable();
                tableBuilder.bigInteger('remittance_maximum_monthly_transaction').nullable();
                tableBuilder.bigInteger('total_spendable').nullable();
                tableBuilder.bigInteger('total_receivable').nullable();

                // date columns
                tableBuilder.timestamp('deleted_at').nullable();
                tableBuilder.timestamps(true, true);

                // foreign key constraints
                tableBuilder
                  .foreign('tier_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.tiers}`)
                  .onDelete('CASCADE');
                tableBuilder
                  .foreign('country_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.countries}`)
                  .onDelete('CASCADE');
              });
          }
        }),
      )
      .catch((e: any) => console.error('MIGRATION_ERROR', e)),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.tier_configs);
}
