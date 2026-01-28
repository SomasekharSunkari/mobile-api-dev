import { IBase } from '../../base';
import { IBlockchainWallet } from '../blockchain_wallet';
import { IUser } from '../user';
import { TransactionStatus } from '../transaction';

export interface IBlockchainGasFundTransaction extends IBase {
  user_id: string;
  blockchain_wallet_id: string;
  native_asset_id: string;
  amount: string;
  status: TransactionStatus;
  provider_reference?: string;
  tx_hash?: string;
  failure_reason?: string;
  network_fee?: string;
  idempotency_key?: string;
  metadata?: Record<string, any>;

  // Relationships
  user?: IUser;
  blockchain_wallet?: IBlockchainWallet;
}
