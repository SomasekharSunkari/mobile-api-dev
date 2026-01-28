import { IBase } from '../../base';
import { IFeatureFlagOverride } from '../featureFlagOverride/featureFlagOverride.interface';

export interface IFeatureFlag extends IBase {
  key: string;
  description?: string;
  enabled: boolean;
  enabled_ios: boolean;
  enabled_android: boolean;
  expires_at?: Date | string;

  overrides?: IFeatureFlagOverride[];
}
