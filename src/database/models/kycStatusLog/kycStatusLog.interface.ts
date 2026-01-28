import { IBase } from '../../base';
import { IKycVerification } from '../kycVerification/kycVerification.interface';

export interface IKycStatusLog extends IBase {
  kyc_id: string;
  old_status?: string;
  new_status: string;
  changed_at?: string;
  comment?: string;

  kycVerification?: IKycVerification;
}
