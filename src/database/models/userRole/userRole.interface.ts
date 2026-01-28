import { IBase } from '../../base';
import { IRole } from '../role';

export interface IUserRole extends IBase {
  role_id: string;
  user_id: string;
  role: IRole;
}
