import { IBase } from '../../base';
import { IUser } from '../user';

export interface ISystemUsersBeneficiary extends IBase {
  sender_user_id: string;
  beneficiary_user_id: string;
  alias_name?: string;
  avatar_url?: string;
  senderUser?: IUser;
  beneficiaryUser?: IUser;
}
