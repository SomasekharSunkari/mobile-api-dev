import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseTables } from '../../database.table';

import { DatabaseSchema } from '../../database.schema';
import { IPasswordReset } from './passwordReset.interface';
import { PasswordResetValidation } from './passwordReset.validation';

export class PasswordResetModel extends BaseModel implements IPasswordReset {
  public id: IPasswordReset['id'];
  public user_id: IPasswordReset['user_id'];
  public code: IPasswordReset['code'];
  public is_used: IPasswordReset['is_used'];
  public expiration_time: IPasswordReset['expiration_time'];
  public created_at: IPasswordReset['created_at'];
  public updated_at: IPasswordReset['updated_at'];
  public deleted_at: IPasswordReset['deleted_at'];
  public user: IPasswordReset['user'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.password_resets}`;
  }

  static get jsonSchema(): JSONSchema {
    return PasswordResetValidation;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.HasOneRelation,
        modelClass: `../models/user`,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.password_resets}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
    };
  }
}
