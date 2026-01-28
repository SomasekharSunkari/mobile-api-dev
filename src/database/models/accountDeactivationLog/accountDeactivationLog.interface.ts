import { IBase } from '../../base';
import { IUser } from '../user';

export enum AccountDeactivationStatus {
  DEACTIVATED = 'deactivated',
  ACTIVATED = 'activated',
}

export interface IAccountDeactivationStatusRedis {
  expires_at: string | Date;
  status: AccountDeactivationStatus;
}

export interface IAccountDeactivationLog extends IBase {
  user_id: string;
  reasons: string[];
  is_active_log: boolean;
  status: AccountDeactivationStatus;
  deactivated_on: string | Date;
  deactivated_by_user_id: string;
  reactivated_on: string | Date | null;
  reactivated_by_user_id: string | null;
  reactivation_description?: string;
  reactivation_support_document_url?: string;
  user: IUser;
  deactivatedBy: IUser | null;
  reactivatedBy: IUser | null;
}
