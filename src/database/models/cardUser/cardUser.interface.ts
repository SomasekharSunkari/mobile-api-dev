import { IBase } from '../../base';
import { ICountry } from '../country';
import { IUser } from '../user';

export interface ICardUser extends IBase {
  user_id: string;
  provider_ref?: string;
  provider_status?: string;
  status: ICardUserStatus;
  provider_application_status_reason?: string;
  provider_application_completion_url?: string;
  country_id: string;
  salary?: number;
  ip_address?: string;
  occupation?: string;
  usage_reason?: string;
  monthly_spend?: number;
  wallet_address?: string;
  address_network_name?: string;
  balance?: number;

  user?: IUser;
  country?: ICountry;
}

export const ICardUserStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const;
export type ICardUserStatus = (typeof ICardUserStatus)[keyof typeof ICardUserStatus];
