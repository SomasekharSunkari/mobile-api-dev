import { IBase } from '../../base';
import { IFiatWallet } from '../fiatWallet';
import { IUser } from '../user';

export enum ExternalAccountStatus {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PENDING = 'pending',
  BLOCKED = 'blocked',
  PENDING_DISCONNECT = 'pending_disconnect',
  ITEM_LOGIN_REQUIRED = 'item_login_required',
  USER_PERMISSION_REVOKED = 'user_permission_revoked',
  USER_ACCOUNT_REVOKED = 'user_account_revoked',
  UNLINKED = 'unlinked',
  CLOSED = 'closed',
  REVOKED = 'revoked',
}

export interface IExternalAccount extends IBase {
  user_id: string;
  fiat_wallet_id?: string;
  external_account_ref: string;
  participant_code?: string;
  provider_kyc_status: string;
  status: ExternalAccountStatus;
  provider: string;

  linked_provider?: string;
  linked_item_ref?: string;
  linked_account_ref?: string;
  linked_access_token?: string;
  linked_processor_token?: string;

  bank_ref?: string;
  bank_name?: string;
  account_number?: string;
  routing_number?: string;
  nuban?: string;
  swift_code?: string;

  expiration_date?: string;
  capabilities?: string[];

  account_name?: string;
  account_type?: string;

  // Relationships
  user?: IUser;
  fiatWallet?: IFiatWallet;
}

export type IExternalAccountPublic = Pick<
  IExternalAccount,
  | 'id'
  | 'user_id'
  | 'fiat_wallet_id'
  | 'status'
  | 'bank_name'
  | 'account_name'
  | 'account_number'
  | 'account_type'
  | 'expiration_date'
  | 'created_at'
  | 'updated_at'
>;
