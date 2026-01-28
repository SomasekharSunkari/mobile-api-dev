import { IBase } from '../../base';

export interface IResetTransactionPin extends IBase {
  code: string;
  user_id: string;
  is_used: boolean;
  expiration_time: string;
}
