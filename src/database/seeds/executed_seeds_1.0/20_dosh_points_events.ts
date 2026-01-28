import { Knex } from 'knex';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';

export async function seed(knex: Knex): Promise<void> {
  // Check if events already exist to avoid duplicates
  const existingEvents = await knex
    .withSchema(DatabaseSchema.apiService)
    .table(DatabaseTables.dosh_points_events)
    .select('code');

  const existingCodes = new Set(existingEvents.map((e) => e.code));

  const events = [
    {
      id: 'cm9doshpt000a0emidp001abc',
      code: 'ONBOARDING_BONUS',
      name: 'Onboarding Bonus',
      description: 'Points awarded when a user completes KYC onboarding',
      transaction_type: 'credit',
      default_points: 10,
      is_active: true,
      is_one_time_per_user: true,
      metadata: null,
      start_date: null,
      end_date: null,
    },
    {
      id: 'cm9doshpt000b0emidp002def',
      code: 'REGISTRATION_BONUS',
      name: 'Registration Bonus',
      description: 'Points awarded when a user completes registration',
      transaction_type: 'credit',
      default_points: 10,
      is_active: true,
      is_one_time_per_user: true,
      metadata: null,
      start_date: null,
      end_date: null,
    },
    {
      id: 'cm9doshpt000c0emidp003ghi',
      code: 'FIRST_DEPOSIT_USD',
      name: 'First Deposit Bonus',
      description: 'Points awarded when a user completes their first USD deposit',
      transaction_type: 'credit',
      default_points: 10,
      is_active: true,
      is_one_time_per_user: true,
      metadata: null,
      start_date: null,
      end_date: null,
    },
  ];

  // Filter out events that already exist
  const newEvents = events.filter((e) => !existingCodes.has(e.code));

  if (newEvents.length > 0) {
    await knex.withSchema(DatabaseSchema.apiService).table(DatabaseTables.dosh_points_events).insert(newEvents);
  }
}
