import { IBase } from '../../base';
import { IUser } from '../user';

export enum KycVerificationEnum {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  REJECTED = 'rejected',
  APPROVED = 'approved',
  NOT_STARTED = 'not_started',
  SUBMITTED = 'submitted',
  RESTARTED = 'restarted',
  RESUBMISSION_REQUESTED = 'resubmission_requested',
}

export interface IKycVerification extends IBase {
  user_id: string;
  provider: string;
  provider_ref: string;
  attempt: number;
  status: KycVerificationEnum;
  error_message?: string;
  submitted_at?: string;
  reviewed_at?: string;
  metadata?: Record<string, any>;
  provider_status?: string;
  tier_config_id: string;
  provider_verification_type?: string;

  tier_config_verification_requirement_id: string;

  user?: IUser;
}
