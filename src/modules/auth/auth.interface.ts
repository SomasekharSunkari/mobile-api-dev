import { KycVerificationEnum } from '../../database/models/kycVerification/kycVerification.interface';
import { IUser } from '../../database/models/user';

export interface UserWithDetails extends IUser {
  account_verified: boolean;
  kyc_status: KycVerificationEnum;
  recent_kyc: RecentKycStatus | null;
  linked_external_account_status: string | null;
  current_tier: number | null;
  isBlacklistedRegion?: boolean;
}

export interface RecentKycStatus {
  tier_level: number;
  status: KycVerificationEnum;
}
export interface JwtTokenResponse {
  access_token: string;
  expiration: Date;
}

export interface AuthPayload {
  message: string;
  credentials: {
    access_token: string;
    expiration: Date;
    refresh_token: string;
  };
  user: UserWithDetails;
}

export type LoginResponse = AuthPayload;
