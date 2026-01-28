import { IBase } from '../../base';

export interface IBankBeneficiary extends IBase {
  user_id: string;
  currency: string;
  alias_name: string;
  avatar_url?: string;
  account_number?: string;
  iban?: string;
  account_name?: string;
  bank_name?: string;
  bank_code?: string;
  swift_code?: string;
  routing_number?: string;
  bank_logo?: string;
  bank_short_name?: string;
  bank_country?: string;
  bank_address?: string;
  bank_city?: string;
  bank_state?: string;
  bank_zip?: string;
  bank_phone?: string;
  bank_email?: string;
  bank_website?: string;
  bank_ref?: string;
}
