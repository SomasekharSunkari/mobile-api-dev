import { createId } from '@paralleldrive/cuid2';
import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

export async function seed(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const existingConfig = await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.rate_configs)
      .where('provider', 'yellowcard')
      .first();

    if (existingConfig) {
      console.log('Rate config for yellowcard already exists, skipping seed');
      return;
    }

    await trx.withSchema(DatabaseSchema.apiService).table(DatabaseTables.rate_configs).insert({
      id: createId(),
      provider: 'yellowcard',
      service_fee: 0.5,
      is_service_fee_percentage: true,
      partner_fee: 2,
      is_partner_fee_percentage: true,
      is_active: true,
      disbursement_fee: 10000,
      disbursement_fee_currency: 'NGN',
      is_disbursement_fee_percentage: false,
      description: 'YellowCard exchange provider rate configuration',
    });

    console.log('Rate config for yellowcard created successfully');
  });
}
