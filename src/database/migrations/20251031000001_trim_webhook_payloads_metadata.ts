import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

/**
 * Migration to trim webhook_payloads array in transaction and fiat_wallet_transaction metadata
 *
 * Context: Webhook payloads were being stored indefinitely in metadata JSONB columns,
 * causing RAM exhaustion and container OOM kills. This migration limits existing records
 * to the last 5 webhook payloads.
 */
export async function up(knex: Knex): Promise<void> {
  const logger = new Logger('TrimWebhookPayloadsMigration');

  await knex.transaction(async (trx) => {
    logger.log('Starting webhook_payloads trimming in transactions table...');

    // Trim webhook_payloads in transactions table
    // metadata is stored as TEXT, so we cast to JSONB for operations
    // Using metadata->'webhook_payloads' IS NOT NULL to check key existence (avoids ? operator issue)
    await trx.raw(`
      UPDATE ${DatabaseSchema.apiService}.${DatabaseTables.transactions}
      SET metadata = jsonb_set(
        metadata::jsonb,
        '{webhook_payloads}',
        (
          SELECT jsonb_agg(elem)
          FROM (
            SELECT elem
            FROM jsonb_array_elements(metadata::jsonb->'webhook_payloads') AS elem
            ORDER BY (elem->>'timestamp')::timestamp DESC
            LIMIT 5
          ) AS limited
        )
      )::text
      WHERE metadata IS NOT NULL
        AND metadata::jsonb->'webhook_payloads' IS NOT NULL
        AND jsonb_array_length(metadata::jsonb->'webhook_payloads') > 5
    `);

    logger.log('Completed webhook_payloads trimming in transactions table');

    logger.log('Starting webhook_payloads trimming in fiat_wallet_transactions table...');

    // Trim webhook_payloads in fiat_wallet_transactions table
    // provider_metadata is stored as TEXT, so we cast to JSONB for operations
    // Using provider_metadata->'webhook_payloads' IS NOT NULL to check key existence (avoids ? operator issue)
    await trx.raw(`
      UPDATE ${DatabaseSchema.apiService}.${DatabaseTables.fiat_wallet_transactions}
      SET provider_metadata = jsonb_set(
        provider_metadata::jsonb,
        '{webhook_payloads}',
        (
          SELECT jsonb_agg(elem)
          FROM (
            SELECT elem
            FROM jsonb_array_elements(provider_metadata::jsonb->'webhook_payloads') AS elem
            ORDER BY (elem->>'timestamp')::timestamp DESC
            LIMIT 5
          ) AS limited
        )
      )::text
      WHERE provider_metadata IS NOT NULL
        AND provider_metadata::jsonb->'webhook_payloads' IS NOT NULL
        AND jsonb_array_length(provider_metadata::jsonb->'webhook_payloads') > 5
    `);

    logger.log('Completed webhook_payloads trimming in fiat_wallet_transactions table');

    // Log statistics
    const transactionsCount = await trx(DatabaseTables.transactions)
      .withSchema(DatabaseSchema.apiService)
      .whereRaw("metadata IS NOT NULL AND metadata::jsonb->'webhook_payloads' IS NOT NULL")
      .count('* as count')
      .first();

    const fiatWalletTransactionsCount = await trx(DatabaseTables.fiat_wallet_transactions)
      .withSchema(DatabaseSchema.apiService)
      .whereRaw("provider_metadata IS NOT NULL AND provider_metadata::jsonb->'webhook_payloads' IS NOT NULL")
      .count('* as count')
      .first();

    logger.log(
      `Trimming complete. Affected tables: transactions (${transactionsCount?.count || 0} records with webhook_payloads), fiat_wallet_transactions (${fiatWalletTransactionsCount?.count || 0} records with webhook_payloads)`,
    );
  });
}

export async function down(): Promise<void> {
  // No rollback - trimming is a one-way operation for data cleanup
  Logger.warn('Rollback not implemented for webhook_payloads trimming - this is a data cleanup operation');
}
