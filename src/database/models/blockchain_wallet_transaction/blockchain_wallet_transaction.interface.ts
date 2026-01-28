import { IBase } from '../../base';
import { IBlockchainWallet } from '../blockchain_wallet';
import { ITransaction, TransactionStatus, TransactionScope } from '../transaction';
import { IUser } from '../user';

export enum BlockchainWalletTransactionType {
  DEPOSIT = 'deposit', // Adding money to wallet
  WITHDRAWAL = 'withdrawal', // Taking money out of wallet
  TRANSFER_IN = 'transfer_in', // Transfer from another user
  TRANSFER_OUT = 'transfer_out', // Transfer to another user
  REFUND = 'refund', // Refund for a previous payment
  FEE = 'fee', // Platform/service fee
  SWAP = 'swap', // Swap between two assets
  REVERSAL = 'reversal', // Transaction reversal
}

export interface IBlockchainWalletTransaction extends IBase {
  blockchain_wallet_id: string;
  provider_reference?: string;
  asset: string;
  amount: string;
  balance_before: string;
  balance_after: string;
  transaction_type: BlockchainWalletTransactionType;
  status: TransactionStatus;
  transaction_scope: TransactionScope;
  metadata?: Record<string, any>;
  description?: string;
  tx_hash?: string;
  failure_reason?: string;
  main_transaction_id?: string;
  peer_wallet_id?: string;
  peer_wallet_address?: string;
  intiated_by?: string;
  signed_by?: string;
  network_fee?: string;
  parent_id?: string;
  idempotency_key?: string;
  type?: 'debit' | 'credit';

  // Relationships
  transaction?: ITransaction;
  blockchain_wallet?: IBlockchainWallet;
  user?: IUser;
}
