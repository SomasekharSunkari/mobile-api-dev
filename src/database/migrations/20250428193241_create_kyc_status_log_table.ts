import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema.withSchema(DatabaseSchema.apiService).hasTable(DatabaseTables.kyc_status_logs);

    if (!tableExists) {
      Logger.log('Creating KYC Status Logs table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.kyc_status_logs, (tableBuilder) => {
          tableBuilder.string('id', 100).primary(); // Unique KYC status log ID
          tableBuilder.string('kyc_id', 100).notNullable(); // FK to KYC table

          tableBuilder.string('old_status', 50).nullable(); // Previous KYC status (nullable if first status)
          tableBuilder.string('new_status', 50).notNullable(); // New KYC status
          tableBuilder.timestamp('changed_at').defaultTo(trx.fn.now()); // Timestamp when status changed
          tableBuilder.text('comment').nullable(); // Optional comment/reason

          tableBuilder.timestamps(true, true); // created_at, updated_at
          tableBuilder.timestamp('deleted_at').nullable(); // Soft delete timestamp

          tableBuilder
            .foreign('kyc_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.kyc_verifications}`)
            .onDelete('CASCADE');
        });

      Logger.log('KYC Status Logs table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.kyc_status_logs);
}
