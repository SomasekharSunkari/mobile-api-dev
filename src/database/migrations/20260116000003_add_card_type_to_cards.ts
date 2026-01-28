import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

/**
 * Migration: Add card_type column to cards table
 * This migration adds a card_type column that can be 'physical' or 'virtual'
 */
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableName = DatabaseTables.cards;

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(tableName);

    if (!tableExists) {
      Logger.warn(`${tableName} table does not exist, skipping migration`);
      return;
    }

    const columnExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasColumn(tableName, 'card_type');

    if (columnExists) {
      Logger.log('card_type column already exists on cards table');
      return;
    }

    Logger.log('Adding card_type column to cards table');

    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(tableName, (table) => {
      table.string('card_type').nullable().comment('Type of card: physical or virtual');
    });

    // Set all existing cards to 'virtual' since they were all virtual cards before
    const updatedCount = await trx(tableName).withSchema(DatabaseSchema.apiService).update({ card_type: 'virtual' });
    Logger.log(`Updated ${updatedCount} existing cards to card_type='virtual'`);

    // Add check constraint
    await trx.raw(`
      ALTER TABLE ${DatabaseSchema.apiService}.${tableName}
      ADD CONSTRAINT cards_card_type_check 
      CHECK (card_type IS NULL OR card_type IN ('physical', 'virtual'))
    `);

    Logger.log('Successfully added card_type column to cards table');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableName = DatabaseTables.cards;

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(tableName);

    if (!tableExists) {
      Logger.warn(`${tableName} table does not exist, skipping rollback`);
      return;
    }

    const columnExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasColumn(tableName, 'card_type');

    if (!columnExists) {
      Logger.warn('card_type column does not exist on cards table, skipping rollback');
      return;
    }

    Logger.log('Removing card_type column from cards table');

    // Drop check constraint first
    const constraintExists = await trx.raw(`
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = '${DatabaseSchema.apiService}' 
      AND table_name = '${tableName}' 
      AND constraint_name = 'cards_card_type_check'
    `);

    if (constraintExists.rows.length > 0) {
      await trx.raw(`
        ALTER TABLE ${DatabaseSchema.apiService}.${tableName}
        DROP CONSTRAINT cards_card_type_check
      `);
      Logger.log('Dropped cards_card_type_check constraint');
    }

    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(tableName, (table) => {
      table.dropColumn('card_type');
    });

    Logger.log('Successfully removed card_type column from cards table');
  });
}
