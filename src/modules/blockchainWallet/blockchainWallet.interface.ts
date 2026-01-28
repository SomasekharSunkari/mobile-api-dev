import { IAssetId } from 'src/adapters/blockchain-waas/blockchain-waas-adapter.interface';
import { BlockchainWalletTransactionType } from 'src/database/models/blockchain_wallet_transaction/blockchain_wallet_transaction.interface';
import { TransactionScope } from 'src/database/models/transaction';
import { BlockchainAccountRail } from '../../constants/blockchainAccountRails';

export type FeeType = 'internal' | 'external';

export interface IEstimateFeeParams {
  type: FeeType;
  asset_id: string;
  amount: string;
  peer_username?: string; // for internal transfers
  peer_address?: string; // for external
  peer_tag?: string; // for external (optional)
  fee_level?: 'LOW' | 'MEDIUM' | 'HIGH';
  idempotencyKey?: string;
}

export interface IInitiateTransactionParams {
  type: FeeType;
  asset_id: string;
  amount: number;
  peer_username?: string;
  peer_address?: string;
  peer_tag?: string;
  note?: string;
  idempotencyKey?: string;
}

export type ICreateWallet = {
  asset_ids: IAssetId[];
  rail?: BlockchainAccountRail;
} & (
  | { blockchain_account_id: string; blockchain_account_ref: string }
  | { blockchain_account_id?: never; blockchain_account_ref?: never }
);

export interface IDefaultWallet {
  assetId: string;
  baseAsset: string;
  name: string;
}

export interface BlockchainWalletTransactionMetadata {
  description?: string;
  provider_reference?: string;
  provider_fee?: number;
  provider_metadata?: Record<string, any>;
  source?: string;
  destination?: string;
  tx_hash?: string;
  block_number?: string;
  network_fee?: string;
  transaction_type?: BlockchainWalletTransactionType;
  idempotency_key?: string;
  failure_reason?: string;
  transaction_scope?: TransactionScope;
}

export interface ICreateCustomWallet {
  network: 'ethereum' | 'solana';
  asset?: string;
  rail?: BlockchainAccountRail;
  name?: string;
  useBase?: boolean;
  useDefault?: boolean;
}
