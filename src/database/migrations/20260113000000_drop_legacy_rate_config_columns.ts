import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

/**
 * This migration drops the legacy individual fee columns from rate_configs table
 * after the data has been migrated to the new JSON config column via Liquibase.
 *
 * IMPORTANT: Only run this migration after the Liquibase migration
 * (003-migrate-rate-configs-to-json) has been executed successfully.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.rate_configs);

    if (tableExists) {
      Logger.log('Dropping legacy columns from rate_configs table');

      // Check if config column exists and has data before dropping old columns
      const hasConfigColumn = await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .hasColumn(DatabaseTables.rate_configs, 'config');

      if (!hasConfigColumn) {
        Logger.error('config column does not exist. Run the add_config_column migration first.');
        throw new Error('config column does not exist. Cannot drop legacy columns.');
      }

      // Verify all records have config populated
      const recordsWithoutConfig = await trx(DatabaseTables.rate_configs)
        .withSchema(DatabaseSchema.apiService)
        .whereNull('config')
        .count('id as count')
        .first();

      if (recordsWithoutConfig && Number(recordsWithoutConfig.count) > 0) {
        Logger.error(`${recordsWithoutConfig.count} records still have NULL config. Run Liquibase migration first.`);
        throw new Error('Some records have NULL config. Run Liquibase migration first.');
      }

      // Make config column not nullable
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.rate_configs, (tableBuilder) => {
        tableBuilder.jsonb('config').notNullable().alter();
      });

      // Drop legacy columns
      const columnsToDrop = [
        'service_fee',
        'service_fee_currency',
        'is_service_fee_percentage',
        'partner_fee',
        'partner_fee_currency',
        'is_partner_fee_percentage',
        'disbursement_fee',
        'disbursement_fee_currency',
        'is_disbursement_fee_percentage',
        'is_active',
        'ngn_withdrawal_fee',
        'is_ngn_withdrawal_fee_percentage',
        'ngn_withdrawal_fee_cap',
      ];

      for (const column of columnsToDrop) {
        const hasColumn = await trx.schema
          .withSchema(DatabaseSchema.apiService)
          .hasColumn(DatabaseTables.rate_configs, column);

        if (hasColumn) {
          await trx.schema
            .withSchema(DatabaseSchema.apiService)
            .alterTable(DatabaseTables.rate_configs, (tableBuilder) => {
              tableBuilder.dropColumn(column);
            });
          Logger.log(`Dropped column: ${column}`);
        }
      }

      Logger.log('Legacy columns dropped from rate_configs table');
    } else {
      Logger.warn('rate_configs table does not exist, skipping migration');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.rate_configs);

    if (tableExists) {
      Logger.log('Re-adding legacy columns to rate_configs table');

      // Re-add the old columns
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.rate_configs, (tableBuilder) => {
        tableBuilder.decimal('service_fee', 18, 8).defaultTo(0);
        tableBuilder.string('service_fee_currency').nullable();
        tableBuilder.boolean('is_service_fee_percentage').defaultTo(false);
        tableBuilder.decimal('partner_fee', 18, 8).defaultTo(0);
        tableBuilder.string('partner_fee_currency').nullable();
        tableBuilder.boolean('is_partner_fee_percentage').defaultTo(false);
        tableBuilder.decimal('disbursement_fee', 18, 8).defaultTo(0);
        tableBuilder.string('disbursement_fee_currency').nullable();
        tableBuilder.boolean('is_disbursement_fee_percentage').defaultTo(false);
        tableBuilder.boolean('is_active').defaultTo(true);
        tableBuilder.decimal('ngn_withdrawal_fee', 18, 8).defaultTo(0);
        tableBuilder.boolean('is_ngn_withdrawal_fee_percentage').defaultTo(false);
        tableBuilder.decimal('ngn_withdrawal_fee_cap', 18, 8).defaultTo(0);
      });

      // Migrate data back from config column to individual columns
      await trx.raw(`
        UPDATE ${DatabaseSchema.apiService}.${DatabaseTables.rate_configs}
        SET
          service_fee = (config->'fiat_exchange'->'service_fee'->>'value')::decimal,
          service_fee_currency = config->'fiat_exchange'->'service_fee'->>'currency',
          is_service_fee_percentage = (config->'fiat_exchange'->'service_fee'->>'is_percentage')::boolean,
          partner_fee = (config->'fiat_exchange'->'partner_fee'->>'value')::decimal,
          partner_fee_currency = config->'fiat_exchange'->'partner_fee'->>'currency',
          is_partner_fee_percentage = (config->'fiat_exchange'->'partner_fee'->>'is_percentage')::boolean,
          disbursement_fee = (config->'fiat_exchange'->'disbursement_fee'->>'value')::decimal,
          disbursement_fee_currency = config->'fiat_exchange'->'disbursement_fee'->>'currency',
          is_disbursement_fee_percentage = (config->'fiat_exchange'->'disbursement_fee'->>'is_percentage')::boolean,
          is_active = (config->>'is_active')::boolean,
          ngn_withdrawal_fee = (config->'fiat_exchange'->'ngn_withdrawal_fee'->>'value')::decimal,
          is_ngn_withdrawal_fee_percentage = (config->'fiat_exchange'->'ngn_withdrawal_fee'->>'is_percentage')::boolean,
          ngn_withdrawal_fee_cap = (config->'fiat_exchange'->'ngn_withdrawal_fee'->>'cap')::decimal
      `);

      // Make config column nullable again
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.rate_configs, (tableBuilder) => {
        tableBuilder.jsonb('config').nullable().alter();
      });

      Logger.log('Legacy columns re-added to rate_configs table');
    }
  });
}
