import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.user_tiers).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating user_tiers table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.user_tiers, (tableBuilder: Knex.TableBuilder) => {
                // primary key
                tableBuilder.string('id').primary();

                // foreign keys
                tableBuilder.string('user_id').notNullable();
                tableBuilder.string('tier_id').notNullable();

                // columns
                tableBuilder.timestamp('deleted_at').nullable();
                tableBuilder.timestamps(true, true);
                // foreign key constraints
                tableBuilder
                  .foreign('user_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.users}`)
                  .onDelete('CASCADE');

                tableBuilder
                  .foreign('tier_id')
                  .references('id')
                  .inTable(`${DatabaseSchema.apiService}.${DatabaseTables.tiers}`)
                  .onDelete('NO ACTION');
              });
          }
        }),
      )
      .catch((e: any) => console.error('MIGRATION_ERROR', e)),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.user_tiers);
}
