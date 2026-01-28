import { BlockchainAccountRail } from '../../../constants/blockchainAccountRails';
import { IBase } from '../../base';
import { IBlockchainWallet } from '../blockchain_wallet/blockchain_wallet.interface';
import { IUser } from '../user';

export interface IBlockchainAccount extends IBase {
  user_id: string;
  provider: BlockchainAccountProvider;
  provider_ref: string;
  status: BlockchainAccountStatus;
  rails: BlockchainAccountRail;
  is_visible: boolean;
  user?: IUser;
  blockchain_wallets?: IBlockchainWallet[];
}

export const BlockchainAccountStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  FROZEN: 'frozen',
  CLOSED: 'closed',
} as const;

export type BlockchainAccountStatus = (typeof BlockchainAccountStatus)[keyof typeof BlockchainAccountStatus];

export const BlockchainAccountProvider = {
  FIREBLOCKS: 'fireblocks',
} as const;

export type BlockchainAccountProvider = (typeof BlockchainAccountProvider)[keyof typeof BlockchainAccountProvider];
