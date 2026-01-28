import { IBase } from '../../base';

export interface ITransactionPin extends IBase {
  user_id: string;
  pin: string;
}
