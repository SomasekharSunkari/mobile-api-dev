import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

/**
 * Migration: Add idempotency_key column to fiat_wallet_transactions table
 *
 * Purpose:
 * - Adds idempotency_key column to support idempotent withdrawal operations
 * - Prevents duplicate withdrawals from network retries or concurrent requests
 * - Enables clients to safely retry failed requests without risk of double-processing
 *
 * Security Benefits:
 * - Prevents race conditions where multiple identical withdrawal requests could be processed
 * - Ensures financial transactions are processed exactly once
 * - Provides audit trail for tracking duplicate request attempts
 */
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.fiat_wallet_transactions);

    if (tableExists) {
      Logger.log('Adding idempotency_key column to fiat_wallet_transactions table');

      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.fiat_wallet_transactions, 'idempotency_key');

      if (!columnExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.fiat_wallet_transactions, (tableBuilder) => {
            // Add idempotency_key column
            // Max 40 characters to match industry standards (e.g., Stripe, Fireblocks)
            // Nullable to support existing records and optional usage
            tableBuilder
              .string('idempotency_key', 40)
              .nullable()
              .comment('Unique key to ensure idempotent transaction processing and prevent duplicate withdrawals');

            // Add unique constraint to prevent duplicate idempotency keys
            // This ensures that each idempotency key can only be used once across all transactions
            tableBuilder.unique(['idempotency_key'], {
              indexName: 'fiat_wallet_transactions_idempotency_key_unique',
            });

            // Add index for fast lookups when checking for existing idempotency keys
            // This optimizes the idempotency check that happens before transaction creation
            tableBuilder.index(['idempotency_key'], 'fiat_wallet_transactions_idempotency_key_idx');

            // Add composite index for user-specific idempotency checks
            // This allows efficient queries to check if a user has already used an idempotency key
            tableBuilder.index(['user_id', 'idempotency_key'], 'fiat_wallet_transactions_user_id_idempotency_key_idx');
          });

        Logger.log('idempotency_key column added to fiat_wallet_transactions table with unique constraint and indexes');
      } else {
        Logger.log('idempotency_key column already exists in fiat_wallet_transactions table');
      }
    } else {
      Logger.warn('fiat_wallet_transactions table does not exist, skipping migration');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.fiat_wallet_transactions);

    if (tableExists) {
      Logger.log('Removing idempotency_key column from fiat_wallet_transactions table');

      const columnExists = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.fiat_wallet_transactions, 'idempotency_key');

      if (columnExists) {
        await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .alterTable(DatabaseTables.fiat_wallet_transactions, (tableBuilder) => {
            // Drop indexes first
            tableBuilder.dropIndex(
              ['user_id', 'idempotency_key'],
              'fiat_wallet_transactions_user_id_idempotency_key_idx',
            );
            tableBuilder.dropIndex(['idempotency_key'], 'fiat_wallet_transactions_idempotency_key_idx');

            // Drop unique constraint
            tableBuilder.dropUnique(['idempotency_key'], 'fiat_wallet_transactions_idempotency_key_unique');

            // Drop column
            tableBuilder.dropColumn('idempotency_key');
          });

        Logger.log('idempotency_key column removed from fiat_wallet_transactions table');
      }
    }
  });
}
