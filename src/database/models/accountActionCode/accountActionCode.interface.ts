import { IBase } from '../../base';
import { IUser } from '../user';

export interface IAccountActionCode extends IBase {
  user_id: string;
  code: string;
  email: string;
  type: string;
  expires_at: string | Date;
  is_used: boolean;
  used_at?: string | Date;
  user: IUser;
}
