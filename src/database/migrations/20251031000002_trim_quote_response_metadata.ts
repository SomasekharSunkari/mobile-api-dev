import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

/**
 * Migration to trim request_funding_quote_response in transaction metadata
 *
 * Context: The entire quote response object was being stored in metadata JSONB columns,
 * causing RAM exhaustion and container OOM kills. This migration extracts only essential
 * fields (quoteRef, amount, currency, expiresAt) from existing quote responses.
 */
export async function up(knex: Knex): Promise<void> {
  const logger = new Logger('TrimQuoteResponseMigration');

  await knex.transaction(async (trx) => {
    logger.log('Starting request_funding_quote_response trimming in transactions table...');

    // Trim request_funding_quote_response to essential fields only
    await trx.raw(`
      UPDATE ${DatabaseSchema.apiService}.${DatabaseTables.transactions}
      SET metadata = jsonb_set(
        metadata::jsonb - 'request_funding_quote_response',
        '{quote}',
        jsonb_build_object(
          'quoteRef', metadata::jsonb->'request_funding_quote_response'->>'quoteRef',
          'amount', metadata::jsonb->'request_funding_quote_response'->>'amount',
          'rate', metadata::jsonb->'request_funding_quote_response'->>'rate',
          'expiresAt', metadata::jsonb->'request_funding_quote_response'->>'expiresAt'
        )
      )::text
      WHERE metadata IS NOT NULL
        AND metadata::jsonb->'request_funding_quote_response' IS NOT NULL
    `);

    logger.log('Completed request_funding_quote_response trimming in transactions table');

    // Log statistics
    const affectedCount = await trx(DatabaseTables.transactions)
      .withSchema(DatabaseSchema.apiService)
      .whereRaw("metadata IS NOT NULL AND metadata::jsonb->'quote' IS NOT NULL")
      .count('* as count')
      .first();

    logger.log(`Trimming complete. Affected records: ${affectedCount?.count || 0} transactions with quote data`);
  });
}

export async function down(): Promise<void> {
  // No rollback - trimming is a one-way operation for data cleanup
  Logger.warn('Rollback not implemented for quote response trimming - this is a data cleanup operation');
}
