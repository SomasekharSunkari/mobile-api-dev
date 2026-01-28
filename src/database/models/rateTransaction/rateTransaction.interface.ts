import { IBase } from '../../base';
import { ITransaction } from '../transaction';
import { IUser } from '../user';

export enum RateTransactionType {
  BUY = 'buy',
  SELL = 'sell',
}

export enum RateTransactionStatus {
  PENDING = 'pending',
  INITIATED = 'initiated',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface IRateTransaction extends IBase {
  user_id: string;
  transaction_id: string;
  rate: number;
  converted_currency: string;
  base_currency: string;
  amount: number;
  converted_amount: number;
  expires_at: string;
  processed_at: string;
  failed_at: string;
  completed_at: string;
  failure_reason: string;
  status: RateTransactionStatus;
  type: RateTransactionType;
  provider: string;
  user?: IUser;
  transaction?: ITransaction;
}
