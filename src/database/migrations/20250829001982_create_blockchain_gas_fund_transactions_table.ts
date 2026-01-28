import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.blockchain_gas_fund_transactions).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating blockchain_gas_fund_transactions table');
            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.blockchain_gas_fund_transactions, (tableBuilder) => {
                tableBuilder.string('id').primary();
                tableBuilder.string('user_id').notNullable();
                tableBuilder.string('blockchain_wallet_id').notNullable();
                tableBuilder.string('native_asset_id').notNullable();
                tableBuilder.decimal('amount', 20, 8).notNullable();
                tableBuilder.string('status').notNullable().defaultTo('pending');
                tableBuilder.string('provider_reference').nullable();
                tableBuilder.string('tx_hash').nullable();
                tableBuilder.string('failure_reason').nullable();
                tableBuilder.decimal('network_fee', 20, 8).nullable();
                tableBuilder.string('idempotency_key').nullable();
                tableBuilder.jsonb('metadata').nullable();
                tableBuilder.timestamps(true, true);
                tableBuilder.timestamp('deleted_at').nullable();

                // Foreign key constraints
                tableBuilder
                  .foreign('user_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
                  .onDelete('CASCADE');
                tableBuilder
                  .foreign('blockchain_wallet_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.blockchain_wallets}`)
                  .onDelete('CASCADE');

                // Indexes
                tableBuilder.index('user_id');
                tableBuilder.index('blockchain_wallet_id');
                tableBuilder.index('status');
                tableBuilder.index('provider_reference');
                tableBuilder.index('created_at');
                tableBuilder.index('idempotency_key');
              });
          }
        }),
      )
      .catch((e) => {
        Logger.error('MIGRATION_ERROR', e);
        throw e;
      }),
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema(DatabaseSchema.apiService)
    .dropTableIfExists(DatabaseTables.blockchain_gas_fund_transactions);
}
