import { JSONSchema } from 'objection';

import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { RoleModel } from '../role';
import { IUserRole } from './userRole.interface';
import { UserRoleValidation } from './userRole.validation';
import { UserModel } from '../user';

export class UserRoleModel extends BaseModel implements IUserRole {
  public role_id: IUserRole['role_id'];
  public user_id: IUserRole['user_id'];
  public role: IUserRole['role'];

  static get tableName() {
    return DatabaseSchema.apiService + '.' + DatabaseTables.users_roles;
  }

  static get jsonSchema(): JSONSchema {
    return UserRoleValidation;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.users_roles}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },

      role: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: RoleModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.users_roles}.role_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.roles}.id`,
        },
      },
    };
  }
}
