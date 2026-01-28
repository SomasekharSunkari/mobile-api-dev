import { IBase } from '../../base';
import { ITier } from '../tier/tier.interface';
import { IUser } from '../user/user.interface';

export interface IUserTier extends IBase {
  user_id: string;
  tier_id: string;
  user?: IUser;
  tier?: ITier;
}
