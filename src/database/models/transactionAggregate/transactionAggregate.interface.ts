import { IBase } from '../../base';

export interface ITransactionAggregate extends IBase {
  date: Date | string;
  transaction_type: string;
  provider: string;
  amount: number;
}
