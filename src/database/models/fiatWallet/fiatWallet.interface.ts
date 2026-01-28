import { IBase } from '../../base';
import { IUser } from '../user';
import { IVirtualAccount } from '../virtualAccount';

export interface IFiatWallet extends IBase {
  user_id: string;
  balance: number;
  credit_balance: number;
  asset: string;
  status: FiatWalletStatus;
  user?: IUser;
  virtualAccounts: IVirtualAccount[];
}

export const FiatWalletStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  FROZEN: 'frozen',
  CLOSED: 'closed',
} as const;

export type FiatWalletStatus = (typeof FiatWalletStatus)[keyof typeof FiatWalletStatus];
