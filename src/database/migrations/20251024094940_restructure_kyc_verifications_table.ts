import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Removing columns from kyc_verifications table');

      // Now remove the limits from the tiers table
      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .alterTable(DatabaseTables.kyc_verifications, (table: Knex.CreateTableBuilder) => {
          // Drop foreign key constraint
          table.dropForeign('country_id', 'kyc_verifications_country_id_foreign');

          // Drop columns
          table.dropColumn('country_id');
          table.dropColumn('identity_type');
          table.dropColumn('identity_value');
          table.dropColumn('provider_level');

          // Add new columns
          table.string('tier_config_verification_requirement_id').nullable();
          table.string('provider_verification_type', 100).nullable();

          // Add foreign key constraint
          table
            .foreign('tier_config_verification_requirement_id', 'kv_tier_c_v_r_id_foreign')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.tier_config_verification_requirements}`)
            .onDelete('CASCADE');
        });

      Logger.log('Successfully removed columns from kyc_verifications table');
    } catch (error) {
      Logger.error('Error removing columns from kyc_verifications table', error);
      throw error;
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) => {
    try {
      Logger.log('Adding columns to kyc_verifications table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .alterTable(DatabaseTables.kyc_verifications, (table: Knex.CreateTableBuilder) => {
          // drop foreign key constraint
          table.dropForeign('tier_config_verification_requirement_id', 'kv_tier_c_v_r_id_foreign');

          // drop columns
          table.dropColumn('tier_config_verification_requirement_id');
          table.dropColumn('provider_verification_type');

          // Add columns
          table.string('country_id').nullable();

          table.string('identity_type').nullable();
          table.string('identity_value').nullable();
          table.string('provider_level').nullable();

          table
            .foreign('country_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.countries}`)
            .onDelete('CASCADE');
        });

      Logger.log('Successfully added columns to kyc_verifications table');
    } catch (error) {
      Logger.error('Error adding columns to kyc_verifications table', error);
      throw error;
    }
  });
}
