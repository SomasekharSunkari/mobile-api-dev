import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { IPagaLedgerTransaction } from './pagaLedgerTransaction.interface';
import { PagaLedgerTransactionValidationSchema } from './pagaLedgerTransaction.validation';

export class PagaLedgerTransactionModel extends BaseModel implements IPagaLedgerTransaction {
  public account_number: IPagaLedgerTransaction['account_number'];
  public date_utc: IPagaLedgerTransaction['date_utc'];
  public description: IPagaLedgerTransaction['description'];
  public amount: IPagaLedgerTransaction['amount'];
  public status: IPagaLedgerTransaction['status'];
  public transaction_id: IPagaLedgerTransaction['transaction_id'];
  public reference_number: IPagaLedgerTransaction['reference_number'];
  public transaction_reference: IPagaLedgerTransaction['transaction_reference'];
  public source_account_name: IPagaLedgerTransaction['source_account_name'];
  public source_account_organization_name: IPagaLedgerTransaction['source_account_organization_name'];
  public balance_before: IPagaLedgerTransaction['balance_before'];
  public balance_after: IPagaLedgerTransaction['balance_after'];
  public tax: IPagaLedgerTransaction['tax'];
  public fee: IPagaLedgerTransaction['fee'];
  public transaction_type: IPagaLedgerTransaction['transaction_type'];
  public transaction_channel: IPagaLedgerTransaction['transaction_channel'];
  public reversal_id: IPagaLedgerTransaction['reversal_id'];
  public currency: IPagaLedgerTransaction['currency'];

  public static get tableName(): string {
    return `${DatabaseSchema.apiService}.${DatabaseTables.paga_ledger_transactions}`;
  }

  public static get jsonSchema(): JSONSchema {
    return PagaLedgerTransactionValidationSchema;
  }
}
