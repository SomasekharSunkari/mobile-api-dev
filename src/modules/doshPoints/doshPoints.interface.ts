import { IDoshPointsAccount } from '../../database/models/doshPointsAccount/doshPointsAccount.interface';
import { DoshPointsEventCode } from '../../database/models/doshPointsEvent/doshPointsEvent.interface';
import { IDoshPointsTransaction } from '../../database/models/doshPointsTransaction/doshPointsTransaction.interface';

export interface IDoshPointsBalance {
  balance: number;
  account: IDoshPointsAccount;
}

export interface IDoshPointsTransactionHistory {
  transactions: IDoshPointsTransaction[];
  total: number;
  page: number;
  limit: number;
}

export interface ICreditPointsParams {
  user_id: string;
  event_code: DoshPointsEventCode | string;
  source_reference: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface IDoshPointsLedgerWriteResult {
  transaction: IDoshPointsTransaction;
  account?: IDoshPointsAccount;
  is_duplicate: boolean;
}

export interface IFindOneQuery {
  user_id?: string;
  event_code?: DoshPointsEventCode | string;
  source_reference?: string;
}

// Define allowed paths as const array (single source of truth)
export const ALLOWED_METADATA_PATHS = [
  'reward.transaction_id',
  'reward.fiat_wallet_transaction_id',
  'deposit.amount',
  'deposit.fiat_wallet_id',
  'deposit.external_account_id',
  'deposit.participant_code',
] as const;

// Derive type from the array
export type AllowedMetadataPath = (typeof ALLOWED_METADATA_PATHS)[number];

export interface IMetadataFilter {
  path: AllowedMetadataPath;
  value: string;
}
