import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.bank_beneficiaries);

    if (tableExists) {
      Logger.log('Adding bank_ref column to bank_beneficiaries table');

      const bankRefExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.bank_beneficiaries, 'bank_ref');

      if (!bankRefExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.bank_beneficiaries, (tableBuilder) => {
            tableBuilder.string('bank_ref').nullable().comment('reference of the bank');
          });

        Logger.log('Successfully added bank_ref column to bank_beneficiaries table');
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.bank_beneficiaries);

    if (tableExists) {
      const bankRefExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.bank_beneficiaries, 'bank_ref');

      if (bankRefExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.bank_beneficiaries, (tableBuilder) => {
            tableBuilder.dropColumn('bank_ref');
          });
      }
    }
  });
}
