import { IBase } from '../../base';

export interface IAccountVerification extends IBase {
  code: string;
  user_id?: string;
  email: string;
  is_used: boolean;
  expiration_time: string | Date;
}
