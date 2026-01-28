import { IBase } from '../../base';
import { IUser } from '../user';
import { IBlockchainAccount } from '../blockchain_account/blockchain_account.interface';

export interface IBlockchainWallet extends IBase {
  user_id: string;
  blockchain_account_id?: string;
  provider_account_ref: string;
  provider: BlockchainWalletProvider;
  asset: string;
  name: string;
  base_asset: string;
  address: string;
  balance: string;
  status: BlockchainWalletStatus;
  network?: string;
  rails?: BlockchainWalletRails;
  decimal?: number;
  is_visible: boolean;
  image_url?: string;
  user?: IUser;
  blockchain_account?: IBlockchainAccount;
}

export const BlockchainWalletStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  FROZEN: 'frozen',
  CLOSED: 'closed',
} as const;

export type BlockchainWalletStatus = (typeof BlockchainWalletStatus)[keyof typeof BlockchainWalletStatus];

export const BlockchainWalletProvider = {
  FIREBLOCKS: 'fireblocks',
  CUSTOM: 'custom',
} as const;

export type BlockchainWalletProvider = (typeof BlockchainWalletProvider)[keyof typeof BlockchainWalletProvider];

export const BlockchainWalletRails = {
  REMITTANCE: 'remittance',
  CRYPTO: 'crypto',
} as const;

export type BlockchainWalletRails = (typeof BlockchainWalletRails)[keyof typeof BlockchainWalletRails];
