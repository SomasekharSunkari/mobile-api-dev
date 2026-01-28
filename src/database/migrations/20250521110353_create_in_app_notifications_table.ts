import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.createSchemaIfNotExists(DatabaseSchema.apiService);

    const tableExists = await trx.schema
      .withSchema(DatabaseSchema.apiService)
      .hasTable(DatabaseTables.in_app_notifications);

    if (!tableExists) {
      Logger.log('Creating in_app_notifications table');

      await trx.schema
        .withSchema(DatabaseSchema.apiService)
        .createTable(DatabaseTables.in_app_notifications, (table) => {
          table.string('id').primary();
          table.string('user_id').notNullable();
          table.string('type').notNullable();
          table.string('title').notNullable();
          table.text('message').notNullable();
          table.boolean('is_read').notNullable().defaultTo(false);
          table.jsonb('metadata').nullable();

          table.timestamp('deleted_at').nullable();
          table.timestamps(true, true);

          // Foreign keys
          table.foreign('user_id').references('id').inTable(`${DatabaseSchema.apiService}.users`).onDelete('CASCADE');

          table.index(['user_id', 'is_read'], 'notifications_user_id_is_read_idx');
        });

      Logger.log('notifications table created');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.in_app_notifications);
}
