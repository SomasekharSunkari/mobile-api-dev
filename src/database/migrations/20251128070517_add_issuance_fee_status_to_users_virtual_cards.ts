import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const hasColumn = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasColumn(DatabaseTables.users_virtual_cards, 'issuance_fee_status');

    if (!hasColumn) {
      Logger.log('Adding issuance_fee_status column to users_virtual_cards table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .table(DatabaseTables.users_virtual_cards, (tableBuilder) => {
          tableBuilder
            .string('issuance_fee_status')
            .defaultTo('pending')
            .notNullable()
            .comment('Issuance fee status: pending, completed, failed');
        });

      Logger.log('issuance_fee_status column added to users_virtual_cards table');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const hasColumn = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasColumn(DatabaseTables.users_virtual_cards, 'issuance_fee_status');

    if (hasColumn) {
      Logger.log('Removing issuance_fee_status column from users_virtual_cards table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .table(DatabaseTables.users_virtual_cards, (tableBuilder) => {
          tableBuilder.dropColumn('issuance_fee_status');
        });

      Logger.log('issuance_fee_status column removed from users_virtual_cards table');
    }
  });
}
