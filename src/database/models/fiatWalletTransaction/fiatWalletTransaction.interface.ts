import { IBase } from '../../base';
import { IExternalAccount } from '../externalAccount/externalAccount.interface';
import { IFiatWallet } from '../fiatWallet/fiatWallet.interface';
import { ITransaction, TransactionStatus } from '../transaction';
import { IUser } from '../user';
import { IVirtualAccount } from '../virtualAccount/virtualAccount.interface';

export enum FiatWalletTransactionType {
  DEPOSIT = 'deposit', // Adding money to wallet
  WITHDRAWAL = 'withdrawal', // Taking money out of wallet
  TRANSFER_IN = 'transfer_in', // Transfer from another user
  TRANSFER_OUT = 'transfer_out', // Transfer to another user
  PAYMENT = 'payment', // Payment for goods/services
  REFUND = 'refund', // Refund for a previous payment
  FEE = 'fee', // Platform/service fee
  ADJUSTMENT = 'adjustment', // Manual balance adjustment
  EXCHANGE = 'exchange', // Currency exchange
  REVERSAL = 'reversal', // Transaction reversal
  REWARD = 'reward', // Stablecoin reward payout
}

export interface IFiatWalletTransaction extends IBase {
  transaction_id: string;
  fiat_wallet_id: string;
  user_id: string;
  transaction_type: FiatWalletTransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  currency: string;
  status: TransactionStatus;
  // Provider details
  provider?: string;
  provider_reference?: string;
  provider_quote_ref?: string;
  provider_request_ref?: string;
  provider_fee?: number;
  provider_metadata?: Record<string, any>;

  // Source/destination
  source?: string;
  destination?: string;

  // External account reference
  external_account_id?: string;

  // Additional info
  description?: string;
  failure_reason?: string;

  // Idempotency
  idempotency_key?: string;

  // Timestamps
  processed_at?: Date | string;
  completed_at?: Date | string;
  failed_at?: Date | string;
  settled_at?: Date | string;

  // Relationships
  transaction?: ITransaction;
  fiat_wallet?: IFiatWallet;
  user?: IUser;
  externalAccount?: IExternalAccount;
  virtualAccount?: IVirtualAccount;
}
