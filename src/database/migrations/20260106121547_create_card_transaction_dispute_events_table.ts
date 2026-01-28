import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.card_transaction_dispute_events);

    if (tableExists) {
      Logger.log('card_transaction_dispute_events table already exists, skipping');
      return;
    }

    Logger.log('Creating card_transaction_dispute_events table');

    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .createTable(DatabaseTables.card_transaction_dispute_events, (tableBuilder) => {
        tableBuilder.string('id').primary();

        tableBuilder.string('dispute_id').notNullable();
        tableBuilder.string('previous_status').nullable();
        tableBuilder.string('new_status').notNullable();
        tableBuilder.string('event_type').notNullable();
        tableBuilder.string('triggered_by').notNullable();
        tableBuilder.string('user_id').nullable();
        tableBuilder.text('reason').nullable();

        tableBuilder.timestamps(true, true);
        tableBuilder.timestamp('deleted_at').nullable();

        tableBuilder
          .foreign('dispute_id')
          .references('id')
          .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.card_transaction_disputes}`)
          .onDelete('CASCADE');

        tableBuilder
          .foreign('user_id')
          .references('id')
          .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
          .onDelete('SET NULL');
      });

    Logger.log('card_transaction_dispute_events table created');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const hasTable = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.card_transaction_dispute_events);

    if (!hasTable) return;

    await trx.schema.withSchema(DatabaseSchema.apiService).dropTable(DatabaseTables.card_transaction_dispute_events);
  });
}
