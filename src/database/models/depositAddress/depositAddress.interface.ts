import { IBase } from '../../base';
import { IUser } from '../user';

export interface IDepositAddress extends IBase {
  user_id: string;
  provider: string;
  asset: string;
  address: string;

  user?: IUser;
}
