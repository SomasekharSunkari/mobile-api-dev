import { IBase } from '../../base';

export type PagaLedgerTransactionStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED';

export type PagaLedgerTransactionType = 'CREDIT' | 'DEBIT';

export interface IPagaLedgerTransaction extends IBase {
  account_number: string;
  amount: number;
  status: PagaLedgerTransactionStatus;
  reference_number: string;
  transaction_reference: string;
  balance_before: number;
  balance_after: number;
  transaction_type: PagaLedgerTransactionType;
  currency: string;

  date_utc?: number;
  description?: string;
  transaction_id?: string;
  source_account_name?: string;
  source_account_organization_name?: string;
  tax?: number;
  fee?: number;
  transaction_channel?: string;
  reversal_id?: string | null;
}
