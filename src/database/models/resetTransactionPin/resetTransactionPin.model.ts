import { JSONSchema } from 'objection';
import { BaseModel } from '../../base';
import { IResetTransactionPin } from './resetTransactionPin.interface';
import { ResetTransactionPinValidationSchema } from './resetTransactionPin.validation';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user/user.model';

export class ResetTransactionPinModel extends BaseModel implements IResetTransactionPin {
  public id: IResetTransactionPin['id'];
  public user_id: IResetTransactionPin['user_id'];
  public code: IResetTransactionPin['code'];
  public is_used: IResetTransactionPin['is_used'];
  public expiration_time: IResetTransactionPin['expiration_time'];
  public created_at: IResetTransactionPin['created_at'];
  public updated_at: IResetTransactionPin['updated_at'];
  public deleted_at: IResetTransactionPin['deleted_at'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.reset_transaction_pins}`;
  }

  static get jsonSchema(): JSONSchema {
    return ResetTransactionPinValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.HasOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.reset_transaction_pins}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
    };
  }
  static get modifiers() {
    return {
      notDeleted(query: any) {
        query.whereNull('deleted_at');
      },
    };
  }
}
