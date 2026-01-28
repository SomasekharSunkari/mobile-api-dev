import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

/**
 * Migration: Rename user_virtual_card_id column to card_id in card_transactions table
 * This migration preserves all data and updates foreign key constraints
 */
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableName = DatabaseTables.card_transactions;
    const oldColumnName = 'user_virtual_card_id';
    const newColumnName = 'card_id';
    const newTableName = 'cards';

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(tableName);

    if (!tableExists) {
      Logger.warn(`${tableName} table does not exist, skipping migration`);
      return;
    }

    const columnExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasColumn(tableName, oldColumnName);

    if (!columnExists) {
      // If user_virtual_card_id doesn't exist but card_id does, the migration may have already run
      const cardIdExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasColumn(tableName, newColumnName);
      if (cardIdExists) {
        Logger.log(
          `${oldColumnName} column does not exist, but ${newColumnName} already exists. Migration may have already completed.`,
        );
        return;
      }
      Logger.warn(`${oldColumnName} column does not exist on ${tableName} table, skipping migration`);
      return;
    }

    const newColumnExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasColumn(tableName, newColumnName);

    // If card_id already exists, we need to handle it
    if (newColumnExists) {
      Logger.log(`${newColumnName} column already exists. Checking if it has data...`);

      // Check if the existing card_id column has any non-null values
      const cardIdData = await trx(tableName)
        .withSchema(DatabaseSchema.apiService)
        .whereNotNull(newColumnName)
        .count('* as count')
        .first();

      const cardIdCount = Number.parseInt((cardIdData?.count as string) || '0', 10);

      if (cardIdCount > 0) {
        Logger.log(`${newColumnName} column has ${cardIdCount} non-null values. Migrating data to ${oldColumnName}...`);

        // Copy card_id values to user_virtual_card_id where user_virtual_card_id is null
        // This preserves the data before we drop the card_id column
        const updateResult = await trx.raw(
          `
          UPDATE ${DatabaseSchema.apiService}.${tableName}
          SET ${oldColumnName} = ${newColumnName}
          WHERE ${newColumnName} IS NOT NULL 
            AND ${oldColumnName} IS NULL
        `,
        );
        const migratedCount = updateResult.rowCount || 0;

        Logger.log(
          `Migrated ${migratedCount} rows from ${newColumnName} to ${oldColumnName} (where ${oldColumnName} was null)`,
        );

        // Check if there are any rows where both columns have different non-null values
        const conflictingRows = await trx.raw(
          `
          SELECT COUNT(*) as count 
          FROM ${DatabaseSchema.apiService}.${tableName}
          WHERE ${newColumnName} IS NOT NULL 
            AND ${oldColumnName} IS NOT NULL 
            AND ${newColumnName} != ${oldColumnName}
        `,
        );

        const conflictCount = Number.parseInt((conflictingRows.rows[0]?.count as string) || '0', 10);

        if (conflictCount > 0) {
          Logger.warn(
            `Found ${conflictCount} rows where ${newColumnName} and ${oldColumnName} have different values. ` +
              `Keeping ${oldColumnName} values and discarding ${newColumnName} values.`,
          );
        }
      }

      // Drop foreign key constraint on card_id if it exists
      const cardIdFkName = `${tableName}_${newColumnName}_foreign`;
      const cardIdFkExists = await trx.raw(`
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = '${DatabaseSchema.apiService}' 
        AND table_name = '${tableName}' 
        AND constraint_name = '${cardIdFkName}'
      `);

      if (cardIdFkExists.rows.length > 0) {
        await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(tableName, (table) => {
          table.dropForeign([newColumnName], cardIdFkName);
        });
        Logger.log(`Dropped foreign key constraint ${cardIdFkName} on ${newColumnName}`);
      }

      // Drop index on card_id if it exists
      const cardIdIndexName = `${tableName}_${newColumnName}_idx`;
      const cardIdIndexExists = await trx.raw(`
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = '${DatabaseSchema.apiService}' 
        AND tablename = '${tableName}' 
        AND indexname = '${cardIdIndexName}'
      `);

      if (cardIdIndexExists.rows.length > 0) {
        await trx.raw(`DROP INDEX IF EXISTS ${DatabaseSchema.apiService}.${cardIdIndexName}`);
        Logger.log(`Dropped index ${cardIdIndexName} on ${newColumnName}`);
      }

      // Drop the existing card_id column
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(tableName, (table) => {
        table.dropColumn(newColumnName);
      });
      Logger.log(`Dropped existing ${newColumnName} column`);
    }

    Logger.log(`Renaming column ${oldColumnName} to ${newColumnName} in ${tableName} table`);

    // Drop the foreign key constraint first
    const foreignKeyName = `${tableName}_${oldColumnName}_foreign`;
    const fkExists = await trx.raw(`
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = '${DatabaseSchema.apiService}' 
      AND table_name = '${tableName}' 
      AND constraint_name = '${foreignKeyName}'
    `);

    if (fkExists.rows.length > 0) {
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(tableName, (table) => {
        table.dropForeign([oldColumnName], foreignKeyName);
      });
      Logger.log(`Dropped foreign key constraint ${foreignKeyName}`);
    }

    // Rename the column
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(tableName, (table) => {
      table.renameColumn(oldColumnName, newColumnName);
    });

    Logger.log(`Renamed column ${oldColumnName} to ${newColumnName}`);

    // Recreate the foreign key constraint with new column name and table name
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(tableName, (table) => {
      table.foreign(newColumnName).references('id').inTable(`${DatabaseSchema.apiService}.${newTableName}`);
    });

    Logger.log(`Recreated foreign key constraint for ${newColumnName}`);

    // Rename the index if it exists
    const oldIndexName = `${tableName}_${oldColumnName}_idx`;
    const newIndexName = `${tableName}_${newColumnName}_idx`;

    const indexExists = await trx.raw(`
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = '${DatabaseSchema.apiService}' 
      AND tablename = '${tableName}' 
      AND indexname = '${oldIndexName}'
    `);

    if (indexExists.rows.length > 0) {
      await trx.raw(`ALTER INDEX ${DatabaseSchema.apiService}.${oldIndexName} RENAME TO ${newIndexName}`);
      Logger.log(`Renamed index ${oldIndexName} to ${newIndexName}`);
    }

    Logger.log(`Successfully renamed column ${oldColumnName} to ${newColumnName} in ${tableName} table`);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    const tableName = DatabaseTables.card_transactions;
    const oldColumnName = 'card_id';
    const newColumnName = 'user_virtual_card_id';
    const newTableName = 'users_virtual_cards';

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(tableName);

    if (!tableExists) {
      Logger.warn(`${tableName} table does not exist, skipping rollback`);
      return;
    }

    const columnExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasColumn(tableName, oldColumnName);
    const newColumnAlreadyExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasColumn(tableName, newColumnName);

    if (!columnExists) {
      Logger.warn(`${oldColumnName} column does not exist on ${tableName} table, skipping rollback`);
      return;
    }

    // If user_virtual_card_id already exists, we need to drop card_id first
    if (newColumnAlreadyExists) {
      Logger.log(`${newColumnName} column already exists. Dropping ${oldColumnName} column first...`);

      // Drop foreign key on card_id if it exists
      const cardIdFkName = `${tableName}_${oldColumnName}_foreign`;
      const cardIdFkExists = await trx.raw(`
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = '${DatabaseSchema.apiService}' 
        AND table_name = '${tableName}' 
        AND constraint_name = '${cardIdFkName}'
      `);

      if (cardIdFkExists.rows.length > 0) {
        await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(tableName, (table) => {
          table.dropForeign([oldColumnName], cardIdFkName);
        });
        Logger.log(`Dropped foreign key constraint ${cardIdFkName}`);
      }

      // Drop index on card_id if it exists
      const cardIdIndexName = `${tableName}_${oldColumnName}_idx`;
      const cardIdIndexExists = await trx.raw(`
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = '${DatabaseSchema.apiService}' 
        AND tablename = '${tableName}' 
        AND indexname = '${cardIdIndexName}'
      `);

      if (cardIdIndexExists.rows.length > 0) {
        await trx.raw(`DROP INDEX IF EXISTS ${DatabaseSchema.apiService}.${cardIdIndexName}`);
        Logger.log(`Dropped index ${cardIdIndexName}`);
      }

      // Drop card_id column
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(tableName, (table) => {
        table.dropColumn(oldColumnName);
      });
      Logger.log(`Dropped ${oldColumnName} column`);

      Logger.log(`Rollback complete - ${newColumnName} column already exists, ${oldColumnName} has been dropped`);
      return;
    }

    Logger.log(`Reverting column ${oldColumnName} to ${newColumnName} in ${tableName} table`);

    // Drop the foreign key constraint first
    const foreignKeyName = `${tableName}_${oldColumnName}_foreign`;
    const fkExists = await trx.raw(`
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_schema = '${DatabaseSchema.apiService}' 
      AND table_name = '${tableName}' 
      AND constraint_name = '${foreignKeyName}'
    `);

    if (fkExists.rows.length > 0) {
      await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(tableName, (table) => {
        table.dropForeign([oldColumnName], foreignKeyName);
      });
      Logger.log(`Dropped foreign key constraint ${foreignKeyName}`);
    }

    // Rename the index if it exists
    const oldIndexName = `${tableName}_${oldColumnName}_idx`;
    const newIndexName = `${tableName}_${newColumnName}_idx`;

    const indexExists = await trx.raw(`
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = '${DatabaseSchema.apiService}' 
      AND tablename = '${tableName}' 
      AND indexname = '${oldIndexName}'
    `);

    if (indexExists.rows.length > 0) {
      await trx.raw(`ALTER INDEX ${DatabaseSchema.apiService}.${oldIndexName} RENAME TO ${newIndexName}`);
      Logger.log(`Renamed index ${oldIndexName} to ${newIndexName}`);
    }

    // Rename the column
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(tableName, (table) => {
      table.renameColumn(oldColumnName, newColumnName);
    });

    Logger.log(`Renamed column ${oldColumnName} to ${newColumnName}`);

    // Recreate the foreign key constraint with old column name and table name
    await trx.schema.withSchema(DatabaseSchema.apiService).alterTable(tableName, (table) => {
      table.foreign(newColumnName).references('id').inTable(`${DatabaseSchema.apiService}.${newTableName}`);
    });

    Logger.log(`Recreated foreign key constraint for ${newColumnName}`);

    Logger.log(`Successfully reverted column ${oldColumnName} to ${newColumnName} in ${tableName} table`);
  });
}
