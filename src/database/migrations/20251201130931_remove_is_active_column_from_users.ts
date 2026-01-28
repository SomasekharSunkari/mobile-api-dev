import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';
import { UserStatus } from '../models';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    Logger.log('Starting migration to remove is_active column from users table');

    // Update existing users with verified emails to have status = 'active'
    const updatedCount = await trx(DatabaseTables.users)
      .withSchema(DatabaseSchema.apiService)
      .where('is_email_verified', true)
      .whereNot('status', UserStatus.ACTIVE)
      .update({ status: UserStatus.ACTIVE });

    Logger.log(`Updated ${updatedCount} verified users to status = 'active'`);

    // Drop the index on is_active column
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users, (table) => {
      table.dropIndex('is_active', 'users_is_active_idx');
    });
    Logger.log('Dropped index users_is_active_idx');

    // Drop the is_active column
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users, (table) => {
      table.dropColumn('is_active');
    });
    Logger.log('Dropped is_active column from users table');

    Logger.log('Migration completed successfully');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    Logger.log('Rolling back: Adding is_active column back to users table');

    // Add is_active column back
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users, (table) => {
      table.boolean('is_active').defaultTo(false);
    });
    Logger.log('Added is_active column');

    // Set is_active based on status
    await trx(DatabaseTables.users)
      .withSchema(DatabaseSchema.apiService)
      .where('status', UserStatus.ACTIVE)
      .update({ is_active: true });

    Logger.log('Updated is_active based on status');

    // Re-create the index
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(DatabaseTables.users, (table) => {
      table.index('is_active', 'users_is_active_idx');
    });
    Logger.log('Re-created index users_is_active_idx');

    Logger.log('Rollback completed successfully');
  });
}
