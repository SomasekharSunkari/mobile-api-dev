import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseTables } from '../../database.table';

import { DatabaseSchema } from '../../database.schema';
import { IAccountDeleteRequest } from './accountDeleteRequest.interface';
import { AccountDeleteRequestValidation } from './accountDeleteRequest.validation';

export class AccountDeleteRequestModel extends BaseModel implements IAccountDeleteRequest {
  public id: IAccountDeleteRequest['id'];
  public user_id: IAccountDeleteRequest['user_id'];

  public reasons: IAccountDeleteRequest['reasons'];
  public deleted_on: IAccountDeleteRequest['deleted_on'];
  public created_at: IAccountDeleteRequest['created_at'];
  public updated_at: IAccountDeleteRequest['updated_at'];
  public deleted_at: IAccountDeleteRequest['deleted_at'];

  static get tableName() {
    return DatabaseSchema.apiService + '.' + DatabaseTables.account_delete_requests;
  }

  static get jsonSchema(): JSONSchema {
    return AccountDeleteRequestValidation;
  }

  static get relationMappings() {
    return {
      users: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: `../models/user`,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.account_delete_requests}.user_id`,
        },
      },
    };
  }
}
