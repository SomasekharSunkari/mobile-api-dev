import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.account_delete_requests);

    if (tableExists) {
      Logger.log('Converting reason column to reasons jsonb in account_delete_requests table');

      const reasonColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.account_delete_requests, 'reason');

      const reasonsColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.account_delete_requests, 'reasons');

      if (reasonColumnExists && !reasonsColumnExists) {
        // Add new reasons column as jsonb
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.account_delete_requests, (tableBuilder) => {
            tableBuilder.jsonb('reasons').nullable();
          });

        // Migrate data from reason to reasons
        await trx.raw(`
          UPDATE ${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}
          SET reasons = jsonb_build_array(jsonb_build_object('reason', reason))
          WHERE reason IS NOT NULL
        `);

        // Drop old reason column
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.account_delete_requests, (tableBuilder) => {
            tableBuilder.dropColumn('reason');
          });

        // Make reasons not nullable
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.account_delete_requests, (tableBuilder) => {
            tableBuilder.jsonb('reasons').notNullable().alter();
          });

        Logger.log('Successfully converted reason to reasons jsonb in account_delete_requests table');
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.account_delete_requests);

    if (tableExists) {
      const reasonsColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.account_delete_requests, 'reasons');

      const reasonColumnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.account_delete_requests, 'reason');

      if (reasonsColumnExists && !reasonColumnExists) {
        Logger.log('Reverting reasons jsonb to reason string in account_delete_requests table');

        // Add back the reason column
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.account_delete_requests, (tableBuilder) => {
            tableBuilder.string('reason').nullable();
          });

        // Migrate data back from reasons to reason (take first reason)
        await trx.raw(`
          UPDATE ${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}
          SET reason = reasons->0->>'reason'
          WHERE reasons IS NOT NULL AND jsonb_array_length(reasons) > 0
        `);

        // Make reason not nullable
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.account_delete_requests, (tableBuilder) => {
            tableBuilder.string('reason').notNullable().alter();
          });

        // Drop reasons column
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.account_delete_requests, (tableBuilder) => {
            tableBuilder.dropColumn('reasons');
          });

        Logger.log('Successfully reverted reasons to reason in account_delete_requests table');
      }
    }
  });
}
