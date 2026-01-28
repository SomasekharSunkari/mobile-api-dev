import { createId } from '@paralleldrive/cuid2';
import { Knex } from 'knex';
import { PROVIDERS } from '../../../constants/constants';
import { ProviderLimitType } from '../../models/providerLimit/providerLimit.interface';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

export async function seed(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const limitsToCreate = [
      {
        id: createId(),
        provider: PROVIDERS.ZEROHASH,
        limit_type: ProviderLimitType.WEEKLY_DEPOSIT,
        limit_value: 10000000,
        currency: 'USD',
        is_active: true,
        description: 'ZeroHash platform weekly deposit limit in cents ($100,000)',
      },
      {
        id: createId(),
        provider: PROVIDERS.ZEROHASH,
        limit_type: ProviderLimitType.WEEKLY_WITHDRAWAL,
        limit_value: 10000000,
        currency: 'USD',
        is_active: true,
        description: 'ZeroHash platform weekly withdrawal limit in cents ($100,000)',
      },
    ];

    for (const limit of limitsToCreate) {
      const existing = await trx
        .withSchema(DatabaseSchema.apiService)
        .table(DatabaseTables.provider_limits)
        .where('provider', limit.provider)
        .where('limit_type', limit.limit_type)
        .where('currency', limit.currency)
        .first();

      if (existing) {
        console.log(`Provider limit already exists: ${limit.provider} ${limit.limit_type} ${limit.currency}`);
        continue;
      }

      await trx.withSchema(DatabaseSchema.apiService).table(DatabaseTables.provider_limits).insert(limit);
      console.log(`Created provider limit: ${limit.provider} ${limit.limit_type} ${limit.currency}`);
    }
  });
}
