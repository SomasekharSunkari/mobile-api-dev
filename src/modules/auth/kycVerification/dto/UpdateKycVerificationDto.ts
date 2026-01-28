import { KycVerificationEnum } from '../../../../database/models/kycVerification/kycVerification.interface';

export interface UpdateKycVerificationDto {
  status?: KycVerificationEnum;
  provider_ref?: string;
  submitted_at?: string;
  attempt?: number;
}
