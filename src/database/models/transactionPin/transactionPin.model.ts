import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { UserModel } from '../user';
import { ITransactionPin } from './transactionPin.interface';
import { TransactionPinValidationSchema } from './transactionPin.validation';

export class TransactionPinModel extends BaseModel implements ITransactionPin {
  public user_id: ITransactionPin['user_id'];
  public pin: ITransactionPin['pin'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.transaction_pins}`;
  }

  static publicProperty(properties: (keyof ITransactionPin)[] = []): (keyof ITransactionPin)[] {
    return ['id', 'user_id', 'created_at', 'updated_at', ...properties];
  }

  static get jsonSchema() {
    return TransactionPinValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.transaction_pins}.user_id`,
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
