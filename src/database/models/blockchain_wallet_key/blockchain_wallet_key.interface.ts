import { IBase } from '../../base';
import { IBlockchainWallet } from '../blockchain_wallet/blockchain_wallet.interface';

export interface IBlockchainWalletKey extends IBase {
  blockchain_wallet_id: string;
  encrypted_private_key: string;
  encryption_iv: string;
  network: string;
  public_key?: string;
  key_index: number;
  blockchain_wallet?: IBlockchainWallet;
}
