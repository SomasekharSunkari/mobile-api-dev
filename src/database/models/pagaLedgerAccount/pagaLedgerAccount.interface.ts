import { IBase } from '../../base';

export interface IPagaLedgerAccount extends IBase {
  email: string;
  phone_number?: string;
  account_number: string;
  account_name: string;
  available_balance: number;
}
