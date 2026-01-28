import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const oldTableName = 'account_deactivation_codes';
    const newTableName = 'account_action_codes';

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(oldTableName);

    if (tableExists) {
      // Drop old indexes before renaming table
      Logger.log('Dropping old indexes from account_deactivation_codes table');
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(oldTableName, (table) => {
        table.dropIndex('user_id', 'account_deactivation_codes_user_id_idx');
        table.dropIndex('email', 'account_deactivation_codes_email_idx');
        table.dropIndex('is_used', 'account_deactivation_codes_is_used_idx');
      });

      // Rename table
      Logger.log(`Renaming ${oldTableName} table to ${newTableName}`);
      await trx.schema.withSchema(DatabaseSchema.apiService).renameTable(oldTableName, newTableName);
      Logger.log(`Table renamed from ${oldTableName} to ${newTableName}`);

      // Add type column
      const columnExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasColumn(newTableName, 'type');
      if (!columnExists) {
        Logger.log('Adding type column to account_action_codes table');
        await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(newTableName, (tableBuilder) => {
          tableBuilder.string('type').notNullable().defaultTo('deactivation');
        });
        Logger.log('type column added to account_action_codes table');
      }

      // Recreate indexes with new names
      Logger.log('Creating new indexes for account_action_codes table');
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(newTableName, (table) => {
        table.index('user_id', 'account_action_codes_user_id_idx');
        table.index('email', 'account_action_codes_email_idx');
        table.index('is_used', 'account_action_codes_is_used_idx');
        table.index('type', 'account_action_codes_type_idx');
      });
      Logger.log('New indexes created for account_action_codes table');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const oldTableName = 'account_deactivation_codes';
    const newTableName = 'account_action_codes';

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(newTableName);

    if (tableExists) {
      // Drop new indexes
      Logger.log('Dropping indexes from account_action_codes table');
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(newTableName, (table) => {
        table.dropIndex('user_id', 'account_action_codes_user_id_idx');
        table.dropIndex('email', 'account_action_codes_email_idx');
        table.dropIndex('is_used', 'account_action_codes_is_used_idx');
        table.dropIndex('type', 'account_action_codes_type_idx');
      });

      // Remove type column
      const columnExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasColumn(newTableName, 'type');
      if (columnExists) {
        Logger.log('Removing type column from account_action_codes table');
        await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(newTableName, (tableBuilder) => {
          tableBuilder.dropColumn('type');
        });
        Logger.log('type column removed from account_action_codes table');
      }

      // Rename table back
      Logger.log(`Renaming ${newTableName} table back to ${oldTableName}`);
      await trx.schema.withSchema(DatabaseSchema.apiService).renameTable(newTableName, oldTableName);
      Logger.log(`Table renamed from ${newTableName} to ${oldTableName}`);

      // Recreate old indexes
      Logger.log('Recreating old indexes for account_deactivation_codes table');
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(oldTableName, (table) => {
        table.index('user_id', 'account_deactivation_codes_user_id_idx');
        table.index('email', 'account_deactivation_codes_email_idx');
        table.index('is_used', 'account_deactivation_codes_is_used_idx');
      });
      Logger.log('Old indexes recreated for account_deactivation_codes table');
    }
  });
}
