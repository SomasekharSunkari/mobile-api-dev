import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.transaction_aggregates);

    if (!tableExists) {
      Logger.log('Creating transaction_aggregates table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.transaction_aggregates, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder.date('date').notNullable();
          tableBuilder.string('transaction_type').notNullable();
          tableBuilder.string('provider').notNullable();
          tableBuilder.bigInteger('amount').notNullable();

          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('deleted_at').nullable();

          tableBuilder.index(['date', 'provider', 'transaction_type'], 'idx_transaction_aggregates_lookup');
        });

      Logger.log('Transaction aggregates table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.transaction_aggregates);
}
