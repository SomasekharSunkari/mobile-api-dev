import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.blockchain_beneficiaries).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating blockchain_beneficiaries table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.blockchain_beneficiaries, (tableBuilder: Knex.TableBuilder) => {
                // primary key
                tableBuilder.string('id').primary();

                // foreign keys
                tableBuilder.string('user_id').notNullable().comment('user id of the beneficiary');
                tableBuilder
                  .string('beneficiary_user_id')
                  .notNullable()
                  .comment('beneficiary user id of the beneficiary');
                tableBuilder.string('alias_name').nullable().comment('alias name of the beneficiary');

                // columns
                tableBuilder.string('asset').nullable().comment('currency of the beneficiary bank account');
                tableBuilder.string('address').nullable().comment('address of the beneficiary');
                tableBuilder.string('network').nullable().comment('network of the beneficiary');
                tableBuilder.string('avatar_url').nullable().comment('avatar url of the beneficiary');

                tableBuilder.timestamp('deleted_at').nullable();
                tableBuilder.timestamps(true, true);
              });
          }
        }),
      )
      .catch((e: any) => console.error('MIGRATION_ERROR', e)),
  );
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.blockchain_beneficiaries);
}
