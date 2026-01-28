import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseTables } from '../../database.table';
import { IRolePermission } from './rolePermission.interface';
import { RolePermissionValidation } from './rolePermission.validation';
import { DatabaseSchema } from '../../database.schema';

export class RolePermissionModel extends BaseModel implements IRolePermission {
  public id: IRolePermission['id'];
  public role_id: IRolePermission['role_id'];
  public created_at: IRolePermission['created_at'];
  public updated_at: IRolePermission['updated_at'];
  public permission_id: IRolePermission['permission_id'];

  static get tableName() {
    return DatabaseSchema.apiService + '.' + DatabaseTables.roles_permissions;
  }

  static get jsonSchema(): JSONSchema {
    return RolePermissionValidation;
  }

  static get relationMappings() {
    return {
      permission: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: `../permissions`,
        join: {
          from: `${DatabaseTables.roles_permissions}.permission_id`,
          to: `${DatabaseTables.permissions}.id`,
        },
      },

      role: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: `../roles`,
        join: {
          from: `${DatabaseTables.roles_permissions}.role_id`,
          to: `${DatabaseTables.roles}.id`,
        },
      },
    };
  }
}
