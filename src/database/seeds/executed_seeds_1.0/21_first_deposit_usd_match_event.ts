import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

export async function seed(knex: Knex): Promise<void> {
  const event = {
    id: 'cm9doshpt000d0emidp004jkl',
    code: 'FIRST_DEPOSIT_USD_MATCH',
    name: 'First Deposit USD Match',
    description: 'USD fiat reward match when a user completes their first USD deposit',
    transaction_type: 'credit',
    default_points: 0,
    is_active: true,
    is_one_time_per_user: true,
    metadata: { usd_reward_cap: 10 },
    start_date: null,
    end_date: null,
  };

  // Check if event already exists to avoid duplicates
  const existingEvent = await knex
    .withSchema(DatabaseSchema.apiService)
    .table(DatabaseTables.dosh_points_events)
    .where('code', event.code)
    .first();

  if (!existingEvent) {
    await knex.withSchema(DatabaseSchema.apiService).table(DatabaseTables.dosh_points_events).insert(event);
  }
}
