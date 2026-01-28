import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.card_transaction_disputes);

    if (tableExists) {
      Logger.log('card_transaction_disputes table already exists, skipping');
      return;
    }

    Logger.log('Creating card_transaction_disputes table');

    await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .createTable(DatabaseTables.card_transaction_disputes, (tableBuilder) => {
        tableBuilder.string('id').primary();

        tableBuilder.string('transaction_id').notNullable();
        tableBuilder.string('provider_dispute_ref').notNullable();
        tableBuilder.string('transaction_ref').notNullable();
        tableBuilder.string('status').notNullable();
        tableBuilder.text('text_evidence').nullable();
        tableBuilder.timestamp('resolved_at').nullable();

        tableBuilder.timestamps(true, true);
        tableBuilder.timestamp('deleted_at').nullable();

        tableBuilder
          .foreign('transaction_id')
          .references('id')
          .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.card_transactions}`);
      });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const hasTable = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.card_transaction_disputes);

    if (!hasTable) return;

    await trx.schema.withSchema(DatabaseSchema.apiService).dropTable(DatabaseTables.card_transaction_disputes);
  });
}
