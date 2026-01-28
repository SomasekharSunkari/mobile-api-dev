import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.account_deactivation_logs);

    if (tableExists) {
      Logger.log('Adding reactivation columns to account_deactivation_logs table');

      const reactivationDescriptionExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.account_deactivation_logs, 'reactivation_description');

      if (!reactivationDescriptionExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.account_deactivation_logs, (tableBuilder) => {
            tableBuilder.text('reactivation_description').nullable();
            tableBuilder.string('reactivation_support_document_url').nullable();
          });

        Logger.log('Successfully added reactivation columns to account_deactivation_logs table');
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.account_deactivation_logs);

    if (tableExists) {
      const reactivationDescriptionExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.account_deactivation_logs, 'reactivation_description');

      if (reactivationDescriptionExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.account_deactivation_logs, (tableBuilder) => {
            tableBuilder.dropColumn('reactivation_description');
            tableBuilder.dropColumn('reactivation_support_document_url');
          });
      }
    }
  });
}
