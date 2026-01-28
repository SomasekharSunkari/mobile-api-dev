import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.virtual_accounts).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating virtual_accounts table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.virtual_accounts, (tableBuilder: Knex.TableBuilder) => {
                // primary key
                tableBuilder.string('id').primary();

                // foreign keys
                tableBuilder.string('user_id').notNullable();
                tableBuilder.string('fiat_wallet_id').notNullable();

                // columns
                tableBuilder.string('account_name').notNullable();
                tableBuilder.string('account_number').notNullable();
                tableBuilder.string('bank_name').notNullable();
                tableBuilder.string('bank_ref').nullable();
                tableBuilder.string('routing_number').nullable();
                tableBuilder.string('iban').nullable();
                tableBuilder.string('provider').notNullable();
                tableBuilder.string('provider_ref').nullable();
                tableBuilder.string('address').nullable();
                tableBuilder.string('state').nullable();
                tableBuilder.string('city').nullable();
                tableBuilder.string('postal_code').nullable();
                tableBuilder.bigInteger('provider_balance').notNullable();

                // date columns
                tableBuilder.timestamp('deleted_at').nullable();
                tableBuilder.timestamps(true, true);

                // foreign key constraints
                tableBuilder
                  .foreign('user_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
                  .onDelete('CASCADE');

                tableBuilder
                  .foreign('fiat_wallet_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallets}`)
                  .onDelete('CASCADE');
              });
          }
        }),
      )
      .catch((e: any) => console.error('MIGRATION_ERROR', e)),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.virtual_accounts);
}
