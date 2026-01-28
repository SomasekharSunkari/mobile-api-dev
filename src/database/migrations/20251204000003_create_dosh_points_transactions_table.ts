import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.dosh_points_transactions);

    if (!tableExists) {
      Logger.log('Creating dosh_points_transactions table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.dosh_points_transactions, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder.string('dosh_points_account_id').notNullable();
          tableBuilder.string('user_id').notNullable();
          tableBuilder.string('event_code').notNullable();
          tableBuilder.string('transaction_type').notNullable();
          tableBuilder.bigInteger('amount').notNullable();
          tableBuilder.bigInteger('balance_before').notNullable();
          tableBuilder.bigInteger('balance_after').notNullable();
          tableBuilder.string('source_reference').nullable();
          tableBuilder.text('description').nullable();
          tableBuilder.jsonb('metadata').nullable();
          tableBuilder.string('status').notNullable().defaultTo('pending');
          tableBuilder.string('idempotency_key').nullable().unique();
          tableBuilder.timestamp('processed_at').nullable();

          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('deleted_at').nullable();

          tableBuilder
            .foreign('dosh_points_account_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_accounts}`)
            .onDelete('CASCADE');

          tableBuilder
            .foreign('user_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
            .onDelete('CASCADE');

          tableBuilder
            .foreign('event_code')
            .references('code')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_events}`)
            .onDelete('RESTRICT');
        });

      // Add indexes for common queries
      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .alterTable(DatabaseTables.dosh_points_transactions, (tableBuilder) => {
          tableBuilder.index(['user_id'], 'idx_dosh_points_transactions_user_id');
          tableBuilder.index(['dosh_points_account_id'], 'idx_dosh_points_transactions_account_id');
          tableBuilder.index(['event_code'], 'idx_dosh_points_transactions_event_code');
          tableBuilder.index(['status'], 'idx_dosh_points_transactions_status');
        });

      Logger.log('dosh_points_transactions table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.dosh_points_transactions);
}
