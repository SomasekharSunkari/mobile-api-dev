import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.external_accounts);

    if (!tableExists) {
      Logger.log('Creating external_accounts table');

      await trx.schema.withSchema(DatabaseSchema.apiService).createTable(DatabaseTables.external_accounts, (table) => {
        table.string('id').primary();
        table.string('user_id').notNullable();

        table.string('external_account_ref');
        table.string('participant_code');
        table.string('provider_kyc_status');
        table.string('status');
        table.string('provider').notNullable();

        table.string('linked_provider');
        table.string('linked_item_ref');
        table.string('linked_account_ref');
        table.text('linked_access_token');
        table.text('linked_processor_token');

        table.string('bank_ref');
        table.string('bank_name');
        table.string('account_number');
        table.string('routing_number');
        table.string('nuban');
        table.string('swift_code');

        table.timestamp('expiration_date').nullable();
        table.jsonb('capabilities');

        table.string('account_name');
        table.string('account_type');

        table.timestamps(true, true);
        table.timestamp('deleted_at').nullable();

        table.foreign('user_id').references('id').inTable(`${DatabaseSchema.apiService}.users`).onDelete('CASCADE');
      });

      Logger.log('external_accounts table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.external_accounts);
}
