import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { DoshPointsAccountModel } from '../doshPointsAccount/doshPointsAccount.model';
import { DoshPointsEventModel } from '../doshPointsEvent/doshPointsEvent.model';
import { UserModel } from '../user/user.model';
import { DoshPointsTransactionStatus, IDoshPointsTransaction } from './doshPointsTransaction.interface';
import { DoshPointsTransactionValidationSchema } from './doshPointsTransaction.validation';

export class DoshPointsTransactionModel extends BaseModel implements IDoshPointsTransaction {
  public dosh_points_account_id: IDoshPointsTransaction['dosh_points_account_id'];
  public user_id: IDoshPointsTransaction['user_id'];
  public event_code: IDoshPointsTransaction['event_code'];
  public transaction_type: IDoshPointsTransaction['transaction_type'];
  public amount: IDoshPointsTransaction['amount'];
  public balance_before: IDoshPointsTransaction['balance_before'];
  public balance_after: IDoshPointsTransaction['balance_after'];
  public source_reference?: IDoshPointsTransaction['source_reference'];
  public description?: IDoshPointsTransaction['description'];
  public metadata?: IDoshPointsTransaction['metadata'];
  public status: IDoshPointsTransaction['status'];
  public idempotency_key?: IDoshPointsTransaction['idempotency_key'];
  public processed_at?: IDoshPointsTransaction['processed_at'];

  public doshPointsAccount?: IDoshPointsTransaction['doshPointsAccount'];
  public user?: IDoshPointsTransaction['user'];
  public event?: IDoshPointsTransaction['event'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_transactions}`;
  }

  static publicProperty(properties: (keyof IDoshPointsTransaction)[] = []): (keyof IDoshPointsTransaction)[] {
    return [
      'id',
      'dosh_points_account_id',
      'user_id',
      'event_code',
      'transaction_type',
      'amount',
      'balance_before',
      'balance_after',
      'source_reference',
      'description',
      'status',
      'processed_at',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return DoshPointsTransactionValidationSchema;
  }

  static get relationMappings() {
    return {
      doshPointsAccount: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: DoshPointsAccountModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_transactions}.dosh_points_account_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_accounts}.id`,
        },
      },
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: UserModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_transactions}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
      event: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: DoshPointsEventModel,
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_transactions}.event_code`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.dosh_points_events}.code`,
        },
      },
    };
  }

  static get modifiers() {
    return {
      notDeleted(query) {
        query.whereNull('deleted_at');
      },
      completed(query) {
        query.where('status', DoshPointsTransactionStatus.COMPLETED);
      },
      pending(query) {
        query.where('status', DoshPointsTransactionStatus.PENDING);
      },
    };
  }
}
