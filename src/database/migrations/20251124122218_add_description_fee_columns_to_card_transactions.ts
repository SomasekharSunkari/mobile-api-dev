import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.card_transactions);

    if (tableExists) {
      Logger.log(
        'Adding description, fee, provider_fee_reference, and is_fee_settled columns to card_transactions table',
      );

      const descriptionExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.card_transactions, 'description');

      if (!descriptionExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.card_transactions, (tableBuilder) => {
            tableBuilder.string('description').nullable();
          });
        Logger.log('description column added to card_transactions table');
      }

      const feeExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.card_transactions, 'fee');

      if (!feeExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.card_transactions, (tableBuilder) => {
            tableBuilder.decimal('fee', 18, 6).nullable();
          });
        Logger.log('fee column added to card_transactions table with precision (18, 6)');
      } else {
        // If fee column already exists, update its precision
        Logger.log('Updating existing fee column precision to decimal(18, 6)');
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.card_transactions, (tableBuilder) => {
            tableBuilder.decimal('fee', 18, 6).nullable().alter();
          });
        Logger.log('Fee column precision updated successfully');
      }

      const providerFeeReferenceExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.card_transactions, 'provider_fee_reference');

      if (!providerFeeReferenceExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.card_transactions, (tableBuilder) => {
            tableBuilder.string('provider_fee_reference').nullable();
          });
        Logger.log('provider_fee_reference column added to card_transactions table');
      }

      const isFeeSettledExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.card_transactions, 'is_fee_settled');

      if (!isFeeSettledExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.card_transactions, (tableBuilder) => {
            tableBuilder.boolean('is_fee_settled').defaultTo(false).nullable();
          });
        Logger.log('is_fee_settled column added to card_transactions table');
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.card_transactions);

    if (tableExists) {
      const descriptionExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.card_transactions, 'description');

      if (descriptionExists) {
        Logger.log('Removing description column from card_transactions table');
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.card_transactions, (tableBuilder) => {
            tableBuilder.dropColumn('description');
          });
        Logger.log('description column removed from card_transactions table');
      }

      const feeExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.card_transactions, 'fee');

      if (feeExists) {
        Logger.log('Removing fee column from card_transactions table');
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.card_transactions, (tableBuilder) => {
            tableBuilder.dropColumn('fee');
          });
        Logger.log('fee column removed from card_transactions table');
      }

      const providerFeeReferenceExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.card_transactions, 'provider_fee_reference');

      if (providerFeeReferenceExists) {
        Logger.log('Removing provider_fee_reference column from card_transactions table');
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.card_transactions, (tableBuilder) => {
            tableBuilder.dropColumn('provider_fee_reference');
          });
        Logger.log('provider_fee_reference column removed from card_transactions table');
      }

      const isFeeSettledExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.card_transactions, 'is_fee_settled');

      if (isFeeSettledExists) {
        Logger.log('Removing is_fee_settled column from card_transactions table');
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.card_transactions, (tableBuilder) => {
            tableBuilder.dropColumn('is_fee_settled');
          });
        Logger.log('is_fee_settled column removed from card_transactions table');
      }
    }
  });
}
