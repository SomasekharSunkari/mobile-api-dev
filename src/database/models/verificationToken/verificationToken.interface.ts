import { IBase } from '../../base';
import { IUser } from '../user';

export interface IVerificationToken extends IBase {
  user_id: string;
  token_identifier: string;
  verification_type: IVerificationType;
  expires_at: Date | string;
  is_used: boolean;
  used_at?: Date | string;

  user?: IUser;
}

export const VerificationType = {
  CHANGE_PIN: 'change_pin',
  RESET_PASSWORD: 'reset_password',
  EMAIL_VERIFICATION: 'email_verification',
  PHONE_VERIFICATION: 'phone_verification',
  TWO_FACTOR_AUTH: 'two_factor_auth',
  ACCOUNT_DEACTIVATION: 'account_deactivation',
  WITHDRAW_FUNDS: 'withdraw_funds',
  CHANGE_PASSWORD: 'change_password',
  RESET_TRANSACTION_PIN: 'reset_transaction_pin',
} as const;

export type IVerificationType = (typeof VerificationType)[keyof typeof VerificationType];
