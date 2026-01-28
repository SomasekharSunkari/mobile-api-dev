import { IBase } from '../../base';
import { IDoshPointsAccount } from '../doshPointsAccount/doshPointsAccount.interface';
import {
  DoshPointsEventCode,
  DoshPointsTransactionType,
  IDoshPointsEvent,
} from '../doshPointsEvent/doshPointsEvent.interface';
import { IUser } from '../user';

export interface IDoshPointsTransaction extends IBase {
  dosh_points_account_id: string;
  user_id: string;
  event_code: DoshPointsEventCode | string;
  transaction_type: DoshPointsTransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  source_reference?: string;
  description?: string;
  metadata?: Record<string, any>;
  status: DoshPointsTransactionStatus;
  idempotency_key?: string;
  processed_at?: Date | string;

  doshPointsAccount?: IDoshPointsAccount;
  user?: IUser;
  event?: IDoshPointsEvent;
}

export const DoshPointsTransactionStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REVERSED: 'reversed',
} as const;

export type DoshPointsTransactionStatus =
  (typeof DoshPointsTransactionStatus)[keyof typeof DoshPointsTransactionStatus];
