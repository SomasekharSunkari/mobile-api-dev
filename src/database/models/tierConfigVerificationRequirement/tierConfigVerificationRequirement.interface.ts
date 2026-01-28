import { IBase } from '../../base';
import { ITierConfig } from '../tierConfig/tierConfig.interface';
import { IVerificationRequirement } from '../verificationRequirement';

export interface ITierConfigVerificationRequirement extends IBase {
  tier_config_id: string;
  verification_requirement_id: string;

  tierConfig?: ITierConfig;
  verificationRequirement?: IVerificationRequirement;
}
