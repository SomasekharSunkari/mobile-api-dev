import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { RoleModel } from '../role/role.model';
import { IPermission } from './permission.interface';
import { PermissionValidation } from './permission.validation';

export class PermissionModel extends BaseModel implements IPermission {
  public id: IPermission['id'];
  public desc: IPermission['desc'];
  public name: IPermission['name'];
  public slug: IPermission['slug'];
  public created_at: IPermission['created_at'];
  public updated_at: IPermission['updated_at'];

  static get tableName() {
    return DatabaseSchema.apiService + '.' + DatabaseTables.permissions;
  }

  static get jsonSchema(): JSONSchema {
    return PermissionValidation;
  }

  static get relationMappings() {
    return {
      roles: {
        relation: BaseModel.ManyToManyRelation,
        modelClass: RoleModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.permissions}.id`,
          through: {
            from: `${DatabaseSchema.apiService}.${DatabaseTables.roles_permissions}.permission_id`,
            to: `${DatabaseSchema.apiService}.${DatabaseTables.roles_permissions}.role_id`,
          },
          to: `${DatabaseSchema.apiService}.${DatabaseTables.roles}.id`,
        },
      },
    };
  }
}
