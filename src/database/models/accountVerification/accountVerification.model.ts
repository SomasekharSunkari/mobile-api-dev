import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseTables } from '../../database.table';

import { DatabaseSchema } from '../../database.schema';
import { IAccountVerification } from './accountVerification.interface';
import { AccountVerificationValidation } from './accountVerification.validation';

export class AccountVerificationModel extends BaseModel implements IAccountVerification {
  public id: IAccountVerification['id'];
  public user_id: IAccountVerification['user_id'];
  public code: IAccountVerification['code'];
  public is_used: IAccountVerification['is_used'];
  public expiration_time: IAccountVerification['expiration_time'];
  public created_at: IAccountVerification['created_at'];
  public updated_at: IAccountVerification['updated_at'];
  public deleted_at: IAccountVerification['deleted_at'];
  public email: IAccountVerification['email'];

  static get tableName() {
    return DatabaseSchema.apiService + '.' + DatabaseTables.account_verifications;
  }

  static get jsonSchema(): JSONSchema {
    return AccountVerificationValidation;
  }

  static get relationMappings() {
    return {
      users: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: `../models/user`,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.account_verifications}.user_id`,
        },
      },
    };
  }
}
