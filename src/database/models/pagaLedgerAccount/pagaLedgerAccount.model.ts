import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { IPagaLedgerAccount } from './pagaLedgerAccount.interface';
import { PagaLedgerAccountValidationSchema } from './pagaLedgerAccount.validation';

export class PagaLedgerAccountModel extends BaseModel implements IPagaLedgerAccount {
  public email: IPagaLedgerAccount['email'];
  public phone_number: IPagaLedgerAccount['phone_number'];
  public account_number: IPagaLedgerAccount['account_number'];
  public account_name: IPagaLedgerAccount['account_name'];
  public available_balance: IPagaLedgerAccount['available_balance'];

  public static get tableName(): string {
    return `${DatabaseSchema.apiService}.${DatabaseTables.paga_ledger_accounts}`;
  }

  public static get jsonSchema(): JSONSchema {
    return PagaLedgerAccountValidationSchema;
  }
}
