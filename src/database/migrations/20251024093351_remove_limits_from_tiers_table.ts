import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Removing limits from tiers table');

      // Now remove the limits from the tiers table
      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .alterTable(DatabaseTables.tiers, (table: Knex.CreateTableBuilder) => {
          table.dropColumn('minimum_deposit');
          table.dropColumn('maximum_deposit');
          table.dropColumn('minimum_balance');
          table.dropColumn('maximum_balance');
        });

      Logger.log('Successfully removed limits from tiers table');
    } catch (error) {
      Logger.error('Error removing limits from tiers table', error);
      throw error;
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Adding limits to tiers table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .alterTable(DatabaseTables.tiers, (table: Knex.CreateTableBuilder) => {
          table.bigInteger('minimum_deposit').defaultTo(0).notNullable();
          table.bigInteger('maximum_deposit').defaultTo(0).notNullable();
          table.bigInteger('minimum_balance').defaultTo(0).notNullable();
          table.bigInteger('maximum_balance').defaultTo(0).notNullable();
        });

      Logger.log('Successfully added limits to tiers table');
    } catch (error) {
      Logger.error('Error adding limits to tiers table', error);
      throw error;
    }
  });
}
