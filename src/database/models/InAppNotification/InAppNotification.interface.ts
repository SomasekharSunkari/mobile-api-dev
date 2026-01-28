import { IBase } from '../../base';

export interface IInAppNotification extends IBase {
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata?: Record<string, any>; // for extra info (e.g., amount, currency, txId)
}
