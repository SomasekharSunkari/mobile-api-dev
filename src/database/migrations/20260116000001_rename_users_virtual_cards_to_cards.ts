import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';

/**
 * Migration: Rename users_virtual_cards table to cards
 * This migration preserves all data, indexes, and foreign key constraints
 */
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const oldTableName = 'users_virtual_cards';
    const newTableName = 'cards';

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(oldTableName);

    if (!tableExists) {
      Logger.warn(`${oldTableName} table does not exist, skipping migration`);
      return;
    }

    const newTableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(newTableName);

    if (newTableExists) {
      Logger.warn(`${newTableName} table already exists, skipping migration`);
      return;
    }

    Logger.log(`Renaming table ${oldTableName} to ${newTableName}`);

    // Rename the table
    await trx.schema.withSchema(DatabaseSchema.apiService).renameTable(oldTableName, newTableName);

    // Rename indexes
    const indexesToRename = [
      { old: 'users_virtual_cards_user_id_idx', new: 'cards_user_id_idx' },
      { old: 'users_virtual_cards_card_user_id_idx', new: 'cards_card_user_id_idx' },
      { old: 'users_virtual_cards_country_id_idx', new: 'cards_country_id_idx' },
      { old: 'users_virtual_cards_status_idx', new: 'cards_status_idx' },
    ];

    for (const { old, new: newName } of indexesToRename) {
      const indexExists = await trx.raw(`
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = '${DatabaseSchema.apiService}' 
        AND tablename = '${newTableName}' 
        AND indexname = '${old}'
      `);

      if (indexExists.rows.length > 0) {
        await trx.raw(`ALTER INDEX ${DatabaseSchema.apiService}.${old} RENAME TO ${newName}`);
        Logger.log(`Renamed index ${old} to ${newName}`);
      }
    }

    Logger.log(`Successfully renamed table ${oldTableName} to ${newTableName}`);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const oldTableName = 'cards';
    const newTableName = 'users_virtual_cards';

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(oldTableName);

    if (!tableExists) {
      Logger.warn(`${oldTableName} table does not exist, skipping rollback`);
      return;
    }

    Logger.log(`Reverting table ${oldTableName} to ${newTableName}`);

    // Rename indexes back
    const indexesToRename = [
      { old: 'cards_user_id_idx', new: 'users_virtual_cards_user_id_idx' },
      { old: 'cards_card_user_id_idx', new: 'users_virtual_cards_card_user_id_idx' },
      { old: 'cards_country_id_idx', new: 'users_virtual_cards_country_id_idx' },
      { old: 'cards_status_idx', new: 'users_virtual_cards_status_idx' },
    ];

    for (const { old, new: newName } of indexesToRename) {
      const indexExists = await trx.raw(`
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = '${DatabaseSchema.apiService}' 
        AND tablename = '${oldTableName}' 
        AND indexname = '${old}'
      `);

      if (indexExists.rows.length > 0) {
        await trx.raw(`ALTER INDEX ${DatabaseSchema.apiService}.${old} RENAME TO ${newName}`);
        Logger.log(`Renamed index ${old} to ${newName}`);
      }
    }

    // Rename the table back
    await trx.schema.withSchema(DatabaseSchema.apiService).renameTable(oldTableName, newTableName);

    Logger.log(`Successfully reverted table ${oldTableName} to ${newTableName}`);
  });
}
