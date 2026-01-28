import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.verification_tokens);

    if (!tableExists) {
      Logger.log('Creating verification_tokens table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.verification_tokens, (tableBuilder) => {
          tableBuilder.string('id').primary();
          tableBuilder.string('user_id').notNullable();
          tableBuilder.string('token_identifier').notNullable().unique();
          tableBuilder.string('verification_type').notNullable();
          tableBuilder.timestamp('expires_at').notNullable();
          tableBuilder.boolean('is_used').defaultTo(false);
          tableBuilder.timestamp('used_at').nullable();

          tableBuilder.timestamps(true, true);
          tableBuilder.timestamp('deleted_at').nullable();

          tableBuilder
            .foreign('user_id')
            .references('id')
            .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
            .onDelete('CASCADE');
        });

      Logger.log('Verification tokens table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.verification_tokens);
}
