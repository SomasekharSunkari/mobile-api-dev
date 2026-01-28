import { UserModel } from '../../../database/models/user/user.model';

export interface LoginSecurityCheck {
  identifier: string;
}

export interface LoginSecurityResult {
  allowed: boolean;
  reason?: string;
}

export interface LocationData {
  country?: string;
  region?: string;
  city?: string;
  isVpn?: boolean;
}

export interface LastKnownLocation {
  country?: string;
  region?: string;
  city?: string;
}

export interface RiskCheckResult {
  score: number;
  reason?: string;
}

export interface RiskAssessment {
  score: number;
  reasons: string[];
  locationData?: LocationData;
}

export interface HighRiskLoginResult {
  maskedContact: string;
  reasons: string[];
}

export interface OtpVerificationResult {
  success: boolean;
  user: UserModel;
}

export interface OtpData {
  code: string;
  user_id: string;
  expiration: number;
  attempts: number;
}
