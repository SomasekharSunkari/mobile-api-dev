import { IBase } from '../../base';
import { ITierConfigVerificationRequirement } from '../tierConfigVerificationRequirement/tierConfigVerificationRequirement.interface';

export interface IVerificationRequirement extends IBase {
  name: string;

  tierConfigVerificationRequirements?: ITierConfigVerificationRequirement[];
}
