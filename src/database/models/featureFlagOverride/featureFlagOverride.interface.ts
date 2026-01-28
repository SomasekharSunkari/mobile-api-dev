import { IBase } from '../../base';
import { IFeatureFlag } from '../featureFlag/featureFlag.interface';
import { IUser } from '../user/user.interface';

export interface IFeatureFlagOverride extends IBase {
  feature_flag_id: string;
  user_id: string;
  enabled: boolean;
  reason?: string;

  feature?: IFeatureFlag;
  user?: IUser;
}
