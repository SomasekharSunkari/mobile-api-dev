import { IBase } from '../../base';
import { IAccountDeactivationLog } from '../accountDeactivationLog/accountDeactivationLog.interface';
import { ICountry } from '../country';
import { IRole } from '../role';
import { IUserProfile } from '../userProfile';

export interface IUser extends IBase {
  first_name: string;
  middle_name?: string;
  last_name: string;
  username: string;
  email: string;
  password: string;
  is_email_verified: boolean;
  country_id: string;

  phone_number?: string;
  is_phone_verified?: boolean;
  phone_number_country_code?: string;
  status?: IUserStatus;
  is_deactivated: boolean;
  require_password_reset?: boolean;
  require_transaction_pin_reset?: boolean;
  disable_login_restrictions: boolean;

  userProfile?: IUserProfile;
  userRoles: IRole[];
  country?: ICountry;
  accountDeactivationLog?: IAccountDeactivationLog;
}

export const UserStatus = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BLOCKED: 'blocked',
  PENDING_DEACTIVATION: 'pending_deactivation',
  PENDING_ACCOUNT_DELETION: 'pending_account_deletion',
  DELETED: 'deleted',
} as const;

export type IUserStatus = (typeof UserStatus)[keyof typeof UserStatus];
