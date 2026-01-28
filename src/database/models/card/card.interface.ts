import { IBase } from '../../base';
import { ICardUser } from '../cardUser';
import { ICountry } from '../country';
import { IUser } from '../user';

export interface ICard extends IBase {
  user_id: string;
  card_user_id: string;
  provider_ref?: string;
  status: ICardStatus;
  card_type?: ICardType;
  limit?: number;
  limit_frequency?: string;
  display_name?: string;
  provider_product_id?: string;
  provider_product_ref?: string;
  art_id?: string;
  last_four_digits?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country_id?: string;
  is_freezed: boolean;
  expiration_month?: string;
  expiration_year?: string;
  balance?: number;
  insufficient_funds_decline_count?: number;
  issuance_fee_status?: IIssuanceFeeStatus;
  token_wallets?: string;

  user?: IUser;
  cardUser?: ICardUser;
  country?: ICountry;
}

export const ICardStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  BLOCKED: 'blocked',
  CANCELED: 'canceled',
  EXPIRED: 'expired',
} as const;
export type ICardStatus = (typeof ICardStatus)[keyof typeof ICardStatus];

export const IIssuanceFeeStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type IIssuanceFeeStatus = (typeof IIssuanceFeeStatus)[keyof typeof IIssuanceFeeStatus];

export const ICardType = {
  PHYSICAL: 'physical',
  VIRTUAL: 'virtual',
} as const;
export type ICardType = (typeof ICardType)[keyof typeof ICardType];
