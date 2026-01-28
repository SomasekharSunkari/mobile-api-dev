import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.support_tickets).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating support_tickets table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.support_tickets, (tableBuilder: Knex.TableBuilder) => {
                // primary key
                tableBuilder.string('id').primary();

                // foreign keys
                tableBuilder.string('user_id').nullable();

                // columns
                tableBuilder.integer('ticket_number').notNullable().unique();
                tableBuilder.string('subject').notNullable();
                tableBuilder.string('description').notNullable();
                tableBuilder.text('content').notNullable();
                tableBuilder.string('status').notNullable().defaultTo('open');
                tableBuilder.string('channel').notNullable().defaultTo('ticket');

                // date columns
                tableBuilder.timestamp('resolved_at').nullable();
                tableBuilder.timestamp('deleted_at').nullable();
                tableBuilder.timestamps(true, true);

                // foreign key constraints
                tableBuilder
                  .foreign('user_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
                  .onDelete('SET NULL');
              });
          }
        }),
      )
      .catch((e: any) => console.error('MIGRATION_ERROR', e)),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.support_tickets);
}
