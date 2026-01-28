import { BaseModel } from '../../base';
import { DatabaseSchema } from '../../database.schema';
import { DatabaseTables } from '../../database.table';
import { IRateTransaction, RateTransactionStatus, RateTransactionType } from './rateTransaction.interface';
import { RateTransactionValidationSchema } from './rateTransaction.validation';

export class RateTransactionModel extends BaseModel implements IRateTransaction {
  public user_id: IRateTransaction['user_id'];
  public transaction_id: IRateTransaction['transaction_id'];
  public rate: IRateTransaction['rate'];
  public converted_currency: IRateTransaction['converted_currency'];
  public base_currency: IRateTransaction['base_currency'];
  public amount: IRateTransaction['amount'];
  public converted_amount: IRateTransaction['converted_amount'];
  public expires_at: IRateTransaction['expires_at'];
  public processed_at: IRateTransaction['processed_at'];
  public failed_at: IRateTransaction['failed_at'];
  public completed_at: IRateTransaction['completed_at'];
  public failure_reason: IRateTransaction['failure_reason'];
  public status: IRateTransaction['status'];
  public type: IRateTransaction['type'];
  public provider: IRateTransaction['provider'];
  public user?: IRateTransaction['user'];
  public transaction?: IRateTransaction['transaction'];

  static get tableName() {
    return `${DatabaseSchema.apiService}.${DatabaseTables.rate_transactions}`;
  }

  static publicProperty(properties: (keyof IRateTransaction)[] = []): (keyof IRateTransaction)[] {
    return [
      'id',
      'user_id',
      'transaction_id',
      'rate',
      'converted_currency',
      'base_currency',
      'amount',
      'converted_amount',
      'expires_at',
      'processed_at',
      'failed_at',
      'completed_at',
      'failure_reason',
      'status',
      'type',
      'provider',
      'created_at',
      'updated_at',
      ...properties,
    ];
  }

  static get jsonSchema() {
    return RateTransactionValidationSchema;
  }

  static get relationMappings() {
    return {
      user: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: '../models/user',
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.rate_transactions}.user_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.users}.id`,
        },
      },
      transaction: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: '../models/transaction',
        join: {
          from: `${DatabaseSchema.apiService}.${DatabaseTables.rate_transactions}.transaction_id`,
          to: `${DatabaseSchema.apiService}.${DatabaseTables.transactions}.id`,
        },
      },
    };
  }

  static get modifiers() {
    return {
      notDeleted(query) {
        query.whereNull('deleted_at');
      },
      pending(query) {
        query.where('status', RateTransactionStatus.PENDING);
      },
      initiated(query) {
        query.where('status', RateTransactionStatus.INITIATED);
      },
      processing(query) {
        query.where('status', RateTransactionStatus.PROCESSING);
      },
      completed(query) {
        query.where('status', RateTransactionStatus.COMPLETED);
      },
      failed(query) {
        query.where('status', RateTransactionStatus.FAILED);
      },
      cancelled(query) {
        query.where('status', RateTransactionStatus.CANCELLED);
      },
      buy(query) {
        query.where('type', RateTransactionType.BUY);
      },
      sell(query) {
        query.where('type', RateTransactionType.SELL);
      },
    };
  }
}
