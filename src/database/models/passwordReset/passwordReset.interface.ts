import { IBase } from '../../base';
import { IUser } from '../user';

export interface IPasswordReset extends IBase {
  code: string;
  user_id: string;
  is_used: boolean;
  expiration_time: string;
  user: IUser;
}
