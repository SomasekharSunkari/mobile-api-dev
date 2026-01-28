import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseTables } from '../../database.table';

import { DatabaseSchema } from '../../database.schema';
import { IPermission, PermissionModel } from '../permission';
import { IRolePermission } from '../rolePermission';
import { UserModel } from '../user/user.model';
import { IUserRole } from '../userRole';
import { IRole } from './role.interface';
import { RoleValidation } from './role.validation';

export class RoleModel extends BaseModel implements IRole {
  public id: IRole['id'];
  public name: IRole['name'];
  public desc: IRole['desc'];
  public slug: IRole['slug'];
  public created_at: IRole['created_at'];
  public updated_at: IRole['updated_at'];
  public rolePermissions: IRolePermission[];
  public usersRoles: IUserRole[];
  public permissions: IPermission[];

  static get tableName() {
    return DatabaseSchema.apiService + '.' + DatabaseTables.roles;
  }

  static get jsonSchema(): JSONSchema {
    return RoleValidation;
  }

  static get relationMappings() {
    return {
      permissions: {
        relation: BaseModel.ManyToManyRelation,
        modelClass: PermissionModel,
        join: {
          from: `${this.tableName}.id`,
          through: {
            from: `${DatabaseSchema.apiService}.${DatabaseTables.roles_permissions}.role_id`,
            to: `${DatabaseSchema.apiService}.${DatabaseTables.roles_permissions}.permission_id`,
          },
          to: `${DatabaseSchema.apiService}.${DatabaseTables.permissions}.id`,
        },
      },

      users: {
        relation: BaseModel.ManyToManyRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.roles}.id`,
          through: {
            from: `${DatabaseSchema.apiService}.${DatabaseTables.users_roles}.role_id`,
            to: `${DatabaseSchema.apiService}.${DatabaseTables.users_roles}.user_id`,
          },
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },

      usersRoles: {
        relation: BaseModel.ManyToManyRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.roles}.id`,
          through: {
            from: `${DatabaseSchema.apiService}.${DatabaseTables.users_roles}.role_id`,
            to: `${DatabaseSchema.apiService}.${DatabaseTables.users_roles}.user_id`,
          },
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },

      rolePermissions: {
        relation: BaseModel.ManyToManyRelation,
        modelClass: PermissionModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.roles}.id`,
          through: {
            from: `${DatabaseSchema.apiService}.${DatabaseTables.roles_permissions}.role_id`,
            to: `${DatabaseSchema.apiService}.${DatabaseTables.roles_permissions}.permission_id`,
          },
          to: `${DatabaseSchema.apiService}.${DatabaseTables.permissions}.id`,
        },
      },
    };
  }
}
