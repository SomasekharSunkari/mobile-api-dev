import { IPermission } from '../permission';
import { IBase } from '../../base';
import { IRolePermission } from '../rolePermission';
import { IUserRole } from '../userRole';

export interface IRole extends IBase {
  name: string;
  desc?: string;
  slug: string;
  rolePermissions: IRolePermission[];
  usersRoles: IUserRole[];
  permissions: IPermission[];
}
