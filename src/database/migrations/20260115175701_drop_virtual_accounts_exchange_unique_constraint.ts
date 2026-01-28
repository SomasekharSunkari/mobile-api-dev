import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Dropping virtual_accounts_user_provider_type_exchange_ref_unique constraint');

      await trx.raw(`
        DROP INDEX IF EXISTS ${DatabaseSchema.apiService}.virtual_accounts_user_provider_type_exchange_ref_unique
      `);

      Logger.log('Successfully dropped virtual_accounts_user_provider_type_exchange_ref_unique constraint');
    } catch (error) {
      Logger.error('Error dropping virtual_accounts constraint', error);
      throw error;
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Recreating virtual_accounts_user_provider_type_exchange_ref_unique constraint');

      await trx.raw(`
        CREATE UNIQUE INDEX IF NOT EXISTS virtual_accounts_user_provider_type_exchange_ref_unique
        ON ${DatabaseSchema.apiService}.virtual_accounts (user_id, provider, type, transaction_id)
        WHERE transaction_id IS NOT NULL
      `);

      Logger.log('Successfully recreated virtual_accounts_user_provider_type_exchange_ref_unique constraint');
    } catch (error) {
      Logger.error('Error recreating virtual_accounts constraint', error);
      throw error;
    }
  });
}
