import { IBase } from '../../base';

export interface IAccountDeleteRequest extends IBase {
  reasons: string[];
  deleted_on: string | Date;
  user_id: string;
}
