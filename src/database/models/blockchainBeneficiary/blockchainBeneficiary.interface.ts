import { IBase } from '../../base';
import { IUser } from '../user';

export interface IBlockchainBeneficiary extends IBase {
  user_id: string;
  beneficiary_user_id: string;
  alias_name?: string;
  asset?: string;
  address?: string;
  network?: string;
  avatar_url?: string;

  user?: IUser;
  beneficiaryUser?: IUser;
}
