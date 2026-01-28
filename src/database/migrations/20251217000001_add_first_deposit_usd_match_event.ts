import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

/**
 * Migration: Add FIRST_DEPOSIT_USD_MATCH event
 *
 * Purpose:
 * - Add event for USD fiat reward matching (separate from dosh points)
 * - This event tracks the actual USD match reward, not the points
 */
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.dosh_points_events);

    if (!tableExists) {
      Logger.warn('dosh_points_events table does not exist, skipping migration');
      return;
    }

    // Check if event already exists
    const existingEvent = await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.dosh_points_events)
      .where('code', 'FIRST_DEPOSIT_USD_MATCH')
      .first();

    if (existingEvent) {
      Logger.log('FIRST_DEPOSIT_USD_MATCH event already exists, skipping');
      return;
    }

    Logger.log('Adding FIRST_DEPOSIT_USD_MATCH event');

    await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.dosh_points_events)
      .insert({
        id: 'cm9doshpt000d0emidp004jkl',
        code: 'FIRST_DEPOSIT_USD_MATCH',
        name: 'First Deposit USD Match',
        description: 'USD fiat reward match when a user completes their first USD deposit',
        transaction_type: 'credit',
        default_points: 0, // No dosh points credited, only USD reward
        is_active: true,
        is_one_time_per_user: true,
        metadata: JSON.stringify({ usd_reward_cap: 10 }), // USD match cap
        start_date: null,
        end_date: null,
      });

    Logger.log('FIRST_DEPOSIT_USD_MATCH event added successfully');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.dosh_points_events);

    if (!tableExists) return;

    Logger.log('Removing FIRST_DEPOSIT_USD_MATCH event');

    await trx
      .withSchema(DatabaseSchema.apiService)
      .table(DatabaseTables.dosh_points_events)
      .where('code', 'FIRST_DEPOSIT_USD_MATCH')
      .delete();
  });
}
