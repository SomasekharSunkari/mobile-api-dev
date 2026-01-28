import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { DatabaseSchema } from '../database.schema';
import { DatabaseTables } from '../database.table';

export async function up(knex: Knex): Promise<void> {
  return knex.transaction(async (trx: any) =>
    trx.schema
      .createSchemaIfNotExists(DatabaseSchema.apiService)
      .then(() =>
        trx.schema.hasTable(DatabaseTables.bank_beneficiaries).then((tableExists: boolean) => {
          if (!tableExists) {
            Logger.log('Creating bank_beneficiaries table');

            return trx.schema
              .withSchema(DatabaseSchema.apiService)
              .createTable(DatabaseTables.bank_beneficiaries, (tableBuilder: Knex.TableBuilder) => {
                // primary key
                tableBuilder.string('id').primary();

                // foreign keys
                tableBuilder.string('user_id').notNullable().comment('user id of the beneficiary');

                // columns
                tableBuilder.string('currency').notNullable().comment('currency of the beneficiary bank account');
                tableBuilder.string('alias_name').notNullable().comment('alias name of the beneficiary');
                tableBuilder.string('avatar_url').nullable().comment('avatar url of the beneficiary');
                tableBuilder.string('account_number').nullable().comment('can also be nuban');
                tableBuilder.string('iban').nullable().comment('international bank account number');
                tableBuilder.string('account_name').nullable().comment('name of the account');
                tableBuilder.string('bank_name').nullable().comment('name of the bank');
                tableBuilder.string('bank_code').nullable().comment('code of the bank');
                tableBuilder.string('swift_code').nullable().comment('swift code of the bank');
                tableBuilder.string('routing_number').nullable().comment('routing number of the bank');
                tableBuilder.string('bank_logo').nullable().comment('logo of the bank');
                tableBuilder.string('bank_short_name').nullable().comment('short name of the bank');
                tableBuilder.string('bank_country').nullable().comment('country of the bank');
                tableBuilder.string('bank_address').nullable().comment('address of the bank');
                tableBuilder.string('bank_city').nullable().comment('city of the bank');
                tableBuilder.string('bank_state').nullable().comment('state of the bank');
                tableBuilder.string('bank_zip').nullable().comment('zip of the bank');
                tableBuilder.string('bank_phone').nullable().comment('phone of the bank');
                tableBuilder.string('bank_email').nullable().comment('email of the bank');
                tableBuilder.string('bank_website').nullable().comment('website of the bank');

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
  return knex.schema.withSchema(DatabaseSchema.apiService).dropTableIfExists(DatabaseTables.bank_beneficiaries);
}
