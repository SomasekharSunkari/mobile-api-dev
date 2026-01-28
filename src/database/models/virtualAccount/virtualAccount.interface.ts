import { IBase } from '../../base';
import { FiatWalletModel } from '../fiatWallet';
import { UserModel } from '../user';

export enum VirtualAccountTier {
  TIER_1 = '1',
  TIER_2 = '2',
  TIER_3 = '3',
}

export enum VirtualAccountType {
  MAIN_ACCOUNT = 'main_account',
  EXCHANGE_ACCOUNT = 'exchange_account',
}

export interface IVirtualAccount extends IBase {
  user_id: string;
  fiat_wallet_id: string | null;
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_ref: string;
  routing_number: string;
  iban: string;
  provider: string;
  provider_ref: string;
  address: string;
  state: string;
  city: string;
  postal_code: string;
  provider_balance: number;
  type: VirtualAccountType;
  transaction_id: string | null;
  scheduled_deletion_at: Date | null;
  user: UserModel;
  fiatWallet: FiatWalletModel;
}
