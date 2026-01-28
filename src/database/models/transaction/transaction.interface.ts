import { IBase } from '../../base';
import { IBlockchainWalletTransaction } from '../blockchain_wallet_transaction';
import { IFiatWalletTransaction } from '../fiatWalletTransaction';
import { ICardTransaction } from '../cardTransaction';
import { IUser } from '../user';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER = 'transfer',
  TRANSFER_OUT = 'transfer_out',
  TRANSFER_IN = 'transfer_in',
  EXCHANGE = 'exchange',
  FEE = 'fee',
  REFUND = 'refund',
  PAYMENT = 'payment',
  REWARD = 'reward',
}

export enum TransactionStatus {
  PENDING = 'pending',
  INITIATED = 'initiated',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  SETTLED = 'settled',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REVIEW = 'review',
  RECONCILE = 'reconcile',
}

export enum TransactionCategory {
  FIAT = 'fiat',
  BLOCKCHAIN = 'blockchain',
  CARD = 'card',
}

export enum TransactionScope {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
}

export interface ITransactionUpdateMetadata {
  provider_reference?: string;
  provider_metadata?: Record<string, unknown>;
  failure_reason?: string;
  balance_after?: number;
  completed_at?: string;
  description?: string;
  source?: string;
  destination?: string;
  provider_fee?: number;
  recipient?: string;
  participant_code?: string;
  sender_name?: string;
  recipient_name?: string;
  recipient_location?: string;
  bank_name?: string;
  account_number?: string;
}

export interface ITransaction extends IBase {
  user_id?: string;
  parent_transaction_id?: string;
  reference: string;
  external_reference?: string;
  asset: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  transaction_type: TransactionType;
  status: TransactionStatus;
  category: TransactionCategory;
  transaction_scope: TransactionScope;
  metadata?: Record<string, any>;
  description?: string;
  ip_address?: string;
  user_agent?: string;
  completed_at?: Date | string;
  failed_at?: Date | string;
  processed_at: Date | string;
  failure_reason?: string;
  user?: IUser;
  fiatWalletTransaction?: IFiatWalletTransaction;
  blockchainWalletTransaction?: IBlockchainWalletTransaction;
  cardTransaction?: ICardTransaction;
}
