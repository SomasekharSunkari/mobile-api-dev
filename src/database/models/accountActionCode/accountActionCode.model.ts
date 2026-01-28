import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user';
import { IAccountActionCode } from './accountActionCode.interface';
import { AccountActionCodeValidation } from './accountActionCode.validation';

export class AccountActionCodeModel extends BaseModel implements IAccountActionCode {
  public id: IAccountActionCode['id'];
  public user_id: IAccountActionCode['user_id'];
  public code: IAccountActionCode['code'];
  public email: IAccountActionCode['email'];
  public type: IAccountActionCode['type'];
  public expires_at: IAccountActionCode['expires_at'];
  public is_used: IAccountActionCode['is_used'];
  public used_at: IAccountActionCode['used_at'];
  public created_at: IAccountActionCode['created_at'];
  public updated_at: IAccountActionCode['updated_at'];
  public deleted_at: IAccountActionCode['deleted_at'];

  public user: IAccountActionCode['user'];

  static get tableName() {
    return DatabaseSchema.apiService + '.' + DatabaseTables.account_action_codes;
  }

  static get jsonSchema(): JSONSchema {
    return AccountActionCodeValidation;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.account_action_codes}.user_id`,
        },
      },
    };
  }
}
